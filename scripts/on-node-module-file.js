module.exports = function(file) {
  // Exclude all @img/sharp platform-specific packages
  if (file.includes('@img/sharp-') && (
    file.includes('darwin') ||
    file.includes('linux') ||
    file.includes('win32') ||
    file.includes('wasm32') ||
    file.includes('libvips')
  )) {
    console.log(`🚫 Excluding @img/sharp platform-specific file: ${file}`);
    return false; // Exclude this file
  }

  // Include all other files
  return true;
};
