import * as migration_20261014_010817_initial from './20261014_010817_initial'
import * as migration_20261014_115215_roles_workflow_front_page from './20261014_115215_roles_workflow_front_page'
import * as migration_20261014_151041_storage_fields from './20261014_151041_storage_fields'
import * as migration_20261014_151605_print_settings_audit from './20261014_151605_print_settings_audit'

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
]
