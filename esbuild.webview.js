import * as esbuild from "esbuild";

const isProduction = process.argv.includes("--production");
const isWatch = process.argv.includes("--watch");

const ctx = await esbuild.context({
  entryPoints: ["src/webview/index.tsx"],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2022",
  outfile: "media/webview.js",
  sourcemap: !isProduction,
  minify: isProduction,
  jsx: "automatic",
  define: {
    "process.env.NODE_ENV": isProduction ? '"production"' : '"development"',
  },
  loader: {
    ".css": "css",
  },
});

if (isWatch) {
  await ctx.watch();
  console.log("Watching webview for changes...");
} else {
  await ctx.rebuild();
  await ctx.dispose();
}
