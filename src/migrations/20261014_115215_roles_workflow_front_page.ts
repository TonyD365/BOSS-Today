import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_articles_history_status" AS ENUM('draft', 'review', 'changes', 'published', 'withdrawn');
  CREATE TYPE "public"."enum_articles_workflow" AS ENUM('draft', 'review', 'changes', 'published', 'withdrawn');
  CREATE TYPE "public"."enum__articles_v_version_history_status" AS ENUM('draft', 'review', 'changes', 'published', 'withdrawn');
  CREATE TYPE "public"."enum__articles_v_version_workflow" AS ENUM('draft', 'review', 'changes', 'published', 'withdrawn');
  CREATE TYPE "public"."enum_users_permissions" AS ENUM('frontPage', 'print', 'staff', 'media');
  CREATE TABLE "articles_history" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"status" "enum_articles_history_status",
  	"by_id" integer,
  	"at" timestamp(3) with time zone,
  	"note" varchar
  );
  
  CREATE TABLE "_articles_v_version_history" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"status" "enum__articles_v_version_history_status",
  	"by_id" integer,
  	"at" timestamp(3) with time zone,
  	"note" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "users_permissions" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_users_permissions",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "front_page" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"lead_id" integer,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "front_page_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"articles_id" integer
  );
  
  ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE text;
  ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'reporter'::text;
  UPDATE "users" SET "role" = CASE "role" WHEN 'admin' THEN 'exec' WHEN 'writer' THEN 'reporter' ELSE "role" END;
  DROP TYPE "public"."enum_users_role";
  CREATE TYPE "public"."enum_users_role" AS ENUM('reader', 'reporter', 'editor', 'exec');
  ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'reporter'::"public"."enum_users_role";
  ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE "public"."enum_users_role" USING "role"::"public"."enum_users_role";
  ALTER TABLE "articles" ADD COLUMN "workflow" "enum_articles_workflow" DEFAULT 'draft';
  ALTER TABLE "articles" ADD COLUMN "review_notes" varchar;
  ALTER TABLE "_articles_v" ADD COLUMN "version_workflow" "enum__articles_v_version_workflow" DEFAULT 'draft';
  ALTER TABLE "_articles_v" ADD COLUMN "version_review_notes" varchar;
  ALTER TABLE "users" ADD COLUMN "active" boolean DEFAULT true;
  ALTER TABLE "articles_history" ADD CONSTRAINT "articles_history_by_id_users_id_fk" FOREIGN KEY ("by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "articles_history" ADD CONSTRAINT "articles_history_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_articles_v_version_history" ADD CONSTRAINT "_articles_v_version_history_by_id_users_id_fk" FOREIGN KEY ("by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_articles_v_version_history" ADD CONSTRAINT "_articles_v_version_history_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_articles_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_permissions" ADD CONSTRAINT "users_permissions_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "front_page" ADD CONSTRAINT "front_page_lead_id_articles_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "front_page_rels" ADD CONSTRAINT "front_page_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."front_page"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "front_page_rels" ADD CONSTRAINT "front_page_rels_articles_fk" FOREIGN KEY ("articles_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "articles_history_order_idx" ON "articles_history" USING btree ("_order");
  CREATE INDEX "articles_history_parent_id_idx" ON "articles_history" USING btree ("_parent_id");
  CREATE INDEX "articles_history_by_idx" ON "articles_history" USING btree ("by_id");
  CREATE INDEX "_articles_v_version_history_order_idx" ON "_articles_v_version_history" USING btree ("_order");
  CREATE INDEX "_articles_v_version_history_parent_id_idx" ON "_articles_v_version_history" USING btree ("_parent_id");
  CREATE INDEX "_articles_v_version_history_by_idx" ON "_articles_v_version_history" USING btree ("by_id");
  CREATE INDEX "users_permissions_order_idx" ON "users_permissions" USING btree ("order");
  CREATE INDEX "users_permissions_parent_idx" ON "users_permissions" USING btree ("parent_id");
  CREATE INDEX "front_page_lead_idx" ON "front_page" USING btree ("lead_id");
  CREATE INDEX "front_page_rels_order_idx" ON "front_page_rels" USING btree ("order");
  CREATE INDEX "front_page_rels_parent_idx" ON "front_page_rels" USING btree ("parent_id");
  CREATE INDEX "front_page_rels_path_idx" ON "front_page_rels" USING btree ("path");
  CREATE INDEX "front_page_rels_articles_id_idx" ON "front_page_rels" USING btree ("articles_id");
  CREATE INDEX "articles_workflow_idx" ON "articles" USING btree ("workflow");
  CREATE INDEX "_articles_v_version_version_workflow_idx" ON "_articles_v" USING btree ("version_workflow");
  UPDATE "articles" SET "workflow" = 'published' WHERE "_status" = 'published';
  UPDATE "_articles_v" SET "version_workflow" = 'published' WHERE "version__status" = 'published';
  ALTER TABLE "articles" DROP COLUMN "ready_for_review";
  ALTER TABLE "articles" DROP COLUMN "placement";
  ALTER TABLE "_articles_v" DROP COLUMN "version_ready_for_review";
  ALTER TABLE "_articles_v" DROP COLUMN "version_placement";
  DROP TYPE "public"."enum_articles_placement";
  DROP TYPE "public"."enum__articles_v_version_placement";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_articles_placement" AS ENUM('lead', 'featured', 'standard');
  CREATE TYPE "public"."enum__articles_v_version_placement" AS ENUM('lead', 'featured', 'standard');
  ALTER TABLE "articles_history" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_articles_v_version_history" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "users_permissions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "front_page" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "front_page_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "articles_history" CASCADE;
  DROP TABLE "_articles_v_version_history" CASCADE;
  DROP TABLE "users_permissions" CASCADE;
  DROP TABLE "front_page" CASCADE;
  DROP TABLE "front_page_rels" CASCADE;
  ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE text;
  ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'writer'::text;
  DROP TYPE "public"."enum_users_role";
  CREATE TYPE "public"."enum_users_role" AS ENUM('admin', 'editor', 'writer');
  ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'writer'::"public"."enum_users_role";
  ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE "public"."enum_users_role" USING "role"::"public"."enum_users_role";
  DROP INDEX "articles_workflow_idx";
  DROP INDEX "_articles_v_version_version_workflow_idx";
  ALTER TABLE "articles" ADD COLUMN "ready_for_review" boolean DEFAULT false;
  ALTER TABLE "articles" ADD COLUMN "placement" "enum_articles_placement" DEFAULT 'standard';
  ALTER TABLE "_articles_v" ADD COLUMN "version_ready_for_review" boolean DEFAULT false;
  ALTER TABLE "_articles_v" ADD COLUMN "version_placement" "enum__articles_v_version_placement" DEFAULT 'standard';
  ALTER TABLE "articles" DROP COLUMN "workflow";
  ALTER TABLE "articles" DROP COLUMN "review_notes";
  ALTER TABLE "_articles_v" DROP COLUMN "version_workflow";
  ALTER TABLE "_articles_v" DROP COLUMN "version_review_notes";
  ALTER TABLE "users" DROP COLUMN "active";
  DROP TYPE "public"."enum_articles_history_status";
  DROP TYPE "public"."enum_articles_workflow";
  DROP TYPE "public"."enum__articles_v_version_history_status";
  DROP TYPE "public"."enum__articles_v_version_workflow";
  DROP TYPE "public"."enum_users_permissions";`)
}
