import nextEnv from "@next/env";
import Database from "better-sqlite3";

nextEnv.loadEnvConfig(process.cwd());
const database = new Database(process.env.DATABASE_PATH || "./data/sime.db", { readonly: true });
const tables = [
  "tenants", "users", "security_settings", "students", "resources", "assignment_submissions",
  "ai_settings", "ai_conversations", "ai_messages", "ai_action_audit", "gamification_settings",
  "gamification_points", "intervention_notes", "platform_settings", "developer_api_settings",
  "developer_api_keys",
];
const booleanColumns = new Set([
  "active", "success", "enabled", "floating_enabled", "allow_admin", "allow_teacher", "allow_student",
  "allow_parent", "global_leaderboard_public", "resolved", "maintenance_mode", "allow_new_schools",
  "school_visible", "allow_read", "allow_write", "require_strong_passwords", "enforce_same_origin",
  "secure_cookies", "audit_logging",
]);
const jsonColumns = new Set(["payload", "action_json", "arguments_json", "details", "scopes"]);
const optionalTimestampColumns = new Set(["license_expires_at", "submitted_at", "follow_up_at", "expires_at", "last_used_at"]);
const identityTables = ["users", "students", "resources", "assignment_submissions", "ai_messages", "ai_action_audit", "gamification_points", "intervention_notes"];

function identifier(value) { return `"${value.replaceAll('"', '""')}"`; }
function literal(value, column) {
  if (value === null || value === undefined) return "null";
  if (value === "" && column === "license_starts_at") return "now()";
  if (value === "" && optionalTimestampColumns.has(column)) return "null";
  if (booleanColumns.has(column)) return Number(value) ? "true" : "false";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "null";
  const escaped = String(value).replaceAll("'", "''");
  return `'${escaped}'${jsonColumns.has(column) ? "::jsonb" : ""}`;
}

const output = [
  "-- Generated from the local SIME SQLite database. Contains password hashes; keep private.",
  "begin;",
  ...tables.map((table) => `alter table public.${identifier(table)} disable trigger user;`),
];

for (const table of tables) {
  const rows = database.prepare(`select * from ${identifier(table)}`).all();
  for (const row of rows) {
    const columns = Object.keys(row);
    const values = columns.map((column) => literal(row[column], column));
    let statement = `insert into public.${identifier(table)} (${columns.map(identifier).join(",")}) values (${values.join(",")})`;
    if (table === "platform_settings") statement += ` on conflict (id) do update set ${columns.filter((column) => column !== "id").map((column) => `${identifier(column)}=excluded.${identifier(column)}`).join(",")}`;
    statement += ";";
    output.push(statement);
  }
}

for (const table of identityTables) {
  output.push(`select setval(pg_get_serial_sequence('public.${table}','id'),coalesce(max(id),1),max(id) is not null) from public.${identifier(table)};`);
}
output.push(
  ...tables.map((table) => `alter table public.${identifier(table)} enable trigger user;`),
  "insert into public.schema_migrations(version) values('sqlite-demo-import-v1') on conflict do nothing;",
  "commit;",
);

database.close();
process.stdout.write(output.join("\n"));
