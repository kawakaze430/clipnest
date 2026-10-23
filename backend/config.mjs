import { randomBytes } from 'node:crypto';
import path from 'node:path';

export function loadConfig(env = process.env) {
  const integer = (key, fallback, min, max) => {
    const raw = env[key] ?? String(fallback);
    if (!/^\d+$/.test(String(raw))) throw new Error(`${key} must be an integer`);
    const value = Number(raw);
    if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`${key} must be between ${min} and ${max}`);
    return value;
  };
  const boolean = (key, fallback) => {
    const value = env[key] ?? String(fallback);
    if (!['true', 'false'].includes(String(value))) throw new Error(`${key} must be true or false`);
    return value === 'true';
  };
  const production = env.NODE_ENV === 'production';
  const databaseUrl = env.DATABASE_URL || '';
  if (databaseUrl) {
    let u; try { u = new URL(databaseUrl); } catch { throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL'); }
    if (!['postgres:', 'postgresql:'].includes(u.protocol)) throw new Error('DATABASE_URL must use PostgreSQL');
    // pg connection-string SSL options override the explicit ssl object. Keep
    // certificate policy in one place so a URL cannot silently disable it.
    if ([...u.searchParams.keys()].some(key=>/^ssl/i.test(key))) throw new Error('Use DB_TLS and DB_CA_FILE instead of SSL parameters in DATABASE_URL');
  }
  const origin = env.PUBLIC_ORIGIN || `http://localhost:${env.PORT || 8787}`;
  const parsed = new URL(origin);
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.pathname !== '/' || parsed.search || parsed.hash || parsed.username || parsed.password) throw new Error('PUBLIC_ORIGIN must be an HTTP(S) origin');
  if (production && parsed.protocol !== 'https:') throw new Error('Production PUBLIC_ORIGIN must use HTTPS');
  if (production && !databaseUrl) throw new Error('Production requires DATABASE_URL; prototype memory mode is local-only');
  if (production && (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32)) throw new Error('Production requires a SESSION_SECRET of at least 32 characters');
  const secureCookies = boolean('COOKIE_SECURE', production);
  if (production && !secureCookies) throw new Error('Production session cookies must be secure');
  const dbTls = env.DB_TLS || (production ? 'verify-full' : 'disable');
  if (!['verify-full', 'disable'].includes(dbTls)) throw new Error('DB_TLS must be verify-full or disable');
  if (production && dbTls !== 'verify-full') throw new Error('Production database TLS verification is required');
  const choice=(key,fallback,allowed)=>{const value=env[key]||fallback;if(!allowed.includes(value))throw new Error(`${key} must be one of ${allowed.join(', ')}`);return value;};
  const storageBackend=choice('STORAGE_BACKEND','local',['local','s3']);
  const queueMode=choice('QUEUE_MODE','database',['database','sqs']);
  const mailMode=choice('MAIL_MODE',production?'ses':'file',['ses','file']);
  const mediaBaseUrl=env.MEDIA_BASE_URL||'';
  if(mediaBaseUrl){const u=new URL(mediaBaseUrl);if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.pathname!=='/')throw new Error('MEDIA_BASE_URL must be an HTTPS origin');}
  if(storageBackend==='s3'&&(!env.S3_BUCKET||!mediaBaseUrl||!env.CLOUDFRONT_KEY_PAIR_ID||(env.APP_ROLE!=='worker'&&!env.CLOUDFRONT_PRIVATE_KEY)))throw new Error('S3 delivery requires S3_BUCKET, MEDIA_BASE_URL and CloudFront signing credentials');
  if(queueMode==='sqs'&&(!env.SQS_QUEUE_URL||!env.SQS_DLQ_URL))throw new Error('SQS mode requires queue and dead-letter URLs');
  for(const key of ['SQS_QUEUE_URL','SQS_DLQ_URL'])if(env[key]&&!/^https:\/\/sqs[.][a-z0-9-]+[.]amazonaws[.]com(?:[.]cn)?\/[0-9]{12}\/[\w-]+$/.test(env[key]))throw new Error(`${key} must be an AWS SQS HTTPS URL`);
  if(production&&mailMode!=='ses')throw new Error('Production email requires SES; development file mail is local-only');
  if(production&&storageBackend==='local'&&!boolean('ALLOW_SHARED_LOCAL_STORAGE',false))throw new Error('Production requires S3 delivery or an explicit shared-filesystem deployment decision');
  if(mailMode==='ses'&&!env.MAIL_FROM)throw new Error('SES mode requires a verified MAIL_FROM identity');
  return {
    production, databaseUrl, publicOrigin: parsed.origin, dbTls, dbCaFile: env.DB_CA_FILE || '',
    storageBackend,queueMode,mailMode,mediaBaseUrl:mediaBaseUrl.replace(/\/$/,''),
    awsRegion:env.AWS_REGION||'ap-south-1',s3Bucket:env.S3_BUCKET||'',objectPrefix:'media/',
    cloudfrontKeyPairId:env.CLOUDFRONT_KEY_PAIR_ID||'',cloudfrontPrivateKey:env.CLOUDFRONT_PRIVATE_KEY||'',
    sqsQueueUrl:env.SQS_QUEUE_URL||'',sqsDlqUrl:env.SQS_DLQ_URL||'',mailFrom:env.MAIL_FROM||'',
    environment:env.DEPLOYMENT_ENV||'development',
    requireEmailVerification:boolean('REQUIRE_EMAIL_VERIFICATION',production),
    jobRetentionDays:integer('JOB_RETENTION_DAYS',30,1,365),auditRetentionDays:integer('AUDIT_RETENTION_DAYS',90,1,365),
    orphanGraceMinutes:integer('ORPHAN_GRACE_MINUTES',60,5,1440),
    maxQueuedJobs:integer('MAX_QUEUED_JOBS',100,1,10000),
    globalDailyJobs:integer('GLOBAL_DAILY_JOB_LIMIT',100,1,100000),
    globalDailyBytes:integer('GLOBAL_DAILY_BYTE_LIMIT',10737418240,1024,1099511627776),
    maxAnalysisConcurrent:integer('MAX_CONCURRENT_ANALYSES',1,1,10),
    jobTimeoutSeconds:integer('JOB_TIMEOUT_SECONDS',1800,5,7200),
    sessionSecret: env.SESSION_SECRET || randomBytes(32).toString('hex'), secureCookies,
    cookieName: secureCookies ? '__Host-clipnest' : 'clipnest_session',
    sessionHours: integer('SESSION_HOURS', 24, 1, 168),
    maxBytes: integer('MAX_FILE_BYTES', 262144000, 1024, 1073741824),
    maxDuration: integer('MAX_DURATION_SECONDS', 900, 1, 7200),
    maxConcurrent: integer('MAX_CONCURRENT_JOBS', 2, 1, 20),
    dailyJobs: integer('DAILY_JOB_LIMIT', 5, 1, 1000),
    dailyBytes: integer('DAILY_BYTE_LIMIT', 1310720000, 1024, 107374182400),
    fileTtlMinutes: integer('FILE_TTL_MINUTES', 30, 1, 1440),
    analysisTtlMinutes: integer('ANALYSIS_TTL_MINUTES', 10, 1, 60),
    authAttemptsPerMinute: integer('AUTH_ATTEMPTS_PER_MINUTE', 12, 1, 100),
    apiRequestsPerMinute: integer('API_REQUESTS_PER_MINUTE', 30, 1, 1000),
    dbPoolMax: integer('DB_POOL_MAX', 10, 1, 50),
    trustedProxyHops: integer('TRUST_PROXY_HOPS', 0, 0, 3),
    inlineWorker: boolean('INLINE_WORKER', !production),
    allowRegistration: boolean('ALLOW_REGISTRATION', !production),
    systemCa: boolean('YTDLP_USE_SYSTEM_CA', false),
    dataDir: path.resolve(env.DATA_DIR || '.cache'),
    port: integer('PORT', 8787, 1, 65535), host: env.HOST || '127.0.0.1',
  };
}
