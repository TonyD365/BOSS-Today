import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Sections created before drafts were added have no version history, and
 * Payload's admin list reads sections through their versions, so those sections
 * were invisible in the admin while still showing on the public site.
 * Give each of them a single, latest version matching what is live.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    INSERT INTO "_sections_v" (
      "parent_id", "version_name", "version_slug", "version_description", "version_order",
      "version_updated_at", "version_created_at", "version__status", "created_at", "updated_at", "latest"
    )
    SELECT s."id", s."name", s."slug", s."description", s."order",
      s."updated_at", s."created_at", COALESCE(s."_status"::text, 'published')::"enum__sections_v_version_status",
      now(), now(), true
    FROM "sections" s
    WHERE NOT EXISTS (SELECT 1 FROM "_sections_v" v WHERE v."parent_id" = s."id");
  `)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // The backfilled versions are harmless to keep.
}
