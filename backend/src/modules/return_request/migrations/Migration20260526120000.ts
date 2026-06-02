import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260526120000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "return_request" add column if not exists "type" text check ("type" in ('refund', 'exchange')) not null default 'refund';`);
    this.addSql(`alter table if exists "return_request" add column if not exists "replacement_order_id" text null;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_return_request_type" ON "return_request" ("type") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "return_request_item" add column if not exists "exchange_variant_id" text null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_return_request_type";`);
    this.addSql(`alter table if exists "return_request" drop column if exists "type";`);
    this.addSql(`alter table if exists "return_request" drop column if exists "replacement_order_id";`);
    this.addSql(`alter table if exists "return_request_item" drop column if exists "exchange_variant_id";`);
  }

}
