import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {deployRelease} from '../scripts/ops/deploy.mjs';
import {rollbackRelease} from '../scripts/ops/rollback.mjs';
import {verifyReadiness} from '../scripts/ops/deployment-verification.mjs';

const oldCommit = '2'.repeat(40), newCommit = '1'.repeat(40);
const repository = '123456789012.dkr.ecr.ap-south-1.amazonaws.com/clipnest-staging';
const oldImage = repository + '@sha256:' + 'b'.repeat(64);
const image = repository + '@sha256:' + 'a'.repeat(64);
const taskArn = role => 'arn:aws:ecs:ap-south-1:123456789012:task-definition/clipnest-staging-' + role + ':1';
const migratedTask = 'arn:aws:ecs:ap-south-1:123456789012:task/clipnest-staging/' + 'c'.repeat(32);
const configuration = origin => ({
  environment: 'staging', region: 'ap-south-1', cluster: 'clipnest-staging',
  api_service: 'clipnest-staging-api', worker_service: 'clipnest-staging-worker',
  api_task: taskArn('api'), worker_task: taskArn('worker'), migration_task: taskArn('migration'),
  application_subnets: ['subnet-fixture'], application_security_group: 'sg-fixture',
  image_repository: repository, public_origin: origin
});
const healthy = commit => ({database: true, workers: true, engine: true, ffmpeg: true,
  ready: true, release: {source: commit, version: '1.2.0'}});

async function origin(t, {commit = newCommit, status = 200, body = healthy(commit), hang = false} = {}) {
  const server = createServer((request, response) => {
    assert.equal(request.url, '/readyz');
    if (!hang) {
      response.writeHead(status, {'Content-Type': 'application/json'});
      response.end(JSON.stringify(body));
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  });
  return 'http://127.0.0.1:' + server.address().port;
}

function harness(d, {migrationResult, registered, waiterError, identityAccount = '123456789012'} = {}) {
  const calls = [], records = new Map(), definitions = new Map();
  for (const role of ['api', 'worker', 'migration']) {
    definitions.set(taskArn(role), {
      family: 'clipnest-staging-' + role, taskDefinitionArn: taskArn(role), cpu: '512', memory: '1024',
      containerDefinitions: [{name: role, image: oldImage, environment: [
        {name: 'SCHEMA_RELEASE', value: '2'}, {name: 'SOURCE_COMMIT', value: oldCommit}
      ]}]
    });
  }
  let migrationDefinition;
  const deps = {
    aws: async (region, service, operation, input) => {
      assert.equal(region, d.region);
      calls.push({operation, input: structuredClone(input)});
      if (service === 'sts' && operation === 'get-caller-identity') return {Account: identityAccount};
      assert.equal(service, 'ecs');
      if (operation === 'describe-services') return {services: [
        {serviceName: d.api_service, taskDefinition: d.api_task, desiredCount: 2},
        {serviceName: d.worker_service, taskDefinition: d.worker_task, desiredCount: 2}
      ]};
      if (operation === 'describe-task-definition') return {taskDefinition: structuredClone(definitions.get(input.taskDefinition))};
      if (operation === 'register-task-definition') {
        const task = {...structuredClone(input), taskDefinitionArn: 'arn:aws:ecs:ap-south-1:123456789012:task-definition/' + input.family + ':2'};
        registered?.(task);
        definitions.set(task.taskDefinitionArn, structuredClone(task));
        if (input.family.endsWith('-migration')) migrationDefinition = task.taskDefinitionArn;
        return {taskDefinition: task};
      }
      if (operation === 'run-task') return {tasks: [{taskArn: migratedTask}]};
      if (operation === 'describe-tasks') {
        const value = {tasks: [{taskArn: migratedTask, taskDefinitionArn: migrationDefinition,
          lastStatus: 'STOPPED', stopCode: 'EssentialContainerExited',
          containers: [{name: 'migration', exitCode: 0, lastStatus: 'STOPPED', image}]}]};
        return migrationResult ? migrationResult(value) : value;
      }
      if (operation === 'update-service') return {service: {
        serviceName: input.service, taskDefinition: input.taskDefinition, desiredCount: input.desiredCount
      }};
      throw new Error('Unexpected AWS operation ' + operation);
    },
    cli: async args => {
      calls.push({operation: 'wait', args});
      if (waiterError) throw new Error('Mock AWS waiter failed');
    },
    record: async (name, value) => records.set(name, structuredClone(value))
  };
  return {deps, calls, records, definitions, updates: () => calls.filter(call => call.operation === 'update-service')};
}

function previous(d) {
  return {provenanceVersion: 1, schemaRelease: 2, compatible: true, environment: d.environment, cluster: d.cluster,
    commit: oldCommit, sourceCommit: oldCommit, requestedCommit: newCommit,
    services: [{service: d.api_service, taskDefinition: d.api_task, desiredCount: 2, sourceCommit: oldCommit, image: oldImage},
      {service: d.worker_service, taskDefinition: d.worker_task, desiredCount: 2, sourceCommit: oldCommit, image: oldImage}]};
}

test('deployment verifies registered immutable image, exact migration and matching readiness; prior provenance is the old release', async t => {
  const d = configuration(await origin(t)), h = harness(d);
  const result = await deployRelease(d, {image, commit: newCommit, execute: true}, h.deps);
  assert.equal(result.deployed, true);
  assert.equal(result.readiness.release.source, newCommit);
  assert.deepEqual(h.updates().map(call => call.input.service), [d.worker_service, d.api_service]);
  const saved = h.records.get('.cache/release/previous-deployment.json');
  assert.equal(saved.sourceCommit, oldCommit);
  assert.equal(saved.commit, oldCommit);
  assert.equal(saved.requestedCommit, newCommit);
  assert.equal(saved.compatible, true);
  assert.ok(saved.services.every(service => service.image === oldImage && service.sourceCommit === oldCommit));
  assert.equal(h.records.get('.cache/release/deployment.json').image, image);
});

test('missing, empty, failed or incomplete migration evidence never rolls services', async t => {
  const cases = [
    ['missing tasks', () => ({})], ['empty tasks', () => ({tasks: []})],
    ['API failures', () => ({failures: [{reason: 'fixture'}], tasks: []})],
    ['empty containers', value => {value.tasks[0].containers = []; return value;}],
    ['missing exit code', value => {delete value.tasks[0].containers[0].exitCode; return value;}],
    ['failed migration', value => {value.tasks[0].containers[0].exitCode = 1; return value;}],
    ['still running', value => {value.tasks[0].lastStatus = 'RUNNING'; return value;}],
    ['task failed to start', value => {value.tasks[0].stopCode = 'TaskFailedToStart'; return value;}],
    ['wrong task ARN', value => {value.tasks[0].taskArn += 'wrong'; return value;}],
    ['wrong revision', value => {value.tasks[0].taskDefinitionArn = taskArn('migration'); return value;}],
    ['wrong image', value => {value.tasks[0].containers[0].image = oldImage; return value;}]
  ];
  for (const [name, migrationResult] of cases) await t.test(name, async () => {
    const d = configuration('http://127.0.0.1:1'), h = harness(d, {migrationResult});
    await assert.rejects(deployRelease(d, {image, commit: newCommit, execute: true}, h.deps), /Migration/);
    assert.equal(h.updates().length, 0);
    assert.equal(h.records.has('.cache/release/deployment.json'), false);
  });
});

test('wrong registered image, source or missing source metadata is rejected before migration', async t => {
  for (const [name, registered] of [
    ['wrong image', task => {task.containerDefinitions[0].image = oldImage;}],
    ['wrong source', task => {task.containerDefinitions[0].environment[1].value = oldCommit;}],
    ['missing source', task => {task.containerDefinitions[0].environment = [{name: 'SCHEMA_RELEASE', value: '2'}];}]
  ]) await t.test(name, async () => {
    const d = configuration('http://127.0.0.1:1'), h = harness(d, {registered});
    await assert.rejects(deployRelease(d, {image, commit: newCommit, execute: true}, h.deps), /image or source|source metadata/);
    assert.equal(h.calls.some(call => call.operation === 'run-task'), false);
    assert.equal(h.updates().length, 0);
  });
});

test('deploy does not record success for readiness of another release', async t => {
  const d = configuration(await origin(t, {commit: oldCommit})), h = harness(d);
  await assert.rejects(deployRelease(d, {image, commit: newCommit, execute: true}, h.deps), /healthy matching release/);
  assert.equal(h.records.has('.cache/release/deployment.json'), false);
});

test('compatible rollback verifies the saved old image and its source, not the incoming requested commit', async t => {
  const d = configuration(await origin(t, {commit: oldCommit})), h = harness(d);
  const result = await rollbackRelease(d, previous(d), {execute: true}, h.deps);
  assert.equal(result.rollbackApplied, true);
  assert.equal(result.sourceCommit, oldCommit);
  assert.equal(result.readiness.release.source, oldCommit);
  assert.deepEqual(h.updates().map(call => call.input.taskDefinition), [d.worker_task, d.api_task]);
});

test('historical requested-commit records, missing digest and CP-01 compatibility cannot authorize rollback', async t => {
  for (const [name, change] of [
    ['historical source', record => {delete record.provenanceVersion; delete record.sourceCommit; record.commit = newCommit;}],
    ['missing digest', record => {delete record.services[0].image;}],
    ['incompatible schema', record => {record.schemaRelease = 1;}],
    ['wrong saved digest', record => {record.services[0].image = image;}]
  ]) await t.test(name, async () => {
    const d = configuration('http://127.0.0.1:1'), h = harness(d), record = previous(d);
    change(record);
    await assert.rejects(rollbackRelease(d, record, {execute: true}, h.deps), /provenance|incompatible|image or source/);
    assert.equal(h.updates().length, 0);
  });
});

test('rollback never reports success on failed, mismatched, incomplete or timed-out readiness', async t => {
  for (const [name, response, message] of [
    ['HTTP failure', {status: 503}, /HTTP 503/],
    ['wrong release', {commit: newCommit}, /healthy matching release/],
    ['missing release', {body: {database: true, workers: true, engine: true, ffmpeg: true, ready: true}}, /healthy matching release/],
    ['unhealthy dependencies', {body: {...healthy(oldCommit), workers: false}}, /healthy matching release/],
    ['timeout', {hang: true}, /timed out/]
  ]) await t.test(name, async inner => {
    const d = configuration(await origin(inner, {commit: oldCommit, ...response})), h = harness(d);
    await assert.rejects(rollbackRelease(d, previous(d), {execute: true}, {...h.deps, readinessTimeoutMs: 50}), message);
  });
});

test('rollback waiter failure cannot reach readiness or report success', async () => {
  const d = configuration('http://127.0.0.1:1'), h = harness(d, {waiterError: true});
  await assert.rejects(rollbackRelease(d, previous(d), {execute: true}, h.deps), /waiter failed/);
});

test('wrong authenticated account prevents deployment before service lookup or mutation', async () => {
  const d=configuration('http://127.0.0.1:1'),h=harness(d,{identityAccount:'999999999999'});
  await assert.rejects(deployRelease(d,{image,commit:newCommit,execute:true},h.deps),/Authenticated AWS account/);
  assert.deepEqual(h.calls.map(c=>c.operation),['get-caller-identity']);
});
test('wrong authenticated account prevents rollback before saved task inspection or mutation', async () => {
  const d=configuration('http://127.0.0.1:1'),h=harness(d,{identityAccount:'999999999999'});
  await assert.rejects(rollbackRelease(d,previous(d),{execute:true},h.deps),/Authenticated AWS account/);
  assert.deepEqual(h.calls.map(c=>c.operation),['get-caller-identity']);
});
test('mixed target account or Region is rejected before making an AWS call', async () => {
  for(const change of [d=>{d.account_id='999999999999';},d=>{d.region='eu-west-1';},d=>{d.api_task=d.api_task.replace('123456789012','999999999999');}]){
    const d=configuration('http://127.0.0.1:1');change(d);const h=harness(d);
    await assert.rejects(deployRelease(d,{image,commit:newCommit,execute:true},h.deps),/one expected AWS account/);
    assert.equal(h.calls.length,0);
  }
});

test('public readiness never follows an unencrypted endpoint', async () => {
  let requested=false;
  await assert.rejects(verifyReadiness('http://public.example.test',newCommit,{fetchImpl:async()=>{requested=true;}}),/requires HTTPS/);
  assert.equal(requested,false);
});
