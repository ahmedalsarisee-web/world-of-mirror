import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {listCatalogSourceEntries, resolveCatalogSource, toWebpBasename} from './mirror-catalog-utils.mjs';

const forceRebuild = process.argv.includes('--force');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
const resolvedSource = resolveCatalogSource(projectRoot, fs);
if (!resolvedSource) {
  console.error('No catalog source images found in "all mirror" or assets/all-mirror');
  process.exit(1);
}
const sourceDir = resolvedSource.dir;
const outputRoot = path.join(projectRoot, 'assets', 'mirror-catalog');
const thumbDir = path.join(outputRoot, 'thumbs');
const displayDir = path.join(outputRoot, 'display');
const manifestPath = path.join(outputRoot, 'manifest.json');

const THUMB_MAX_EDGE = 240;
const DISPLAY_MAX_EDGE = 1280;
const THUMB_QUALITY = 72;
const DISPLAY_QUALITY = 82;

async function writeOptimizedVariant({
  sourcePath,
  outputPath,
  maxEdge,
  quality,
}) {
  const image = sharp(sourcePath, {failOn: 'none'});
  const metadata = await image.metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  if (width <= 0 || height <= 0) {
    throw new Error(`Invalid image dimensions for ${sourcePath}`);
  }

  const scale = Math.min(1, maxEdge / Math.max(width, height));
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));

  await fs.promises.mkdir(path.dirname(outputPath), {recursive: true});
  await image
    .resize(targetWidth, targetHeight, {fit: 'inside', withoutEnlargement: true})
    .webp({quality, effort: 4})
    .toFile(outputPath);

  const stats = await fs.promises.stat(outputPath);
  return {
    width: targetWidth,
    height: targetHeight,
    bytes: stats.size,
  };
}

function isFreshOutput(sourcePath, outputPath) {
  if (!fs.existsSync(outputPath)) {
    return false;
  }
  const sourceMtime = fs.statSync(sourcePath).mtimeMs;
  const outputMtime = fs.statSync(outputPath).mtimeMs;
  return outputMtime >= sourceMtime;
}

async function optimizeCatalogImage({id, sourcePath}) {
  const webpName = toWebpBasename(id);
  const thumbPath = path.join(thumbDir, webpName);
  const displayPath = path.join(displayDir, webpName);

  const thumbFresh = !forceRebuild && isFreshOutput(sourcePath, thumbPath);
  const displayFresh = !forceRebuild && isFreshOutput(sourcePath, displayPath);

  let thumbMeta;
  let displayMeta;

  if (thumbFresh && displayFresh) {
    const thumbImage = sharp(thumbPath);
    const displayImage = sharp(displayPath);
    const [thumbInfo, displayInfo, thumbStats, displayStats] = await Promise.all([
      thumbImage.metadata(),
      displayImage.metadata(),
      fs.promises.stat(thumbPath),
      fs.promises.stat(displayPath),
    ]);
    thumbMeta = {
      width: thumbInfo.width ?? 0,
      height: thumbInfo.height ?? 0,
      bytes: thumbStats.size,
    };
    displayMeta = {
      width: displayInfo.width ?? 0,
      height: displayInfo.height ?? 0,
      bytes: displayStats.size,
    };
  } else {
    if (!thumbFresh) {
      thumbMeta = await writeOptimizedVariant({
        sourcePath,
        outputPath: thumbPath,
        maxEdge: THUMB_MAX_EDGE,
        quality: THUMB_QUALITY,
      });
    } else {
      const thumbInfo = await sharp(thumbPath).metadata();
      const thumbStats = await fs.promises.stat(thumbPath);
      thumbMeta = {
        width: thumbInfo.width ?? 0,
        height: thumbInfo.height ?? 0,
        bytes: thumbStats.size,
      };
    }

    if (!displayFresh) {
      displayMeta = await writeOptimizedVariant({
        sourcePath,
        outputPath: displayPath,
        maxEdge: DISPLAY_MAX_EDGE,
        quality: DISPLAY_QUALITY,
      });
    } else {
      const displayInfo = await sharp(displayPath).metadata();
      const displayStats = await fs.promises.stat(displayPath);
      displayMeta = {
        width: displayInfo.width ?? 0,
        height: displayInfo.height ?? 0,
        bytes: displayStats.size,
      };
    }
  }

  return {
    id,
    webpName,
    displayWidth: displayMeta.width,
    displayHeight: displayMeta.height,
    thumbBytes: thumbMeta.bytes,
    displayBytes: displayMeta.bytes,
  };
}

async function main() {
  console.log(`Source: ${path.relative(projectRoot, sourceDir)}`);

  await fs.promises.mkdir(thumbDir, {recursive: true});
  await fs.promises.mkdir(displayDir, {recursive: true});

  const sourceEntries = listCatalogSourceEntries(sourceDir, fs);
  const entries = [];

  for (const sourceEntry of sourceEntries) {
    const entry = await optimizeCatalogImage(sourceEntry);
    entries.push(entry);
    const location =
      sourceEntry.relativePath === sourceEntry.id ? sourceEntry.id : sourceEntry.relativePath;
    console.log(
      `  ${location} -> thumb ${Math.round(entry.thumbBytes / 1024)}KB, display ${Math.round(entry.displayBytes / 1024)}KB (${entry.displayWidth}x${entry.displayHeight})`,
    );
  }

  const expectedWebp = new Set(entries.map((entry) => entry.webpName));
  for (const dir of [thumbDir, displayDir]) {
    for (const file of fs.readdirSync(dir)) {
      if (!expectedWebp.has(file)) {
        fs.unlinkSync(path.join(dir, file));
      }
    }
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    sourceDir: path.relative(projectRoot, sourceDir).replace(/\\/g, '/'),
    thumbMaxEdge: THUMB_MAX_EDGE,
    displayMaxEdge: DISPLAY_MAX_EDGE,
    entries,
  };

  await fs.promises.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  const totalThumbKb = Math.round(entries.reduce((sum, entry) => sum + entry.thumbBytes, 0) / 1024);
  const totalDisplayKb = Math.round(entries.reduce((sum, entry) => sum + entry.displayBytes, 0) / 1024);
  console.log(`Optimized ${entries.length} catalog images (${totalThumbKb}KB thumbs, ${totalDisplayKb}KB display).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
