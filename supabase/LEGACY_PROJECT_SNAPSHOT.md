# Supabase project snapshot before SIME replacement

Project: `skxizqwipqthvukzgcll`

Captured through the authenticated Supabase MCP on 2026-08-13 before the user-authorized destructive replacement.

The previous `public` schema contained these empty application tables:

`profiles`, `contacts`, `tags`, `contact_tags`, `custom_fields`, `contact_custom_values`, `contact_notes`, `conversations`, `messages`, `whatsapp_config`, `message_templates`, `pipelines`, `pipeline_stages`, `deals`, `broadcasts`, `broadcast_recipients`, `automations`, `automation_steps`, `automation_logs`, `automation_pending_executions`, `message_reactions`, `flows`, `flow_nodes`, `flow_runs`, `flow_run_events`, `accounts`, `account_invitations`.

All reported zero rows and had RLS enabled. No tracked migrations, Edge Functions, or development branches were present. Public storage buckets `avatars` and `flow-media` existed. The replacement migration intentionally removes the old `public` schema objects; storage buckets are handled separately and are not removed by dropping `public`.

This inventory is not a data backup and cannot independently restore the previous application.
