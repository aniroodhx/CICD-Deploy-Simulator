'use strict';
// Health requires GREETING to be set, so configure it before the server loads.
process.env.GREETING = process.env.GREETING || 'test greeting';

const { test } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const { server } = require('./server');

function get(path) {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    http
      .get({ host: '127.0.0.1', port: addr.port, path }, (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
      })
      .on('error', reject);
  });
}

test.before(() => new Promise((r) => server.listen(0, r)));
test.after(() => new Promise((r) => server.close(r)));

test('GET / returns greeting and version', async () => {
  const res = await get('/');
  assert.strictEqual(res.status, 200);
  assert.ok(res.body.message);
  assert.ok(res.body.version);
});

test('GET /health returns ok when configured', async () => {
  const res = await get('/health');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.status, 'ok');
});

test('GET /health returns 503 when GREETING is missing', async () => {
  const saved = process.env.GREETING;
  delete process.env.GREETING;
  try {
    const res = await get('/health');
    assert.strictEqual(res.status, 503);
    assert.strictEqual(res.body.status, 'unhealthy');
  } finally {
    process.env.GREETING = saved;
  }
});

test('GET /version returns a version', async () => {
  const res = await get('/version');
  assert.strictEqual(res.status, 200);
  assert.ok(res.body.version);
});

test('unknown route returns 404', async () => {
  const res = await get('/nope');
  assert.strictEqual(res.status, 404);
});
