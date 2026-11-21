import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "node:path";
const browserExecutable = "/opt/pw-browsers/chromium";
const chromiumOptions = { gl: "swangle" };
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), publicDir: path.resolve("public") });
const composition = await selectComposition({ serveUrl, id: "ZombieShort", browserExecutable, chromiumOptions });
for (const f of process.argv[2].split(",").map(Number)) {
  const t0 = Date.now();
  await renderStill({ composition, serveUrl, frame: f, output: `out/z3/x_${f}.jpg`, imageFormat: "jpeg", jpegQuality: 88, browserExecutable, chromiumOptions, timeoutInMilliseconds: 600000 });
  console.log("still", f, ((Date.now() - t0) / 1000).toFixed(1));
}
