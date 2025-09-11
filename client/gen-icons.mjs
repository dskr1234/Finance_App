// gen-icons.mjs — generates LRF icons (192, 512, 512 maskable) + favicon
import fs from "node:fs";
import sharp from "sharp";

fs.mkdirSync("public/icons", { recursive: true });

const TEXT = process.env.ICON_TEXT || "LRF";

// auto font-size based on letters
const baseFont = (() => {
  const n = TEXT.length;
  if (n <= 2) return 240;
  if (n === 3) return 200;   // good for "LRF"
  if (n === 4) return 170;
  return 150;
})();

// tweak letter spacing if you want the letters tighter/looser
const LETTER_SPACING = "-6"; // px as string; try "-4" or "0" if needed

const svg = (size = 512, { maskable = false } = {}) => `<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#4f46e5"/>
      <stop offset="1" stop-color="#0ea5e9"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${maskable ? size*0.25 : size*0.19}" fill="url(#g)"/>
  <text
    x="50%" y="55%"
    text-anchor="middle"
    dominant-baseline="middle"
    font-family="system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Inter, sans-serif"
    font-size="${maskable ? Math.round(baseFont*0.92) : baseFont}"
    font-weight="800"
    letter-spacing="${LETTER_SPACING}"
    fill="#ffffff">${TEXT}</text>
</svg>`;

async function write(file, contents) {
  await sharp(Buffer.from(contents)).png().toFile(file);
}

await write("public/icons/icon-512.png", svg(512));
await write("public/icons/icon-512-maskable.png", svg(512, { maskable: true }));
await sharp(Buffer.from(svg(512))).png().resize(192, 192).toFile("public/icons/icon-192.png");

// favicons
await sharp(Buffer.from(svg(512))).png().resize(64, 64).toFile("public/favicon.png");
await sharp(Buffer.from(svg(512))).png().resize(32, 32).toFile("public/favicon-32.png");

console.log("✅ Icons generated for text:", TEXT);
console.log(" -> public/icons/icon-192.png");
console.log(" -> public/icons/icon-512.png");
console.log(" -> public/icons/icon-512-maskable.png");
console.log(" -> public/favicon.png, public/favicon-32.png");
