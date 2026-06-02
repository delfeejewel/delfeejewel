import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260525051641 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "qr_code" drop constraint if exists "qr_code_code_unique";`);
    this.addSql(`create table if not exists "qr_code" ("id" text not null, "code" text not null, "variant_id" text not null, "product_id" text not null, "sku" text null, "status" text check ("status" in ('active', 'void')) not null default 'active', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "qr_code_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_qr_code_deleted_at" ON "qr_code" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_qr_code_code_unique" ON "qr_code" ("code") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_qr_code_variant_id" ON "qr_code" ("variant_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_qr_code_product_id" ON "qr_code" ("product_id") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "qr_code" cascade;`);
  }

}
