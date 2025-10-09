#!/usr/bin/env tsx

import { resetDatabase } from '../src/lib/database'

async function main() {
  try {
    console.log('Starting database reset...')
    await resetDatabase()
    console.log('Database reset completed successfully!')
    process.exit(0)
  } catch (error) {
    console.error('Database reset failed:', error)
    process.exit(1)
  }
}

main()