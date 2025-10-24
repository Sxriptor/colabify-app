#!/usr/bin/env node

/**
 * Build script for unsigned Electron apps
 * This script sets the necessary environment variables to build without code signing
 */

const { spawn } = require('child_process');
const path = require('path');

// Set environment variables for unsigned builds
process.env.CSC_IDENTITY_AUTO_DISCOVERY = 'false';
process.env.ELECTRON_UPDATER_ALLOW_UNSIGNED = '1';
process.env.SKIP_NOTARIZATION = 'true';

console.log('🔧 Building unsigned Electron app...');
console.log('📋 Environment variables set:');
console.log('  CSC_IDENTITY_AUTO_DISCOVERY=false');
console.log('  ELECTRON_UPDATER_ALLOW_UNSIGNED=1');
console.log('  SKIP_NOTARIZATION=true');

// Get the platform from command line args or default to current platform
const platform = process.argv[2] || process.platform;
let buildCommand;

switch (platform) {
  case 'darwin':
  case 'mac':
    buildCommand = 'electron-builder --mac --publish=never';
    break;
  case 'win32':
  case 'win':
  case 'windows':
    buildCommand = 'electron-builder --win --publish=never';
    break;
  case 'linux':
    buildCommand = 'electron-builder --linux --publish=never';
    break;
  default:
    buildCommand = 'electron-builder --publish=never';
}

console.log(`🚀 Running: npm run build && ${buildCommand}`);

// First run the Next.js build
const nextBuild = spawn('npm', ['run', 'build'], {
  stdio: 'inherit',
  shell: true,
  cwd: process.cwd()
});

nextBuild.on('close', (code) => {
  if (code !== 0) {
    console.error('❌ Next.js build failed');
    process.exit(code);
  }

  console.log('✅ Next.js build completed');
  console.log('🔨 Starting Electron build...');

  // Then run the Electron build
  const electronBuild = spawn('npx', buildCommand.split(' '), {
    stdio: 'inherit',
    shell: true,
    cwd: process.cwd(),
    env: process.env
  });

  electronBuild.on('close', (code) => {
    if (code === 0) {
      console.log('✅ Unsigned Electron build completed successfully!');
      console.log('📦 Check the dist-electron folder for your unsigned app');
    } else {
      console.error('❌ Electron build failed');
      process.exit(code);
    }
  });
});