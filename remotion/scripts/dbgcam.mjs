// usage: node scripts/dbgcam.mjs <out.jpg> <frame> '<json cams [{pos,look,fov}]>'  -> one still per cam (_0.._n)
import fs from "node:fs"; import path from "node:path";
const tmp = path.resolve("remotion-tmp"); fs.mkdirSync(tmp, { recursive: true }); process.env.TEMP = process.env.TMP = process.env.TMPDIR = tmp;
const { bundle } = await import("@remotion/bundler"); const { renderStill, selectComposition } = await import("@remotion/renderer");
const [out, frame, camsJ] = process.argv.slice(2); const cams = JSON.parse(camsJ);
const browserExecutable = "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const chromiumOptions = { gl: "swangle" };
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), publicDir: path.resolve("public") });
for (let i = 0; i < cams.length; i++) {
  const inputProps = { cam: cams[i] };
  const composition = await selectComposition({ serveUrl, id: "BaychimoShort", browserExecutable, chromiumOptions, inputProps });
  await renderStill({ composition, serveUrl, frame: Number(frame), output: out.replace(".jpg", `_${i}.jpg`), imageFormat: "jpeg", scale: 0.5, browserExecutable, chromiumOptions, inputProps, timeoutInMilliseconds: 600000 });
}
fs.rmSync(serveUrl, { recursive: true, force: true });
