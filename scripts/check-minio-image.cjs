const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { createRequire } = require('node:module');
const { setTimeout: delay } = require('node:timers/promises');
const {
  S3Client, CreateBucketCommand, DeleteBucketCommand, DeleteObjectCommand,
  GetObjectCommand, HeadObjectCommand, ListBucketsCommand, PutObjectCommand, paginateListObjectsV2,
} = createRequire(require.resolve('../api/package.json'))('@aws-sdk/client-s3');

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
      const response = await fetch(`http://127.0.0.1:${port()}/minio/health/live`, {
        signal: AbortSignal.timeout(3000),
      });
      if (response.ok) return;
    } catch {
      // The endpoint can disappear briefly when the fixture restarts.
    }
    await delay(250);
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
    const newClient = (secretAccessKey = secretKey) => new S3Client({
      endpoint: `http://127.0.0.1:${port()}`,
      forcePathStyle: true,
      region: 'us-east-1',
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
      credentials: { accessKeyId: accessKey, secretAccessKey },
    });
    let client = newClient();
    await assert.rejects(newClient('incorrect-password').send(new ListBucketsCommand({})),
      { name: 'SignatureDoesNotMatch' });
    const Bucket = 'orbit-smoke';
    const Key = 'folder/sample.txt';
    const Body = Buffer.from('Orbit storage compatibility check');
    await client.send(new CreateBucketCommand({ Bucket }));
    await client.send(new PutObjectCommand({
      Bucket, Key, Body, ContentLength: Body.length, ContentType: 'text/plain',
    }));
    const stat = await client.send(new HeadObjectCommand({ Bucket, Key }));
    assert.equal(stat.ContentLength, Body.length);
    assert.equal(stat.ContentType, 'text/plain');
    const objects = [];
    for await (const page of paginateListObjectsV2({ client }, { Bucket })) {
      objects.push(...(page.Contents || []).map((object) => object.Key));
    }
    assert.deepEqual(objects, [Key]);
    docker('restart', container);
    await ready();
    client.destroy();
    client = newClient();
    const downloaded = await client.send(new GetObjectCommand({ Bucket, Key }));
    assert.deepEqual(Buffer.from(await downloaded.Body.transformToByteArray()), Body);
    await client.send(new DeleteObjectCommand({ Bucket, Key }));
    await assert.rejects(client.send(new HeadObjectCommand({ Bucket, Key })),
      (error) => error.$metadata?.httpStatusCode === 404);
    await client.send(new DeleteBucketCommand({ Bucket }));
    client.destroy();
    console.log('MinIO authentication, S3 operations and persistence checks passed.');
  } finally {
    docker('rm', '--force', '--volumes', container);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
