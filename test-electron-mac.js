#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🧪 Testing Electron Mac Build');
console.log('=============================');

if (process.platform !== 'darwin') {
  console.log('⚠️ This test is for macOS only');
  process.exit(1);
}

console.log('🚀 Starting Electron in production mode...');

const electronPath = path.join(__dirname, 'node_modules', '.bin', 'electron');
const mainPath = path.join(__dirname, 'electron', 'main.js');

const electronProcess = spawn(electronPath, [mainPath], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'production'
  }
});

electronProcess.on('error', (error) => {
  console.error('❌ Failed to start Electron:', error);
});

electronProcess.on('exit', (code) => {
  console.log(`🏁 Electron exited with code: ${code}`);
});

// Kill after 60 seconds for testing
setTimeout(() => {
  console.log('⏰ Test timeout, killing Electron...');
  electronProcess.kill();
}, 60000);

console.log('🔍 Watch the Electron window for any error messages');
console.log('🛑 Press Ctrl+C to stop');