'use strict';

//   Bridges the browser UI to the real cluster + scripts
//   GET  /api/pods          -> current pod health in the prod namespace
//   GET  /api/logs/stream   -> Server-Sent Events feed of action output (live logs)
//   POST /api/action/deploy|break|rollback -> runs the matching script

const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const PORT = process.env.PORT || 4000;
const ROOT = path.resolve(__dirname, '..'); // repo root (scripts live under ROOT/scripts)
const NS = 'prod';

// GitHub Actions integration (Level 1). Set these in the environment:
// GITHUB_REPO=owner/repo   GITHUB_TOKEN=<fine-grained or classic token, Actions:read>

const GH_REPO = process.env.GITHUB_REPO || 'aniroodhx/CICD-Deploy-Simulator';
const GH_TOKEN = process.env.GITHUB_TOKEN || '';

// live log feed (SSE)
const logClients = new Set();
function broadcast(line) {
  const payload = `data: ${JSON.stringify({ line, ts: Date.now() })}\n\n`;
  for (const client of logClients) client.write(payload);
}

// actions: run a repo script, stream its output 
const ACTIONS = {
  deploy: 'scripts/deploy-local.sh',
  break: 'scripts/break.sh',
  rollback: 'scripts/rollback.sh',
};
let running = null;

function runAction(name, res) {
  if (!ACTIONS[name]) return json(res, 404, { error: `unknown action: ${name}` });
  if (running) return json(res, 409, { error: `'${running}' is still running` });

  running = name;
  broadcast(`\n=== running ${name} ===`);
  const child = spawn('bash', [ACTIONS[name]], { cwd: ROOT });

  const pipe = (buf) =>
    buf
      .toString()
      .split('\n')
      .forEach((l) => l.length && broadcast(l));
  child.stdout.on('data', pipe);
  child.stderr.on('data', pipe);
  child.on('close', (code) => {
    broadcast(`=== ${name} finished (exit ${code}) ===`);
    running = null;
  });

  return json(res, 202, { started: name });
}

// pod status 
function getPods(res) {
  const child = spawn('kubectl', ['-n', NS, 'get', 'pods', '-o', 'json']);
  let out = '';
  let err = '';
  child.stdout.on('data', (d) => (out += d));
  child.stderr.on('data', (d) => (err += d));
  child.on('error', () => json(res, 500, { error: 'kubectl not found' }));
  child.on('close', (code) => {
    if (code !== 0) return json(res, 500, { error: err.trim() || 'kubectl failed' });
    try {
      const items = JSON.parse(out).items || [];
      const pods = items.map((p) => {
        const cs = p.status.containerStatuses || [];
        const ready = cs.filter((c) => c.ready).length;
        const envs = (p.spec.containers[0] && p.spec.containers[0].env) || [];
        return {
          name: p.metadata.name,
          phase: p.status.phase,
          ready: `${ready}/${cs.length || 1}`,
          allReady: cs.length > 0 && ready === cs.length,
          restarts: cs.reduce((a, c) => a + (c.restartCount || 0), 0),
          version: (envs.find((e) => e.name === 'APP_VERSION') || {}).value || '',
        };
      });
      return json(res, 200, { pods });
    } catch (e) {
      return json(res, 500, { error: 'failed to parse kubectl output' });
    }
  });
}

// live GitHub Actions pipeline status
async function getPipeline(res) {
  if (!GH_TOKEN) return json(res, 200, { configured: false });
  const base = `https://api.github.com/repos/${GH_REPO}/actions`;
  const headers = {
    Authorization: `Bearer ${GH_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'deploy-sim-dashboard',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  try {
    const runsR = await fetch(`${base}/runs?per_page=1`, { headers });
    if (!runsR.ok) return json(res, 502, { error: `GitHub API ${runsR.status}` });
    const run = (await runsR.json()).workflow_runs?.[0];
    if (!run) return json(res, 200, { configured: true, run: null, steps: [] });

    const jobsR = await fetch(`${base}/runs/${run.id}/jobs`, { headers });
    const job = (await jobsR.json()).jobs?.[0];
    const steps = (job?.steps || [])
      .filter((s) => !/^(Set up job|Complete job|Post )/.test(s.name))
      .map((s) => ({ name: s.name, status: s.status, conclusion: s.conclusion }));

    return json(res, 200, {
      configured: true,
      run: {
        number: run.run_number,
        title: run.display_title || run.name,
        branch: run.head_branch,
        status: run.status,
        conclusion: run.conclusion,
        url: run.html_url,
        updated: run.updated_at,
      },
      steps,
    });
  } catch (e) {
    return json(res, 502, { error: `failed to reach GitHub: ${e.message}` });
  }
}

// helpers 
function json(res, code, body) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  // Allow the Vite dev server (different port) to call this API.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.writeHead(204).end();

  const url = new URL(req.url, `http://localhost:${PORT}`);

  if(url.pathname === '/api/pods' && req.method === 'GET') return getPods(res);
  if(url.pathname === '/api/pipeline' && req.method === 'GET') return getPipeline(res); 

  if (url.pathname === '/api/logs/stream' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write('retry: 3000\n\n');
    logClients.add(res);
    req.on('close', () => logClients.delete(res));
    return;
  }

  const action = url.pathname.match(/^\/api\/action\/(\w+)$/);
  if (action && req.method === 'POST') return runAction(action[1], res);

  return json(res, 404, { error: 'not found' });
});

server.listen(PORT, () => console.log(`dashboard API listening on :${PORT}`));