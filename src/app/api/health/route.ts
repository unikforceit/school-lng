import { db } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function GET() { try { db.prepare("SELECT 1").get(); return Response.json({ status: "ok", service: "sime", timestamp: new Date().toISOString() }); } catch { return Response.json({ status: "error" }, { status: 503 }); } }
