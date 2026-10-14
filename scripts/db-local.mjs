// A real Postgres for local development, stored in ./.postgres. Keep it running in its own terminal.
import EmbeddedPostgres from 'embedded-postgres'
import fs from 'fs'

const databaseDir = './.postgres'
const pg = new EmbeddedPostgres({
  databaseDir,
  user: 'postgres',
  password: 'postgres',
  port: 5433,
  persistent: true,
})

const isNew = !fs.existsSync(databaseDir)
if (isNew) await pg.initialise()
await pg.start()
if (isNew) await pg.createDatabase('boss_today')

console.log('Postgres is running on port 5433. Press Ctrl+C to stop.')
const stop = async () => {
  await pg.stop()
  process.exit(0)
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
