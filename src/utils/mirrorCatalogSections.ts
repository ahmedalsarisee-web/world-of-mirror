import type {MirrorCatalogItem, MirrorCatalogSection} from '@app/types/mirrorCatalog';

const GROUP_ORDER: Record<string, number> = {
  a: 1,
  b: 2,
  c: 3,
  d: 4,
  e: 5,
  f: 6,
  h: 7,
  menu: 90,
  uploads: 95,
  other: 99,
};

export function parseCatalogSortKey(filename: string): {
  group: string;
  groupOrder: number;
  number: number;
  filename: string;
} {
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

export function resolveCatalogSectionKey(sourceName: string): string {
  return parseCatalogSortKey(sourceName).group;
}

export function resolveCatalogSortOrder(sourceName: string): number {
  const parsed = parseCatalogSortKey(sourceName);
  return parsed.groupOrder * 1_000_000 + parsed.number;
}

export function buildMirrorCatalogSections(items: MirrorCatalogItem[]): MirrorCatalogSection[] {
  const sections: MirrorCatalogSection[] = [];
  const sectionByKey = new Map<string, MirrorCatalogSection>();

  const sortedItems = [...items].sort((left, right) => {
    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }
    return left.id.localeCompare(right.id, undefined, {numeric: true, sensitivity: 'base'});
  });

  for (const item of sortedItems) {
    const key = item.section || 'other';
    if (!sectionByKey.has(key)) {
      const section: MirrorCatalogSection = {key, imageIds: []};
      sectionByKey.set(key, section);
      sections.push(section);
    }
    sectionByKey.get(key)?.imageIds.push(item.id);
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

export function buildMirrorCatalogImageIds(items: MirrorCatalogItem[]): string[] {
  return buildMirrorCatalogSections(items).flatMap((section) => section.imageIds);
}
