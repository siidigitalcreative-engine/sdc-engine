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
  try {
    const dir = path.join(process.cwd(), "app", "lib", "fonts");
    /* The fallback needs its own family name: satori keeps only the first
       font for a given name and weight, so files sharing "Inter" were being
       ignored. Renderers list both families, as FONT_STACK below. */
    cached = await Promise.all([
      ...FILES.map(async ({ file, weight }) => ({
        name: "Inter",
        data: await readFile(path.join(dir, file)),
        weight,
        style: "normal",
      })),
      ...FALLBACK.map(async ({ file, weight }) => ({
        name: "InterExt",
        data: await readFile(path.join(dir, file)),
        weight,
        style: "normal",
      })),
    ]);
  } catch (error) {
    // Without the files the image still renders, just in the fallback face.
    console.error("print-fonts: could not load Inter", error);
    cached = [];
  }
  return cached;
}
