import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sizes = [192, 512];
const color = '#8B0000';

async function generateIcons() {
  const publicDir = path.join(__dirname, '..', 'public');
  
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  for (const size of sizes) {
    const svg = `
      <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${size}" height="${size}" fill="${color}"/>
        <text 
          x="${size / 2}" 
          y="${size / 2 + size * 0.15}" 
          font-family="serif" 
          font-size="${size * 0.4}" 
          fill="#FFFEF0" 
          text-anchor="middle"
          font-weight="bold">西</text>
      </svg>
    `;

    await sharp(Buffer.from(svg))
      .png()
      .toFile(path.join(publicDir, `icon-${size}.png`));

    console.log(`✓ Generated icon-${size}.png`);
  }
}

generateIcons().catch(console.error);
