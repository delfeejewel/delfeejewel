import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260522122019 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "product_review" add column if not exists "customer_name" text not null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "product_review" drop column if exists "customer_name";`);
  }

}
