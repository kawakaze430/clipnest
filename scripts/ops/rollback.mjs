import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {deployment, aws as awsCommand, cli as awsWait} from './aws-cli.mjs';
import {commitPattern, taskRelease, verifyReadiness, requireDeploymentAccount} from './deployment-verification.mjs';

export async function rollbackRelease(d, previous, {execute = false} = {}, {
  aws = awsCommand, cli = awsWait, readiness = verifyReadiness, readinessTimeoutMs = 20000
} = {}) {
  if (!previous.compatible || previous.schemaRelease !== 2 || previous.cluster !== d.cluster || previous.environment !== d.environment) {
    throw new Error('Unsafe/incompatible rollback: CP-01 writers cannot serve CP-02 object assets. Forward-fix or perform reviewed isolated database restore.');
  }
  // Older records wrote the incoming requested commit into the previous record.
  // That value cannot prove the source served by an old task revision.
  if (previous.provenanceVersion !== 1 || !commitPattern.test(previous.sourceCommit || '')) {
    throw new Error('Insufficient prior release provenance; do not infer the previous source from a historical requested commit');
  }
  const expected = [d.worker_service, d.api_service];
  if (!Array.isArray(previous.services) || previous.services.length !== expected.length ||
      new Set(previous.services.map(service => service.service)).size !== expected.length ||
      previous.services.some(service => !expected.includes(service.service) || !Number.isInteger(service.desiredCount) || service.desiredCount < 0 || service.sourceCommit !== previous.sourceCommit ||
        typeof service.taskDefinition !== 'string' || typeof service.image !== 'string' ||
        !service.image.startsWith(d.image_repository + '@sha256:') || !/@sha256:[a-f0-9]{64}$/.test(service.image))) {
    throw new Error('Rollback record has missing, ambiguous or mismatched service provenance');
  }
  if (!execute) return {mode: 'review', environment: d.environment, sourceCommit: previous.sourceCommit,
    services: previous.services, frontend: 'Restore the matching immutable frontend artifact after verified API health; no database down migration.'};
  await requireDeploymentAccount(d, aws);
  // Verify every saved task before mutating either service.
  for (const service of previous.services) {
    const task = (await aws(d.region, 'ecs', 'describe-task-definition', {taskDefinition: service.taskDefinition})).taskDefinition;
    taskRelease(task, {repository: d.image_repository, arn: service.taskDefinition, image: service.image,
      commit: previous.sourceCommit, containerName: service.service === d.api_service ? 'api' : 'worker'});
  }
  for (const name of expected) {
    const service = previous.services.find(item => item.service === name);
    await aws(d.region, 'ecs', 'update-service', {cluster: d.cluster, service: name, taskDefinition: service.taskDefinition, desiredCount: service.desiredCount});
  }
  await cli(['ecs', 'wait', 'services-stable', '--region', d.region, '--cluster', d.cluster, '--services', ...expected]);
  const ready = await readiness(d.public_origin, previous.sourceCommit, {timeoutMs: readinessTimeoutMs});
  return {rollbackApplied: true, environment: d.environment, sourceCommit: previous.sourceCommit, readiness: ready};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [outputs, record] = process.argv.slice(2).filter(argument => !argument.startsWith('--'));
  try {
    if (!outputs || !record) throw new Error('Usage: node scripts/ops/rollback.mjs OUTPUTS_JSON PREVIOUS_DEPLOYMENT_JSON [--execute]');
    console.log(JSON.stringify(await rollbackRelease(await deployment(outputs), JSON.parse(await readFile(record, 'utf8')), {execute: process.argv.includes('--execute')})));
  } catch (error) {
    console.error(JSON.stringify({event: 'rollback_failed', reason: error.message}));
    process.exitCode = 1;
  }
}
