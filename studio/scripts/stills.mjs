// usage: node scripts/stills.mjs <Comp> <outPrefix> <frame,frame,...> [scale]
import fs from "node:fs";
import path from "node:path";
const TMPD = path.resolve("../.remotion-tmp"); fs.mkdirSync(TMPD, { recursive: true }); process.env.TEMP = process.env.TMP = process.env.TMPDIR = TMPD;
const { bundle } = await import("@remotion/bundler");
const { renderStill, selectComposition } = await import("@remotion/renderer");
const [comp, prefix, frames, scale = "0.5"] = process.argv.slice(2);
fs.mkdirSync(path.dirname(prefix), { recursive: true });
const browserExecutable = process.env.CHROME || "/opt/pw-browsers/chromium";
const chromiumOptions = { gl: process.env.GL || "angle", headless: true };
const serveUrl = await bundle({ entryPoint: path.resolve(process.env.ENTRY || "src/index.ts"), publicDir: path.resolve("public") });
const composition = await selectComposition({ serveUrl, id: comp, chromiumOptions, browserExecutable });
const onBrowserLog = (l) => { if (l.type === "error" || l.type === "warning") console.log(`[${l.type}]`, l.text.slice(0, 300)); };
for (const f of frames.split(",").map(Number)) {
  const t0 = Date.now();
  await renderStill({ composition, serveUrl, frame: f, output: `${prefix}${f}.jpg`, imageFormat: "jpeg", jpegQuality: 88, scale: Number(scale),
    chromiumOptions, browserExecutable, timeoutInMilliseconds: 300000, onBrowserLog });
  console.log("still", f, ((Date.now() - t0) / 1000).toFixed(1) + "s");
}
fs.rmSync(path.dirname(serveUrl.replace("file://","")), { recursive: true, force: true });
