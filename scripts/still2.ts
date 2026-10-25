import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { join } from "node:path";
import { ROOT } from "../db";
const serveUrl = await bundle({ entryPoint: join(ROOT, "renderer", "index.ts") });
const composition = await selectComposition({ serveUrl, id: "MockDebug" });
await renderStill({ composition, serveUrl, output: "/tmp/mock.png", frame: 40 } as any);
console.log("ok");
