import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260630100955 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "appointment" drop constraint if exists "appointment_reference_unique";`);
    this.addSql(`create table if not exists "appointment" ("id" text not null, "reference" text not null, "name" text not null, "email" text not null, "phone" text not null, "service_type" text not null, "date" text not null, "slot" text not null, "status" text check ("status" in ('confirmed', 'completed', 'cancelled')) not null default 'confirmed', "notes" text null, "customer_id" text null, "cancelled_reason" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "appointment_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_appointment_reference_unique" ON "appointment" ("reference") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_appointment_deleted_at" ON "appointment" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "appointment_setting" ("id" text not null, "slot_minutes" integer not null default 30, "capacity_per_slot" integer not null default 1, "weekdays" jsonb not null default '[1,2,3,4,5,6]', "open_time" text not null default '11:00', "close_time" text not null default '19:00', "lead_hours" integer not null default 24, "horizon_days" integer not null default 30, "closed_dates" jsonb not null default '[]', "enabled" boolean not null default true, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "appointment_setting_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_appointment_setting_deleted_at" ON "appointment_setting" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "appointment" cascade;`);

    this.addSql(`drop table if exists "appointment_setting" cascade;`);
  }

}
