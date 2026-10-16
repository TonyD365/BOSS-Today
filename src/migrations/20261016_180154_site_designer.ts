import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_site_design_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__site_design_v_version_status" AS ENUM('draft', 'published');
  ALTER TYPE "public"."enum_deployments_reason" ADD VALUE 'design';
  CREATE TABLE "site_design" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"design" jsonb,
  	"_status" "enum_site_design_status" DEFAULT 'draft',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "_site_design_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"version_design" jsonb,
  	"version__status" "enum__site_design_v_version_status" DEFAULT 'draft',
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  ALTER TABLE "users_permissions" ALTER COLUMN "value" SET DATA TYPE text;
  -- The Front Page permission became Design: people who held it keep it.
  UPDATE "users_permissions" SET "value" = 'design' WHERE "value" = 'frontPage';
  DROP TYPE "public"."enum_users_permissions";
  CREATE TYPE "public"."enum_users_permissions" AS ENUM('issue', 'design', 'print', 'staff', 'media');
  ALTER TABLE "users_permissions" ALTER COLUMN "value" SET DATA TYPE "public"."enum_users_permissions" USING "value"::"public"."enum_users_permissions";
  CREATE INDEX "site_design__status_idx" ON "site_design" USING btree ("_status");
  CREATE INDEX "_site_design_v_version_version__status_idx" ON "_site_design_v" USING btree ("version__status");
  CREATE INDEX "_site_design_v_created_at_idx" ON "_site_design_v" USING btree ("created_at");
  CREATE INDEX "_site_design_v_updated_at_idx" ON "_site_design_v" USING btree ("updated_at");
  CREATE INDEX "_site_design_v_latest_idx" ON "_site_design_v" USING btree ("latest");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "site_design" CASCADE;
  DROP TABLE "_site_design_v" CASCADE;
  ALTER TABLE "users_permissions" ALTER COLUMN "value" SET DATA TYPE text;
  UPDATE "users_permissions" SET "value" = 'frontPage' WHERE "value" = 'design';
  DROP TYPE "public"."enum_users_permissions";
  CREATE TYPE "public"."enum_users_permissions" AS ENUM('issue', 'frontPage', 'print', 'staff', 'media');
  ALTER TABLE "users_permissions" ALTER COLUMN "value" SET DATA TYPE "public"."enum_users_permissions" USING "value"::"public"."enum_users_permissions";
  ALTER TABLE "deployments" ALTER COLUMN "reason" SET DATA TYPE text;
  UPDATE "deployments" SET "reason" = 'rebuild' WHERE "reason" = 'design';
  DROP TYPE "public"."enum_deployments_reason";
  CREATE TYPE "public"."enum_deployments_reason" AS ENUM('issue', 'withdrawal', 'rebuild', 'banner');
  ALTER TABLE "deployments" ALTER COLUMN "reason" SET DATA TYPE "public"."enum_deployments_reason" USING "reason"::"public"."enum_deployments_reason";
  DROP TYPE "public"."enum_site_design_status";
  DROP TYPE "public"."enum__site_design_v_version_status";`)
}
