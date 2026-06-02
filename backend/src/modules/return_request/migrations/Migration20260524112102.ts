import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260524112102 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "return_request" ("id" text not null, "order_id" text not null, "customer_id" text not null, "status" text check ("status" in ('pending', 'approved', 'rejected', 'received', 'completed', 'canceled')) not null default 'pending', "reason" text not null, "message" text null, "rejected_reason" text null, "refund_amount" integer null, "currency_code" text not null, "approved_at" timestamptz null, "rejected_at" timestamptz null, "received_at" timestamptz null, "processed_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "return_request_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_return_request_deleted_at" ON "return_request" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_return_request_customer_id" ON "return_request" ("customer_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_return_request_order_id" ON "return_request" ("order_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_return_request_status" ON "return_request" ("status") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "return_request_item" ("id" text not null, "line_item_id" text not null, "variant_id" text null, "product_id" text null, "title" text not null, "thumbnail" text null, "quantity" integer not null, "unit_price" integer not null, "reason" text null, "return_request_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "return_request_item_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_return_request_item_return_request_id" ON "return_request_item" ("return_request_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_return_request_item_deleted_at" ON "return_request_item" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "return_request_item" add constraint "return_request_item_return_request_id_foreign" foreign key ("return_request_id") references "return_request" ("id") on update cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "return_request_item" drop constraint if exists "return_request_item_return_request_id_foreign";`);

    this.addSql(`drop table if exists "return_request" cascade;`);

    this.addSql(`drop table if exists "return_request_item" cascade;`);
  }

}
