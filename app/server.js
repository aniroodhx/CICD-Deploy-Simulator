'use strict';

// Minimal zero-dependency HTTP API — the "thing being deployed" in the simulator.
// Endpoints:
//   GET /          -> greeting + version
//   GET /health    -> readiness/liveness probe used by Kubernetes
//   GET /version   -> the image/app version currently serving traffic
const http = require('http');

const PORT = process.env.PORT || 8080;
const APP_VERSION = process.env.APP_VERSION || 'dev';

// Health depends on config being present. Phase 3 injects failures by
// unsetting/mis-setting GREETING so the health check goes red on purpose.
const GREETING = process.env.GREETING || 'Hello from the deploy simulator';

function isHealthy() {
  return typeof GREETING === 'string' && GREETING.length > 0;
}

const server = http.createServer((req, res) => {
  const send = (code, body) => {
    res.writeHead(code, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  };

  if(req.url === '/health'){
    return isHealthy()
      ? send(200, { status: 'ok', version: APP_VERSION })
      : send(503, { status: 'unhealthy', reason: 'GREETING not configured' });
  }
  if(req.url === '/version') return send(200, { version: APP_VERSION });
  if(req.url === '/') return send(200, { message: GREETING, version: APP_VERSION });
  return send(404, { error: 'not found' });
});

// Only listen when run directly, so tests can import the server.
if(require.main === module){
  server.listen(PORT, () => console.log(`listening on :${PORT} (v${APP_VERSION})`));
}

module.exports = { server, isHealthy };
