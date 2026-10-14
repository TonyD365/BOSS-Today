import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_issues_stories_width" AS ENUM('full', 'twoThirds', 'half', 'column');
  CREATE TYPE "public"."enum__issues_v_version_stories_width" AS ENUM('full', 'twoThirds', 'half', 'column');
  CREATE TYPE "public"."enum_audit_log_action" AS ENUM('publish', 'withdraw', 'delete', 'invite', 'role', 'deactivate', 'reactivate', 'settings');
  CREATE TABLE "issues_stories" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"article_id" integer,
  	"width" "enum_issues_stories_width" DEFAULT 'full',
  	"show_image" boolean DEFAULT true
  );
  
  CREATE TABLE "_issues_v_version_stories" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"article_id" integer,
  	"width" "enum__issues_v_version_stories_width" DEFAULT 'full',
  	"show_image" boolean DEFAULT true,
  	"_uuid" varchar
  );
  
  CREATE TABLE "audit_log" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"summary" varchar NOT NULL,
  	"action" "enum_audit_log_action" NOT NULL,
  	"actor_id" integer,
  	"target" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "settings_social_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"url" varchar NOT NULL
  );
  
  CREATE TABLE "settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"site_name" varchar DEFAULT 'BOSS Today' NOT NULL,
  	"tagline" varchar DEFAULT 'The student newspaper of Bur Oak Secondary School.',
  	"about" jsonb,
  	"footer_note" varchar DEFAULT 'Written and edited by students.',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  INSERT INTO "issues_stories" ("_order", "_parent_id", "id", "article_id", "width", "show_image")
    SELECT COALESCE("order", 1), "parent_id", substr(md5(random()::text || "id"::text), 1, 24), "articles_id", 'full', true
    FROM "issues_rels" WHERE "path" = 'articles' AND "articles_id" IS NOT NULL;
  INSERT INTO "_issues_v_version_stories" ("_order", "_parent_id", "article_id", "width", "show_image", "_uuid")
    SELECT COALESCE("order", 1), "parent_id", "articles_id", 'full', true, substr(md5(random()::text || "id"::text), 1, 24)
    FROM "_issues_v_rels" WHERE "path" = 'version.articles' AND "articles_id" IS NOT NULL;
  ALTER TABLE "issues_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_issues_v_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "issues_rels" CASCADE;
  DROP TABLE "_issues_v_rels" CASCADE;
  ALTER TABLE "issues" ADD COLUMN "announcement" varchar;
  ALTER TABLE "issues" ADD COLUMN "show_contents" boolean DEFAULT true;
  ALTER TABLE "issues" ADD COLUMN "show_staff_box" boolean DEFAULT true;
  ALTER TABLE "_issues_v" ADD COLUMN "version_announcement" varchar;
  ALTER TABLE "_issues_v" ADD COLUMN "version_show_contents" boolean DEFAULT true;
  ALTER TABLE "_issues_v" ADD COLUMN "version_show_staff_box" boolean DEFAULT true;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "audit_log_id" integer;
  ALTER TABLE "issues_stories" ADD CONSTRAINT "issues_stories_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "issues_stories" ADD CONSTRAINT "issues_stories_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_issues_v_version_stories" ADD CONSTRAINT "_issues_v_version_stories_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_issues_v_version_stories" ADD CONSTRAINT "_issues_v_version_stories_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_issues_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "settings_social_links" ADD CONSTRAINT "settings_social_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."settings"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "issues_stories_order_idx" ON "issues_stories" USING btree ("_order");
  CREATE INDEX "issues_stories_parent_id_idx" ON "issues_stories" USING btree ("_parent_id");
  CREATE INDEX "issues_stories_article_idx" ON "issues_stories" USING btree ("article_id");
  CREATE INDEX "_issues_v_version_stories_order_idx" ON "_issues_v_version_stories" USING btree ("_order");
  CREATE INDEX "_issues_v_version_stories_parent_id_idx" ON "_issues_v_version_stories" USING btree ("_parent_id");
  CREATE INDEX "_issues_v_version_stories_article_idx" ON "_issues_v_version_stories" USING btree ("article_id");
  CREATE INDEX "audit_log_action_idx" ON "audit_log" USING btree ("action");
  CREATE INDEX "audit_log_actor_idx" ON "audit_log" USING btree ("actor_id");
  CREATE INDEX "audit_log_target_idx" ON "audit_log" USING btree ("target");
  CREATE INDEX "audit_log_updated_at_idx" ON "audit_log" USING btree ("updated_at");
  CREATE INDEX "audit_log_created_at_idx" ON "audit_log" USING btree ("created_at");
  CREATE INDEX "settings_social_links_order_idx" ON "settings_social_links" USING btree ("_order");
  CREATE INDEX "settings_social_links_parent_id_idx" ON "settings_social_links" USING btree ("_parent_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_audit_log_fk" FOREIGN KEY ("audit_log_id") REFERENCES "public"."audit_log"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_audit_log_id_idx" ON "payload_locked_documents_rels" USING btree ("audit_log_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "issues_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"articles_id" integer
  );
  
  CREATE TABLE "_issues_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"articles_id" integer
  );
  
  ALTER TABLE "issues_stories" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_issues_v_version_stories" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "audit_log" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "settings_social_links" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "settings" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "issues_stories" CASCADE;
  DROP TABLE "_issues_v_version_stories" CASCADE;
  DROP TABLE "audit_log" CASCADE;
  DROP TABLE "settings_social_links" CASCADE;
  DROP TABLE "settings" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_audit_log_fk";
  
  DROP INDEX "payload_locked_documents_rels_audit_log_id_idx";
  ALTER TABLE "issues_rels" ADD CONSTRAINT "issues_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "issues_rels" ADD CONSTRAINT "issues_rels_articles_fk" FOREIGN KEY ("articles_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_issues_v_rels" ADD CONSTRAINT "_issues_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_issues_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_issues_v_rels" ADD CONSTRAINT "_issues_v_rels_articles_fk" FOREIGN KEY ("articles_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "issues_rels_order_idx" ON "issues_rels" USING btree ("order");
  CREATE INDEX "issues_rels_parent_idx" ON "issues_rels" USING btree ("parent_id");
  CREATE INDEX "issues_rels_path_idx" ON "issues_rels" USING btree ("path");
  CREATE INDEX "issues_rels_articles_id_idx" ON "issues_rels" USING btree ("articles_id");
  CREATE INDEX "_issues_v_rels_order_idx" ON "_issues_v_rels" USING btree ("order");
  CREATE INDEX "_issues_v_rels_parent_idx" ON "_issues_v_rels" USING btree ("parent_id");
  CREATE INDEX "_issues_v_rels_path_idx" ON "_issues_v_rels" USING btree ("path");
  CREATE INDEX "_issues_v_rels_articles_id_idx" ON "_issues_v_rels" USING btree ("articles_id");
  ALTER TABLE "issues" DROP COLUMN "announcement";
  ALTER TABLE "issues" DROP COLUMN "show_contents";
  ALTER TABLE "issues" DROP COLUMN "show_staff_box";
  ALTER TABLE "_issues_v" DROP COLUMN "version_announcement";
  ALTER TABLE "_issues_v" DROP COLUMN "version_show_contents";
  ALTER TABLE "_issues_v" DROP COLUMN "version_show_staff_box";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "audit_log_id";
  DROP TYPE "public"."enum_issues_stories_width";
  DROP TYPE "public"."enum__issues_v_version_stories_width";
  DROP TYPE "public"."enum_audit_log_action";`)
}
