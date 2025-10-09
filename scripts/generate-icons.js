// Simple icon generator for PWA
// This creates basic colored squares as placeholders
// In production, you'd want to use proper icon files

const fs = require('fs');
const path = require('path');

// Create a simple SVG icon
const createSVGIcon = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" rx="${size * 0.125}" fill="#1f2937"/>
  <circle cx="${size/2}" cy="${size/2}" r="${size * 0.25}" fill="white"/>
  <circle cx="${size/2}" cy="${size/2}" r="${size * 0.125}" fill="#1f2937"/>
</svg>`;

// Icon sizes needed for PWA
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

const iconsDir = path.join(__dirname, '../public/icons');

// Create icons directory if it doesn't exist
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Generate SVG files (we'll use these as placeholders)
sizes.forEach(size => {
  const svgContent = createSVGIcon(size);
  const filename = `icon-${size}x${size}.svg`;
  fs.writeFileSync(path.join(iconsDir, filename), svgContent);
  console.log(`Generated ${filename}`);
});

console.log('Icon generation complete!');
console.log('Note: These are placeholder SVG icons. For production, convert to PNG format.');