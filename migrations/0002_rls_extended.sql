-- Extend Row-Level Security to cover the remaining user-scoped tables that
-- were not included in 0001_rls_policies.sql:
--   saved_cases, google_calendar_credentials, calendar_events, ai_usage,
--   and training_docs.
--
-- Each policy enforces that only rows belonging to the current request's
-- user (identified by the app.current_user_id session variable set via
-- withUserContext in server/db.ts) are visible or modifiable.
-- FORCE ROW LEVEL SECURITY ensures the policy applies even when the
-- database connection runs as the table owner.

--> statement-breakpoint
ALTER TABLE "saved_cases" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "saved_cases" FORCE ROW LEVEL SECURITY;

CREATE POLICY "saved_cases_user_isolation" ON "saved_cases"
  USING (user_id = current_setting('app.current_user_id', TRUE))
  WITH CHECK (user_id = current_setting('app.current_user_id', TRUE));

--> statement-breakpoint
ALTER TABLE "google_calendar_credentials" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "google_calendar_credentials" FORCE ROW LEVEL SECURITY;

CREATE POLICY "google_calendar_credentials_user_isolation" ON "google_calendar_credentials"
  USING (user_id = current_setting('app.current_user_id', TRUE))
  WITH CHECK (user_id = current_setting('app.current_user_id', TRUE));

--> statement-breakpoint
ALTER TABLE "calendar_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "calendar_events" FORCE ROW LEVEL SECURITY;

CREATE POLICY "calendar_events_user_isolation" ON "calendar_events"
  USING (user_id = current_setting('app.current_user_id', TRUE))
  WITH CHECK (user_id = current_setting('app.current_user_id', TRUE));

--> statement-breakpoint
ALTER TABLE "ai_usage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_usage" FORCE ROW LEVEL SECURITY;

CREATE POLICY "ai_usage_user_isolation" ON "ai_usage"
  USING (user_id = current_setting('app.current_user_id', TRUE))
  WITH CHECK (user_id = current_setting('app.current_user_id', TRUE));

--> statement-breakpoint
ALTER TABLE "training_docs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "training_docs" FORCE ROW LEVEL SECURITY;

CREATE POLICY "training_docs_user_isolation" ON "training_docs"
  USING (user_id = current_setting('app.current_user_id', TRUE))
  WITH CHECK (user_id = current_setting('app.current_user_id', TRUE));
