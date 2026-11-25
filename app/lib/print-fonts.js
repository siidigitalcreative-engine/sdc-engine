import { readFile } from "node:fs/promises";
import path from "node:path";

/* Satori falls back to a single-weight font unless real font files are given,
   which is why bold text rendered as regular. Inter is the app's own typeface,
   so the exports now match the screen. Loaded once per process. */

const FILES = [
  { file: "Inter-Regular.woff", weight: 400 },
  { file: "Inter-SemiBold.woff", weight: 600 },
  { file: "Inter-Bold.woff", weight: 700 },
];

/* The main files are a Latin subset with no peso sign, so ₱ rendered as an
   empty box in exports. These carry the extended range and are listed after
   the others as a fallback for anything missing from them. */
const FALLBACK = [
  { file: "Inter-LatinExt-400.woff", weight: 400 },
  { file: "Inter-LatinExt-600.woff", weight: 600 },
  { file: "Inter-LatinExt-700.woff", weight: 700 },
];

// What a renderer should set as fontFamily, so missing glyphs fall through.
export const FONT_STACK = "Inter, InterExt";

let cached = null;

export async function interFonts() {
  if (cached) return cached;

  const dir = path.join(process.cwd(), "app", "lib", "fonts");

  /* Each file is loaded on its own and a missing one is skipped, rather than
     losing the whole set. One absent file used to leave satori with no fonts
     at all, which fails the render outright with "No fonts are loaded". */
  const load = async (entries, family) => {
    const loaded = await Promise.all(entries.map(async ({ file, weight }) => {
      try {
        return { name: family, data: await readFile(path.join(dir, file)), weight, style: "normal" };
      } catch {
        console.error(`print-fonts: ${file} is missing, carrying on without it`);
        return null;
      }
    }));
    return loaded.filter(Boolean);
  };

  const main = await load(FILES, "Inter");
  const ext = main.length ? await load(FALLBACK, "InterExt") : [];

  cached = [...main, ...ext];
  return cached;
}
