const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const publicDir = path.resolve(__dirname, '../public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// 1. Base icon SVG: VozPDF modern indigo/violet audio book icon
const baseSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4f46e5" />
      <stop offset="100%" stop-color="#7c3aed" />
    </linearGradient>
    <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="100%" stop-color="#818cf8" />
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="130%" height="130%">
      <feDropShadow dx="0" dy="16" stdDeviation="24" flood-color="#1e1b4b" flood-opacity="0.35" />
    </filter>
  </defs>

  <!-- Background rounded rect -->
  <rect width="512" height="512" rx="112" fill="url(#bgGrad)" />

  <!-- Inner glowing badge -->
  <g filter="url(#shadow)">
    <!-- Document page outline -->
    <rect x="110" y="96" width="230" height="320" rx="24" fill="#ffffff" />
    
    <!-- PDF Corner Fold -->
    <path d="M280 96 L340 156 L280 156 Z" fill="#e0e7ff" />
    <path d="M280 96 L340 156 L340 96 Z" fill="#c7d2fe" />

    <!-- Document Lines (Text simulation) -->
    <rect x="146" y="180" width="130" height="12" rx="6" fill="#818cf8" />
    <rect x="146" y="212" width="158" height="10" rx="5" fill="#cbd5e1" />
    <rect x="146" y="238" width="140" height="10" rx="5" fill="#cbd5e1" />
    <rect x="146" y="264" width="150" height="10" rx="5" fill="#cbd5e1" />
    <rect x="146" y="290" width="110" height="10" rx="5" fill="#cbd5e1" />

    <!-- Audio headphone & wave badge overlay on bottom-right -->
    <circle cx="340" cy="340" r="82" fill="url(#accentGrad)" stroke="#ffffff" stroke-width="8" />

    <!-- Sound waves inside circle -->
    <path d="M305 340 L315 340" stroke="#ffffff" stroke-width="6" stroke-linecap="round" />
    <path d="M325 322 L325 358" stroke="#ffffff" stroke-width="6" stroke-linecap="round" />
    <path d="M340 310 L340 370" stroke="#ffffff" stroke-width="7" stroke-linecap="round" />
    <path d="M355 318 L355 362" stroke="#ffffff" stroke-width="6" stroke-linecap="round" />
    <path d="M370 332 L370 348" stroke="#ffffff" stroke-width="6" stroke-linecap="round" />
  </g>
</svg>`;

// 2. Maskable SVG: extra 15% safe-padding around the artwork
const maskableSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGradM" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4f46e5" />
      <stop offset="100%" stop-color="#7c3aed" />
    </linearGradient>
    <linearGradient id="accentGradM" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="100%" stop-color="#818cf8" />
    </linearGradient>
  </defs>

  <!-- Full-bleed background for maskable circle/squircle crops -->
  <rect width="512" height="512" fill="url(#bgGradM)" />

  <!-- Centered safe-zone group scaled to ~75% -->
  <g transform="translate(64, 64) scale(0.75)">
    <!-- Document page outline -->
    <rect x="110" y="96" width="230" height="320" rx="24" fill="#ffffff" />
    
    <!-- PDF Corner Fold -->
    <path d="M280 96 L340 156 L280 156 Z" fill="#e0e7ff" />
    <path d="M280 96 L340 156 L340 96 Z" fill="#c7d2fe" />

    <!-- Document Lines -->
    <rect x="146" y="180" width="130" height="12" rx="6" fill="#818cf8" />
    <rect x="146" y="212" width="158" height="10" rx="5" fill="#cbd5e1" />
    <rect x="146" y="238" width="140" height="10" rx="5" fill="#cbd5e1" />
    <rect x="146" y="264" width="150" height="10" rx="5" fill="#cbd5e1" />
    <rect x="146" y="290" width="110" height="10" rx="5" fill="#cbd5e1" />

    <!-- Audio circle overlay -->
    <circle cx="340" cy="340" r="82" fill="url(#accentGradM)" stroke="#ffffff" stroke-width="8" />

    <!-- Sound waves inside circle -->
    <path d="M305 340 L315 340" stroke="#ffffff" stroke-width="6" stroke-linecap="round" />
    <path d="M325 322 L325 358" stroke="#ffffff" stroke-width="6" stroke-linecap="round" />
    <path d="M340 310 L340 370" stroke="#ffffff" stroke-width="7" stroke-linecap="round" />
    <path d="M355 318 L355 362" stroke="#ffffff" stroke-width="6" stroke-linecap="round" />
    <path d="M370 332 L370 348" stroke="#ffffff" stroke-width="6" stroke-linecap="round" />
  </g>
</svg>`;

async function run() {
  const svgBuffer = Buffer.from(baseSvg);
  const maskableSvgBuffer = Buffer.from(maskableSvg);

  fs.writeFileSync(path.join(publicDir, 'icon.svg'), baseSvg);

  // Generate 192x192 PNG
  await sharp(svgBuffer)
    .resize(192, 192)
    .png()
    .toFile(path.join(publicDir, 'pwa-192x192.png'));

  // Generate 512x512 PNG
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'pwa-512x512.png'));

  // Generate maskable 512x512 PNG
  await sharp(maskableSvgBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'pwa-maskable-512x512.png'));

  // Generate apple-touch-icon 180x180 PNG
  await sharp(svgBuffer)
    .resize(180, 180)
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));

  // Generate favicon.ico (64x64 PNG format works in modern browsers)
  await sharp(svgBuffer)
    .resize(64, 64)
    .png()
    .toFile(path.join(publicDir, 'favicon.ico'));

  console.log('Successfully generated all PWA icons in /public!');
}

run().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
