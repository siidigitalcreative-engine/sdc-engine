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

let cached = null;

export async function interFonts() {
  if (cached) return cached;
  try {
    const dir = path.join(process.cwd(), "app", "lib", "fonts");
    cached = await Promise.all(
      FILES.map(async ({ file, weight }) => ({
        name: "Inter",
        data: await readFile(path.join(dir, file)),
        weight,
        style: "normal",
      }))
    );
  } catch (error) {
    // Without the files the image still renders, just in the fallback face.
    console.error("print-fonts: could not load Inter", error);
    cached = [];
  }
  return cached;
}
