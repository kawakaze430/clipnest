import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {deployment, aws as awsCommand, cli as awsWait, privateJson} from './aws-cli.mjs';
import {commitPattern, taskRelease, requireMigrationSuccess, verifyReadiness, requireDeploymentAccount} from './deployment-verification.mjs';

const allowed = ['family', 'taskRoleArn', 'executionRoleArn', 'networkMode', 'containerDefinitions', 'volumes', 'placementConstraints', 'requiresCompatibilities', 'cpu', 'memory', 'pidMode', 'ipcMode', 'proxyConfiguration', 'inferenceAccelerators', 'ephemeralStorage', 'runtimePlatform'];

export async function deployRelease(d, {image, commit, execute = false}, {
  aws = awsCommand, cli = awsWait, record = privateJson, readiness = verifyReadiness, readinessTimeoutMs = 20000
} = {}) {
  if (!commitPattern.test(commit || '') || !image?.startsWith(d.image_repository + '@sha256:') || !/@sha256:[a-f0-9]{64}$/.test(image)) {
    throw new Error('Release requires a known commit and immutable image in this deployment repository');
  }
  if (!execute) return {
    mode: 'review', environment: d.environment, image, commit,
    actions: ['capture prior tasks and source provenance', 'drain pre-CP02 services if needed', 'register and verify digest-pinned task revisions', 'run private migration once', 'require successful exact-release migration', 'roll workers then API and wait stable', 'verify healthy matching release', 'publish frontend separately after readiness'],
    requires: 'verified CI image/SBOM/scan, owner AWS authorization and release evidence'
  };
  await requireDeploymentAccount(d, aws);
  const region = d.region, services = [d.api_service, d.worker_service];
  const prior = await aws(region, 'ecs', 'describe-services', {cluster: d.cluster, services});
  if (prior.failures?.length || !Array.isArray(prior.services) || prior.services.length !== services.length ||
      new Set(prior.services.map(service => service.serviceName)).size !== services.length ||
      prior.services.some(service => !services.includes(service.serviceName) || !service.taskDefinition || !Number.isInteger(service.desiredCount) || service.desiredCount < 0)) {
    throw new Error('Current services are missing or ambiguous');
  }
  const previous = {
    provenanceVersion: 1, schemaRelease: 2, createdAt: new Date().toISOString(), requestedCommit: commit,
    commit: null, sourceCommit: null, environment: d.environment, cluster: d.cluster, services: [], compatible: true
  };
  let schemaCompatible = true;
  for (const service of prior.services) {
    const task = (await aws(region, 'ecs', 'describe-task-definition', {taskDefinition: service.taskDefinition})).taskDefinition;
    if (!Array.isArray(task?.containerDefinitions) || !task.containerDefinitions.length ||
        !task.containerDefinitions.every(container => container.environment?.some(item => item.name === 'SCHEMA_RELEASE' && item.value === '2'))) schemaCompatible = false;
    let release = null;
    try {
      release = taskRelease(task, {repository: d.image_repository, arn: service.taskDefinition,
        containerName: service.serviceName === d.api_service ? 'api' : 'worker'});
    } catch {
      previous.compatible = false;
    }
    previous.services.push({service: service.serviceName, taskDefinition: service.taskDefinition,
      desiredCount: service.desiredCount, sourceCommit: release?.sourceCommit ?? null, image: release?.image ?? null});
  }
  const priorSources = new Set(previous.services.map(service => service.sourceCommit));
  if (previous.compatible && priorSources.size === 1 && !priorSources.has(null)) {
    previous.sourceCommit = previous.commit = [...priorSources][0];
  } else {
    previous.compatible = false;
    previous.compatibilityReason = 'Prior tasks do not prove a single immutable CP-02 source release';
  }
  await record('.cache/release/previous-deployment.json', previous);
  // Preserve the pre-CP02 drain requirement. Missing rollback provenance does
  // not fabricate a prior commit or turn a known CP-02 schema into CP-01.
  if (!schemaCompatible) {
    for (const service of previous.services) await aws(region, 'ecs', 'update-service', {cluster: d.cluster, service: service.service, desiredCount: 0});
    await cli(['ecs', 'wait', 'services-stable', '--region', region, '--cluster', d.cluster, '--services', ...services]);
  }
  async function revision(arn, containerName) {
    const old = (await aws(region, 'ecs', 'describe-task-definition', {taskDefinition: arn})).taskDefinition;
    if (!old || !Array.isArray(old.containerDefinitions) || !old.containerDefinitions.length) throw new Error('Base task definition is incomplete');
    const input = Object.fromEntries(allowed.filter(key => old[key] !== undefined).map(key => [key, old[key]]));
    input.containerDefinitions = input.containerDefinitions.map(container => ({...container, image, environment: [
      ...(container.environment || []).filter(item => !['SOURCE_COMMIT', 'SCHEMA_RELEASE'].includes(item.name)),
      {name: 'SOURCE_COMMIT', value: commit}, {name: 'SCHEMA_RELEASE', value: '2'}
    ]}));
    const registered = (await aws(region, 'ecs', 'register-task-definition', input)).taskDefinition;
    taskRelease(registered, {repository: d.image_repository, image, commit, containerName});
    if (registered.family !== old.family) throw new Error('Registered task family differs from the requested release');
    return registered.taskDefinitionArn;
  }
  const migration = await revision(d.migration_task, 'migration');
  const worker = await revision(d.worker_task, 'worker');
  const api = await revision(d.api_task, 'api');
  const started = await aws(region, 'ecs', 'run-task', {
    cluster: d.cluster, taskDefinition: migration, launchType: 'FARGATE',
    networkConfiguration: {awsvpcConfiguration: {subnets: d.application_subnets, securityGroups: [d.application_security_group], assignPublicIp: 'DISABLED'}}, startedBy: 'clipnest-release'
  });
  if (started.failures?.length || started.tasks?.length !== 1 || !started.tasks[0]?.taskArn) throw new Error('Migration task failed to start');
  const taskArn = started.tasks[0].taskArn;
  await cli(['ecs', 'wait', 'tasks-stopped', '--region', region, '--cluster', d.cluster, '--tasks', taskArn]);
  const result = await aws(region, 'ecs', 'describe-tasks', {cluster: d.cluster, tasks: [taskArn]});
  requireMigrationSuccess(result, {taskArn, taskDefinitionArn: migration, image});
  for (const [service, taskDefinition] of [[d.worker_service, worker], [d.api_service, api]]) {
    await aws(region, 'ecs', 'update-service', {cluster: d.cluster, service, taskDefinition, desiredCount: 2});
    await cli(['ecs', 'wait', 'services-stable', '--region', region, '--cluster', d.cluster, '--services', service]);
  }
  const ready = await readiness(d.public_origin, commit, {timeoutMs: readinessTimeoutMs});
  const released = {createdAt: new Date().toISOString(), commit, image, migration, worker, api, previousCompatible: previous.compatible, readiness: ready};
  await record('.cache/release/deployment.json', released);
  return {deployed: true, environment: d.environment, origin: d.public_origin, previousCompatible: previous.compatible, readiness: ready};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [outputs, image, commit] = process.argv.slice(2).filter(argument => !argument.startsWith('--'));
  try {
    if (!outputs || !image || !commit) throw new Error('Usage: node scripts/ops/deploy.mjs OUTPUTS_JSON ECR_URI@sha256:DIGEST COMMIT [--execute]');
    console.log(JSON.stringify(await deployRelease(await deployment(outputs), {image, commit, execute: process.argv.includes('--execute')})));
  } catch (error) {
    console.error(JSON.stringify({event: 'deployment_failed', reason: error.message}));
    process.exitCode = 1;
  }
}
