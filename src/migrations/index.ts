import * as migration_20261014_010817_initial from './20261014_010817_initial';
import * as migration_20261014_115215_roles_workflow_front_page from './20261014_115215_roles_workflow_front_page';
import * as migration_20261014_151041_storage_fields from './20261014_151041_storage_fields';
import * as migration_20261014_151605_print_settings_audit from './20261014_151605_print_settings_audit';
import * as migration_20261014_154757_email_sign_in from './20261014_154757_email_sign_in';
import * as migration_20261014_160633_password_sign_in from './20261014_160633_password_sign_in';
import * as migration_20261014_185527_issue_publishing from './20261014_185527_issue_publishing';
import * as migration_20261014_192539_rebuild_progress from './20261014_192539_rebuild_progress';
import * as migration_20261014_200000_backfill_section_versions from './20261014_200000_backfill_section_versions';
import * as migration_20261014_231138_batch1_tags_corrections_banner from './20261014_231138_batch1_tags_corrections_banner';
import * as migration_20261014_233311_batch2_assignments_templates_comments from './20261014_233311_batch2_assignments_templates_comments';
import * as migration_20261014_233400_seed_story_templates from './20261014_233400_seed_story_templates';
import * as migration_20261015_153301_batch3_submissions_readership_staff from './20261015_153301_batch3_submissions_readership_staff';
import * as migration_20261016_132138_github_media_prefix from './20261016_132138_github_media_prefix';
import * as migration_20261016_154026_batch4_scores_calendar_live from './20261016_154026_batch4_scores_calendar_live';
import * as migration_20261016_180154_site_designer from './20261016_180154_site_designer';
import * as migration_20261016_183434_site_chrome_pages from './20261016_183434_site_chrome_pages';
import * as migration_20261016_184921_page_templates from './20261016_184921_page_templates';

export const migrations = [
  {
    up: migration_20261014_010817_initial.up,
    down: migration_20261014_010817_initial.down,
    name: '20261014_010817_initial',
  },
  {
    up: migration_20261014_115215_roles_workflow_front_page.up,
    down: migration_20261014_115215_roles_workflow_front_page.down,
    name: '20261014_115215_roles_workflow_front_page',
  },
  {
    up: migration_20261014_151041_storage_fields.up,
    down: migration_20261014_151041_storage_fields.down,
    name: '20261014_151041_storage_fields',
  },
  {
    up: migration_20261014_151605_print_settings_audit.up,
    down: migration_20261014_151605_print_settings_audit.down,
    name: '20261014_151605_print_settings_audit',
  },
  {
    up: migration_20261014_154757_email_sign_in.up,
    down: migration_20261014_154757_email_sign_in.down,
    name: '20261014_154757_email_sign_in',
  },
  {
    up: migration_20261014_160633_password_sign_in.up,
    down: migration_20261014_160633_password_sign_in.down,
    name: '20261014_160633_password_sign_in',
  },
  {
    up: migration_20261014_185527_issue_publishing.up,
    down: migration_20261014_185527_issue_publishing.down,
    name: '20261014_185527_issue_publishing',
  },
  {
    up: migration_20261014_192539_rebuild_progress.up,
    down: migration_20261014_192539_rebuild_progress.down,
    name: '20261014_192539_rebuild_progress',
  },
  {
    up: migration_20261014_200000_backfill_section_versions.up,
    down: migration_20261014_200000_backfill_section_versions.down,
    name: '20261014_200000_backfill_section_versions',
  },
  {
    up: migration_20261014_231138_batch1_tags_corrections_banner.up,
    down: migration_20261014_231138_batch1_tags_corrections_banner.down,
    name: '20261014_231138_batch1_tags_corrections_banner',
  },
  {
    up: migration_20261014_233311_batch2_assignments_templates_comments.up,
    down: migration_20261014_233311_batch2_assignments_templates_comments.down,
    name: '20261014_233311_batch2_assignments_templates_comments',
  },
  {
    up: migration_20261014_233400_seed_story_templates.up,
    down: migration_20261014_233400_seed_story_templates.down,
    name: '20261014_233400_seed_story_templates',
  },
  {
    up: migration_20261015_153301_batch3_submissions_readership_staff.up,
    down: migration_20261015_153301_batch3_submissions_readership_staff.down,
    name: '20261015_153301_batch3_submissions_readership_staff',
  },
  {
    up: migration_20261016_132138_github_media_prefix.up,
    down: migration_20261016_132138_github_media_prefix.down,
    name: '20261016_132138_github_media_prefix',
  },
  {
    up: migration_20261016_154026_batch4_scores_calendar_live.up,
    down: migration_20261016_154026_batch4_scores_calendar_live.down,
    name: '20261016_154026_batch4_scores_calendar_live',
  },
  {
    up: migration_20261016_180154_site_designer.up,
    down: migration_20261016_180154_site_designer.down,
    name: '20261016_180154_site_designer',
  },
  {
    up: migration_20261016_183434_site_chrome_pages.up,
    down: migration_20261016_183434_site_chrome_pages.down,
    name: '20261016_183434_site_chrome_pages',
  },
  {
    up: migration_20261016_184921_page_templates.up,
    down: migration_20261016_184921_page_templates.down,
    name: '20261016_184921_page_templates'
  },
];
