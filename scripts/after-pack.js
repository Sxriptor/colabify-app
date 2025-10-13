const fs = require('fs');
const path = require('path');

module.exports = async function(context) {
  console.log('🧹 Running after-pack cleanup...');

  const { appOutDir, electronPlatformName } = context;

  // Function to recursively remove platform-specific directories
  function removePlatformSpecificDirs(dirPath) {
    if (!fs.existsSync(dirPath)) return;

    const items = fs.readdirSync(dirPath);

    items.forEach(item => {
      const fullPath = path.join(dirPath, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        // Remove platform-specific directories that don't match current platform
        if (item.includes('darwin') && electronPlatformName !== 'darwin') {
          console.log(`🗑️ Removing ${fullPath}`);
          fs.rmSync(fullPath, { recursive: true, force: true });
        } else if (item.includes('linux') && electronPlatformName !== 'linux') {
          console.log(`🗑️ Removing ${fullPath}`);
          fs.rmSync(fullPath, { recursive: true, force: true });
        } else if (item.includes('win32') && electronPlatformName !== 'win32') {
          console.log(`🗑️ Removing ${fullPath}`);
          fs.rmSync(fullPath, { recursive: true, force: true });
        } else {
          // Recurse into subdirectories
          removePlatformSpecificDirs(fullPath);
        }
      }
    });
  }

  // Clean up node_modules in the packaged app
  const nodeModulesPath = path.join(appOutDir, 'resources', 'node_modules');
  if (fs.existsSync(nodeModulesPath)) {
    console.log('🧹 Cleaning platform-specific binaries from packaged node_modules...');
    removePlatformSpecificDirs(nodeModulesPath);
  }

  console.log('✅ After-pack cleanup completed');
};

