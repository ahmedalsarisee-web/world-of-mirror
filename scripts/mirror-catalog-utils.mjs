import path from 'node:path';

export const GROUP_ORDER = {
  a: 1,
  b: 2,
  c: 3,
  d: 4,
  e: 5,
  f: 6,
  h: 7,
  menu: 90,
  other: 99,
};

const IMAGE_EXT_PATTERN = /\.(jpg|jpeg|png|webp)$/i;

export function parseCatalogSortKey(filename) {
  const base = filename.replace(/\.[^.]+$/i, '');

  if (/^menu/i.test(base)) {
    const number = Number.parseInt(base.replace(/\D/g, ''), 10) || 0;
    return {group: 'menu', groupOrder: GROUP_ORDER.menu, number, filename};
  }

  const match = base.match(/^([a-zA-Z]+)[^0-9]*(\d+)/);
  if (match) {
    const group = match[1].toLowerCase();
    return {
      group,
      groupOrder: GROUP_ORDER[group] ?? GROUP_ORDER.other,
      number: Number.parseInt(match[2], 10) || 0,
      filename,
    };
  }

  return {group: 'other', groupOrder: GROUP_ORDER.other, number: 0, filename};
}

export function sortCatalogFiles(files) {
  return [...files].sort((left, right) => {
    const a = parseCatalogSortKey(left);
    const b = parseCatalogSortKey(right);

    if (a.groupOrder !== b.groupOrder) {
      return a.groupOrder - b.groupOrder;
    }
    if (a.number !== b.number) {
      return a.number - b.number;
    }
    return a.filename.localeCompare(b.filename, undefined, {numeric: true, sensitivity: 'base'});
  });
}

export function buildCatalogSections(imageFiles) {
  const sections = [];
  const sectionByKey = new Map();

  for (const filename of imageFiles) {
    const {group} = parseCatalogSortKey(filename);
    if (!sectionByKey.has(group)) {
      const section = {key: group, imageIds: []};
      sectionByKey.set(group, section);
      sections.push(section);
    }
    sectionByKey.get(group).imageIds.push(filename);
  }

  sections.sort((left, right) => {
    const leftOrder = GROUP_ORDER[left.key] ?? GROUP_ORDER.other;
    const rightOrder = GROUP_ORDER[right.key] ?? GROUP_ORDER.other;
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }
    return left.key.localeCompare(right.key);
  });

  return sections;
}

export function toWebpBasename(filename) {
  return `${filename.replace(/\.[^.]+$/i, '')}.webp`;
}

export function listCatalogSourceEntries(catalogDir, fs, pathModule = path) {
  const byId = new Map();

  function walk(relativeDir) {
    const absoluteDir = relativeDir ? pathModule.join(catalogDir, relativeDir) : catalogDir;

    for (const entry of fs.readdirSync(absoluteDir, {withFileTypes: true})) {
      if (entry.name.startsWith('.') || entry.name === 'README.md') {
        continue;
      }

      const relativePath = relativeDir
        ? pathModule.join(relativeDir, entry.name).replace(/\\/g, '/')
        : entry.name;

      if (entry.isDirectory()) {
        walk(relativePath);
        continue;
      }

      if (!IMAGE_EXT_PATTERN.test(entry.name)) {
        continue;
      }

      const id = entry.name;
      const sourcePath = pathModule.join(catalogDir, relativePath);
      const depth = relativePath.split(/[/\\]/).length;
      const existing = byId.get(id);

      if (!existing || depth > existing.depth) {
        if (existing && existing.relativePath !== relativePath) {
          console.warn(
            `Duplicate catalog id "${id}" — using ${relativePath} (ignored ${existing.relativePath})`,
          );
        }
        byId.set(id, {id, sourcePath, relativePath, depth});
      } else if (existing.relativePath !== relativePath) {
        console.warn(
          `Duplicate catalog id "${id}" — keeping ${existing.relativePath} (ignored ${relativePath})`,
        );
      }
    }
  }

  walk('');

  const ids = sortCatalogFiles([...byId.keys()]);
  return ids.map((id) => byId.get(id));
}

export function listCatalogSourceFiles(catalogDir, fs, pathModule = path) {
  return listCatalogSourceEntries(catalogDir, fs, pathModule).map((entry) => entry.id);
}

/** Prefer project-root `all mirror`, then legacy `assets/all-mirror`. */
export function resolveCatalogSource(projectRoot, fs, pathModule = path) {
  const candidates = [
    pathModule.join(projectRoot, 'all mirror'),
    pathModule.join(projectRoot, 'assets', 'all-mirror'),
  ];

  for (const dir of candidates) {
    if (!fs.existsSync(dir)) {
      continue;
    }
    const entries = listCatalogSourceEntries(dir, fs, pathModule);
    if (entries.length > 0) {
      return {dir, entries};
    }
  }

  return null;
}
