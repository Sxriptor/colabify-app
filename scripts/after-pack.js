const fs = require('fs');
const path = require('path');

module.exports = async function(context) {
  console.log('🧹 Running after-pack cleanup...');

  const { appOutDir, electronPlatformName } = context;
  
  // Add timeout to prevent hanging
  const timeoutId = setTimeout(() => {
    console.log('⚠️ After-pack cleanup timeout - continuing with build...');
  }, 30000); // 30 second timeout

  try {
    // Function to recursively remove platform-specific directories
    function removePlatformSpecificDirs(dirPath, depth = 0) {
      // Safety: prevent infinite recursion
      if (depth > 10) {
        console.log(`⚠️ Max depth reached at ${dirPath}, skipping...`);
        return;
      }

      if (!fs.existsSync(dirPath)) return;

      let items;
      try {
        items = fs.readdirSync(dirPath);
      } catch (error) {
        console.log(`⚠️ Cannot read directory ${dirPath}: ${error.message}`);
        return;
      }

      items.forEach(item => {
        try {
          const fullPath = path.join(dirPath, item);
          
          let stat;
          try {
            stat = fs.lstatSync(fullPath); // Use lstatSync to avoid following symlinks
          } catch (statError) {
            console.log(`⚠️ Cannot stat ${fullPath}: ${statError.message}`);
            return;
          }

          // Skip symlinks to avoid potential issues
          if (stat.isSymbolicLink()) {
            console.log(`⏭️ Skipping symlink: ${fullPath}`);
            return;
          }

          if (stat.isDirectory()) {
            // Remove platform-specific directories that don't match current platform
            const shouldRemove = 
              (item.includes('darwin') && electronPlatformName !== 'darwin') ||
              (item.includes('linux') && electronPlatformName !== 'linux') ||
              (item.includes('win32') && electronPlatformName !== 'win32');

            if (shouldRemove) {
              console.log(`🗑️ Removing ${fullPath}`);
              try {
                fs.rmSync(fullPath, { recursive: true, force: true, maxRetries: 3 });
              } catch (rmError) {
                console.log(`⚠️ Failed to remove ${fullPath}: ${rmError.message}`);
              }
            } else {
              // Recurse into subdirectories with increased depth
              removePlatformSpecificDirs(fullPath, depth + 1);
            }
          }
        } catch (itemError) {
          console.log(`⚠️ Error processing item ${item}: ${itemError.message}`);
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
  } catch (error) {
    console.error('❌ Error during after-pack cleanup:', error);
    // Don't fail the build, just log the error
  } finally {
    clearTimeout(timeoutId);
  }
};

