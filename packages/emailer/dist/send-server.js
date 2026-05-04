import { Resend } from "resend";
import { createEmailSupabaseClient, emailError, emailJson, readJson, resolveEmailEngineEnv, } from "./database.js";
import { appendEmailAttributionToLinks, injectOpenPixel, pickTrackingBaseUrl, } from "./tracking-server.js";
import { applyAllMergeTags, applyAllMergeTagsWithLog, globalTemplateVars, injectPreheader, renderTemplate, } from "./template.js";
export async function sendEmailCampaign(payload, options = {}) {
    const env = resolveEmailEngineEnv(options);
    if (!env.resendApiKey)
        throw new Error("Missing RESEND_API_KEY");
    const supabase = createEmailSupabaseClient(options);
    const resend = new Resend(env.resendApiKey);
    const logs = [];
    const log = (level, message, meta) => {
        logs.push({ ts: new Date().toISOString(), level, message, ...(meta ?? {}) });
    };
    let sendLogId = null;
    let sendLogError = null;
    try {
        const { data, error } = await supabase
            .from("send_logs")
            .insert({ campaign_id: payload.campaignId, triggered_by: payload.triggeredBy ?? "agent", status: "pending" })
            .select("id")
            .single();
        if (error)
            sendLogError = `${error.message} (code: ${error.code ?? "?"})`;
        else
            sendLogId = data?.id ?? null;
    }
    catch (error) {
        sendLogError = error instanceof Error ? error.message : "send_logs insert failed";
    }
    const persistLogs = async (done, stats) => {
        if (!sendLogId)
            return;
        await supabase
            .from("send_logs")
            .update({
            status: done ? "success" : "error",
            summary: stats,
            raw_log: logs.map((entry) => `[${entry.ts}] [${entry.level.toUpperCase()}] ${entry.message}`).join("\n"),
        })
            .eq("id", sendLogId);
    };
    let stats = { sent: 0, failed: 0, total: 0 };
    try {
        log("info", "Fetching campaign data");
        const { data: campaignData, error: campaignError } = await supabase
            .from("campaigns")
            .select("*")
            .eq("id", payload.campaignId)
            .single();
        if (campaignError || !campaignData) {
            throw new Error(`Campaign not found: ${campaignError?.message ?? "unknown"}`);
        }
        const campaign = campaignData;
        let trackingCampaignId = payload.campaignId;
        if (campaign.is_template) {
            const today = new Date().toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
            });
            const { data: child, error } = await supabase
                .from("campaigns")
                .insert({
                name: `${campaign.name} (Send ${today})`,
                subject_line: campaign.subject_line,
                html_content: campaign.html_content,
                status: "draft",
                is_template: false,
                parent_template_id: payload.campaignId,
                workspace: campaign.workspace,
                email_type: campaign.email_type || "campaign",
                variable_values: stripSubscriberTargeting(campaign.variable_values),
            })
                .select("id")
                .single();
            if (error || !child)
                throw new Error(`Failed to create child campaign: ${error?.message ?? "unknown"}`);
            trackingCampaignId = child.id;
        }
        const variableValues = asJsonObject(campaign.variable_values);
        let recipientQuery = supabase.from("subscribers").select("*").eq("status", "active");
        const lockedSubscriberId = stringFrom(variableValues.subscriber_id);
        const lockedSubscriberIds = stringArrayFrom(variableValues.subscriber_ids);
        const targetTag = stringFrom(variableValues.target_tag);
        if (payload.overrideSubscriberIds?.length) {
            recipientQuery = recipientQuery.in("id", payload.overrideSubscriberIds);
        }
        else if (lockedSubscriberIds.length > 0) {
            recipientQuery = recipientQuery.in("id", lockedSubscriberIds);
        }
        else if (lockedSubscriberId) {
            recipientQuery = recipientQuery.eq("id", lockedSubscriberId);
        }
        else if (targetTag) {
            recipientQuery = recipientQuery.eq("workspace", campaign.workspace).contains("tags", [targetTag]);
        }
        else if (campaign.workspace) {
            throw new Error("Refusing to send without explicit targeting. Set subscriber_id, subscriber_ids, target_tag, or overrideSubscriberIds.");
        }
        const { data: recipientData, error: recipientError } = await recipientQuery;
        if (recipientError || !recipientData?.length) {
            throw new Error(`No active subscribers found: ${recipientError?.message ?? "none matched"}`);
        }
        const recipients = recipientData;
        stats = { sent: 0, failed: 0, total: recipients.length };
        const htmlGlobal = renderTemplate(campaign.html_content ?? "", globalTemplateVars(variableValues));
        const htmlWithPreheader = injectPreheader(htmlGlobal, variableValues.preview_text);
        const htmlBase = options.appendUnsubscribeFooter === false
            ? htmlWithPreheader
            : htmlWithPreheader + unsubscribeFooter();
        const resolvedFromEmail = payload.fromEmail || stringFrom(variableValues.from_email) || env.resendFromEmail || null;
        const resolvedFromName = payload.fromName || stringFrom(variableValues.from_name) || null;
        const trackingBaseUrl = pickTrackingBaseUrl(resolvedFromEmail, options);
        const sentRecords = [];
        let firstResendEmailId = null;
        for (const [index, subscriber] of recipients.entries()) {
            try {
                const unsubscribeUrl = `${trackingBaseUrl}/unsubscribe?s=${subscriber.id}&c=${trackingCampaignId}&w=${campaign.workspace ?? ""}`;
                const { html: mergedHtml, log: mergeTagLog } = await applyAllMergeTagsWithLog(htmlBase, subscriber, {
                    unsubscribe_url: unsubscribeUrl,
                    discount_code: variableValues.discount_code ?? "",
                });
                let personalHtml = mergedHtml;
                if (payload.clickTracking !== false) {
                    personalHtml = appendEmailAttributionToLinks(personalHtml, {
                        subscriberId: subscriber.id,
                        campaignId: trackingCampaignId,
                        clickTrackingMode: payload.clickTrackingMode ?? "append",
                        trackingBaseUrl,
                    });
                }
                if (payload.openTracking !== false) {
                    personalHtml = injectOpenPixel(personalHtml, {
                        subscriberId: subscriber.id,
                        campaignId: trackingCampaignId,
                        trackingBaseUrl,
                    });
                }
                const subject = await applyAllMergeTags(campaign.subject_line ?? "", subscriber);
                const from = resolvedFromName && resolvedFromEmail
                    ? `${resolvedFromName} <${resolvedFromEmail}>`
                    : resolvedFromEmail ?? "DreamPlay <hello@email.dreamplaypianos.com>";
                const sendPayload = {
                    from,
                    to: subscriber.email,
                    subject,
                    html: personalHtml,
                    headers: {
                        "List-Unsubscribe": `<${unsubscribeUrl}>`,
                        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
                    },
                    click_tracking: payload.resendClickTracking ?? false,
                    open_tracking: payload.resendOpenTracking ?? false,
                };
                const { data, error } = await resend.emails.send(sendPayload);
                if (error) {
                    stats.failed += 1;
                    log("error", `[${index + 1}/${recipients.length}] ${subscriber.email}: ${error.message}`);
                }
                else {
                    stats.sent += 1;
                    if (!firstResendEmailId && data?.id)
                        firstResendEmailId = data.id;
                    sentRecords.push({
                        campaign_id: trackingCampaignId,
                        subscriber_id: subscriber.id,
                        sent_at: new Date().toISOString(),
                        variant_sent: campaign.subject_line ?? null,
                        merge_tag_log: mergeTagLog,
                    });
                    log("success", `[${index + 1}/${recipients.length}] sent to ${subscriber.email}`);
                }
            }
            catch (error) {
                stats.failed += 1;
                log("error", `[${index + 1}/${recipients.length}] ${subscriber.email}: ${error instanceof Error ? error.message : String(error)}`);
            }
            if ((options.rateLimitMs ?? 100) > 0 && index < recipients.length - 1) {
                await new Promise((resolve) => setTimeout(resolve, options.rateLimitMs ?? 100));
            }
        }
        if (sentRecords.length > 0) {
            await supabase.from("sent_history").insert(sentRecords);
        }
        await supabase
            .from("campaigns")
            .update({
            status: "completed",
            updated_at: new Date().toISOString(),
            total_recipients: stats.sent,
            total_audience_size: recipients.length,
            ...(firstResendEmailId ? { resend_email_id: firstResendEmailId } : {}),
        })
            .eq("id", trackingCampaignId);
        await persistLogs(true, stats);
        return { done: true, stats, logLines: logs.length, sendLogId, sendLogError };
    }
    catch (error) {
        log("error", error instanceof Error ? error.message : String(error));
        await persistLogs(false, stats);
        return { done: false, stats, logLines: logs.length, sendLogId, sendLogError };
    }
}
export function createEmailSendHandler(options = {}) {
    return async function POST(request) {
        const body = await readJson(request);
        if (!isRecord(body) || typeof body.campaignId !== "string") {
            return emailError("campaignId is required", 400);
        }
        const result = await sendEmailCampaign(body, options);
        return emailJson(result, result.done ? 200 : 500);
    };
}
function stripSubscriberTargeting(value) {
    const { subscriber_id: _subscriberId, subscriber_ids: _subscriberIds, ...rest } = value ?? {};
    return rest;
}
function asJsonObject(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function stringFrom(value) {
    return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}
function stringArrayFrom(value) {
    return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}
function unsubscribeFooter() {
    return `
<div style="margin-top:40px;padding-top:20px;border-top:1px solid #e5e7eb;text-align:center;font-size:12px;color:#6b7280;font-family:sans-serif;">
  <p style="margin:0;">No longer want to receive these emails? <a href="{{unsubscribe_url}}" style="color:#6b7280;text-decoration:underline;">Unsubscribe here</a>.</p>
</div>`;
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
//# sourceMappingURL=send-server.js.map