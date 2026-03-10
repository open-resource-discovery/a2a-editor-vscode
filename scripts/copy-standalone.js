import { cpSync, mkdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const sourceDir = resolve(root, "node_modules/@open-resource-discovery/a2a-editor/dist-standalone");
const targetDir = resolve(root, "media");

if (!existsSync(sourceDir)) {
  console.error(`Source directory not found: ${sourceDir}`);
  console.error("Please install dependencies first: npm install");
  process.exit(1);
}

mkdirSync(targetDir, { recursive: true });

const files = ["a2a-playground.js", "a2a-playground.css"];
for (const f of files) {
  const src = resolve(sourceDir, f);
  if (existsSync(src)) {
    cpSync(src, resolve(targetDir, f));
    console.log(`Copied ${f}`);
  } else {
    console.warn(`Warning: ${f} not found in ${sourceDir}`);
  }
}

const imagesDir = resolve(sourceDir, "images");
if (existsSync(imagesDir)) {
  cpSync(imagesDir, resolve(targetDir, "images"), { recursive: true });
  console.log("Copied images/");
}

console.log("Standalone bundle copied to media/");
