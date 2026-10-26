// A small BibTeX reader for content/publications.bib. It handles the subset the file uses:
// @type{key, field = {braced {nested}} | "quoted" | bare,} and % comments. Each entry keeps its
// raw source so the site can offer it as a copy-able BibTeX citation.
import { readFileSync } from "node:fs";
import { join } from "node:path";

export type Pub = {
  key: string;
  type: "journal" | "conference";
  title: string;
  authors: string[];
  venue: string;
  year: number;
  details: string;      // volume, number, pages, place
  doi?: string;
  arxiv?: string;
  note?: string;        // "abstract" | "preprint"
  topics: string[];
  raw: string;
};

export const ME = "K. A. Muthukumar";

export const TOPICS: Record<string, string> = {
  signals: "Biomedical signals",
  imaging: "Medical images",
  anomaly: "Few-shot anomaly",
  infrared: "Infrared sensing",
  tracking: "Detection and tracking",
  edge: "Edge AI",
  "health-data": "Health data",
  computing: "Computing",
};

function readValue(src: string, i: number): [string, number] {
  while (/\s/.test(src[i])) i++;
  if (src[i] === "{") {
    let depth = 0, j = i;
    for (; j < src.length; j++) {
      if (src[j] === "{") depth++;
      else if (src[j] === "}" && --depth === 0) break;
    }
    return [src.slice(i + 1, j), j + 1];
  }
  if (src[i] === '"') {
    const j = src.indexOf('"', i + 1);
    return [src.slice(i + 1, j), j + 1];
  }
  const m = /^[^,}\s]+/.exec(src.slice(i))!;
  return [m[0], i + m[0].length];
}

const clean = (s: string) =>
  s.replace(/[{}]/g, "").replace(/\\&/g, "&").replace(/---/g, "-").replace(/--/g, "-").replace(/\s+/g, " ").trim();

// "Muthukumar, K. A." -> "K. A. Muthukumar"
const person = (a: string) => {
  const [last, first] = a.split(",").map((x) => x.trim());
  return first ? `${first} ${last}` : last;
};

export function parseBib(src: string): Pub[] {
  const text = src.split("\n").filter((l) => !l.trimStart().startsWith("%")).join("\n");
  const out: Pub[] = [];
  const re = /@(\w+)\s*\{\s*([^,\s]+)\s*,/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const kind = m[1].toLowerCase();
    const key = m[2];
    const start = m.index;
    // walk fields until the entry's closing brace
    const f: Record<string, string> = {};
    let i = re.lastIndex;
    for (;;) {
      while (/[\s,]/.test(text[i])) i++;
      if (text[i] === "}" || i >= text.length) break;
      const nm = /^(\w+)\s*=/.exec(text.slice(i));
      if (!nm) break;
      i += nm[0].length;
      const [v, next] = readValue(text, i);
      f[nm[1].toLowerCase()] = v;
      i = next;
    }
    const raw = text.slice(start, i + 1).trim();
    re.lastIndex = i + 1;

    const type = kind === "article" ? "journal" : "conference";
    const venue = clean(f.journal ?? f.booktitle ?? "");
    const bits = [
      f.volume && `vol. ${clean(f.volume)}`,
      f.number && `no. ${clean(f.number)}`,
      f.pages && (/^\d+$/.test(clean(f.pages)) ? `art. ${clean(f.pages)}` : `pp. ${clean(f.pages)}`),
      f.address && clean(f.address),
    ].filter(Boolean);
    out.push({
      key,
      type,
      title: clean(f.title ?? ""),
      authors: clean(f.author ?? "").split(/\s+and\s+/).map(person),
      venue,
      year: Number(clean(f.year ?? "0")),
      details: bits.join(", "),
      doi: f.doi && clean(f.doi),
      arxiv: f.eprint && clean(f.eprint),
      note: f.note && clean(f.note).toLowerCase(),
      topics: (f.keywords ?? "").split(",").map((t) => t.trim()).filter(Boolean),
      raw,
    });
  }
  return out.sort((a, b) => b.year - a.year || (a.type === b.type ? 0 : a.type === "journal" ? -1 : 1));
}

export function loadPublications(): Pub[] {
  // resolved from the project root: the build bundles this module elsewhere, so import.meta.url would drift
  return parseBib(readFileSync(join(process.cwd(), "content", "publications.bib"), "utf8"));
}
