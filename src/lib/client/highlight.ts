function collectTextNodes(root: HTMLElement): Text[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];

  while (walker.nextNode()) {
    nodes.push(walker.currentNode as Text);
  }

  return nodes;
}

function compact(value: string): string {
  return value.replace(/[\s,$%]/g, "").toLowerCase();
}

function wrapChars(node: Text, start: number, end: number): HTMLElement {
  const mark = document.createElement("mark");
  mark.className = "pdf-highlight";
  const rest = node.splitText(start);
  rest.splitText(end - start);
  mark.textContent = rest.nodeValue;
  rest.parentNode?.replaceChild(mark, rest);

  return mark;
}

/**
 * PDF.js splits glyphs across many text nodes. Match the cited figure or
 * phrase on a punctuation-stripped haystack, then map back onto those nodes.
 */
export function highlightText(root: HTMLElement, search: string): HTMLElement | null {
  const needle = compact(search);

  if (needle.length < 1) {
    return null;
  }

  const nodes = collectTextNodes(root);
  const map: Array<{ node: Text; offset: number }> = [];
  let haystack = "";

  for (const node of nodes) {
    const value = node.nodeValue ?? "";

    for (let offset = 0; offset < value.length; offset += 1) {
      if (/[\s,$%]/.test(value[offset])) {
        continue;
      }

      haystack += value[offset].toLowerCase();
      map.push({ node, offset });
    }
  }

  let index = haystack.indexOf(needle);

  if (index === -1 && needle.length > 8) {
    index = haystack.indexOf(needle.slice(0, 8));
  }

  if (index === -1) {
    return null;
  }

  const length = Math.min(needle.length, haystack.length - index);
  const covered = new Map<Text, { start: number; end: number }>();

  for (let i = index; i < index + length; i += 1) {
    const point = map[i];

    if (!point) {
      break;
    }

    const current = covered.get(point.node);

    if (!current) {
      covered.set(point.node, { start: point.offset, end: point.offset + 1 });
      continue;
    }

    current.end = point.offset + 1;
  }

  let firstMark: HTMLElement | null = null;

  for (const [node, range] of covered) {
    try {
      const mark = wrapChars(node, range.start, range.end);
      firstMark ??= mark;
    } catch {
      // Text node may already have been rewritten; skip.
    }
  }

  return firstMark;
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
