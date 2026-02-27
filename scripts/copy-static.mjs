import { cp, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const from = resolve(root, "public");
const to = resolve(root, "dist");
const jsPdfFrom = resolve(root, "node_modules", "jspdf", "dist", "jspdf.umd.min.js");
const jsPdfTo = resolve(root, "dist", "vendor", "jspdf.umd.min.js");

await mkdir(to, { recursive: true });
await cp(from, to, { recursive: true });
await mkdir(resolve(root, "dist", "vendor"), { recursive: true });
await cp(jsPdfFrom, jsPdfTo);
