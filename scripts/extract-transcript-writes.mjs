import fs from 'fs';
import path from 'path';

const transcriptPath = process.argv[2];
const outDir = process.argv[3] || '.transcript-restore';
const maxLine = Number(process.argv[4]) || Infinity;
const targets = process.argv.slice(5);

const lines = fs.readFileSync(transcriptPath, 'utf8').split('\n');
fs.mkdirSync(outDir, {recursive: true});

const latest = new Map();
const limit = Math.min(lines.length, maxLine);

for (let i = 0; i < limit; i++) {
  const line = lines[i];
  if (!line.includes('"Write"')) continue;
  try {
    const obj = JSON.parse(line);
    const write = obj.message?.content?.find((c) => c.name === 'Write');
    if (!write?.input?.path || !write?.input?.contents) continue;
    const filePath = write.input.path.replace(/\\/g, '/');
    const baseName = path.basename(filePath);
    if (targets.length > 0 && !targets.some((t) => filePath.includes(t))) continue;
    latest.set(filePath, {line: i + 1, contents: write.input.contents, baseName});
  } catch {
    // skip
  }
}

for (const [filePath, {line, contents, baseName}] of latest) {
  const outPath = path.join(outDir, baseName);
  fs.writeFileSync(outPath, contents);
  console.log(`Line ${line} -> ${outPath} (${contents.length} chars) [${filePath}]`);
}
