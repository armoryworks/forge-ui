export function humanizeIdentifier(identifier: string): string {
  return identifier
    .split('.')
    .map(humanizeSegment)
    .filter(Boolean)
    .join(' — ');
}

function humanizeSegment(segment: string): string {
  return segment
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word, i) => {
      if (word.length > 1 && /^[A-Z\d]+$/.test(word)) return word;
      const lower = word.toLowerCase();
      return i === 0 ? lower.charAt(0).toUpperCase() + lower.slice(1) : lower;
    })
    .join(' ');
}
