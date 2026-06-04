import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const assetsDir = path.join(root, 'assets');

const sourceCandidates = [
  path.join(root, 'WhatsApp Image 2026-05-23 at 17.26.00.jpeg'),
  path.join(assetsDir, 'logo-source.jpg'),
];

function resolveSource() {
  for (const candidate of sourceCandidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error('Logo source not found. Add WhatsApp Image 2026-05-23 at 17.26.00.jpeg to the project root.');
}

async function buildLogoPng(sourcePath) {
  return sharp(sourcePath)
    .trim({threshold: 12})
    .resize({width: 1400, withoutEnlargement: false})
    .png({compressionLevel: 9})
    .toBuffer();
}

const RED = {r: 220, g: 38, b: 38};

async function recolorLogoToRed(inputBuffer) {
  const {data, info} = await sharp(inputBuffer).ensureAlpha().raw().toBuffer({resolveWithObject: true});

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a === 0) {
      continue;
    }

    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    if (luminance < 200) {
      data[i] = RED.r;
      data[i + 1] = RED.g;
      data[i + 2] = RED.b;
    }
  }

  return sharp(data, {
    raw: {width: info.width, height: info.height, channels: 4},
  })
    .png({compressionLevel: 9})
    .toBuffer();
}

async function writeLoginIcon(logoBuffer) {
  await sharp(logoBuffer).toFile(path.join(assetsDir, 'login-icon.png'));
}

async function writeSplashIcon(logoBuffer) {
  await sharp(logoBuffer).toFile(path.join(assetsDir, 'splash-icon.png'));
}

async function writeAppIcon(logoBuffer) {
  await sharp(logoBuffer)
    .resize(1024, 1024, {
      fit: 'contain',
      background: {r: 255, g: 255, b: 255, alpha: 1},
    })
    .png()
    .toFile(path.join(assetsDir, 'icon.png'));
}

async function writeAndroidSplashLogos(logoBuffer) {
  const densities = {
    mdpi: 288,
    hdpi: 432,
    xhdpi: 576,
    xxhdpi: 864,
    xxxhdpi: 1152,
  };

  for (const [density, width] of Object.entries(densities)) {
    const outDir = path.join(root, 'android', 'app', 'src', 'main', 'res', `drawable-${density}`);
    fs.mkdirSync(outDir, {recursive: true});
    await sharp(logoBuffer)
      .resize({width, withoutEnlargement: false})
      .png()
      .toFile(path.join(outDir, 'splashscreen_logo.png'));
  }
}

async function main() {
  fs.mkdirSync(assetsDir, {recursive: true});

  const sourcePath = resolveSource();
  await sharp(sourcePath).jpeg({quality: 95}).toFile(path.join(assetsDir, 'logo-source.jpg'));

  const logoBuffer = await buildLogoPng(sourcePath);
  await writeSplashIcon(logoBuffer);
  await writeLoginIcon(logoBuffer);
  await writeAppIcon(logoBuffer);

  if (fs.existsSync(path.join(root, 'android'))) {
    await writeAndroidSplashLogos(logoBuffer);
  }

  console.log('Brand assets generated from:', sourcePath);
  console.log('- assets/logo-source.jpg');
  console.log('- assets/splash-icon.png');
  console.log('- assets/login-icon.png');
  console.log('- assets/icon.png');
  console.log('- android drawable-*dpi/splashscreen_logo.png');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
