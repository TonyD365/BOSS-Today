import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "design_templates" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"design" jsonb NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "design_templates_id" integer;
  CREATE INDEX "design_templates_updated_at_idx" ON "design_templates" USING btree ("updated_at");
  CREATE INDEX "design_templates_created_at_idx" ON "design_templates" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_design_templates_fk" FOREIGN KEY ("design_templates_id") REFERENCES "public"."design_templates"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_design_templates_id_idx" ON "payload_locked_documents_rels" USING btree ("design_templates_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "design_templates" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "design_templates" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_design_templates_fk";
  
  DROP INDEX "payload_locked_documents_rels_design_templates_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "design_templates_id";`)
}
