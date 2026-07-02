import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260627201920 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "newsletter_subscriber" drop constraint if exists "newsletter_subscriber_email_unique";`);
    this.addSql(`create table if not exists "marketing_campaign" ("id" text not null, "name" text not null, "subject" text not null, "body_html" text not null, "audience_type" text check ("audience_type" in ('subscribers', 'segment', 'all_customers', 'everyone')) not null default 'subscribers', "audience_segment" text check ("audience_segment" in ('new', 'repeat', 'regular')) null, "status" text check ("status" in ('draft', 'sending', 'sent', 'failed')) not null default 'draft', "scheduled_at" timestamptz null, "total_recipients" integer not null default 0, "sent_count" integer not null default 0, "failed_count" integer not null default 0, "sent_at" timestamptz null, "last_error" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "marketing_campaign_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketing_campaign_deleted_at" ON "marketing_campaign" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "newsletter_subscriber" ("id" text not null, "email" text not null, "status" text check ("status" in ('subscribed', 'unsubscribed')) not null default 'subscribed', "source" text null, "customer_id" text null, "consent_at" timestamptz null, "unsubscribed_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "newsletter_subscriber_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_newsletter_subscriber_email_unique" ON "newsletter_subscriber" ("email") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_newsletter_subscriber_deleted_at" ON "newsletter_subscriber" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "marketing_campaign" cascade;`);

    this.addSql(`drop table if exists "newsletter_subscriber" cascade;`);
  }

}
