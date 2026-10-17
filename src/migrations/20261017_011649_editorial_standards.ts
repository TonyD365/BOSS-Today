import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "settings" ADD COLUMN "standards" jsonb;
  ALTER TABLE "_settings_v" ADD COLUMN "version_standards" jsonb;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "settings" DROP COLUMN "standards";
  ALTER TABLE "_settings_v" DROP COLUMN "version_standards";`)
}
