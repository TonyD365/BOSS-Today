import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_design" ADD COLUMN "templates" jsonb;
  ALTER TABLE "_site_design_v" ADD COLUMN "version_templates" jsonb;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_design" DROP COLUMN "templates";
  ALTER TABLE "_site_design_v" DROP COLUMN "version_templates";`)
}
