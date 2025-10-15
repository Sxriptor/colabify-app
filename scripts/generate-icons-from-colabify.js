// Generate all required icons from colabify.svg/png
// This creates icons for both PWA and Electron builds

const fs = require('fs');
const path = require('path');

// Try to load sharp for image resizing
let sharp;
try {
  sharp = require('sharp');
  console.log('✅ sharp package available for PNG resizing');
} catch (error) {
  console.log('⚠️  sharp package not found - will copy PNG without resizing');
  console.log('   Install with: npm install sharp');
}

// Icon sizes needed for PWA
const pwaIconSizes = [72, 96, 128, 144, 152, 192, 384, 512];

// Electron icon sizes for Linux
const electronIconSizes = [16, 32, 48, 64, 128, 256, 512, 1024];

const iconsDir = path.join(__dirname, '../public/icons');
const buildDir = path.join(__dirname, '../build');
const buildIconsDir = path.join(buildDir, 'icons');

// Create directories if they don't exist
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
  console.log('✅ Created build directory');
}

if (!fs.existsSync(buildIconsDir)) {
  fs.mkdirSync(buildIconsDir, { recursive: true });
  console.log('✅ Created build/icons directory');
}

// Source colabify SVG
const colabifySvgPath = path.join(iconsDir, 'colabify.svg');
const colabifyPngPath = path.join(iconsDir, 'colabify.png');

console.log('\n🎨 Colabify Icon Generator\n');
console.log('Source files:');
console.log(`  - SVG: ${colabifySvgPath}`);
console.log(`  - PNG: ${colabifyPngPath}`);

if (!fs.existsSync(colabifySvgPath) && !fs.existsSync(colabifyPngPath)) {
  console.error('❌ Error: colabify.svg or colabify.png not found in public/icons/');
  process.exit(1);
}

// Read the colabify SVG content
let colabifySvgContent = '';
if (fs.existsSync(colabifySvgPath)) {
  colabifySvgContent = fs.readFileSync(colabifySvgPath, 'utf8');
  console.log('✅ Read colabify.svg');
}

// Function to resize PNG using sharp
async function resizePNG(inputPath, outputPath, size) {
  if (!sharp) {
    // If sharp is not available, just copy the original
    fs.copyFileSync(inputPath, outputPath);
    return;
  }
  
  try {
    await sharp(inputPath)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 } // Transparent background
      })
      .png()
      .toFile(outputPath);
  } catch (error) {
    console.log(`⚠️  Failed to resize ${outputPath}, copying original:`, error.message);
    fs.copyFileSync(inputPath, outputPath);
  }
}

async function generateIcons() {
  console.log('\n📱 Generating PWA icons...');
  
  // For SVG icons, just copy the original colabify.svg (SVGs are scalable!)
  if (colabifySvgContent) {
    pwaIconSizes.forEach(size => {
      const filename = `icon-${size}x${size}.svg`;
      const filePath = path.join(iconsDir, filename);
      fs.copyFileSync(colabifySvgPath, filePath);
      console.log(`  ✅ Generated ${filename} (copied original SVG)`);
    });
  }
  
  // For PNG icons, actually resize them if sharp is available
  if (fs.existsSync(colabifyPngPath)) {
    // Generate sized PNG icons
    for (const size of pwaIconSizes) {
      const filename = `icon-${size}x${size}.png`;
      const filePath = path.join(iconsDir, filename);
      await resizePNG(colabifyPngPath, filePath, size);
      console.log(`  ✅ Generated ${filename} (${sharp ? 'resized' : 'copied'})`);
    }
    
    // Also ensure we have a 192x192 PNG
    const target192 = path.join(iconsDir, 'icon-192x192.png');
    if (!fs.existsSync(target192)) {
      await resizePNG(colabifyPngPath, target192, 192);
      console.log('  ✅ Generated icon-192x192.png');
    }
  }

  console.log('\n🖥️  Generating Electron icons...');

  // For Linux: Resize colabify.png to build/icons/ with various sizes
  if (fs.existsSync(colabifyPngPath)) {
    for (const size of electronIconSizes) {
      const filename = `${size}x${size}.png`;
      const targetPath = path.join(buildIconsDir, filename);
      await resizePNG(colabifyPngPath, targetPath, size);
      console.log(`  ✅ Generated ${filename} (Linux) - ${sharp ? 'resized' : 'copied'}`);
    }
  }

  // Copy colabify.png as the base icon (or resize to 512x512)
  if (fs.existsSync(colabifyPngPath)) {
    await resizePNG(colabifyPngPath, path.join(buildDir, 'icon.png'), 512);
    console.log('  ✅ Created build/icon.png (512x512)');
  }

  // Copy colabify.svg to build directory
  if (fs.existsSync(colabifySvgPath)) {
    fs.copyFileSync(colabifySvgPath, path.join(buildDir, 'icon.svg'));
    console.log('  ✅ Created build/icon.svg');
  }

  console.log('\n⚠️  IMPORTANT: Platform-specific icon generation');
  console.log('');
  console.log('Windows (.ico) and Mac (.icns) icons require special tools:');
  console.log('');
  console.log('📦 Install electron-icon-builder:');
  console.log('   npm install --save-dev electron-icon-builder');
  console.log('');
  console.log('🔨 Generate .ico and .icns files:');
  console.log('   npx electron-icon-builder --input=./public/icons/colabify.png --output=./build --flatten');
  console.log('');
  console.log('Alternative: Use online converters:');
  console.log('  • Windows .ico: https://convertio.co/png-ico/');
  console.log('  • Mac .icns: https://cloudconvert.com/png-to-icns');
  console.log('');
  console.log('Or install these packages:');
  console.log('   npm install --save-dev png2icons');
  console.log('   npm install --save-dev png-to-ico');
  console.log('');

  // Create a placeholder README for the build directory
  const readmeContent = `# Build Icons

This directory contains icons for Electron builds.

## Current Status

✅ Generated from colabify.svg/colabify.png
✅ Linux icons ready (PNG set)
⚠️  Windows .ico - needs generation
⚠️  Mac .icns - needs generation

## Generate Windows and Mac Icons

### Option 1: Using electron-icon-builder (Recommended)
\`\`\`bash
npm install --save-dev electron-icon-builder
npx electron-icon-builder --input=./public/icons/colabify.png --output=./build --flatten
\`\`\`

### Option 2: Using png2icons
\`\`\`bash
npm install --save-dev png2icons
node scripts/generate-platform-icons.js
\`\`\`

### Option 3: Manual Conversion
1. Windows (.ico): Upload colabify.png to https://convertio.co/png-ico/
   - Download as icon.ico
   - Place in build/icon.ico

2. Mac (.icns): Upload colabify.png to https://cloudconvert.com/png-to-icns
   - Download as icon.icns
   - Place in build/icon.icns

## Icon Requirements

- **Windows**: icon.ico (256x256, 128x128, 64x64, 48x48, 32x32, 16x16)
- **Mac**: icon.icns (1024x1024, 512x512, 256x256, 128x128, 64x64, 32x32, 16x16)
- **Linux**: PNG set (16, 32, 48, 64, 128, 256, 512, 1024)

All icons are generated from \`public/icons/colabify.png\` or \`colabify.svg\`.
`;

  fs.writeFileSync(path.join(buildDir, 'README.md'), readmeContent);
  console.log('✅ Created build/README.md with instructions');

  console.log('\n🎉 Icon generation complete!');
  console.log('\n📋 Next steps:');
  console.log('   1. Review generated icons in public/icons/ and build/');
  console.log('   2. Generate .ico and .icns files (see build/README.md)');
  console.log('   3. Run build: npm run electron:build:win');
  console.log('');
}

// Run the async function
generateIcons().catch(error => {
  console.error('❌ Error generating icons:', error);
  process.exit(1);
});

