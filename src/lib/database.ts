import { supabaseAdmin } from './supabase'
import fs from 'fs'
import path from 'path'

/**
 * Run database migrations and setup
 */
export async function runMigrations() {
  try {
    // Read and execute schema
    const schemaPath = path.join(process.cwd(), 'database', 'schema.sql')
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8')
    
    console.log('Running database schema migration...')
    const { error: schemaError } = await supabaseAdmin.rpc('exec_sql', {
      sql: schemaSQL
    })
    
    if (schemaError) {
      console.error('Schema migration error:', schemaError)
      throw schemaError
    }
    
    console.log('Schema migration completed successfully')
    return true
  } catch (error) {
    console.error('Migration failed:', error)
    throw error
  }
}

/**
 * Seed database with development data
 */
export async function seedDatabase() {
  try {
    // Read and execute seed data
    const seedPath = path.join(process.cwd(), 'database', 'seed.sql')
    const seedSQL = fs.readFileSync(seedPath, 'utf8')
    
    console.log('Seeding database with development data...')
    const { error: seedError } = await supabaseAdmin.rpc('exec_sql', {
      sql: seedSQL
    })
    
    if (seedError) {
      console.error('Seed data error:', seedError)
      throw seedError
    }
    
    console.log('Database seeded successfully')
    return true
  } catch (error) {
    console.error('Seeding failed:', error)
    throw error
  }
}

/**
 * Reset database (drop all tables and recreate)
 */
export async function resetDatabase() {
  try {
    console.log('Resetting database...')
    
    // Drop all tables in reverse dependency order
    const dropSQL = `
      DROP TABLE IF EXISTS email_deliveries CASCADE;
      DROP TABLE IF EXISTS notifications CASCADE;
      DROP TABLE IF EXISTS repositories CASCADE;
      DROP TABLE IF EXISTS project_members CASCADE;
      DROP TABLE IF EXISTS projects CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
      DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
    `
    
    const { error: dropError } = await supabaseAdmin.rpc('exec_sql', {
      sql: dropSQL
    })
    
    if (dropError) {
      console.error('Drop tables error:', dropError)
      throw dropError
    }
    
    // Run migrations to recreate tables
    await runMigrations()
    
    console.log('Database reset completed')
    return true
  } catch (error) {
    console.error('Database reset failed:', error)
    throw error
  }
}