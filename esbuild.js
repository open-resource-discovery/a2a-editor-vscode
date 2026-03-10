import * as esbuild from "esbuild";

const isProduction = process.argv.includes("--production");
const isWatch = process.argv.includes("--watch");

const ctx = await esbuild.context({
  entryPoints: ["src/extension.ts"],
  bundle: true,
  format: "cjs",
  platform: "node",
  target: "node24",
  outfile: "out/extension.cjs",
  external: ["vscode"],
  sourcemap: !isProduction,
  minify: isProduction,
});

if (isWatch) {
  await ctx.watch();
  console.log("Watching for changes...");
} else {
  await ctx.rebuild();
  await ctx.dispose();
}
