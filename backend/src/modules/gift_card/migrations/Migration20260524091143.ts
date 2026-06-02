import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260524091143 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "gift_card" drop constraint if exists "gift_card_code_unique";`);
    this.addSql(`create table if not exists "gift_card" ("id" text not null, "code" text not null, "value" integer not null, "balance" integer not null, "currency_code" text not null, "status" text check ("status" in ('active', 'redeemed', 'expired', 'void')) not null default 'active', "expires_at" timestamptz null, "purchaser_order_id" text null, "purchaser_customer_id" text null, "recipient_email" text not null, "recipient_name" text null, "message" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "gift_card_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_gift_card_deleted_at" ON "gift_card" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_gift_card_code_unique" ON "gift_card" ("code") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_gift_card_recipient_email" ON "gift_card" ("recipient_email") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_gift_card_status" ON "gift_card" ("status") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "gift_card" cascade;`);
  }

}
