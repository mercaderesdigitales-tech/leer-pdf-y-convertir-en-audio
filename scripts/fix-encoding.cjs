const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, '../node_modules/mespeak/src/ESpeak.js');

if (fs.existsSync(targetPath)) {
  try {
    const rawContent = fs.readFileSync(targetPath, 'latin1');
    fs.writeFileSync(targetPath, rawContent, 'utf8');
    console.log('[fix-encoding] mespeak/src/ESpeak.js converted to valid UTF-8.');
  } catch (err) {
    console.warn('[fix-encoding] Could not convert ESpeak.js:', err.message);
  }
}
