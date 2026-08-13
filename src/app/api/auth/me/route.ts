import { getSession } from "@/lib/auth";
import { jsonError } from "@/lib/http";
export const dynamic = "force-dynamic";
export async function GET() { const session = await getSession(); return session ? Response.json({ data: session }) : jsonError("Authentication required", 401); }
