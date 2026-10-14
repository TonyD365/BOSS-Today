import * as migration_20261014_010817_initial from './20261014_010817_initial';
import * as migration_20261014_115215_roles_workflow_front_page from './20261014_115215_roles_workflow_front_page';
import * as migration_20261014_151041_storage_fields from './20261014_151041_storage_fields';
import * as migration_20261014_151605_print_settings_audit from './20261014_151605_print_settings_audit';
import * as migration_20261014_154757_email_sign_in from './20261014_154757_email_sign_in';
import * as migration_20261014_160633_password_sign_in from './20261014_160633_password_sign_in';
import * as migration_20261014_185527_issue_publishing from './20261014_185527_issue_publishing';
import * as migration_20261014_200000_backfill_section_versions from './20261014_200000_backfill_section_versions';

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
    name: '20261014_185527_issue_publishing'
  },
  {
    up: migration_20261014_200000_backfill_section_versions.up,
    down: migration_20261014_200000_backfill_section_versions.down,
    name: '20261014_200000_backfill_section_versions',
  },
];
