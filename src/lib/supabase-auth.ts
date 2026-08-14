import type { Role, Session } from "@/lib/auth";

// The project URL and publishable key are safe to ship to browsers. Environment
// variables can override them when this repository is deployed to another project.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://skxizqwipqthvukzgcll.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_jMZVKy6yx-jek07SX88Rpw_7xBou1Ld";

type SupabaseUser = {
  id: string;
  email?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
};

export type EditableUserProfile = {
  displayName: string;
  phone: string;
  address: string;
  bio: string;
  avatarUrl: string;
};

export type SupabaseTokens = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at?: number;
  user: SupabaseUser;
};

const roles = new Set<Role>(["superadmin", "admin", "teacher", "student", "parent"]);

async function authRequest<T>(path: string, init: RequestInit) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  const payload = await response.json().catch(() => null) as (T & { message?: string; error_description?: string }) | null;
  if (!response.ok || !payload) throw new Error(payload?.error_description || payload?.message || "Supabase authentication failed");
  return payload;
}

export function sessionFromUser(user: SupabaseUser, expiresAt = Date.now() + 60 * 60 * 1000): Session | null {
  const metadata = user.app_metadata || {};
  const profile = user.user_metadata || {};
  const role = metadata.role;
  const tenantId = metadata.tenant_id;
  const email = user.email?.toLowerCase();
  if (!email || typeof tenantId !== "string" || !roles.has(role as Role)) return null;
  return {
    userId: email,
    name: typeof profile.display_name === "string" && profile.display_name.trim() ? profile.display_name.trim() : typeof metadata.display_name === "string" ? metadata.display_name : email,
    role: role as Role,
    tenantId,
    exp: expiresAt,
  };
}

function metadataString(metadata: Record<string, unknown> | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" ? value : "";
}

export function editableProfileFromUser(user: SupabaseUser): EditableUserProfile {
  return {
    displayName: metadataString(user.user_metadata, "display_name") || metadataString(user.app_metadata, "display_name") || user.email || "",
    phone: metadataString(user.user_metadata, "phone"),
    address: metadataString(user.user_metadata, "address"),
    bio: metadataString(user.user_metadata, "bio"),
    avatarUrl: metadataString(user.user_metadata, "avatar_url"),
  };
}

export function tokenExpiry(accessToken: string) {
  try {
    const payload = JSON.parse(Buffer.from(accessToken.split(".")[1], "base64url").toString()) as { exp?: number };
    return typeof payload.exp === "number" ? payload.exp * 1000 : Date.now() + 60 * 60 * 1000;
  } catch {
    return Date.now() + 60 * 60 * 1000;
  }
}

export function signInWithPassword(email: string, password: string) {
  return authRequest<SupabaseTokens>("/token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email: email.toLowerCase(), password }),
  });
}

export function refreshSupabaseSession(refreshToken: string) {
  return authRequest<SupabaseTokens>("/token?grant_type=refresh_token", {
    method: "POST",
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
}

export async function userFromAccessToken(accessToken: string) {
  try {
    return await authRequest<SupabaseUser>("/user", {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    return null;
  }
}

export function updateUserMetadata(accessToken: string, profile: EditableUserProfile) {
  return authRequest<SupabaseUser>("/user", {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      data: {
        display_name: profile.displayName,
        phone: profile.phone,
        address: profile.address,
        bio: profile.bio,
        avatar_url: profile.avatarUrl,
      },
    }),
  });
}

export async function signOutAccessToken(accessToken: string) {
  await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
    method: "POST",
    cache: "no-store",
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${accessToken}` },
  }).catch(() => undefined);
}
