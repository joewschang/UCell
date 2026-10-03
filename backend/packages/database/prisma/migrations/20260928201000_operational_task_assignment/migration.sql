ALTER TABLE integration.operational_task
  ADD COLUMN assignee_actor text,
  ADD COLUMN assignee_role text,
  ADD COLUMN due_at timestamptz(6);
CREATE INDEX operational_task_assignee_due_idx ON integration.operational_task(assignee_actor,due_at);