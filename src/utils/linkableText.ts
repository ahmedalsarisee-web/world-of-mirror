export type TextSegment =
  | {type: 'text'; value: string}
  | {type: 'link'; value: string; url: string};

const LINK_PATTERN =
  /(https?:\/\/[^\s<>"']+|(?:maps\.google\.[^\s<>"']+|goo\.gl\/maps[^\s<>"']*|maps\.app\.goo\.gl\/[^\s<>"']+))/gi;

export function normalizeLinkUrl(raw: string): string {
  const trimmed = raw.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

export function splitTextWithLinks(text: string): TextSegment[] {
  if (!text) {
    return [];
  }

  const segments: TextSegment[] = [];
  let lastIndex = 0;
  const matches = [...text.matchAll(LINK_PATTERN)];

  for (const match of matches) {
    const index = match.index ?? 0;
    const matched = match[0];
    if (!matched) {
      continue;
    }

    if (index > lastIndex) {
      segments.push({type: 'text', value: text.slice(lastIndex, index)});
    }

    segments.push({
      type: 'link',
      value: matched,
      url: normalizeLinkUrl(matched),
    });
    lastIndex = index + matched.length;
  }

  if (lastIndex < text.length) {
    segments.push({type: 'text', value: text.slice(lastIndex)});
  }

  if (segments.length === 0) {
    segments.push({type: 'text', value: text});
  }

  return segments;
}

export function textContainsLink(text: string): boolean {
  LINK_PATTERN.lastIndex = 0;
  return LINK_PATTERN.test(text);
}
