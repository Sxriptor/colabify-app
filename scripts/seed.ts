#!/usr/bin/env tsx

import { seedDatabase } from '../src/lib/database'

async function main() {
  try {
    console.log('Starting database seeding...')
    await seedDatabase()
    console.log('Database seeded successfully!')
    process.exit(0)
  } catch (error) {
    console.error('Seeding failed:', error)
    process.exit(1)
  }
}

main()