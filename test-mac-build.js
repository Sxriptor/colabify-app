#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🧪 Testing Mac Electron build...');
console.log('🖥️ Platform:', process.platform);

if (process.platform !== 'darwin') {
  console.log('⚠️ This test is designed for macOS');
  process.exit(1);
}

// Test with the simple main file
console.log('🚀 Starting Electron with test main file...');

const electronPath = path.join(__dirname, 'node_modules', '.bin', 'electron');
const testMainPath = path.join(__dirname, 'electron', 'test-main.js');

const electronProcess = spawn(electronPath, [testMainPath], {
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

// Kill the process after 30 seconds for testing
setTimeout(() => {
  console.log('⏰ Test timeout, killing process...');
  electronProcess.kill();
}, 30000);