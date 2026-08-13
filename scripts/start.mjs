import nextEnv from "@next/env";
import { isAbsolute, resolve } from "node:path";

nextEnv.loadEnvConfig(process.cwd());
if (process.env.DATABASE_PATH && !isAbsolute(process.env.DATABASE_PATH)) process.env.DATABASE_PATH = resolve(process.cwd(), process.env.DATABASE_PATH);
process.env.PORT ||= "6969";
process.env.HOSTNAME ||= "0.0.0.0";
await import("../.next/standalone/server.js");
