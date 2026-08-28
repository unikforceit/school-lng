import Database from "better-sqlite3";
import path from "node:path";
import { scryptSync } from "node:crypto";

const dbPath =
  process.env.DATABASE_PATH ??
  (process.env.VERCEL
    ? path.join("/tmp", "sime.db")
    : path.join(process.cwd(), "data", "sime.db"));
const globalForDb = globalThis as unknown as { simeDb?: Database.Database };

export const db = globalForDb.simeDb ?? new Database(dbPath);

if (process.env.NODE_ENV !== "production") globalForDb.simeDb = db;

db.pragma("journal_mode = WAL");
db.pragma("busy_timeout = 10000");
db.pragma("foreign_keys = ON");
db.exec(`
  CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    plan TEXT NOT NULL DEFAULT 'starter',
    license_status TEXT NOT NULL DEFAULT 'trial' CHECK(license_status IN ('trial','active','expired','suspended')),
    license_starts_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    license_expires_at TEXT,
    max_students INTEGER NOT NULL DEFAULT 500 CHECK(max_students BETWEEN 1 AND 1000000),
    max_users INTEGER NOT NULL DEFAULT 100 CHECK(max_users BETWEEN 1 AND 100000),
    contact_email TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('superadmin','admin','teacher','student','parent')),
    password_hash TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, email)
  );
  CREATE TABLE IF NOT EXISTS security_settings (
    tenant_id TEXT PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
    max_login_attempts INTEGER NOT NULL DEFAULT 5 CHECK(max_login_attempts BETWEEN 3 AND 20),
    lockout_minutes INTEGER NOT NULL DEFAULT 15 CHECK(lockout_minutes BETWEEN 1 AND 1440),
    session_hours INTEGER NOT NULL DEFAULT 8 CHECK(session_hours BETWEEN 1 AND 168),
    ai_requests_per_minute INTEGER NOT NULL DEFAULT 10 CHECK(ai_requests_per_minute BETWEEN 1 AND 100),
    require_strong_passwords INTEGER NOT NULL DEFAULT 1,
    enforce_same_origin INTEGER NOT NULL DEFAULT 1,
    secure_cookies INTEGER NOT NULL DEFAULT 1,
    audit_logging INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS login_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    email TEXT NOT NULL,
    ip TEXT NOT NULL,
    success INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_login_attempts_lookup ON login_attempts(tenant_id,email,ip,created_at DESC);
  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT NOT NULL DEFAULT '',
    grade INTEGER NOT NULL CHECK (grade BETWEEN 1 AND 12),
    class_name TEXT NOT NULL,
    address TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS resources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    resource_type TEXT NOT NULL,
    title TEXT NOT NULL,
    payload TEXT NOT NULL CHECK (json_valid(payload)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_resources_tenant_type ON resources(tenant_id, resource_type, updated_at DESC);
  CREATE TABLE IF NOT EXISTS assignment_submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    assignment_id INTEGER NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    student_email TEXT NOT NULL,
    student_name TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    attachment_url TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','submitted','reviewed','returned')),
    score REAL,
    feedback TEXT NOT NULL DEFAULT '',
    submitted_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id,assignment_id,student_email)
  );
  CREATE INDEX IF NOT EXISTS idx_assignment_submissions_lookup ON assignment_submissions(tenant_id,assignment_id,status,updated_at DESC);
  CREATE TABLE IF NOT EXISTS ai_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL DEFAULT 'demo-school',
    request_id TEXT NOT NULL UNIQUE,
    model TEXT NOT NULL,
    prompt_chars INTEGER NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS ai_settings (
    tenant_id TEXT PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
    api_key_encrypted TEXT NOT NULL DEFAULT '',
    model TEXT NOT NULL DEFAULT 'openrouter/free',
    enabled INTEGER NOT NULL DEFAULT 1,
    floating_enabled INTEGER NOT NULL DEFAULT 1,
    allow_admin INTEGER NOT NULL DEFAULT 1,
    allow_teacher INTEGER NOT NULL DEFAULT 1,
    allow_student INTEGER NOT NULL DEFAULT 1,
    allow_parent INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS ai_conversations (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_email TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT 'New conversation',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_ai_conversations_owner ON ai_conversations(tenant_id,user_email,updated_at DESC);
  CREATE TABLE IF NOT EXISTS ai_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id TEXT NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_email TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('user','assistant')),
    content TEXT NOT NULL,
    model TEXT NOT NULL DEFAULT '',
    action_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(action_json)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation ON ai_messages(conversation_id,id);
  CREATE TABLE IF NOT EXISTS ai_action_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_email TEXT NOT NULL,
    conversation_id TEXT NOT NULL,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL DEFAULT '',
    arguments_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(arguments_json)),
    status TEXT NOT NULL CHECK(status IN ('success','denied','error')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_ai_actions_tenant_created ON ai_action_audit(tenant_id,created_at DESC);
  CREATE TABLE IF NOT EXISTS gamification_settings (
    tenant_id TEXT PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
    enabled INTEGER NOT NULL DEFAULT 1,
    attendance_points INTEGER NOT NULL DEFAULT 10 CHECK(attendance_points BETWEEN 0 AND 500),
    assignment_points INTEGER NOT NULL DEFAULT 20 CHECK(assignment_points BETWEEN 0 AND 500),
    exam_points INTEGER NOT NULL DEFAULT 30 CHECK(exam_points BETWEEN 0 AND 500),
    behavior_points INTEGER NOT NULL DEFAULT 15 CHECK(behavior_points BETWEEN 0 AND 500),
    global_leaderboard_public INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS gamification_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    student_name TEXT NOT NULL,
    class_name TEXT NOT NULL,
    points INTEGER NOT NULL CHECK(points BETWEEN -1000 AND 1000),
    source TEXT NOT NULL CHECK(source IN ('attendance','assignment','exam','behavior','bonus')),
    note TEXT NOT NULL DEFAULT '',
    awarded_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_gamification_leaderboard ON gamification_points(tenant_id,class_name,student_name);
  CREATE TABLE IF NOT EXISTS intervention_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    author_email TEXT NOT NULL,
    risk_status TEXT NOT NULL CHECK(risk_status IN ('on_track','at_risk','high_risk')),
    note TEXT NOT NULL,
    follow_up_at TEXT,
    resolved INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_intervention_notes_student ON intervention_notes(tenant_id,student_id,created_at DESC);
  CREATE TABLE IF NOT EXISTS platform_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_email TEXT NOT NULL,
    action TEXT NOT NULL,
    tenant_id TEXT,
    details TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_platform_audit_created ON platform_audit(created_at DESC);
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    audience_role TEXT NOT NULL DEFAULT 'all',
    user_email TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'system',
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_notifications_audience ON notifications(tenant_id,created_at DESC,id DESC);
  CREATE TABLE IF NOT EXISTS notification_reads (
    notification_id INTEGER NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    tenant_id TEXT NOT NULL,
    user_email TEXT NOT NULL,
    read_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(notification_id,tenant_id,user_email)
  );
  CREATE TRIGGER IF NOT EXISTS notify_resource_created AFTER INSERT ON resources BEGIN
    INSERT INTO notifications(tenant_id,audience_role,category,title,message,link) VALUES(NEW.tenant_id,'all',CASE WHEN NEW.resource_type IN ('messages','announcements','events') THEN 'communication' ELSE 'academic' END,'New ' || NEW.resource_type || ' record',NEW.title || ' was added.','/list/' || NEW.resource_type);
  END;
  CREATE TRIGGER IF NOT EXISTS notify_resource_updated AFTER UPDATE ON resources BEGIN
    INSERT INTO notifications(tenant_id,audience_role,category,title,message,link) VALUES(NEW.tenant_id,'all',CASE WHEN NEW.resource_type IN ('messages','announcements','events') THEN 'communication' ELSE 'academic' END,NEW.resource_type || ' updated','School information changed and is available now.','/list/' || NEW.resource_type);
  END;
  CREATE TRIGGER IF NOT EXISTS notify_resource_deleted AFTER DELETE ON resources BEGIN
    INSERT INTO notifications(tenant_id,audience_role,category,title,message,link) VALUES(OLD.tenant_id,'admin','academic',OLD.resource_type || ' record removed','A school record was removed.','/list/' || OLD.resource_type);
  END;
  CREATE TRIGGER IF NOT EXISTS notify_student_created AFTER INSERT ON students BEGIN
    INSERT INTO notifications(tenant_id,audience_role,category,title,message,link) VALUES(NEW.tenant_id,'admin','account','Student added',NEW.name || ' joined class ' || NEW.class_name || '.','/list/students');
    INSERT INTO notifications(tenant_id,audience_role,category,title,message,link) VALUES(NEW.tenant_id,'teacher','account','Student roster updated','A student was added to class ' || NEW.class_name || '.','/list/students');
  END;
  CREATE TRIGGER IF NOT EXISTS notify_student_updated AFTER UPDATE ON students BEGIN
    INSERT INTO notifications(tenant_id,audience_role,category,title,message,link) VALUES(NEW.tenant_id,'admin','account','Student updated',NEW.name || '''s profile changed.','/list/students/' || NEW.id);
    INSERT INTO notifications(tenant_id,audience_role,category,title,message,link) VALUES(NEW.tenant_id,'teacher','account','Student roster updated','A student profile changed in class ' || NEW.class_name || '.','/list/students/' || NEW.id);
  END;
  CREATE TRIGGER IF NOT EXISTS notify_student_deleted AFTER DELETE ON students BEGIN
    INSERT INTO notifications(tenant_id,audience_role,category,title,message,link) VALUES(OLD.tenant_id,'admin','account','Student removed',OLD.name || ' was removed from the school roster.','/list/students');
  END;
  CREATE TRIGGER IF NOT EXISTS notify_submission_created AFTER INSERT ON assignment_submissions BEGIN
    INSERT INTO notifications(tenant_id,audience_role,category,title,message,link) VALUES(NEW.tenant_id,'admin','academic','Assignment activity','A student saved assignment work.','/list/assignments');
    INSERT INTO notifications(tenant_id,audience_role,category,title,message,link) VALUES(NEW.tenant_id,'teacher','academic','Assignment activity','A student saved assignment work.','/list/assignments');
    INSERT INTO notifications(tenant_id,audience_role,user_email,category,title,message,link) VALUES(NEW.tenant_id,'student',NEW.student_email,'academic','Assignment saved','Your assignment work is saved.','/list/assignments');
  END;
  CREATE TRIGGER IF NOT EXISTS notify_submission_updated AFTER UPDATE ON assignment_submissions BEGIN
    INSERT INTO notifications(tenant_id,audience_role,user_email,category,title,message,link) VALUES(NEW.tenant_id,'student',NEW.student_email,'academic','Assignment ' || NEW.status,'Your assignment status is now ' || NEW.status || '.','/list/assignments');
    INSERT INTO notifications(tenant_id,audience_role,category,title,message,link) VALUES(NEW.tenant_id,'parent','academic','Assignment activity','Linked student assignment activity changed.','/list/assignments');
    INSERT INTO notifications(tenant_id,audience_role,category,title,message,link) VALUES(NEW.tenant_id,'teacher','academic','Assignment updated','Assignment work or review status changed.','/list/assignments');
  END;
  CREATE TRIGGER IF NOT EXISTS notify_points_created AFTER INSERT ON gamification_points BEGIN
    INSERT INTO notifications(tenant_id,audience_role,category,title,message,link) VALUES(NEW.tenant_id,'all','academic','Points awarded',NEW.student_name || ' earned ' || NEW.points || ' points.','/gamification');
  END;
  CREATE TRIGGER IF NOT EXISTS notify_intervention_created AFTER INSERT ON intervention_notes BEGIN
    INSERT INTO notifications(tenant_id,audience_role,category,title,message,link) VALUES(NEW.tenant_id,'admin','academic','Intervention note added','A new private intervention note requires staff attention.','/interventions');
    INSERT INTO notifications(tenant_id,audience_role,category,title,message,link) VALUES(NEW.tenant_id,'teacher','academic','Intervention note added','A new private intervention note requires staff attention.','/interventions');
  END;
  CREATE TRIGGER IF NOT EXISTS notify_intervention_updated AFTER UPDATE ON intervention_notes BEGIN
    INSERT INTO notifications(tenant_id,audience_role,category,title,message,link) VALUES(NEW.tenant_id,'admin','academic','Intervention updated','A student intervention plan changed.','/interventions');
    INSERT INTO notifications(tenant_id,audience_role,category,title,message,link) VALUES(NEW.tenant_id,'teacher','academic','Intervention updated','A student intervention plan changed.','/interventions');
  END;
  CREATE TRIGGER IF NOT EXISTS notify_security_settings AFTER UPDATE ON security_settings BEGIN
    INSERT INTO notifications(tenant_id,audience_role,category,title,message,link) VALUES(NEW.tenant_id,'admin','security','Security settings updated','Tenant security controls changed.','/admin/settings');
  END;
  CREATE TRIGGER IF NOT EXISTS notify_ai_settings AFTER UPDATE ON ai_settings BEGIN
    INSERT INTO notifications(tenant_id,audience_role,category,title,message,link) VALUES(NEW.tenant_id,'admin','system','SAGE settings updated','AI availability or permissions changed.','/admin/settings');
  END;
  CREATE TRIGGER IF NOT EXISTS notify_game_settings AFTER UPDATE ON gamification_settings BEGIN
    INSERT INTO notifications(tenant_id,audience_role,category,title,message,link) VALUES(NEW.tenant_id,'admin','academic','Gamification settings updated','Scoring or leaderboard visibility changed.','/gamification/settings');
  END;
  CREATE TRIGGER IF NOT EXISTS notify_tenant_updated AFTER UPDATE ON tenants WHEN NEW.id!='platform' BEGIN
    INSERT INTO notifications(tenant_id,audience_role,category,title,message,link) VALUES('platform','superadmin','platform','School updated',NEW.name || ' platform controls changed.','/superadmin/schools/' || NEW.id);
    INSERT INTO notifications(tenant_id,audience_role,category,title,message,link) VALUES(NEW.id,'admin','platform','School plan updated','Your school status, license, or profile changed.','/settings');
  END;
  CREATE TRIGGER IF NOT EXISTS notify_user_updated AFTER UPDATE ON users WHEN NEW.tenant_id!='platform' BEGIN
    INSERT INTO notifications(tenant_id,audience_role,category,title,message,link) VALUES('platform','superadmin','account','School account updated','An account status changed for tenant ' || NEW.tenant_id || '.','/superadmin/users');
    INSERT INTO notifications(tenant_id,audience_role,user_email,category,title,message,link) VALUES(NEW.tenant_id,NEW.role,NEW.email,'account','Account updated','Your account status or profile changed.','/profile');
  END;
  CREATE TABLE IF NOT EXISTS platform_settings (
    id INTEGER PRIMARY KEY CHECK(id=1),
    platform_name TEXT NOT NULL DEFAULT 'SIME',
    support_email TEXT NOT NULL DEFAULT 'support@sime.local',
    default_plan TEXT NOT NULL DEFAULT 'starter',
    trial_days INTEGER NOT NULL DEFAULT 30 CHECK(trial_days BETWEEN 1 AND 365),
    maintenance_mode INTEGER NOT NULL DEFAULT 0,
    allow_new_schools INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  INSERT OR IGNORE INTO platform_settings (id) VALUES (1);
  CREATE TABLE IF NOT EXISTS developer_api_settings (
    tenant_id TEXT PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
    enabled INTEGER NOT NULL DEFAULT 0,
    school_visible INTEGER NOT NULL DEFAULT 0,
    allow_read INTEGER NOT NULL DEFAULT 1,
    allow_write INTEGER NOT NULL DEFAULT 0,
    requests_per_minute INTEGER NOT NULL DEFAULT 60 CHECK(requests_per_minute BETWEEN 10 AND 1000),
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS developer_api_keys (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    key_prefix TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,
    scopes TEXT NOT NULL DEFAULT '["read"]' CHECK(json_valid(scopes)),
    active INTEGER NOT NULL DEFAULT 1,
    expires_at TEXT,
    last_used_at TEXT,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_developer_keys_tenant ON developer_api_keys(tenant_id,active,created_at DESC);
  CREATE TABLE IF NOT EXISTS developer_api_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    method TEXT NOT NULL,
    path TEXT NOT NULL,
    status INTEGER NOT NULL,
    ip TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_developer_logs_tenant ON developer_api_logs(tenant_id,created_at DESC);
  CREATE TRIGGER IF NOT EXISTS notify_assignment_deleted AFTER DELETE ON assignment_submissions BEGIN
    INSERT INTO notifications(tenant_id,audience_role,category,title,message,link) VALUES(OLD.tenant_id,'teacher','academic','Assignment work removed','A saved assignment submission was removed.','/list/assignments');
    INSERT INTO notifications(tenant_id,audience_role,category,title,message,link) VALUES(OLD.tenant_id,'admin','academic','Assignment work removed','A saved assignment submission was removed.','/list/assignments');
  END;
  CREATE TRIGGER IF NOT EXISTS notify_platform_settings AFTER UPDATE ON platform_settings BEGIN
    INSERT INTO notifications(tenant_id,audience_role,category,title,message,link) VALUES('platform','superadmin','platform','Platform settings updated','Global platform configuration changed.','/superadmin/settings');
  END;
  CREATE TRIGGER IF NOT EXISTS notify_developer_settings AFTER UPDATE ON developer_api_settings BEGIN
    INSERT INTO notifications(tenant_id,audience_role,category,title,message,link) VALUES('platform','superadmin','developer','Developer API settings updated','Developer access changed for tenant ' || NEW.tenant_id || '.','/superadmin/developer');
    INSERT INTO notifications(tenant_id,audience_role,category,title,message,link) VALUES(NEW.tenant_id,'admin','developer','Developer API settings updated','Your school developer API access changed.','/developer');
  END;
  CREATE TRIGGER IF NOT EXISTS notify_developer_key_created AFTER INSERT ON developer_api_keys BEGIN
    INSERT INTO notifications(tenant_id,audience_role,category,title,message,link) VALUES(NEW.tenant_id,'admin','security','Developer API key created','A new API credential was issued for your school.','/developer');
    INSERT INTO notifications(tenant_id,audience_role,category,title,message,link) VALUES('platform','superadmin','developer','Developer API key created','A school issued a new developer credential.','/superadmin/developer');
  END;
  CREATE TRIGGER IF NOT EXISTS notify_developer_key_updated AFTER UPDATE ON developer_api_keys BEGIN
    INSERT INTO notifications(tenant_id,audience_role,category,title,message,link) VALUES(NEW.tenant_id,'admin','security','Developer API key changed','An API credential status changed.','/developer');
  END;
  CREATE TRIGGER IF NOT EXISTS notify_developer_key_deleted AFTER DELETE ON developer_api_keys BEGIN
    INSERT INTO notifications(tenant_id,audience_role,category,title,message,link) VALUES(OLD.tenant_id,'admin','security','Developer API key revoked','An API credential was permanently removed.','/developer');
  END;
`);

const aiAuditColumns = db
  .prepare("PRAGMA table_info(ai_audit)")
  .all() as Array<{ name: string }>;
if (!aiAuditColumns.some((column) => column.name === "tenant_id")) {
  try {
    db.exec(
      "ALTER TABLE ai_audit ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'demo-school'",
    );
  } catch (error) {
    if (!(error instanceof Error && error.message.includes("duplicate column")))
      throw error;
  }
}
db.exec(
  "CREATE INDEX IF NOT EXISTS idx_ai_audit_tenant_created ON ai_audit(tenant_id,created_at DESC)",
);

const tenantColumns = db.prepare("PRAGMA table_info(tenants)").all() as Array<{
  name: string;
}>;
if (!tenantColumns.some((column) => column.name === "active"))
  db.exec("ALTER TABLE tenants ADD COLUMN active INTEGER NOT NULL DEFAULT 1");
const tenantAdditions = [
  ["plan", "TEXT NOT NULL DEFAULT 'starter'"],
  ["license_status", "TEXT NOT NULL DEFAULT 'trial'"],
  ["license_starts_at", "TEXT NOT NULL DEFAULT ''"],
  ["license_expires_at", "TEXT"],
  ["max_students", "INTEGER NOT NULL DEFAULT 500"],
  ["max_users", "INTEGER NOT NULL DEFAULT 100"],
  ["contact_email", "TEXT NOT NULL DEFAULT ''"],
] as const;
for (const [column, definition] of tenantAdditions)
  if (!tenantColumns.some((item) => item.name === column))
    db.exec(`ALTER TABLE tenants ADD COLUMN ${column} ${definition}`);

const usersTable = db
  .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'")
  .get() as { sql: string } | undefined;
if (usersTable && !usersTable.sql.includes("'superadmin'")) {
  db.transaction(() =>
    db.exec(`
    ALTER TABLE users RENAME TO users_legacy;
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('superadmin','admin','teacher','student','parent')),
      password_hash TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tenant_id,email)
    );
    INSERT INTO users (id,tenant_id,email,name,role,password_hash,active,created_at)
      SELECT id,tenant_id,email,name,role,password_hash,active,created_at FROM users_legacy;
    DROP TABLE users_legacy;
  `),
  )();
}
db.prepare("INSERT OR IGNORE INTO schema_migrations (version) VALUES (?)").run(
  "users-superadmin-v1",
);

for (const [id, name] of [
  ["platform", "SIME Platform"],
  ["demo-school", "SIME Demo School"],
  ["sample-academy", "Sample Academy"],
] as const) {
  db.prepare("INSERT OR IGNORE INTO tenants (id,name) VALUES (?,?)").run(
    id,
    name,
  );
  db.prepare(
    "INSERT OR IGNORE INTO security_settings (tenant_id) VALUES (?)",
  ).run(id);
  db.prepare("INSERT OR IGNORE INTO ai_settings (tenant_id) VALUES (?)").run(
    id,
  );
  db.prepare(
    "INSERT OR IGNORE INTO gamification_settings (tenant_id) VALUES (?)",
  ).run(id);
  db.prepare(
    "INSERT OR IGNORE INTO developer_api_settings (tenant_id) VALUES (?)",
  ).run(id);
}
db.prepare(
  "UPDATE tenants SET plan='enterprise',license_status='active',license_expires_at=NULL,max_students=1000000,max_users=100000 WHERE id='platform'",
).run();
if (
  !db
    .prepare(
      "SELECT 1 FROM schema_migrations WHERE version='tenant-licenses-v1'",
    )
    .get()
)
  db.transaction(() => {
    db.prepare(
      "UPDATE tenants SET license_status='active',license_starts_at=CASE WHEN license_starts_at='' THEN datetime('now') ELSE license_starts_at END,license_expires_at=COALESCE(license_expires_at,datetime('now','+365 days')),contact_email=CASE id WHEN 'demo-school' THEN 'admin@sime.local' WHEN 'sample-academy' THEN 'principal@sample.local' ELSE contact_email END WHERE id!='platform'",
    ).run();
    db.prepare(
      "INSERT INTO schema_migrations(version) VALUES ('tenant-licenses-v1')",
    ).run();
  })();
db.prepare(
  "UPDATE security_settings SET session_hours=168 WHERE tenant_id IN ('platform','demo-school','sample-academy') AND session_hours=8",
).run();
function demoHash(password: string, salt: string) {
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
const insertUser = db.prepare(
  "INSERT OR IGNORE INTO users (tenant_id,email,name,role,password_hash) VALUES (?,?,?,?,?)",
);
insertUser.run(
  "platform",
  process.env.SUPERADMIN_EMAIL || "superadmin@sime.local",
  "SIME Platform Owner",
  "superadmin",
  demoHash(
    process.env.SUPERADMIN_PASSWORD || "SuperAdmin123!",
    "sime-superadmin",
  ),
);
insertUser.run(
  "demo-school",
  process.env.ADMIN_EMAIL || "admin@sime.local",
  "Devon Harper",
  "admin",
  demoHash(process.env.ADMIN_PASSWORD || "ChangeMe123!", "sime-admin"),
);
insertUser.run(
  "demo-school",
  "teacher@sime.local",
  "Emily Anderson",
  "teacher",
  demoHash(process.env.TEACHER_PASSWORD || "Teacher123!", "sime-teacher"),
);
insertUser.run(
  "demo-school",
  "student@sime.local",
  "Jessica Rose",
  "student",
  demoHash(process.env.STUDENT_PASSWORD || "Student123!", "sime-student"),
);
insertUser.run(
  "demo-school",
  "parent@sime.local",
  "Sophia Brown",
  "parent",
  demoHash(process.env.PARENT_PASSWORD || "Parent123!", "sime-parent"),
);
insertUser.run(
  "sample-academy",
  "principal@sample.local",
  "Morgan Lee",
  "admin",
  demoHash(
    process.env.SAMPLE_ADMIN_PASSWORD || "SampleAdmin123!",
    "sime-sample-admin",
  ),
);
const studentColumns = db
  .prepare("PRAGMA table_info(students)")
  .all() as Array<{ name: string }>;
if (!studentColumns.some((column) => column.name === "tenant_id")) {
  db.exec(
    "ALTER TABLE students ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'demo-school'",
  );
  db.exec(
    "CREATE INDEX IF NOT EXISTS idx_students_tenant_name ON students(tenant_id, name)",
  );
}

const tenantStudentMigration = db
  .prepare("SELECT 1 FROM schema_migrations WHERE version=?")
  .get("students-tenant-unique-v1");
if (!tenantStudentMigration) {
  db.transaction(() => {
    db.exec(`
      ALTER TABLE students RENAME TO students_legacy;
      CREATE TABLE students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        student_id TEXT NOT NULL,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT NOT NULL DEFAULT '',
        grade INTEGER NOT NULL CHECK (grade BETWEEN 1 AND 12),
        class_name TEXT NOT NULL,
        address TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, student_id),
        UNIQUE(tenant_id, email)
      );
      INSERT INTO students (id,tenant_id,student_id,name,email,phone,grade,class_name,address,created_at,updated_at)
        SELECT id,tenant_id,student_id,name,email,phone,grade,class_name,address,created_at,updated_at FROM students_legacy;
      DROP TABLE students_legacy;
      CREATE INDEX idx_students_tenant_name ON students(tenant_id, name);
      INSERT INTO schema_migrations (version) VALUES ('students-tenant-unique-v1');
    `);
  })();
}

const currentStudentColumns = db
  .prepare("PRAGMA table_info(students)")
  .all() as Array<{ name: string }>;
if (!currentStudentColumns.some((column) => column.name === "gender")) {
  db.exec(
    "ALTER TABLE students ADD COLUMN gender TEXT NOT NULL DEFAULT 'unspecified' CHECK(gender IN ('female','male','other','unspecified'))",
  );
}
db.prepare(
  "UPDATE students SET gender=CASE WHEN id % 2=0 THEN 'male' ELSE 'female' END WHERE gender='unspecified'",
).run();
if (!currentStudentColumns.some((column) => column.name === "blood_type"))
  db.exec(
    "ALTER TABLE students ADD COLUMN blood_type TEXT NOT NULL DEFAULT 'Unknown'",
  );
if (!currentStudentColumns.some((column) => column.name === "photo_url"))
  db.exec("ALTER TABLE students ADD COLUMN photo_url TEXT NOT NULL DEFAULT ''");
const gamificationSettingColumns = db
  .prepare("PRAGMA table_info(gamification_settings)")
  .all() as Array<{ name: string }>;
if (
  !gamificationSettingColumns.some(
    (column) => column.name === "global_leaderboard_public",
  )
)
  db.exec(
    "ALTER TABLE gamification_settings ADD COLUMN global_leaderboard_public INTEGER NOT NULL DEFAULT 0",
  );

const insertStudent = db.prepare(
  `INSERT OR IGNORE INTO students (tenant_id,student_id,name,email,phone,grade,class_name,address,gender,blood_type,photo_url) VALUES (@tenantId,@studentId,@name,@email,@phone,@grade,@className,@address,@gender,@bloodType,@photoUrl)`,
);
db.transaction(() => {
  insertStudent.run({
    tenantId: "demo-school",
    studentId: "SIME-1000",
    name: "Jessica Rose",
    email: "student@sime.local",
    phone: "+8801700000000",
    grade: 8,
    className: "8-A",
    address: "Dhaka",
    gender: "female",
    bloodType: "B+",
    photoUrl: "",
  });
  insertStudent.run({
    tenantId: "demo-school",
    studentId: "SIME-1001",
    name: "Amina Rahman",
    email: "amina@example.edu",
    phone: "+8801700000001",
    grade: 8,
    className: "8-A",
    address: "Dhaka",
    gender: "female",
    bloodType: "A+",
    photoUrl: "",
  });
  insertStudent.run({
    tenantId: "demo-school",
    studentId: "SIME-1002",
    name: "Nabil Hasan",
    email: "nabil@example.edu",
    phone: "+8801700000002",
    grade: 9,
    className: "9-B",
    address: "Chattogram",
    gender: "male",
    bloodType: "O+",
    photoUrl: "",
  });
  insertStudent.run({
    tenantId: "demo-school",
    studentId: "SIME-1003",
    name: "Sara Ahmed",
    email: "sara@example.edu",
    phone: "+8801700000003",
    grade: 7,
    className: "7-A",
    address: "Sylhet",
    gender: "female",
    bloodType: "AB+",
    photoUrl: "",
  });
  insertStudent.run({
    tenantId: "sample-academy",
    studentId: "SAMPLE-2001",
    name: "Alex Morgan",
    email: "alex@sample.local",
    phone: "",
    grade: 6,
    className: "6-A",
    address: "Dhaka",
    gender: "male",
    bloodType: "O+",
    photoUrl: "",
  });
  insertStudent.run({
    tenantId: "sample-academy",
    studentId: "SAMPLE-2002",
    name: "Maya Chen",
    email: "maya@sample.local",
    phone: "",
    grade: 6,
    className: "6-A",
    address: "Dhaka",
    gender: "female",
    bloodType: "A+",
    photoUrl: "",
  });
})();
db.prepare(
  "UPDATE students SET blood_type=CASE student_id WHEN 'SIME-1000' THEN 'B+' WHEN 'SIME-1001' THEN 'A+' WHEN 'SIME-1002' THEN 'O+' WHEN 'SIME-1003' THEN 'AB+' ELSE blood_type END WHERE blood_type='Unknown'",
).run();

const resourceCount = db
  .prepare("SELECT COUNT(*) AS count FROM resources WHERE tenant_id=?")
  .get("demo-school") as { count: number };
if (resourceCount.count === 0) {
  const add = db.prepare(
    "INSERT INTO resources (tenant_id,resource_type,title,payload) VALUES (?,?,?,?)",
  );
  const samples: Array<[string, string, Record<string, string | number>]> = [
    [
      "teachers",
      "Emily Anderson",
      {
        teacherId: "T-1001",
        name: "Emily Anderson",
        email: "teacher@sime.local",
        phone: "+880 1711 220011",
        subjects: "English, Literature",
        classes: "8-A, 9-B",
        address: "Dhaka",
      },
    ],
    [
      "teachers",
      "Steve Jones",
      {
        teacherId: "T-1002",
        name: "Steve Jones",
        email: "steve@sime.school",
        phone: "+880 1711 220012",
        subjects: "Mathematics",
        classes: "7-A, 8-A",
        address: "Dhaka",
      },
    ],
    [
      "parents",
      "Sophia Brown",
      {
        name: "Sophia Brown",
        students: "Jessica Rose",
        email: "parent@sime.local",
        phone: "+880 1811 330011",
        address: "Dhaka",
      },
    ],
    [
      "subjects",
      "Mathematics",
      { name: "Mathematics", teachers: "Steve Jones" },
    ],
    ["subjects", "English", { name: "English", teachers: "Emily Anderson" }],
    [
      "classes",
      "8-A",
      { name: "8-A", capacity: 30, grade: 8, supervisor: "Emily Anderson" },
    ],
    [
      "classes",
      "9-B",
      { name: "9-B", capacity: 28, grade: 9, supervisor: "Steve Jones" },
    ],
    [
      "lessons",
      "English Literature",
      { subject: "English", class: "8-A", teacher: "Emily Anderson" },
    ],
    [
      "lessons",
      "Algebra",
      { subject: "Mathematics", class: "8-A", teacher: "Steve Jones" },
    ],
    [
      "exams",
      "English Midterm",
      {
        subject: "English",
        class: "8-A",
        teacher: "Emily Anderson",
        date: "2026-07-20",
      },
    ],
    [
      "exams",
      "Math Quiz",
      {
        subject: "Mathematics",
        class: "8-A",
        teacher: "Steve Jones",
        date: "2026-07-22",
      },
    ],
    [
      "assignments",
      "Essay: Bright Future",
      {
        subject: "English",
        class: "8-A",
        teacher: "Emily Anderson",
        dueDate: "2026-07-18",
      },
    ],
    [
      "assignments",
      "Algebra worksheet",
      {
        subject: "Mathematics",
        class: "8-A",
        teacher: "Steve Jones",
        dueDate: "2026-07-19",
      },
    ],
    [
      "results",
      "Jessica Rose",
      {
        subject: "English",
        student: "Jessica Rose",
        score: 92,
        teacher: "Emily Anderson",
        class: "8-A",
        date: "2026-07-08",
        type: "exam",
      },
    ],
    [
      "results",
      "Jessica Rose",
      {
        subject: "Mathematics",
        student: "Jessica Rose",
        score: 88,
        teacher: "Steve Jones",
        class: "8-A",
        date: "2026-07-09",
        type: "assignment",
      },
    ],
    [
      "attendance",
      "Jessica Rose",
      {
        student: "Jessica Rose",
        class: "8-A",
        date: "2026-07-12",
        status: "Present",
        note: "On time",
      },
    ],
    [
      "attendance",
      "Nabil Hasan",
      {
        student: "Nabil Hasan",
        class: "9-B",
        date: "2026-07-12",
        status: "Absent",
        note: "Family leave",
      },
    ],
    [
      "events",
      "Science Fair",
      {
        title: "Science Fair",
        class: "All",
        date: "2026-07-28",
        startTime: "10:00",
        endTime: "14:00",
      },
    ],
    [
      "events",
      "Parents Meeting",
      {
        title: "Parents Meeting",
        class: "8-A",
        date: "2026-07-25",
        startTime: "15:00",
        endTime: "17:00",
      },
    ],
    [
      "messages",
      "Welcome to SIME",
      {
        subject: "Welcome to SIME",
        recipient: "All users",
        body: "Your school workspace is ready.",
        status: "Sent",
        date: "2026-07-12",
      },
    ],
    [
      "announcements",
      "Midterm schedule published",
      { title: "Midterm schedule published", class: "All", date: "2026-07-12" },
    ],
    [
      "announcements",
      "Science fair registration",
      { title: "Science fair registration", class: "8-A", date: "2026-07-11" },
    ],
  ];
  db.transaction(() => {
    for (const [type, title, payload] of samples)
      add.run("demo-school", type, title, JSON.stringify(payload));
  })();
}

const gamificationCount = db
  .prepare("SELECT COUNT(*) count FROM gamification_points WHERE tenant_id=?")
  .get("demo-school") as { count: number };
if (!gamificationCount.count) {
  const award = db.prepare(
    "INSERT INTO gamification_points (tenant_id,student_name,class_name,points,source,note,awarded_by) VALUES (?,?,?,?,?,?,?)",
  );
  db.transaction(() => {
    award.run(
      "demo-school",
      "Jessica Rose",
      "8-A",
      95,
      "exam",
      "Excellent midterm performance",
      "teacher@sime.local",
    );
    award.run(
      "demo-school",
      "Jessica Rose",
      "8-A",
      20,
      "assignment",
      "Essay completed",
      "teacher@sime.local",
    );
    award.run(
      "demo-school",
      "Amina Rahman",
      "8-A",
      85,
      "exam",
      "Strong science result",
      "teacher@sime.local",
    );
    award.run(
      "demo-school",
      "Amina Rahman",
      "8-A",
      15,
      "behavior",
      "Helped classmates",
      "teacher@sime.local",
    );
    award.run(
      "demo-school",
      "Nabil Hasan",
      "9-B",
      78,
      "exam",
      "Mathematics quiz",
      "teacher@sime.local",
    );
    award.run(
      "demo-school",
      "Sara Ahmed",
      "7-A",
      90,
      "exam",
      "English assessment",
      "teacher@sime.local",
    );
  })();
}

if (
  !db
    .prepare(
      "SELECT 1 FROM schema_migrations WHERE version='role-feedback-results-v1'",
    )
    .get()
)
  db.transaction(() => {
    const add = db.prepare(
      "INSERT INTO resources (tenant_id,resource_type,title,payload) VALUES ('demo-school','results',?,?)",
    );
    const rows: Array<[string, Record<string, string | number>]> = [
      [
        "Amina Rahman",
        {
          subject: "Mathematics",
          student: "Amina Rahman",
          score: 82,
          teacher: "Steve Jones",
          class: "8-A",
          date: "2026-04-10",
          type: "exam",
        },
      ],
      [
        "Amina Rahman",
        {
          subject: "Mathematics",
          student: "Amina Rahman",
          score: 87,
          teacher: "Steve Jones",
          class: "8-A",
          date: "2026-06-10",
          type: "exam",
        },
      ],
      [
        "Nabil Hasan",
        {
          subject: "Mathematics",
          student: "Nabil Hasan",
          score: 79,
          teacher: "Steve Jones",
          class: "9-B",
          date: "2026-03-10",
          type: "exam",
        },
      ],
      [
        "Nabil Hasan",
        {
          subject: "Mathematics",
          student: "Nabil Hasan",
          score: 65,
          teacher: "Steve Jones",
          class: "9-B",
          date: "2026-05-10",
          type: "exam",
        },
      ],
      [
        "Nabil Hasan",
        {
          subject: "Mathematics",
          student: "Nabil Hasan",
          score: 48,
          teacher: "Steve Jones",
          class: "9-B",
          date: "2026-07-10",
          type: "exam",
        },
      ],
      [
        "Sara Ahmed",
        {
          subject: "English",
          student: "Sara Ahmed",
          score: 58,
          teacher: "Emily Anderson",
          class: "7-A",
          date: "2026-04-10",
          type: "exam",
        },
      ],
      [
        "Sara Ahmed",
        {
          subject: "English",
          student: "Sara Ahmed",
          score: 56,
          teacher: "Emily Anderson",
          class: "7-A",
          date: "2026-06-10",
          type: "exam",
        },
      ],
    ];
    for (const [title, payload] of rows)
      add.run(title, JSON.stringify(payload));
    db.prepare(
      "INSERT INTO schema_migrations(version) VALUES ('role-feedback-results-v1')",
    ).run();
  })();

// School-InG academic-year foundation. All operational academic records can be
// tied to a year, while lifecycle transitions remain immutable in the audit log.
db.exec(`
  CREATE TABLE IF NOT EXISTS academic_years (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    country TEXT NOT NULL DEFAULT 'Guinea',
    timezone TEXT NOT NULL DEFAULT 'Africa/Conakry',
    default_language TEXT NOT NULL DEFAULT 'fr',
    currency TEXT NOT NULL DEFAULT 'GNF',
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    enrollment_start TEXT NOT NULL,
    enrollment_end TEXT NOT NULL,
    period_system TEXT NOT NULL DEFAULT 'terms' CHECK(period_system IN ('terms','semesters')),
    status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','scheduled','active','closed','archived')),
    school_opening_date TEXT NOT NULL,
    holidays_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(holidays_json)),
    closures_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(closures_json)),
    exams_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(exams_json)),
    grading_json TEXT NOT NULL DEFAULT '{"maximum":20,"passMark":10}' CHECK(json_valid(grading_json)),
    coefficients_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(coefficients_json)),
    rounding_rule TEXT NOT NULL DEFAULT '0.01',
    ranking_rule TEXT NOT NULL DEFAULT 'dense',
    promotion_json TEXT NOT NULL DEFAULT '{"minimumAverage":10}' CHECK(json_valid(promotion_json)),
    report_template_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(report_template_json)),
    fee_template_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(fee_template_json)),
    created_by TEXT NOT NULL,
    closed_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id,code),
    CHECK(date(start_date) < date(end_date)),
    CHECK(date(enrollment_start) <= date(enrollment_end))
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_academic_year_one_active
    ON academic_years(tenant_id) WHERE status='active';
  CREATE INDEX IF NOT EXISTS idx_academic_years_tenant ON academic_years(tenant_id,status,start_date DESC);
  CREATE TABLE IF NOT EXISTS academic_terms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    academic_year_id INTEGER NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    position INTEGER NOT NULL CHECK(position BETWEEN 1 AND 6),
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    composition_start TEXT NOT NULL,
    composition_end TEXT NOT NULL,
    report_publication_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')),
    reports_published INTEGER NOT NULL DEFAULT 0 CHECK(reports_published IN (0,1)),
    UNIQUE(academic_year_id,code),
    CHECK(date(start_date) <= date(end_date))
  );
  CREATE TABLE IF NOT EXISTS academic_year_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    academic_year_id INTEGER NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
    actor_email TEXT NOT NULL,
    action TEXT NOT NULL,
    previous_status TEXT NOT NULL DEFAULT '',
    new_status TEXT NOT NULL DEFAULT '',
    reason TEXT NOT NULL DEFAULT '',
    details_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(details_json)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_academic_audit_year ON academic_year_audit(academic_year_id,created_at DESC);
  CREATE TABLE IF NOT EXISTS academic_year_permissions (
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_email TEXT NOT NULL,
    can_manage INTEGER NOT NULL DEFAULT 1 CHECK(can_manage IN (0,1)),
    can_reopen INTEGER NOT NULL DEFAULT 0 CHECK(can_reopen IN (0,1)),
    PRIMARY KEY(tenant_id,user_email)
  );
  CREATE TABLE IF NOT EXISTS academic_structure_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    academic_year_id INTEGER NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
    item_type TEXT NOT NULL CHECK(item_type IN ('cycle','level','stream','section','class','subject')),
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    parent_id INTEGER REFERENCES academic_structure_items(id) ON DELETE CASCADE,
    settings_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(settings_json)),
    sort_order INTEGER NOT NULL DEFAULT 0,
    UNIQUE(academic_year_id,item_type,code)
  );
  CREATE TABLE IF NOT EXISTS enrollments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    academic_year_id INTEGER NOT NULL REFERENCES academic_years(id) ON DELETE RESTRICT,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    class_id INTEGER REFERENCES academic_structure_items(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','promoted','repeated','transferred','withdrawn','excluded')),
    decision_reason TEXT NOT NULL DEFAULT '',
    enrolled_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(academic_year_id,student_id)
  );
  CREATE TABLE IF NOT EXISTS report_card_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    academic_year_id INTEGER NOT NULL REFERENCES academic_years(id) ON DELETE RESTRICT,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),
    status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published')),
    correction_reason TEXT NOT NULL DEFAULT '',
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    published_at TEXT,
    UNIQUE(academic_year_id,student_id,version)
  );
`);
const resourceColumns = db
  .prepare("PRAGMA table_info(resources)")
  .all() as Array<{ name: string }>;
if (!resourceColumns.some((column) => column.name === "academic_year_id")) {
  db.exec(
    "ALTER TABLE resources ADD COLUMN academic_year_id INTEGER REFERENCES academic_years(id) ON DELETE RESTRICT",
  );
  db.exec(
    "CREATE INDEX IF NOT EXISTS idx_resources_academic_year ON resources(tenant_id,academic_year_id,resource_type)",
  );
}
db.prepare(
  "INSERT OR IGNORE INTO schema_migrations(version) VALUES ('academic-years-v1')",
).run();
db.prepare(
  "INSERT OR IGNORE INTO academic_year_permissions(tenant_id,user_email,can_manage,can_reopen) SELECT tenant_id,email,1,1 FROM users WHERE role='admin'",
).run();

if (
  !db
    .prepare(
      "SELECT 1 FROM schema_migrations WHERE version='school-ing-guinea-v1'",
    )
    .get()
)
  db.transaction(() => {
    db.prepare(
      "DELETE FROM resources WHERE tenant_id IN ('demo-school','sample-academy')",
    ).run();
    db.prepare(
      "DELETE FROM gamification_points WHERE tenant_id IN ('demo-school','sample-academy')",
    ).run();
    db.prepare(
      "DELETE FROM notifications WHERE tenant_id IN ('platform','demo-school','sample-academy')",
    ).run();
    db.prepare(
      "DELETE FROM ai_conversations WHERE tenant_id IN ('demo-school','sample-academy')",
    ).run();
    db.prepare(
      "DELETE FROM students WHERE tenant_id IN ('demo-school','sample-academy')",
    ).run();
    db.prepare(
      "UPDATE tenants SET name='School-InG · GNG GROUP',contact_email='direction@school-ing.gn' WHERE id='platform'",
    ).run();
    db.prepare(
      "UPDATE tenants SET name='École Moderne de Conakry',contact_email='admin@school-ing.gn' WHERE id='demo-school'",
    ).run();
    db.prepare(
      "UPDATE tenants SET name='Académie de Kankan',contact_email='direction@academie-kankan.gn' WHERE id='sample-academy'",
    ).run();
    const accounts: [
      [string, string, string, string],
      [string, string, string, string],
      [string, string, string, string],
      [string, string, string, string],
      [string, string, string, string],
      [string, string, string, string],
    ] = [
      ["platform", "superadmin", "superadmin@school-ing.gn", "Mamadou Diallo"],
      ["demo-school", "admin", "admin@school-ing.gn", "Aïssatou Camara"],
      ["demo-school", "teacher", "teacher@school-ing.gn", "Ibrahima Condé"],
      ["demo-school", "student", "student@school-ing.gn", "Mariama Bah"],
      ["demo-school", "parent", "parent@school-ing.gn", "Fatoumata Sylla"],
      [
        "sample-academy",
        "admin",
        "direction@academie-kankan.gn",
        "Alpha Soumah",
      ],
    ];
    for (const [tenant, role, email, name] of accounts)
      db.prepare(
        "UPDATE users SET email=?,name=? WHERE tenant_id=? AND role=?",
      ).run(email, name, tenant, role);
    db.prepare(
      "UPDATE platform_settings SET platform_name='School-InG',support_email='support@school-ing.gn'",
    ).run();
    db.prepare("DELETE FROM academic_year_permissions").run();
    db.prepare(
      "INSERT INTO academic_year_permissions(tenant_id,user_email,can_manage,can_reopen) SELECT tenant_id,email,1,1 FROM users WHERE role='admin'",
    ).run();
    const addStudent = db.prepare(
      "INSERT INTO students(tenant_id,student_id,name,email,phone,grade,class_name,address,gender,blood_type,photo_url) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
    );
    addStudent.run(
      "demo-school",
      "GIN-2026-0001",
      "Mariama Bah",
      "student@school-ing.gn",
      "+224 620 10 20 01",
      10,
      "10e-A",
      "Ratoma, Conakry",
      "female",
      "B+",
      "",
    );
    addStudent.run(
      "demo-school",
      "GIN-2026-0002",
      "Mamadou Sékou Diallo",
      "mamadou.diallo@ecole.gn",
      "+224 621 10 20 02",
      7,
      "7e-A",
      "Matam, Conakry",
      "male",
      "O+",
      "",
    );
    addStudent.run(
      "demo-school",
      "GIN-2026-0003",
      "Fodé Camara",
      "fode.camara@ecole.gn",
      "+224 622 10 20 03",
      12,
      "Terminale-Sciences",
      "Kindia, Guinée",
      "male",
      "A+",
      "",
    );
    addStudent.run(
      "demo-school",
      "GIN-2026-0004",
      "Aminata Condé",
      "aminata.conde@ecole.gn",
      "+224 623 10 20 04",
      1,
      "CI-A",
      "Dixinn, Conakry",
      "female",
      "AB+",
      "",
    );
    addStudent.run(
      "sample-academy",
      "KKN-2026-0001",
      "Sékouba Keïta",
      "sekouba@academie-kankan.gn",
      "+224 624 20 30 01",
      8,
      "8e-A",
      "Kankan, Guinée",
      "male",
      "O+",
      "",
    );
    const year = db
      .prepare(
        `INSERT INTO academic_years(tenant_id,name,code,start_date,end_date,enrollment_start,enrollment_end,period_system,status,school_opening_date,exams_json,created_by) VALUES('demo-school','2026–2027','2026-2027','2026-09-15','2027-06-30','2026-07-01','2026-09-30','terms','active','2026-09-15',?,'admin@school-ing.gn')`,
      )
      .run(
        JSON.stringify([
          { name: "CEE", date: "2027-06-10" },
          { name: "BEPC", date: "2027-06-15" },
          { name: "Baccalauréat", date: "2027-06-20" },
        ]),
      );
    const yearId = Number(year.lastInsertRowid),
      addTerm = db.prepare(
        "INSERT INTO academic_terms(academic_year_id,tenant_id,name,code,position,start_date,end_date,composition_start,composition_end,report_publication_date) VALUES(?,?,?,?,?,?,?,?,?,?)",
      );
    addTerm.run(
      yearId,
      "demo-school",
      "1er trimestre",
      "T1",
      1,
      "2026-09-15",
      "2026-12-18",
      "2026-12-07",
      "2026-12-12",
      "2026-12-18",
    );
    addTerm.run(
      yearId,
      "demo-school",
      "2e trimestre",
      "T2",
      2,
      "2027-01-04",
      "2027-03-26",
      "2027-03-15",
      "2027-03-20",
      "2027-03-26",
    );
    addTerm.run(
      yearId,
      "demo-school",
      "3e trimestre",
      "T3",
      3,
      "2027-04-05",
      "2027-06-30",
      "2027-06-14",
      "2027-06-19",
      "2027-06-30",
    );
    const addStructure = db.prepare(
      "INSERT INTO academic_structure_items(tenant_id,academic_year_id,item_type,code,name,sort_order) VALUES('demo-school',?,?,?,?,?)",
    );
    ["Préscolaire", "Primaire", "Collège", "Lycée"].forEach((name, index) =>
      addStructure.run(yearId, "cycle", `C${index + 1}`, name, index),
    );
    [
      "Petite section",
      "Moyenne section",
      "Grande section",
      "CI",
      "CP",
      "CE1",
      "CE2",
      "CM1",
      "CM2",
      "7e",
      "8e",
      "9e",
      "10e",
      "11e",
      "12e / Terminale",
    ].forEach((name, index) =>
      addStructure.run(yearId, "level", `N${index + 1}`, name, index),
    );
    const addResource = db.prepare(
        "INSERT INTO resources(tenant_id,resource_type,title,payload,academic_year_id) VALUES('demo-school',?,?,?,?)",
      ),
      samples: Array<[string, string, Record<string, string | number>]> = [
        [
          "teachers",
          "Ibrahima Condé",
          {
            teacherId: "ENS-1001",
            name: "Ibrahima Condé",
            email: "teacher@school-ing.gn",
            phone: "+224 620 11 22 01",
            subjects: "Français, Histoire-Géographie",
            classes: "7e-A, 10e-A",
            address: "Ratoma, Conakry",
          },
        ],
        [
          "teachers",
          "Néné Kourouma",
          {
            teacherId: "ENS-1002",
            name: "Néné Kourouma",
            email: "nene.kourouma@ecole.gn",
            phone: "+224 621 11 22 02",
            subjects: "Mathématiques, Sciences",
            classes: "10e-A, Terminale-Sciences",
            address: "Dixinn, Conakry",
          },
        ],
        [
          "parents",
          "Fatoumata Sylla",
          {
            name: "Fatoumata Sylla",
            students: "Mariama Bah",
            email: "parent@school-ing.gn",
            phone: "+224 622 33 44 01",
            address: "Ratoma, Conakry",
          },
        ],
        [
          "subjects",
          "Mathématiques",
          { name: "Mathématiques", teachers: "Néné Kourouma" },
        ],
        [
          "subjects",
          "Français",
          { name: "Français", teachers: "Ibrahima Condé" },
        ],
        [
          "classes",
          "10e-A",
          {
            name: "10e-A",
            capacity: 35,
            grade: 10,
            supervisor: "Ibrahima Condé",
          },
        ],
        [
          "classes",
          "Terminale-Sciences",
          {
            name: "Terminale-Sciences",
            capacity: 32,
            grade: 12,
            supervisor: "Néné Kourouma",
          },
        ],
        [
          "lessons",
          "Français",
          { subject: "Français", class: "10e-A", teacher: "Ibrahima Condé" },
        ],
        [
          "exams",
          "Composition de français",
          {
            subject: "Français",
            class: "10e-A",
            teacher: "Ibrahima Condé",
            date: "2026-12-10",
          },
        ],
        [
          "assignments",
          "Dissertation",
          {
            subject: "Français",
            class: "10e-A",
            teacher: "Ibrahima Condé",
            dueDate: "2026-11-20",
          },
        ],
        [
          "results",
          "Mariama Bah",
          {
            subject: "Français",
            student: "Mariama Bah",
            score: 16,
            coefficient: 2,
            teacher: "Ibrahima Condé",
            class: "10e-A",
            term: "T1",
            date: "2026-12-10",
            type: "composition",
          },
        ],
        [
          "results",
          "Mariama Bah",
          {
            subject: "Mathématiques",
            student: "Mariama Bah",
            score: 14,
            coefficient: 3,
            teacher: "Néné Kourouma",
            class: "10e-A",
            term: "T1",
            date: "2026-12-11",
            type: "composition",
          },
        ],
        [
          "attendance",
          "Mariama Bah",
          {
            student: "Mariama Bah",
            class: "10e-A",
            date: "2026-10-12",
            status: "Présente",
            note: "À l’heure",
          },
        ],
        [
          "events",
          "Réunion des parents",
          {
            title: "Réunion des parents",
            class: "Toutes",
            date: "2026-10-25",
            startTime: "15:00",
            endTime: "17:00",
          },
        ],
        [
          "messages",
          "Bienvenue sur School-InG",
          {
            subject: "Bienvenue sur School-InG",
            recipient: "Tous les utilisateurs",
            body: "Votre espace scolaire est prêt.",
            status: "Envoyé",
            date: "2026-09-15",
          },
        ],
        [
          "announcements",
          "Calendrier des compositions",
          {
            title: "Calendrier des compositions",
            class: "Toutes",
            date: "2026-11-30",
          },
        ],
      ];
    for (const [type, title, payload] of samples)
      addResource.run(type, title, JSON.stringify(payload), yearId);
    const award = db.prepare(
      "INSERT INTO gamification_points(tenant_id,student_name,class_name,points,source,note,awarded_by) VALUES('demo-school',?,?,?,?,?,?)",
    );
    award.run(
      "Mariama Bah",
      "10e-A",
      85,
      "exam",
      "Excellente composition",
      "teacher@school-ing.gn",
    );
    award.run(
      "Mamadou Sékou Diallo",
      "7e-A",
      20,
      "behavior",
      "Esprit d’entraide",
      "teacher@school-ing.gn",
    );
    db.prepare(
      "INSERT INTO schema_migrations(version) VALUES('school-ing-guinea-v1')",
    ).run();
  })();

export type StudentRecord = {
  id: number;
  studentId: string;
  name: string;
  email: string;
  phone: string;
  grade: number;
  className: string;
  address: string;
  gender: "female" | "male" | "other" | "unspecified";
  bloodType: string;
  photoUrl: string;
  createdAt: string;
  updatedAt: string;
};
