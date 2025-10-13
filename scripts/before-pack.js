const fs = require('fs');
const path = require('path');

module.exports = async function(context) {
  console.log('🔧 Running before-pack setup...');

  const imgSharpDir = path.join(__dirname, '..', 'node_modules', '@img');

  // Create empty directories for platform-specific @img/sharp packages that don't exist
  // This prevents electron-builder from failing with ENOENT errors
  const platformPackages = [
    'sharp-darwin-arm64',
    'sharp-darwin-x64',
    'sharp-linux-arm',
    'sharp-linux-arm64',
    'sharp-linux-ppc64',
    'sharp-linux-s390x',
    'sharp-linux-x64',
    'sharp-linuxmusl-arm64',
    'sharp-linuxmusl-x64',
    'sharp-libvips-darwin-arm64',
    'sharp-libvips-darwin-x64',
    'sharp-libvips-linux-arm',
    'sharp-libvips-linux-arm64',
    'sharp-libvips-linux-ppc64',
    'sharp-libvips-linux-s390x',
    'sharp-libvips-linux-x64',
    'sharp-libvips-linuxmusl-arm64',
    'sharp-libvips-linuxmusl-x64',
    'sharp-wasm32'
  ];

  platformPackages.forEach(pkg => {
    const pkgDir = path.join(imgSharpDir, pkg);
    if (!fs.existsSync(pkgDir)) {
      console.log(`📁 Creating placeholder directory: ${pkgDir}`);
      fs.mkdirSync(pkgDir, { recursive: true });
      // Create a package.json to mark it as a valid package
      const packageJson = {
        name: `@img/${pkg}`,
        version: "0.0.0-placeholder",
        description: "Placeholder package to prevent electron-builder errors"
      };
      fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify(packageJson, null, 2));
    }
  });

  console.log('✅ Before-pack setup completed');
};
