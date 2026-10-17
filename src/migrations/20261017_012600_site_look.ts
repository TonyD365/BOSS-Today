import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_settings_look_serif" AS ENUM('newsreader', 'franklin', 'masthead', 'playfair', 'merriweather', 'lora', 'source-serif', 'inter', 'roboto', 'montserrat', 'oswald', 'bebas', 'anton', 'caveat', 'marker', 'mono');
  CREATE TYPE "public"."enum_settings_look_sans" AS ENUM('newsreader', 'franklin', 'masthead', 'playfair', 'merriweather', 'lora', 'source-serif', 'inter', 'roboto', 'montserrat', 'oswald', 'bebas', 'anton', 'caveat', 'marker', 'mono');
  CREATE TYPE "public"."enum_settings_look_masthead" AS ENUM('newsreader', 'franklin', 'masthead', 'playfair', 'merriweather', 'lora', 'source-serif', 'inter', 'roboto', 'montserrat', 'oswald', 'bebas', 'anton', 'caveat', 'marker', 'mono');
  CREATE TYPE "public"."enum__settings_v_version_look_serif" AS ENUM('newsreader', 'franklin', 'masthead', 'playfair', 'merriweather', 'lora', 'source-serif', 'inter', 'roboto', 'montserrat', 'oswald', 'bebas', 'anton', 'caveat', 'marker', 'mono');
  CREATE TYPE "public"."enum__settings_v_version_look_sans" AS ENUM('newsreader', 'franklin', 'masthead', 'playfair', 'merriweather', 'lora', 'source-serif', 'inter', 'roboto', 'montserrat', 'oswald', 'bebas', 'anton', 'caveat', 'marker', 'mono');
  CREATE TYPE "public"."enum__settings_v_version_look_masthead" AS ENUM('newsreader', 'franklin', 'masthead', 'playfair', 'merriweather', 'lora', 'source-serif', 'inter', 'roboto', 'montserrat', 'oswald', 'bebas', 'anton', 'caveat', 'marker', 'mono');
  ALTER TABLE "settings" ADD COLUMN "look_accent" varchar DEFAULT '#326891';
  ALTER TABLE "settings" ADD COLUMN "look_ink" varchar DEFAULT '#121212';
  ALTER TABLE "settings" ADD COLUMN "look_paper" varchar DEFAULT '#ffffff';
  ALTER TABLE "settings" ADD COLUMN "look_serif" "enum_settings_look_serif" DEFAULT 'newsreader';
  ALTER TABLE "settings" ADD COLUMN "look_sans" "enum_settings_look_sans" DEFAULT 'franklin';
  ALTER TABLE "settings" ADD COLUMN "look_masthead" "enum_settings_look_masthead" DEFAULT 'masthead';
  ALTER TABLE "_settings_v" ADD COLUMN "version_look_accent" varchar DEFAULT '#326891';
  ALTER TABLE "_settings_v" ADD COLUMN "version_look_ink" varchar DEFAULT '#121212';
  ALTER TABLE "_settings_v" ADD COLUMN "version_look_paper" varchar DEFAULT '#ffffff';
  ALTER TABLE "_settings_v" ADD COLUMN "version_look_serif" "enum__settings_v_version_look_serif" DEFAULT 'newsreader';
  ALTER TABLE "_settings_v" ADD COLUMN "version_look_sans" "enum__settings_v_version_look_sans" DEFAULT 'franklin';
  ALTER TABLE "_settings_v" ADD COLUMN "version_look_masthead" "enum__settings_v_version_look_masthead" DEFAULT 'masthead';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "settings" DROP COLUMN "look_accent";
  ALTER TABLE "settings" DROP COLUMN "look_ink";
  ALTER TABLE "settings" DROP COLUMN "look_paper";
  ALTER TABLE "settings" DROP COLUMN "look_serif";
  ALTER TABLE "settings" DROP COLUMN "look_sans";
  ALTER TABLE "settings" DROP COLUMN "look_masthead";
  ALTER TABLE "_settings_v" DROP COLUMN "version_look_accent";
  ALTER TABLE "_settings_v" DROP COLUMN "version_look_ink";
  ALTER TABLE "_settings_v" DROP COLUMN "version_look_paper";
  ALTER TABLE "_settings_v" DROP COLUMN "version_look_serif";
  ALTER TABLE "_settings_v" DROP COLUMN "version_look_sans";
  ALTER TABLE "_settings_v" DROP COLUMN "version_look_masthead";
  DROP TYPE "public"."enum_settings_look_serif";
  DROP TYPE "public"."enum_settings_look_sans";
  DROP TYPE "public"."enum_settings_look_masthead";
  DROP TYPE "public"."enum__settings_v_version_look_serif";
  DROP TYPE "public"."enum__settings_v_version_look_sans";
  DROP TYPE "public"."enum__settings_v_version_look_masthead";`)
}
