import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_sections_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__sections_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_issue_checks_kind" AS ENUM('checked', 'sent-back', 'published');
  CREATE TYPE "public"."enum_deployments_reason" AS ENUM('issue', 'withdrawal', 'rebuild');
  CREATE TYPE "public"."enum_deployments_status" AS ENUM('triggered', 'failed', 'not-configured');
  CREATE TYPE "public"."enum_front_page_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__front_page_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_settings_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__settings_v_version_status" AS ENUM('draft', 'published');
  ALTER TYPE "public"."enum_articles_history_status" ADD VALUE 'approved' BEFORE 'published';
  ALTER TYPE "public"."enum_articles_workflow" ADD VALUE 'approved' BEFORE 'published';
  ALTER TYPE "public"."enum__articles_v_version_history_status" ADD VALUE 'approved' BEFORE 'published';
  ALTER TYPE "public"."enum__articles_v_version_workflow" ADD VALUE 'approved' BEFORE 'published';
  ALTER TYPE "public"."enum_users_permissions" ADD VALUE 'issue' BEFORE 'frontPage';
  CREATE TABLE "_sections_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_name" varchar,
  	"version_slug" varchar,
  	"version_description" varchar,
  	"version_order" numeric DEFAULT 10,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__sections_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "issue_checks" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"summary" varchar NOT NULL,
  	"kind" "enum_issue_checks_kind" NOT NULL,
  	"issue_id" integer,
  	"article_id" integer,
  	"article_version" varchar,
  	"checked_by_id" integer NOT NULL,
  	"note" varchar,
  	"declaration" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "deployments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"reason" "enum_deployments_reason" NOT NULL,
  	"status" "enum_deployments_status" NOT NULL,
  	"http_status" numeric,
  	"note" varchar,
  	"issue_id" integer,
  	"actor_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_front_page_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"version_lead_id" integer,
  	"version__status" "enum__front_page_v_version_status" DEFAULT 'draft',
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "_front_page_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"articles_id" integer
  );
  
  CREATE TABLE "_settings_v_version_social_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"url" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_settings_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"version_site_name" varchar DEFAULT 'BOSS Today',
  	"version_tagline" varchar DEFAULT 'The student newspaper of Bur Oak Secondary School.',
  	"version_about" jsonb,
  	"version_footer_note" varchar DEFAULT 'Written and edited by students.',
  	"version__status" "enum__settings_v_version_status" DEFAULT 'draft',
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  ALTER TABLE "sections" ALTER COLUMN "name" DROP NOT NULL;
  ALTER TABLE "sections" ALTER COLUMN "slug" DROP NOT NULL;
  ALTER TABLE "settings_social_links" ALTER COLUMN "label" DROP NOT NULL;
  ALTER TABLE "settings_social_links" ALTER COLUMN "url" DROP NOT NULL;
  ALTER TABLE "settings" ALTER COLUMN "site_name" DROP NOT NULL;
  ALTER TABLE "issues" ADD COLUMN "published_by_id" integer;
  ALTER TABLE "issues" ADD COLUMN "published_at" timestamp(3) with time zone;
  ALTER TABLE "_issues_v" ADD COLUMN "version_published_by_id" integer;
  ALTER TABLE "_issues_v" ADD COLUMN "version_published_at" timestamp(3) with time zone;
  ALTER TABLE "sections" ADD COLUMN "_status" "enum_sections_status" DEFAULT 'draft';
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "issue_checks_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "deployments_id" integer;
  ALTER TABLE "front_page" ADD COLUMN "_status" "enum_front_page_status" DEFAULT 'draft';
  ALTER TABLE "settings" ADD COLUMN "_status" "enum_settings_status" DEFAULT 'draft';
  -- Everything that existed before drafts were added is already live.
  UPDATE "sections" SET "_status" = 'published';
  UPDATE "front_page" SET "_status" = 'published';
  UPDATE "settings" SET "_status" = 'published';
  ALTER TABLE "_sections_v" ADD CONSTRAINT "_sections_v_parent_id_sections_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."sections"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "issue_checks" ADD CONSTRAINT "issue_checks_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "issue_checks" ADD CONSTRAINT "issue_checks_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "issue_checks" ADD CONSTRAINT "issue_checks_checked_by_id_users_id_fk" FOREIGN KEY ("checked_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "deployments" ADD CONSTRAINT "deployments_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "deployments" ADD CONSTRAINT "deployments_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_front_page_v" ADD CONSTRAINT "_front_page_v_version_lead_id_articles_id_fk" FOREIGN KEY ("version_lead_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_front_page_v_rels" ADD CONSTRAINT "_front_page_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_front_page_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_front_page_v_rels" ADD CONSTRAINT "_front_page_v_rels_articles_fk" FOREIGN KEY ("articles_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_settings_v_version_social_links" ADD CONSTRAINT "_settings_v_version_social_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_settings_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "_sections_v_parent_idx" ON "_sections_v" USING btree ("parent_id");
  CREATE INDEX "_sections_v_version_version_slug_idx" ON "_sections_v" USING btree ("version_slug");
  CREATE INDEX "_sections_v_version_version_updated_at_idx" ON "_sections_v" USING btree ("version_updated_at");
  CREATE INDEX "_sections_v_version_version_created_at_idx" ON "_sections_v" USING btree ("version_created_at");
  CREATE INDEX "_sections_v_version_version__status_idx" ON "_sections_v" USING btree ("version__status");
  CREATE INDEX "_sections_v_created_at_idx" ON "_sections_v" USING btree ("created_at");
  CREATE INDEX "_sections_v_updated_at_idx" ON "_sections_v" USING btree ("updated_at");
  CREATE INDEX "_sections_v_latest_idx" ON "_sections_v" USING btree ("latest");
  CREATE INDEX "issue_checks_kind_idx" ON "issue_checks" USING btree ("kind");
  CREATE INDEX "issue_checks_issue_idx" ON "issue_checks" USING btree ("issue_id");
  CREATE INDEX "issue_checks_article_idx" ON "issue_checks" USING btree ("article_id");
  CREATE INDEX "issue_checks_checked_by_idx" ON "issue_checks" USING btree ("checked_by_id");
  CREATE INDEX "issue_checks_updated_at_idx" ON "issue_checks" USING btree ("updated_at");
  CREATE INDEX "issue_checks_created_at_idx" ON "issue_checks" USING btree ("created_at");
  CREATE INDEX "deployments_status_idx" ON "deployments" USING btree ("status");
  CREATE INDEX "deployments_issue_idx" ON "deployments" USING btree ("issue_id");
  CREATE INDEX "deployments_actor_idx" ON "deployments" USING btree ("actor_id");
  CREATE INDEX "deployments_updated_at_idx" ON "deployments" USING btree ("updated_at");
  CREATE INDEX "deployments_created_at_idx" ON "deployments" USING btree ("created_at");
  CREATE INDEX "_front_page_v_version_version_lead_idx" ON "_front_page_v" USING btree ("version_lead_id");
  CREATE INDEX "_front_page_v_version_version__status_idx" ON "_front_page_v" USING btree ("version__status");
  CREATE INDEX "_front_page_v_created_at_idx" ON "_front_page_v" USING btree ("created_at");
  CREATE INDEX "_front_page_v_updated_at_idx" ON "_front_page_v" USING btree ("updated_at");
  CREATE INDEX "_front_page_v_latest_idx" ON "_front_page_v" USING btree ("latest");
  CREATE INDEX "_front_page_v_rels_order_idx" ON "_front_page_v_rels" USING btree ("order");
  CREATE INDEX "_front_page_v_rels_parent_idx" ON "_front_page_v_rels" USING btree ("parent_id");
  CREATE INDEX "_front_page_v_rels_path_idx" ON "_front_page_v_rels" USING btree ("path");
  CREATE INDEX "_front_page_v_rels_articles_id_idx" ON "_front_page_v_rels" USING btree ("articles_id");
  CREATE INDEX "_settings_v_version_social_links_order_idx" ON "_settings_v_version_social_links" USING btree ("_order");
  CREATE INDEX "_settings_v_version_social_links_parent_id_idx" ON "_settings_v_version_social_links" USING btree ("_parent_id");
  CREATE INDEX "_settings_v_version_version__status_idx" ON "_settings_v" USING btree ("version__status");
  CREATE INDEX "_settings_v_created_at_idx" ON "_settings_v" USING btree ("created_at");
  CREATE INDEX "_settings_v_updated_at_idx" ON "_settings_v" USING btree ("updated_at");
  CREATE INDEX "_settings_v_latest_idx" ON "_settings_v" USING btree ("latest");
  ALTER TABLE "issues" ADD CONSTRAINT "issues_published_by_id_users_id_fk" FOREIGN KEY ("published_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_issues_v" ADD CONSTRAINT "_issues_v_version_published_by_id_users_id_fk" FOREIGN KEY ("version_published_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_issue_checks_fk" FOREIGN KEY ("issue_checks_id") REFERENCES "public"."issue_checks"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_deployments_fk" FOREIGN KEY ("deployments_id") REFERENCES "public"."deployments"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "issues_published_by_idx" ON "issues" USING btree ("published_by_id");
  CREATE INDEX "_issues_v_version_version_published_by_idx" ON "_issues_v" USING btree ("version_published_by_id");
  CREATE INDEX "sections__status_idx" ON "sections" USING btree ("_status");
  CREATE INDEX "payload_locked_documents_rels_issue_checks_id_idx" ON "payload_locked_documents_rels" USING btree ("issue_checks_id");
  CREATE INDEX "payload_locked_documents_rels_deployments_id_idx" ON "payload_locked_documents_rels" USING btree ("deployments_id");
  CREATE INDEX "front_page__status_idx" ON "front_page" USING btree ("_status");
  CREATE INDEX "settings__status_idx" ON "settings" USING btree ("_status");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "_sections_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "issue_checks" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "deployments" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_front_page_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_front_page_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_settings_v_version_social_links" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_settings_v" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "_sections_v" CASCADE;
  DROP TABLE "issue_checks" CASCADE;
  DROP TABLE "deployments" CASCADE;
  DROP TABLE "_front_page_v" CASCADE;
  DROP TABLE "_front_page_v_rels" CASCADE;
  DROP TABLE "_settings_v_version_social_links" CASCADE;
  DROP TABLE "_settings_v" CASCADE;
  ALTER TABLE "issues" DROP CONSTRAINT "issues_published_by_id_users_id_fk";
  
  ALTER TABLE "_issues_v" DROP CONSTRAINT "_issues_v_version_published_by_id_users_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_issue_checks_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_deployments_fk";
  
  ALTER TABLE "articles_history" ALTER COLUMN "status" SET DATA TYPE text;
  DROP TYPE "public"."enum_articles_history_status";
  CREATE TYPE "public"."enum_articles_history_status" AS ENUM('draft', 'review', 'changes', 'published', 'withdrawn');
  ALTER TABLE "articles_history" ALTER COLUMN "status" SET DATA TYPE "public"."enum_articles_history_status" USING "status"::"public"."enum_articles_history_status";
  ALTER TABLE "articles" ALTER COLUMN "workflow" SET DATA TYPE text;
  ALTER TABLE "articles" ALTER COLUMN "workflow" SET DEFAULT 'draft'::text;
  DROP TYPE "public"."enum_articles_workflow";
  CREATE TYPE "public"."enum_articles_workflow" AS ENUM('draft', 'review', 'changes', 'published', 'withdrawn');
  ALTER TABLE "articles" ALTER COLUMN "workflow" SET DEFAULT 'draft'::"public"."enum_articles_workflow";
  ALTER TABLE "articles" ALTER COLUMN "workflow" SET DATA TYPE "public"."enum_articles_workflow" USING "workflow"::"public"."enum_articles_workflow";
  ALTER TABLE "_articles_v_version_history" ALTER COLUMN "status" SET DATA TYPE text;
  DROP TYPE "public"."enum__articles_v_version_history_status";
  CREATE TYPE "public"."enum__articles_v_version_history_status" AS ENUM('draft', 'review', 'changes', 'published', 'withdrawn');
  ALTER TABLE "_articles_v_version_history" ALTER COLUMN "status" SET DATA TYPE "public"."enum__articles_v_version_history_status" USING "status"::"public"."enum__articles_v_version_history_status";
  ALTER TABLE "_articles_v" ALTER COLUMN "version_workflow" SET DATA TYPE text;
  ALTER TABLE "_articles_v" ALTER COLUMN "version_workflow" SET DEFAULT 'draft'::text;
  DROP TYPE "public"."enum__articles_v_version_workflow";
  CREATE TYPE "public"."enum__articles_v_version_workflow" AS ENUM('draft', 'review', 'changes', 'published', 'withdrawn');
  ALTER TABLE "_articles_v" ALTER COLUMN "version_workflow" SET DEFAULT 'draft'::"public"."enum__articles_v_version_workflow";
  ALTER TABLE "_articles_v" ALTER COLUMN "version_workflow" SET DATA TYPE "public"."enum__articles_v_version_workflow" USING "version_workflow"::"public"."enum__articles_v_version_workflow";
  ALTER TABLE "users_permissions" ALTER COLUMN "value" SET DATA TYPE text;
  DROP TYPE "public"."enum_users_permissions";
  CREATE TYPE "public"."enum_users_permissions" AS ENUM('frontPage', 'print', 'staff', 'media');
  ALTER TABLE "users_permissions" ALTER COLUMN "value" SET DATA TYPE "public"."enum_users_permissions" USING "value"::"public"."enum_users_permissions";
  DROP INDEX "issues_published_by_idx";
  DROP INDEX "_issues_v_version_version_published_by_idx";
  DROP INDEX "sections__status_idx";
  DROP INDEX "payload_locked_documents_rels_issue_checks_id_idx";
  DROP INDEX "payload_locked_documents_rels_deployments_id_idx";
  DROP INDEX "front_page__status_idx";
  DROP INDEX "settings__status_idx";
  ALTER TABLE "sections" ALTER COLUMN "name" SET NOT NULL;
  ALTER TABLE "sections" ALTER COLUMN "slug" SET NOT NULL;
  ALTER TABLE "settings_social_links" ALTER COLUMN "label" SET NOT NULL;
  ALTER TABLE "settings_social_links" ALTER COLUMN "url" SET NOT NULL;
  ALTER TABLE "settings" ALTER COLUMN "site_name" SET NOT NULL;
  ALTER TABLE "issues" DROP COLUMN "published_by_id";
  ALTER TABLE "issues" DROP COLUMN "published_at";
  ALTER TABLE "_issues_v" DROP COLUMN "version_published_by_id";
  ALTER TABLE "_issues_v" DROP COLUMN "version_published_at";
  ALTER TABLE "sections" DROP COLUMN "_status";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "issue_checks_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "deployments_id";
  ALTER TABLE "front_page" DROP COLUMN "_status";
  ALTER TABLE "settings" DROP COLUMN "_status";
  DROP TYPE "public"."enum_sections_status";
  DROP TYPE "public"."enum__sections_v_version_status";
  DROP TYPE "public"."enum_issue_checks_kind";
  DROP TYPE "public"."enum_deployments_reason";
  DROP TYPE "public"."enum_deployments_status";
  DROP TYPE "public"."enum_front_page_status";
  DROP TYPE "public"."enum__front_page_v_version_status";
  DROP TYPE "public"."enum_settings_status";
  DROP TYPE "public"."enum__settings_v_version_status";`)
}
