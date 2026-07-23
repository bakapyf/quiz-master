import sharp from "sharp";

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6366f1"/>
      <stop offset="100%" style="stop-color:#9333ea"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="96" fill="url(#g)"/>
  <text x="256" y="288" text-anchor="middle" font-family="Arial,sans-serif" font-size="220" font-weight="bold" fill="white">Q</text>
  <text x="340" y="360" text-anchor="middle" font-family="Arial,sans-serif" font-size="80" font-weight="bold" fill="rgba(255,255,255,0.85)">?</text>
</svg>`;

async function generate() {
  await sharp(Buffer.from(SVG)).resize(192, 192).png().toFile("public/icon-192.png");
  await sharp(Buffer.from(SVG)).resize(512, 512).png().toFile("public/icon-512.png");
  await sharp(Buffer.from(SVG)).resize(180, 180).png().toFile("public/apple-touch-icon.png");
  console.log("Icons generated successfully!");
}

generate();
