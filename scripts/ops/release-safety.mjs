// Fail closed on ambiguous cloud rollout evidence; pure helpers for offline tests.
export function assertMigrationSucceeded(description, expectedTaskArn) {
  const tasks = description?.tasks;
  if (description?.failures?.length || !Array.isArray(tasks) || tasks.length !== 1) {
    throw new Error('Migration result is missing or includes ECS lookup failures; rollout stopped.');
  }
  const task = tasks[0];
  if (!expectedTaskArn || task?.taskArn !== expectedTaskArn || task.lastStatus !== 'STOPPED') {
    throw new Error('Migration task identity or stopped state was not confirmed; rollout stopped.');
  }
  if (!Array.isArray(task.containers) || task.containers.length === 0 ||
      task.containers.some(c => !Number.isInteger(c?.exitCode) || c.exitCode !== 0 || c.lastStatus !== 'STOPPED')) {
    throw new Error('Migration container exit zero was not confirmed; rollout stopped.');
  }
}

export function assertHealthyRollbackResponse(response) {
  if (!response || response.ok !== true || !Number.isInteger(response.status) ||
      response.status < 200 || response.status >= 300) {
    throw new Error('Rollback service readiness failed; do not report a successful rollback.');
  }
}
