import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260604130920 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "otp_code" ("id" text not null, "email" text not null, "code_hash" text not null, "expires_at" timestamptz not null, "consumed_at" timestamptz null, "attempts" integer not null default 0, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "otp_code_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_otp_code_deleted_at" ON "otp_code" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "otp_code" cascade;`);
  }

}
