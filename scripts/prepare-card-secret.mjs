import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const target=join(process.cwd(),"src/generated/id-card-secret.ts");
await mkdir(dirname(target),{recursive:true});
await writeFile(target,`// Generated at build time. Never commit this file.\nexport const BUILD_ID_CARD_SECRET = ${JSON.stringify(randomBytes(32).toString("base64url"))};\n`,{encoding:"utf8",mode:0o600});
