import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_positions" AS ENUM('editor-in-chief', 'managing-editor', 'faculty-advisor', 'news-editor', 'opinion-editor', 'student-life-editor', 'sports-editor', 'arts-culture-editor', 'science-tech-editor', 'copy-chief', 'copy-editor', 'fact-checker', 'standards-editor', 'photo-editor', 'staff-photographer', 'graphics-editor', 'print-editor', 'layout-designer', 'digital-editor', 'video-producer', 'social-media-editor', 'recruitment-coordinator', 'web-tech-lead', 'archivist', 'senior-reporter', 'staff-writer', 'columnist', 'junior-reporter', 'contributing-writer');
  CREATE TABLE "users_positions" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_users_positions",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  ALTER TABLE "users_positions" ADD CONSTRAINT "users_positions_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_positions_order_idx" ON "users_positions" USING btree ("order");
  CREATE INDEX "users_positions_parent_idx" ON "users_positions" USING btree ("parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "users_positions" CASCADE;
  DROP TYPE "public"."enum_users_positions";`)
}
