import * as migration_20261014_010817_initial from './20261014_010817_initial'

export const migrations = [
  {
    up: migration_20261014_010817_initial.up,
    down: migration_20261014_010817_initial.down,
    name: '20261014_010817_initial',
  },
]
