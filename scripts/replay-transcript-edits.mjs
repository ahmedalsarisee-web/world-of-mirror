import fs from 'fs';
import path from 'path';

const transcriptPath = process.argv[2];
const maxLine = Number(process.argv[3]) || Infinity;
const targetFiles = process.argv.slice(4).map((f) => f.replace(/\\/g, '/').toLowerCase());

const lines = fs.readFileSync(transcriptPath, 'utf8').split('\n');
const files = new Map();

function normalizePath(p) {
  return p.replace(/\\/g, '/').toLowerCase();
}

function matchesTarget(filePath) {
  if (targetFiles.length === 0) return true;
  const norm = normalizePath(filePath);
  return targetFiles.some((t) => norm.endsWith(t.toLowerCase()));
}

function setFile(filePath, contents) {
  files.set(normalizePath(filePath), {filePath, contents});
}

function getFile(filePath) {
  return files.get(normalizePath(filePath))?.contents;
}

for (let i = 0; i < Math.min(lines.length, maxLine); i++) {
  const line = lines[i];
  if (!line.trim()) continue;
  let obj;
  try {
    obj = JSON.parse(line);
  } catch {
    continue;
  }

  const content = obj.message?.content;
  if (!Array.isArray(content)) continue;

  for (const item of content) {
    if (item.name === 'Write' && item.input?.path && item.input?.contents) {
      const filePath = item.input.path;
      if (!matchesTarget(filePath)) continue;
      setFile(filePath, item.input.contents);
    }

    if (item.name === 'StrReplace' && item.input?.path) {
      const filePath = item.input.path;
      if (!matchesTarget(filePath)) continue;
      const current = getFile(filePath);
      if (current === undefined) continue;
      const {old_string: oldStr, new_string: newStr} = item.input;
      if (!oldStr || newStr === undefined) continue;
      if (!current.includes(oldStr)) {
        // console.warn(`Line ${i + 1}: old_string not found in ${filePath}`);
        continue;
      }
      setFile(filePath, current.replace(oldStr, newStr));
    }
  }
}

const outDir = '.transcript-replayed';
fs.mkdirSync(outDir, {recursive: true});

for (const {filePath, contents} of files.values()) {
  const base = path.basename(filePath);
  const outPath = path.join(outDir, base);
  fs.writeFileSync(outPath, contents);
  console.log(`${base}: ${contents.length} chars`);
}
