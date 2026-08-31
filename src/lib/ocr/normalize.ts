const IMAGE_MARKDOWN_RE = /!\[[^\]]*]\([^)]*\)/g;
const IMAGE_HTML_RE = /<img\b[^>]*>/gi;
const NOISE_ATTR_RE =
  /\s+(?:style|class|width|height|align|valign|border|cellpadding|cellspacing|bgcolor)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const TABLE_RE = /<table\b[\s\S]*?<\/table>/gi;
const EXTRA_BLANK_RE = /\n{3,}/g;

function cellText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function htmlTableToMarkdown(tableHtml: string): string {
  const rows = [...tableHtml.matchAll(/<tr\b[\s\S]*?<\/tr>/gi)].map((match) => {
    return [...match[0].matchAll(/<t[dh]\b[\s\S]*?<\/t[dh]>/gi)].map((cell) =>
      cellText(cell[0]).replace(/\|/g, "\\|"),
    );
  });

  if (rows.length === 0) {
    return "";
  }

  const columnCount = Math.max(...rows.map((row) => row.length));
  const padded = rows.map((row) => {
    const next = [...row];

    while (next.length < columnCount) {
      next.push("");
    }

    return next;
  });

  const header = padded[0];
  const divider = header.map(() => "---");
  const body = padded.slice(1);
  const lines = [
    `| ${header.join(" | ")} |`,
    `| ${divider.join(" | ")} |`,
    ...body.map((row) => `| ${row.join(" | ")} |`),
  ];

  return lines.join("\n");
}

export function cleanMarkdown(text: string): string {
  let output = text.replace(IMAGE_MARKDOWN_RE, "[image]");
  output = output.replace(IMAGE_HTML_RE, "[image]");
  output = output.replace(NOISE_ATTR_RE, "");
  output = output.replace(TABLE_RE, (table) => htmlTableToMarkdown(table));
  output = output.replace(EXTRA_BLANK_RE, "\n\n");

  return output.trim();
}
