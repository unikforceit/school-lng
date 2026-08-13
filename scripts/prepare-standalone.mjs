import { cpSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const standalone = join(root, ".next", "standalone");
if (!existsSync(join(standalone, "server.js"))) throw new Error("Next.js standalone server was not generated");
mkdirSync(join(standalone, ".next"), { recursive: true });
cpSync(join(root, ".next", "static"), join(standalone, ".next", "static"), { recursive: true, force: true });
cpSync(join(root, "public"), join(standalone, "public"), { recursive: true, force: true });
console.log("Prepared self-contained .next/standalone production artifact.");
