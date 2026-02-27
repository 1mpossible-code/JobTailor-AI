import { cp, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const from = resolve(root, "public");
const to = resolve(root, "dist");

await mkdir(to, { recursive: true });
await cp(from, to, { recursive: true });
