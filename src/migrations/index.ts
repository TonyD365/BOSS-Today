import * as migration_20261014_010817_initial from './20261014_010817_initial'
import * as migration_20261014_115215_roles_workflow_front_page from './20261014_115215_roles_workflow_front_page'

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
]
