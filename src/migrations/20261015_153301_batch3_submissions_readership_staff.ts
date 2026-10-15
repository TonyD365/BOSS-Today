import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_submissions_kind" AS ENUM('letter', 'tip', 'correction');
  CREATE TYPE "public"."enum_submissions_status" AS ENUM('new', 'inProgress', 'used', 'replied', 'declined', 'spam');
  CREATE TYPE "public"."enum_page_views_kind" AS ENUM('path', 'referrer');
  CREATE TABLE "submissions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"kind" "enum_submissions_kind" NOT NULL,
  	"status" "enum_submissions_status" DEFAULT 'new' NOT NULL,
  	"body" varchar NOT NULL,
  	"name" varchar NOT NULL,
  	"email" varchar,
  	"affiliation" varchar,
  	"article_id" integer,
  	"email_confirmed" boolean,
  	"identity_confirmed" boolean,
  	"notes" varchar,
  	"handled_by_id" integer,
  	"story_id" integer,
  	"assignment_id" integer,
  	"ip_hash" varchar,
  	"contact_removed_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "page_views" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"day" varchar NOT NULL,
  	"kind" "enum_page_views_kind" NOT NULL,
  	"key" varchar NOT NULL,
  	"views" numeric NOT NULL,
  	"visits" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "articles" ADD COLUMN "guest_byline" varchar;
  ALTER TABLE "_articles_v" ADD COLUMN "version_guest_byline" varchar;
  ALTER TABLE "users" ADD COLUMN "show_on_staff_page" boolean DEFAULT true;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "submissions_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "page_views_id" integer;
  ALTER TABLE "settings" ADD COLUMN "join_us" jsonb;
  ALTER TABLE "_settings_v" ADD COLUMN "version_join_us" jsonb;
  ALTER TABLE "submissions" ADD CONSTRAINT "submissions_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "submissions" ADD CONSTRAINT "submissions_handled_by_id_users_id_fk" FOREIGN KEY ("handled_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "submissions" ADD CONSTRAINT "submissions_story_id_articles_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "submissions" ADD CONSTRAINT "submissions_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "submissions_status_idx" ON "submissions" USING btree ("status");
  CREATE INDEX "submissions_article_idx" ON "submissions" USING btree ("article_id");
  CREATE INDEX "submissions_email_confirmed_idx" ON "submissions" USING btree ("email_confirmed");
  CREATE INDEX "submissions_handled_by_idx" ON "submissions" USING btree ("handled_by_id");
  CREATE INDEX "submissions_story_idx" ON "submissions" USING btree ("story_id");
  CREATE INDEX "submissions_assignment_idx" ON "submissions" USING btree ("assignment_id");
  CREATE INDEX "submissions_ip_hash_idx" ON "submissions" USING btree ("ip_hash");
  CREATE INDEX "submissions_updated_at_idx" ON "submissions" USING btree ("updated_at");
  CREATE INDEX "submissions_created_at_idx" ON "submissions" USING btree ("created_at");
  CREATE INDEX "page_views_day_idx" ON "page_views" USING btree ("day");
  CREATE INDEX "page_views_key_idx" ON "page_views" USING btree ("key");
  CREATE INDEX "page_views_updated_at_idx" ON "page_views" USING btree ("updated_at");
  CREATE INDEX "page_views_created_at_idx" ON "page_views" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_submissions_fk" FOREIGN KEY ("submissions_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_page_views_fk" FOREIGN KEY ("page_views_id") REFERENCES "public"."page_views"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_submissions_id_idx" ON "payload_locked_documents_rels" USING btree ("submissions_id");
  CREATE INDEX "payload_locked_documents_rels_page_views_id_idx" ON "payload_locked_documents_rels" USING btree ("page_views_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "submissions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "page_views" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "submissions" CASCADE;
  DROP TABLE "page_views" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_submissions_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_page_views_fk";
  
  DROP INDEX "payload_locked_documents_rels_submissions_id_idx";
  DROP INDEX "payload_locked_documents_rels_page_views_id_idx";
  ALTER TABLE "articles" DROP COLUMN "guest_byline";
  ALTER TABLE "_articles_v" DROP COLUMN "version_guest_byline";
  ALTER TABLE "users" DROP COLUMN "show_on_staff_page";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "submissions_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "page_views_id";
  ALTER TABLE "settings" DROP COLUMN "join_us";
  ALTER TABLE "_settings_v" DROP COLUMN "version_join_us";
  DROP TYPE "public"."enum_submissions_kind";
  DROP TYPE "public"."enum_submissions_status";
  DROP TYPE "public"."enum_page_views_kind";`)
}
