import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_deployments_build_status" AS ENUM('queued', 'building', 'live', 'failed', 'canceled');
  ALTER TABLE "deployments" ADD COLUMN "build_status" "enum_deployments_build_status";
  ALTER TABLE "deployments" ADD COLUMN "cloudflare_id" varchar;
  ALTER TABLE "deployments" ADD COLUMN "finished_at" timestamp(3) with time zone;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "deployments" DROP COLUMN "build_status";
  ALTER TABLE "deployments" DROP COLUMN "cloudflare_id";
  ALTER TABLE "deployments" DROP COLUMN "finished_at";
  DROP TYPE "public"."enum_deployments_build_status";`)
}
