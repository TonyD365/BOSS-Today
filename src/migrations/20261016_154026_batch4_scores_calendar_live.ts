import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_live_blogs_status" AS ENUM('live', 'ended');
  CREATE TYPE "public"."enum_games_home" AS ENUM('home', 'away');
  CREATE TYPE "public"."enum_games_status" AS ENUM('scheduled', 'live', 'final', 'cancelled');
  ALTER TYPE "public"."enum_audit_log_action" ADD VALUE 'live';
  CREATE TABLE "live_blogs_updates" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"at" timestamp(3) with time zone,
  	"text" varchar NOT NULL,
  	"image_id" integer,
  	"by_id" integer
  );
  
  CREATE TABLE "live_blogs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"summary" varchar,
  	"status" "enum_live_blogs_status" DEFAULT 'live' NOT NULL,
  	"slug" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "games" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"team" varchar NOT NULL,
  	"opponent" varchar NOT NULL,
  	"starts_at" timestamp(3) with time zone NOT NULL,
  	"location" varchar,
  	"home" "enum_games_home" DEFAULT 'home',
  	"status" "enum_games_status" DEFAULT 'scheduled' NOT NULL,
  	"our_score" numeric,
  	"their_score" numeric,
  	"note" varchar,
  	"recap_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "events" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"starts_at" timestamp(3) with time zone NOT NULL,
  	"ends_at" timestamp(3) with time zone,
  	"all_day" boolean,
  	"location" varchar,
  	"description" varchar,
  	"link" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "live_blogs_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "games_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "events_id" integer;
  ALTER TABLE "live_blogs_updates" ADD CONSTRAINT "live_blogs_updates_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "live_blogs_updates" ADD CONSTRAINT "live_blogs_updates_by_id_users_id_fk" FOREIGN KEY ("by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "live_blogs_updates" ADD CONSTRAINT "live_blogs_updates_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."live_blogs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "games" ADD CONSTRAINT "games_recap_id_articles_id_fk" FOREIGN KEY ("recap_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "live_blogs_updates_order_idx" ON "live_blogs_updates" USING btree ("_order");
  CREATE INDEX "live_blogs_updates_parent_id_idx" ON "live_blogs_updates" USING btree ("_parent_id");
  CREATE INDEX "live_blogs_updates_image_idx" ON "live_blogs_updates" USING btree ("image_id");
  CREATE INDEX "live_blogs_updates_by_idx" ON "live_blogs_updates" USING btree ("by_id");
  CREATE UNIQUE INDEX "live_blogs_slug_idx" ON "live_blogs" USING btree ("slug");
  CREATE INDEX "live_blogs_updated_at_idx" ON "live_blogs" USING btree ("updated_at");
  CREATE INDEX "live_blogs_created_at_idx" ON "live_blogs" USING btree ("created_at");
  CREATE INDEX "games_starts_at_idx" ON "games" USING btree ("starts_at");
  CREATE INDEX "games_recap_idx" ON "games" USING btree ("recap_id");
  CREATE INDEX "games_updated_at_idx" ON "games" USING btree ("updated_at");
  CREATE INDEX "games_created_at_idx" ON "games" USING btree ("created_at");
  CREATE INDEX "events_starts_at_idx" ON "events" USING btree ("starts_at");
  CREATE INDEX "events_updated_at_idx" ON "events" USING btree ("updated_at");
  CREATE INDEX "events_created_at_idx" ON "events" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_live_blogs_fk" FOREIGN KEY ("live_blogs_id") REFERENCES "public"."live_blogs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_games_fk" FOREIGN KEY ("games_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_events_fk" FOREIGN KEY ("events_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_live_blogs_id_idx" ON "payload_locked_documents_rels" USING btree ("live_blogs_id");
  CREATE INDEX "payload_locked_documents_rels_games_id_idx" ON "payload_locked_documents_rels" USING btree ("games_id");
  CREATE INDEX "payload_locked_documents_rels_events_id_idx" ON "payload_locked_documents_rels" USING btree ("events_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "live_blogs_updates" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "live_blogs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "games" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "events" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "live_blogs_updates" CASCADE;
  DROP TABLE "live_blogs" CASCADE;
  DROP TABLE "games" CASCADE;
  DROP TABLE "events" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_live_blogs_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_games_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_events_fk";
  
  ALTER TABLE "audit_log" ALTER COLUMN "action" SET DATA TYPE text;
  DROP TYPE "public"."enum_audit_log_action";
  CREATE TYPE "public"."enum_audit_log_action" AS ENUM('publish', 'withdraw', 'delete', 'invite', 'role', 'deactivate', 'reactivate', 'settings');
  ALTER TABLE "audit_log" ALTER COLUMN "action" SET DATA TYPE "public"."enum_audit_log_action" USING "action"::"public"."enum_audit_log_action";
  DROP INDEX "payload_locked_documents_rels_live_blogs_id_idx";
  DROP INDEX "payload_locked_documents_rels_games_id_idx";
  DROP INDEX "payload_locked_documents_rels_events_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "live_blogs_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "games_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "events_id";
  DROP TYPE "public"."enum_live_blogs_status";
  DROP TYPE "public"."enum_games_home";
  DROP TYPE "public"."enum_games_status";`)
}
