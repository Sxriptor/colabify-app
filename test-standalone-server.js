#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🧪 Testing Next.js Standalone Server');
console.log('====================================');

// Check if standalone server exists
const serverPath = path.join(__dirname, '.next/standalone/server.js');
const standalonePath = path.join(__dirname, '.next/standalone');

console.log('📁 Server path:', serverPath);
console.log('📁 Server exists:', fs.existsSync(serverPath));
console.log('📁 Standalone path:', standalonePath);
console.log('📁 Standalone exists:', fs.existsSync(standalonePath));

if (!fs.existsSync(serverPath)) {
  console.error('❌ Server not found! Run: npm run build');
  process.exit(1);
}

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

console.log('🔧 Environment check:');
console.log('  NODE_ENV:', process.env.NODE_ENV || 'not set');
console.log('  SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Missing');

// Copy .env.local to standalone if needed
const envPath = path.join(__dirname, '.env.local');
const standaloneEnvPath = path.join(standalonePath, '.env.local');
if (fs.existsSync(envPath) && !fs.existsSync(standaloneEnvPath)) {
  console.log('📦 Copying .env.local to standalone...');
  fs.copyFileSync(envPath, standaloneEnvPath);
}

// Start the server
console.log('🚀 Starting standalone server...');

const serverEnv = {
  ...process.env,
  PORT: '3000',
  HOSTNAME: 'localhost',
  NODE_ENV: 'production'
};

console.log('🔧 Server environment:');
console.log('  PORT:', serverEnv.PORT);
console.log('  HOSTNAME:', serverEnv.HOSTNAME);
console.log('  NODE_ENV:', serverEnv.NODE_ENV);

const server = spawn('node', [serverPath], {
  cwd: standalonePath,
  env: serverEnv,
  stdio: 'inherit'
});

server.on('error', (error) => {
  console.error('❌ Server error:', error);
});

server.on('exit', (code, signal) => {
  console.log(`📊 Server exited with code ${code} and signal ${signal}`);
});

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n🛑 Stopping server...');
  server.kill();
  process.exit(0);
});

console.log('🌐 Server should be available at: http://localhost:3000');
console.log('🛑 Press Ctrl+C to stop');