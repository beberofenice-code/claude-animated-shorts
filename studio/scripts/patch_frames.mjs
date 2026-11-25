// Re-render a list of frames as lossless PNG stills, one browser per worker.
// usage: node scripts/patch_frames.mjs <Comp> <outDir> <framesFile> <workerIndex> <workerCount> [scale]
// framesFile holds comma-separated frame numbers; worker i takes every workerCount-th frame.
// Existing PNGs are skipped, so a killed worker can simply be restarted.
import fs from "node:fs";
import path from "node:path";
const TMPD = path.resolve("../.remotion-tmp"); fs.mkdirSync(TMPD, { recursive: true }); process.env.TEMP = process.env.TMP = process.env.TMPDIR = TMPD;
const { bundle } = await import("@remotion/bundler");
const { renderStill, selectComposition, openBrowser } = await import("@remotion/renderer");
const [comp, outDir, framesFile, wi, wn, scale = "1.3333333333333333"] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const all = fs.readFileSync(framesFile, "utf8").trim().split(",").map(Number);
const mine = all.filter((_, i) => i % Number(wn) === Number(wi)).filter((f) => !fs.existsSync(path.join(outDir, `f${String(f).padStart(4, "0")}.png`)));
const browserExecutable = "/opt/pw-browsers/chromium";
const chromiumOptions = { gl: "angle", headless: true };
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), publicDir: path.resolve("public") });
const composition = await selectComposition({ serveUrl, id: comp, chromiumOptions, browserExecutable });
let browser = await openBrowser("chrome", { browserExecutable, chromiumOptions });
let n = 0;
for (const f of mine) {
  const out = path.join(outDir, `f${String(f).padStart(4, "0")}.png`);
  const t0 = Date.now();
  await renderStill({ composition, serveUrl, frame: f, output: out + ".tmp.png", imageFormat: "png", scale: Number(scale),
    puppeteerInstance: browser, chromiumOptions, browserExecutable, timeoutInMilliseconds: 300000 });
  fs.renameSync(out + ".tmp.png", out);
  console.log(`w${wi} frame ${f} ${((Date.now() - t0) / 1000).toFixed(1)}s (${++n}/${mine.length})`);
  // fresh browser every 60 frames keeps GPU-process memory in check
  if (n % 60 === 0) { await browser.close({ silent: true }); browser = await openBrowser("chrome", { browserExecutable, chromiumOptions }); }
}
await browser.close({ silent: true });
console.log(`w${wi} DONE`);
