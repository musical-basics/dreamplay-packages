import type { EmailSubscriberRow, JsonObject } from "./schema.js";

export const STANDARD_TAGS = [
  "first_name",
  "last_name",
  "email",
  "subscriber_id",
  "location_city",
  "location_country",
  "discount_code",
  "unsubscribe_url",
  "unsubscribe_link",
  "unsubscribe_link_url",
] as const;

const STANDARD_TAG_SET = new Set<string>(STANDARD_TAGS);

export function renderTemplate(
  html: string,
  assets: Record<string, string>,
  subscriberTags: string[] = []
): string {
  let result = html;

  result = result.replace(
    /\{\{#if\s+tag_(\w+)\}\}([\s\S]*?)\{\{\/?endif\}\}/gi,
    (_match, tagName: string, content: string) => {
      const hasTag = subscriberTags.some((tag) => tag.toLowerCase() === tagName.toLowerCase());
      return hasTag ? content.trim() : "";
    }
  );

  for (const [key, value] of Object.entries(assets)) {
    const fitValue = assets[`${key}_fit`];
    if (!fitValue) continue;

    const imgTagRegex = new RegExp(`(<img[^>]*src=["']\\{\\{${key}\\}\\}["'][^>]*>)`, "gi");
    result = result.replace(imgTagRegex, (match) => {
      if (match.match(/style=["'][^"']*["']/i)) {
        return match.replace(/style=(["'])(.*?)\1/i, (_styleMatch, quote, styleContent) => {
          let newStyle = styleContent as string;
          if (newStyle.includes("object-fit:")) {
            newStyle = newStyle.replace(/object-fit:\s*[\w-]+/i, `object-fit: ${fitValue}`);
          } else {
            newStyle = `${newStyle}; object-fit: ${fitValue}`;
          }
          if (!newStyle.includes("max-width:")) newStyle = `${newStyle}; max-width: 100%`;
          if (!newStyle.includes("height:")) newStyle = `${newStyle}; height: auto`;
          return `style=${quote}${newStyle}${quote}`;
        });
      }

      const style = ` style="object-fit: ${fitValue}; max-width: 100%; height: auto;"`;
      return match.endsWith("/>") ? match.slice(0, -2) + `${style} />` : match.slice(0, -1) + `${style}>`;
    });
  }

  for (const [key, value] of Object.entries(assets)) {
    result = result.replace(new RegExp(`\\{\\{${escapeRegExp(key)}\\}\\}`, "g"), value || "");
  }

  return result;
}

export function injectPreheader(html: string, previewText: unknown): string {
  if (typeof previewText !== "string" || !previewText.trim()) return html;
  const safePreview = escapeHtml(previewText.trim());
  const preheaderHtml =
    `<!--[preheader]--><div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${safePreview}</div><!--[/preheader]-->`;
  const bodyMatch = html.match(/<body[^>]*>/i);
  if (!bodyMatch) return preheaderHtml + html;
  const insertPos = html.indexOf(bodyMatch[0]) + bodyMatch[0].length;
  return html.slice(0, insertPos) + preheaderHtml + html.slice(insertPos);
}

export async function applyAllMergeTags(
  html: string,
  subscriber: EmailSubscriberRow,
  dynamicVars: Record<string, unknown> = {}
): Promise<string> {
  return applyAllMergeTagsWithLog(html, subscriber, dynamicVars).then((result) => result.html);
}

export async function applyAllMergeTagsWithLog(
  html: string,
  subscriber: EmailSubscriberRow,
  dynamicVars: Record<string, unknown> = {}
): Promise<{ html: string; log: Array<Record<string, unknown>> }> {
  const resolved = subscriberMergeTags(subscriber, dynamicVars);
  const log: Array<Record<string, unknown>> = [];

  let result = html.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    const value = resolved[key];
    if (value === undefined || value === null || value === "") return match;
    log.push({ tag: key, value: String(value), source: "subscriber_or_dynamic" });
    return String(value);
  });

  if (dynamicVars.unsubscribe_url) {
    for (const alias of ["unsubscribe_link_url", "unsubscribe_link"]) {
      result = result.replace(new RegExp(`\\{\\{${alias}\\}\\}`, "g"), String(dynamicVars.unsubscribe_url));
    }
  }

  return { html: result, log };
}

export function globalTemplateVars(variableValues: JsonObject | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(variableValues ?? {})) {
    if (STANDARD_TAG_SET.has(key)) continue;
    if (typeof value === "string") out[key] = value;
    if (typeof value === "number" || typeof value === "boolean") out[key] = String(value);
  }
  return out;
}

function subscriberMergeTags(
  subscriber: EmailSubscriberRow,
  dynamicVars: Record<string, unknown>
): Record<string, unknown> {
  return {
    ...dynamicVars,
    first_name: subscriber.first_name ?? "",
    last_name: subscriber.last_name ?? "",
    email: subscriber.email,
    subscriber_id: subscriber.id,
    location_city: typeof subscriber.shipping_city === "string" ? subscriber.shipping_city : "",
    location_country: typeof subscriber.country === "string" ? subscriber.country : "",
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
