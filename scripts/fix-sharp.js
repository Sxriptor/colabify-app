const fs = require("fs");
const path = require("path");

console.log('🧹 Cleaning up unused sharp platform binaries...');

const targets = [
  "../node_modules/@img/sharp-darwin-arm64",
  "../node_modules/@img/sharp-darwin-x64",
  "../node_modules/@img/sharp-linux-arm64",
  "../node_modules/@img/sharp-linux-x64",
  "../node_modules/@img/sharp-linux-arm64v8",
];

targets.forEach((t) => {
  const full = path.join(__dirname, t);
  if (fs.existsSync(full)) {
    fs.rmSync(full, { recursive: true, force: true });
    console.log("   ✅ Removed", path.basename(full));
  } else {
    console.log("   ⏭️  Skipped (not found)", path.basename(full));
  }
});

console.log('✅ Sharp cleanup complete\n');
