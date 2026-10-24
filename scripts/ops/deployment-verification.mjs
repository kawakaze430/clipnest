// Release identity checks shared by deployment and compatible rollback.
import {assertMigrationSucceeded, assertHealthyRollbackResponse} from './release-safety.mjs';
export const commitPattern = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const taskArnPattern = /^arn:aws(?:-[a-z]+)*:ecs:[a-z0-9-]+:[0-9]{12}:task-definition\/[A-Za-z0-9_-]+:[0-9]+$/;

export async function requireDeploymentAccount(d, aws) {
  const repository = /^(\d{12})\.dkr\.ecr\.([a-z0-9-]+)\.amazonaws\.com\/[^@\s]+$/.exec(d.image_repository || '');
  if (!repository || repository[2] !== d.region || (d.account_id && d.account_id !== repository[1]) ||
      ['api_task', 'worker_task', 'migration_task'].some(name =>
        !taskArnPattern.test(d[name] || '') || !d[name].startsWith(`arn:aws:ecs:${d.region}:${repository[1]}:task-definition/`))) {
    throw new Error('Deployment outputs do not identify one expected AWS account and Region');
  }
  const identity = await aws(d.region, 'sts', 'get-caller-identity');
  if (identity?.Account !== repository[1]) throw new Error('Authenticated AWS account differs from the deployment target; no service changes allowed');
}

export function taskRelease(task, {repository, arn, image, commit, containerName} = {}) {
  if (!task || !taskArnPattern.test(task.taskDefinitionArn || '') || (arn && task.taskDefinitionArn !== arn)) {
    throw new Error('Task definition identity is missing or mismatched');
  }
  const containers = task.containerDefinitions;
  if (!Array.isArray(containers) || !containers.length ||
      (containerName && !containers.some(container => container.name === containerName))) {
    throw new Error('Task definition has no expected release container');
  }
  const sources = new Set(), images = new Set();
  for (const container of containers) {
    const environment = container.environment;
    const values = name => Array.isArray(environment) ? environment.filter(item => item.name === name).map(item => item.value) : [];
    const schema = values('SCHEMA_RELEASE'), source = values('SOURCE_COMMIT');
    if (schema.length !== 1 || schema[0] !== '2' || source.length !== 1 || !commitPattern.test(source[0])) {
      throw new Error('Task definition lacks verified CP-02 source metadata');
    }
    if (typeof repository !== 'string' || !container.image?.startsWith(repository + '@sha256:') ||
        !/@sha256:[a-f0-9]{64}$/.test(container.image)) {
      throw new Error('Task definition image is not immutable in the expected repository');
    }
    if ((image && container.image !== image) || (commit && source[0] !== commit)) {
      throw new Error('Registered task image or source differs from the requested release');
    }
    sources.add(source[0]);
    images.add(container.image);
  }
  if (sources.size !== 1 || images.size !== 1) throw new Error('Task containers identify different releases');
  return {sourceCommit: [...sources][0], image: [...images][0]};
}

export function requireMigrationSuccess(response, {taskArn, taskDefinitionArn, image}) {
  assertMigrationSucceeded(response, taskArn);
  const task = response.tasks[0];
  if (!task || task.taskArn !== taskArn || task.taskDefinitionArn !== taskDefinitionArn ||
      task.lastStatus !== 'STOPPED' || task.stopCode !== 'EssentialContainerExited' ||
      !Array.isArray(task.containers) || !task.containers.length ||
      !task.containers.some(container => container.name === 'migration') ||
      task.containers.some(container => container.exitCode !== 0 || container.lastStatus !== 'STOPPED' || container.image !== image)) {
    throw new Error('Migration did not prove successful completion of the exact release; service rollout stopped');
  }
}

export async function verifyReadiness(origin, expectedCommit, {timeoutMs = 20000, fetchImpl = fetch} = {}) {
  if (!commitPattern.test(expectedCommit || '')) throw new Error('Readiness requires a known release commit');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1) throw new Error('Readiness requires a positive timeout');
  const target = new URL('/readyz', origin);
  if (target.protocol !== 'https:' && !(target.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname))) {
    throw new Error('Release readiness requires HTTPS outside a disposable loopback test');
  }
  let response, result;
  try {
    response = await fetchImpl(target, {
      redirect: 'manual', signal: AbortSignal.timeout(timeoutMs), headers: {Accept: 'application/json'}
    });
    if (response.status !== 200) throw new Error('Release readiness returned HTTP ' + response.status);
    assertHealthyRollbackResponse(response);
    result = await response.json();
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') throw new Error('Release readiness timed out');
    if (error.message?.startsWith('Release readiness returned HTTP ')) throw error;
    throw new Error('Release readiness request or JSON response failed');
  }
  if (result?.ready !== true || ['database', 'workers', 'engine', 'ffmpeg'].some(name => result[name] !== true) ||
      result.release?.source !== expectedCommit || typeof result.release?.version !== 'string' || !result.release.version.trim()) {
    throw new Error('Readiness does not identify a healthy matching release');
  }
  return {status: response.status, ready: true, release: {source: result.release.source, version: result.release.version}};
}
