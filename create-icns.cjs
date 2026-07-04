const png2icons = require('png2icons');
const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, 'src-tauri', 'icons', 'icon.png');
const outputPath = path.join(__dirname, 'src-tauri', 'icons', 'icon.icns');

console.log('Creating macOS ICNS file...');
console.log('Input:', inputPath);
console.log('Output:', outputPath);

// Read PNG file
const input = fs.readFileSync(inputPath);

// Convert to ICNS
const icns = png2icons.createICNS(input, png2icons.BILINEAR, 0);

if (icns) {
  fs.writeFileSync(outputPath, icns);
  console.log('[OK] Created icon.icns successfully!');
} else {
  console.error('[ERROR] Failed to create ICNS file');
  process.exit(1);
}
