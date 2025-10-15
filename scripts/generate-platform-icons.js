// Generate Windows .ico and Mac .icns from colabify.png
// Requires: npm install --save-dev png2icons

const fs = require('fs');
const path = require('path');

console.log('🔨 Generating platform-specific icons from colabify.png...\n');

const colabifyPngPath = path.join(__dirname, '../public/icons/colabify.png');
const buildDir = path.join(__dirname, '../build');

if (!fs.existsSync(colabifyPngPath)) {
  console.error('❌ Error: colabify.png not found in public/icons/');
  console.log('\nPlease ensure colabify.png exists before running this script.');
  process.exit(1);
}

// Try to load png2icons
let png2icons;
try {
  png2icons = require('png2icons');
  console.log('✅ png2icons package found');
} catch (error) {
  console.error('❌ Error: png2icons package not installed');
  console.log('\nInstall it with:');
  console.log('   npm install --save-dev png2icons');
  console.log('\nOr use the alternative method in build/README.md');
  process.exit(1);
}

// Read the source PNG
const input = fs.readFileSync(colabifyPngPath);
console.log('✅ Read colabify.png\n');

console.log('🖼️  Generating Windows icon (icon.ico)...');
try {
  // Generate Windows .ico file
  const icoOutput = png2icons.createICO(input, png2icons.BICUBIC, 0, false, true);
  
  if (icoOutput) {
    const icoPath = path.join(buildDir, 'icon.ico');
    fs.writeFileSync(icoPath, icoOutput);
    console.log(`✅ Created ${icoPath}`);
  } else {
    console.log('⚠️  Failed to generate .ico file');
  }
} catch (error) {
  console.error('❌ Error generating .ico:', error.message);
}

console.log('\n🍎 Generating Mac icon (icon.icns)...');
try {
  // Generate Mac .icns file
  const icnsOutput = png2icons.createICNS(input, png2icons.BICUBIC, 0);
  
  if (icnsOutput) {
    const icnsPath = path.join(buildDir, 'icon.icns');
    fs.writeFileSync(icnsPath, icnsOutput);
    console.log(`✅ Created ${icnsPath}`);
  } else {
    console.log('⚠️  Failed to generate .icns file');
  }
} catch (error) {
  console.error('❌ Error generating .icns:', error.message);
}

console.log('\n🎉 Platform icon generation complete!');
console.log('\n📋 Generated files:');
console.log('   - build/icon.ico (Windows)');
console.log('   - build/icon.icns (Mac)');
console.log('\nYou can now run: npm run electron:build:win');
console.log('');

