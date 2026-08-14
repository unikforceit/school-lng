import { cookies } from "next/headers";
import { z } from "zod";
import { getSession, SESSION_COOKIE } from "@/lib/auth";
import { getClientIp, hasValidOrigin, jsonError, rateLimit } from "@/lib/http";
import { editableProfileFromUser, updateUserMetadata, userFromAccessToken } from "@/lib/supabase-auth";

const profileSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  phone: z.string().trim().max(30),
  address: z.string().trim().max(160),
  bio: z.string().trim().max(300),
  avatarUrl: z.string().trim().max(500).refine(value=>!value||value.startsWith("https://")||value.startsWith("http://"),"Profile photo must use an HTTP or HTTPS URL"),
}).strict();

export const dynamic = "force-dynamic";

async function authenticatedProfile() {
  const session = await getSession();
  const accessToken = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!session || !accessToken) return null;
  const user = await userFromAccessToken(accessToken);
  return user ? { session, accessToken, user } : null;
}

export async function GET() {
  const auth = await authenticatedProfile();
  if (!auth) return jsonError("Authentication required", 401);
  return Response.json({
    data: {
      ...editableProfileFromUser(auth.user),
      email: auth.session.userId,
      role: auth.session.role,
      tenantId: auth.session.tenantId,
    },
  });
}

export async function PATCH(request: Request) {
  if (!hasValidOrigin(request)) return jsonError("Invalid request origin", 403);
  const auth = await authenticatedProfile();
  if (!auth) return jsonError("Authentication required", 401);
  const limit = rateLimit(`profile:${auth.session.userId}:${getClientIp(request)}`, 12);
  if (!limit.allowed) return jsonError("Too many profile updates. Please try again shortly.", 429);
  const parsed = profileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Please check the profile fields", 400, parsed.error.flatten());
  try {
    const user = await updateUserMetadata(auth.accessToken, parsed.data);
    return Response.json({
      data: {
        ...editableProfileFromUser(user),
        email: auth.session.userId,
        role: auth.session.role,
        tenantId: auth.session.tenantId,
      },
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to update profile", 502);
  }
}
