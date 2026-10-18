const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { createRequire } = require('node:module');
const { setTimeout: delay } = require('node:timers/promises');
const { Client } = createRequire(require.resolve('../api/package.json'))('minio');

const image = process.argv[2];
assert.ok(image, 'Provide the task-owned MinIO image to test');
const container = `orbit-minio-smoke-${randomUUID()}`;
const accessKey = 'orbit-smoke';
const secretKey = 'orbit-smoke-test-password';
const docker = (...args) => execFileSync('docker', args, {
  encoding: 'utf8',
  timeout: args[0] === 'exec' ? 5000 : 60000,
  stdio: 'pipe',
});

function port() {
  const info = JSON.parse(docker('inspect', container))[0];
  return Number(info.NetworkSettings.Ports['9000/tcp'][0].HostPort);
}

async function ready() {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      docker('exec', container, 'mc', 'ready', 'local');
      return;
    } catch {
      await delay(250);
    }
  }
  throw new Error('MinIO did not become ready within 30 seconds');
}

async function main() {
  try {
    docker('run', '--detach', '--name', container,
      '--publish', '127.0.0.1::9000',
      '--env', `MINIO_ROOT_USER=${accessKey}`,
      '--env', `MINIO_ROOT_PASSWORD=${secretKey}`,
      image, 'server', '/data', '--console-address', ':9001');
    await ready();
    assert.match(docker('exec', container, 'minio', '--version'),
      /RELEASE\.2025-09-07T16-13-09Z/);
    const options = {
      endPoint: '127.0.0.1',
      port: port(),
      useSSL: false,
      accessKey,
      secretKey,
    };
    let client = new Client(options);
    await assert.rejects(new Client({ ...options, secretKey: 'incorrect-password' }).listBuckets(),
      { code: 'SignatureDoesNotMatch' });
    const bucket = 'orbit-smoke';
    const key = 'folder/sample.txt';
    const content = Buffer.from('Orbit storage compatibility check');
    await client.makeBucket(bucket, 'us-east-1');
    await client.putObject(bucket, key, content, content.length, { 'Content-Type': 'text/plain' });
    const stat = await client.statObject(bucket, key);
    assert.equal(stat.size, content.length);
    assert.equal(stat.metaData['content-type'], 'text/plain');
    const objects = [];
    for await (const object of client.listObjectsV2(bucket, '', true)) objects.push(object.name);
    assert.deepEqual(objects, [key]);
    docker('restart', container);
    await ready();
    client = new Client({ ...options, port: port() });
    const chunks = [];
    for await (const chunk of await client.getObject(bucket, key)) chunks.push(chunk);
    assert.deepEqual(Buffer.concat(chunks), content);
    await client.removeObject(bucket, key);
    await assert.rejects(client.statObject(bucket, key), { code: 'NotFound' });
    await client.removeBucket(bucket);
    console.log('MinIO authentication, S3 operations and persistence checks passed.');
  } finally {
    docker('rm', '--force', '--volumes', container);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
