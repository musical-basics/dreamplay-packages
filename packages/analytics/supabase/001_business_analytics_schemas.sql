-- @dreamplay/analytics
-- Migration: create separate analytics schemas in one Supabase project.
--
-- Option B layout:
--   dreamplay_analytics.analytics_logs
--   musicalbasics_analytics.analytics_logs
--   concert_analytics.analytics_logs
--
-- Run this in the Supabase SQL editor for the shared business analytics
-- project. The migration is idempotent and safe to re-run.

create extension if not exists pgcrypto;

do $$
declare
  schema_name text;
  schema_names text[] := array[
    'dreamplay_analytics',
    'musicalbasics_analytics',
    'concert_analytics'
  ];
begin
  foreach schema_name in array schema_names loop
    execute format('create schema if not exists %I', schema_name);

    execute format($sql$
      create table if not exists %I.analytics_logs (
        id uuid primary key default gen_random_uuid(),
        created_at timestamptz not null default now(),
        event_name text not null,
        path text not null,
        session_id text not null,
        anonymous_id text,
        tracker_version text,
        metadata jsonb not null default '{}'::jsonb,
        ip_address text,
        user_agent text,
        country text,
        city text,
        region text,
        constraint analytics_logs_metadata_object_check
          check (jsonb_typeof(metadata) = 'object')
      )
    $sql$, schema_name);

    execute format($sql$
      create table if not exists %I.ip_email_map (
        id uuid primary key default gen_random_uuid(),
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        ip_address text not null,
        email text not null,
        note text,
        unique (ip_address, email)
      )
    $sql$, schema_name);

    execute format(
      'create index if not exists %I on %I.analytics_logs (created_at desc)',
      schema_name || '_analytics_logs_created_at_idx',
      schema_name
    );

    execute format(
      'create index if not exists %I on %I.analytics_logs (event_name)',
      schema_name || '_analytics_logs_event_name_idx',
      schema_name
    );

    execute format(
      'create index if not exists %I on %I.analytics_logs (session_id)',
      schema_name || '_analytics_logs_session_id_idx',
      schema_name
    );

    execute format(
      'create index if not exists %I on %I.analytics_logs (anonymous_id)',
      schema_name || '_analytics_logs_anonymous_id_idx',
      schema_name
    );

    execute format(
      'create index if not exists %I on %I.analytics_logs (ip_address)',
      schema_name || '_analytics_logs_ip_address_idx',
      schema_name
    );

    execute format(
      'create index if not exists %I on %I.analytics_logs using gin (metadata)',
      schema_name || '_analytics_logs_metadata_gin_idx',
      schema_name
    );

    execute format(
      'create index if not exists %I on %I.analytics_logs ((metadata->>''sid''))',
      schema_name || '_analytics_logs_sid_idx',
      schema_name
    );

    execute format(
      'create index if not exists %I on %I.analytics_logs ((metadata->>''cid''))',
      schema_name || '_analytics_logs_cid_idx',
      schema_name
    );

    execute format(
      'create index if not exists %I on %I.analytics_logs ((metadata->>''email''))',
      schema_name || '_analytics_logs_email_idx',
      schema_name
    );

    execute format(
      'create index if not exists %I on %I.ip_email_map (ip_address)',
      schema_name || '_ip_email_map_ip_address_idx',
      schema_name
    );

    execute format($sql$
      create or replace view %I.email_attributed_pageviews as
      select *
      from %I.analytics_logs
      where event_name = 'pageview'
        and metadata ? 'sid'
        and metadata ? 'cid'
    $sql$, schema_name, schema_name);

    -- These schemas are intended to be written from server-side ingestion routes
    -- using the Supabase service role key. Do not grant anon/authenticated access
    -- unless you add RLS policies or read-only dashboard views intentionally.
    execute format('grant usage on schema %I to service_role', schema_name);
    execute format(
      'grant select, insert, update, delete on all tables in schema %I to service_role',
      schema_name
    );
    execute format(
      'alter default privileges in schema %I grant select, insert, update, delete on tables to service_role',
      schema_name
    );
  end loop;
end $$;

-- Optional sanity check after running:
--
-- select table_schema, table_name
-- from information_schema.tables
-- where table_schema in ('dreamplay_analytics', 'musicalbasics_analytics', 'concert_analytics')
-- order by table_schema, table_name;
