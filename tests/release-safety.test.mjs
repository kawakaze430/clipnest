import test from 'node:test';
import assert from 'node:assert/strict';
import {assertMigrationSucceeded, assertHealthyRollbackResponse} from '../scripts/ops/release-safety.mjs';

const arn = 'arn:aws:ecs:ap-south-1:123456789012:task/clipnest/staging-migration';
const completed = () => ({failures: [], tasks: [{
  taskArn: arn, lastStatus: 'STOPPED', containers: [{name: 'migrate', lastStatus: 'STOPPED', exitCode: 0}]
}]});

test('migration requires identified stopped task and confirmed zero exits', () => {
  assert.doesNotThrow(() => assertMigrationSucceeded(completed(), arn));
  const cases = [
    undefined, {}, {tasks: []}, {failures: [{reason: 'MISSING'}], tasks: completed().tasks},
    {tasks: [{...completed().tasks[0], taskArn: 'different'}]},
    {tasks: [{...completed().tasks[0], lastStatus: 'RUNNING'}]},
    {tasks: [{...completed().tasks[0], containers: []}]},
    {tasks: [{...completed().tasks[0], containers: [{}]}]},
    {tasks: [{...completed().tasks[0], containers: [{lastStatus: 'STOPPED'}]}]},
    {tasks: [{...completed().tasks[0], containers: [{lastStatus: 'STOPPED', exitCode: 1}]}]},
    {tasks: [{...completed().tasks[0], containers: [{lastStatus: 'RUNNING', exitCode: 0}]}]},
  ];
  for (const value of cases) assert.throws(() => assertMigrationSucceeded(value, arn), /rollout stopped/i);
  assert.throws(() => assertMigrationSucceeded(completed(), ''), /rollout stopped/i);
});

test('rollback treats unhealthy or unknown HTTP readiness as failure', () => {
  assert.doesNotThrow(() => assertHealthyRollbackResponse({ok: true, status: 200}));
  for (const response of [undefined, {}, {ok: false, status: 503},
    {ok: false, status: 404}, {ok: true, status: 503}, {ok: true},
    {ok: true, status: 302}]) {
    assert.throws(() => assertHealthyRollbackResponse(response), /readiness failed/i);
  }
});
