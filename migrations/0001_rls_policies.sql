-- Enable Row-Level Security on the 8 user-scoped tables.
-- Each policy enforces that only rows belonging to the current request's
-- user (identified by app.current_user_id session variable) are visible or
-- modifiable. FORCE ROW LEVEL SECURITY ensures the policy applies even when
-- the database connection runs as the table owner.

--> statement-breakpoint
ALTER TABLE "documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "documents" FORCE ROW LEVEL SECURITY;

CREATE POLICY "documents_user_isolation" ON "documents"
  USING (user_id = current_setting('app.current_user_id', TRUE))
  WITH CHECK (user_id = current_setting('app.current_user_id', TRUE));

--> statement-breakpoint
ALTER TABLE "chat_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chat_sessions" FORCE ROW LEVEL SECURITY;

CREATE POLICY "chat_sessions_user_isolation" ON "chat_sessions"
  USING (user_id = current_setting('app.current_user_id', TRUE))
  WITH CHECK (user_id = current_setting('app.current_user_id', TRUE));

--> statement-breakpoint
ALTER TABLE "chat_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chat_messages" FORCE ROW LEVEL SECURITY;

CREATE POLICY "chat_messages_user_isolation" ON "chat_messages"
  USING (user_id = current_setting('app.current_user_id', TRUE))
  WITH CHECK (user_id = current_setting('app.current_user_id', TRUE));

--> statement-breakpoint
ALTER TABLE "drafts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "drafts" FORCE ROW LEVEL SECURITY;

CREATE POLICY "drafts_user_isolation" ON "drafts"
  USING (user_id = current_setting('app.current_user_id', TRUE))
  WITH CHECK (user_id = current_setting('app.current_user_id', TRUE));

--> statement-breakpoint
ALTER TABLE "legal_memos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "legal_memos" FORCE ROW LEVEL SECURITY;

CREATE POLICY "legal_memos_user_isolation" ON "legal_memos"
  USING (user_id = current_setting('app.current_user_id', TRUE))
  WITH CHECK (user_id = current_setting('app.current_user_id', TRUE));

--> statement-breakpoint
ALTER TABLE "research_notes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "research_notes" FORCE ROW LEVEL SECURITY;

CREATE POLICY "research_notes_user_isolation" ON "research_notes"
  USING (user_id = current_setting('app.current_user_id', TRUE))
  WITH CHECK (user_id = current_setting('app.current_user_id', TRUE));

--> statement-breakpoint
ALTER TABLE "cnr_notes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cnr_notes" FORCE ROW LEVEL SECURITY;

CREATE POLICY "cnr_notes_user_isolation" ON "cnr_notes"
  USING (user_id = current_setting('app.current_user_id', TRUE))
  WITH CHECK (user_id = current_setting('app.current_user_id', TRUE));

--> statement-breakpoint
ALTER TABLE "research_queries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "research_queries" FORCE ROW LEVEL SECURITY;

CREATE POLICY "research_queries_user_isolation" ON "research_queries"
  USING (user_id = current_setting('app.current_user_id', TRUE))
  WITH CHECK (user_id = current_setting('app.current_user_id', TRUE));
