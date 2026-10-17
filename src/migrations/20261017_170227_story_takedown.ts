import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_articles_history_status" ADD VALUE 'takedown' BEFORE 'withdrawn';
  ALTER TYPE "public"."enum_articles_workflow" ADD VALUE 'takedown' BEFORE 'withdrawn';
  ALTER TYPE "public"."enum__articles_v_version_history_status" ADD VALUE 'takedown' BEFORE 'withdrawn';
  ALTER TYPE "public"."enum__articles_v_version_workflow" ADD VALUE 'takedown' BEFORE 'withdrawn';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "articles_history" ALTER COLUMN "status" SET DATA TYPE text;
  DROP TYPE "public"."enum_articles_history_status";
  CREATE TYPE "public"."enum_articles_history_status" AS ENUM('draft', 'review', 'changes', 'approved', 'published', 'withdrawn');
  ALTER TABLE "articles_history" ALTER COLUMN "status" SET DATA TYPE "public"."enum_articles_history_status" USING "status"::"public"."enum_articles_history_status";
  ALTER TABLE "articles" ALTER COLUMN "workflow" SET DATA TYPE text;
  ALTER TABLE "articles" ALTER COLUMN "workflow" SET DEFAULT 'draft'::text;
  DROP TYPE "public"."enum_articles_workflow";
  CREATE TYPE "public"."enum_articles_workflow" AS ENUM('draft', 'review', 'changes', 'approved', 'published', 'withdrawn');
  ALTER TABLE "articles" ALTER COLUMN "workflow" SET DEFAULT 'draft'::"public"."enum_articles_workflow";
  ALTER TABLE "articles" ALTER COLUMN "workflow" SET DATA TYPE "public"."enum_articles_workflow" USING "workflow"::"public"."enum_articles_workflow";
  ALTER TABLE "_articles_v_version_history" ALTER COLUMN "status" SET DATA TYPE text;
  DROP TYPE "public"."enum__articles_v_version_history_status";
  CREATE TYPE "public"."enum__articles_v_version_history_status" AS ENUM('draft', 'review', 'changes', 'approved', 'published', 'withdrawn');
  ALTER TABLE "_articles_v_version_history" ALTER COLUMN "status" SET DATA TYPE "public"."enum__articles_v_version_history_status" USING "status"::"public"."enum__articles_v_version_history_status";
  ALTER TABLE "_articles_v" ALTER COLUMN "version_workflow" SET DATA TYPE text;
  ALTER TABLE "_articles_v" ALTER COLUMN "version_workflow" SET DEFAULT 'draft'::text;
  DROP TYPE "public"."enum__articles_v_version_workflow";
  CREATE TYPE "public"."enum__articles_v_version_workflow" AS ENUM('draft', 'review', 'changes', 'approved', 'published', 'withdrawn');
  ALTER TABLE "_articles_v" ALTER COLUMN "version_workflow" SET DEFAULT 'draft'::"public"."enum__articles_v_version_workflow";
  ALTER TABLE "_articles_v" ALTER COLUMN "version_workflow" SET DATA TYPE "public"."enum__articles_v_version_workflow" USING "version_workflow"::"public"."enum__articles_v_version_workflow";`)
}
