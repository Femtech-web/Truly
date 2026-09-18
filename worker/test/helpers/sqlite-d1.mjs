import { DatabaseSync } from 'node:sqlite'
import { readFileSync, readdirSync } from 'node:fs'

/** Transactional SQLite adapter for real migration/SQL checks, not a mock of outcomes. */
export function createTestDatabase() {
  const sqlite = new DatabaseSync(':memory:')
  const directory = new URL('../../../migrations/', import.meta.url)
  for (const file of readdirSync(directory).filter(name => name.endsWith('.sql')).sort()) {
    sqlite.exec(readFileSync(new URL(file, directory), 'utf8'))
  }
  function prepare(sql, values = []) {
    const statement = () => sqlite.prepare(sql)
    return {
      bind: (...args) => prepare(sql, args),
      first: async () => statement().get(...values) ?? null,
      all: async () => ({ results: statement().all(...values) }),
      run: async () => ({ meta: { changes: Number(statement().run(...values).changes) } }),
    }
  }
  return { sqlite, DB: { prepare, batch: async statements => {
    sqlite.exec('BEGIN')
    try {
      const results = []
      for (const statement of statements) results.push(await statement.run())
      sqlite.exec('COMMIT')
      return results
    } catch (error) { sqlite.exec('ROLLBACK'); throw error }
  } } }
}
