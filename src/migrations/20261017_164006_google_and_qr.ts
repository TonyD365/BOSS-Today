import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "issues" ADD COLUMN "show_qr_codes" boolean DEFAULT true;
  ALTER TABLE "_issues_v" ADD COLUMN "version_show_qr_codes" boolean DEFAULT true;
  ALTER TABLE "settings" ADD COLUMN "google_verification" varchar;
  ALTER TABLE "_settings_v" ADD COLUMN "version_google_verification" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "issues" DROP COLUMN "show_qr_codes";
  ALTER TABLE "_issues_v" DROP COLUMN "version_show_qr_codes";
  ALTER TABLE "settings" DROP COLUMN "google_verification";
  ALTER TABLE "_settings_v" DROP COLUMN "version_google_verification";`)
}
