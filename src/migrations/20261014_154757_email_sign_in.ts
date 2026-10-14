import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users" ADD COLUMN "login_code_hash" varchar;
  ALTER TABLE "users" ADD COLUMN "login_code_expires_at" timestamp(3) with time zone;
  ALTER TABLE "users" ADD COLUMN "login_code_attempts" numeric;
  ALTER TABLE "users" ADD COLUMN "login_code_sent_at" timestamp(3) with time zone;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users" DROP COLUMN "login_code_hash";
  ALTER TABLE "users" DROP COLUMN "login_code_expires_at";
  ALTER TABLE "users" DROP COLUMN "login_code_attempts";
  ALTER TABLE "users" DROP COLUMN "login_code_sent_at";`)
}
