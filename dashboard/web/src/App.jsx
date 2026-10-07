import { useEffect, useRef, useState } from 'react';
import './App.css';

const API = 'http://localhost:4000';

function usePolled(path, intervalMs) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const r = await fetch(`${API}${path}`);
        const j = await r.json();
        if (!alive) return;
        setData(j);
        setError(j.error || null);
      } catch (e) {
        if (alive) setError('API unreachable — is the dashboard server running?');
      }
    };
    tick();
    const id = setInterval(tick, intervalMs);
    return () => { alive = false; clearInterval(id); };
  }, [path, intervalMs]);
  return { data, error };
}

function useLogStream() {
  const [lines, setLines] = useState([]);
  useEffect(() => {
    const es = new EventSource(`${API}/api/logs/stream`);
    es.onmessage = (e) => {
      try {
        const { line } = JSON.parse(e.data);
        setLines((prev) => [...prev.slice(-500), line]);
      } catch {}
    };
    return () => es.close();
  }, []);
  return lines;
}

function Controls({ busy, onRun }) {
  const btn = (name, label, cls) => (
    <button className={`btn ${cls}`} disabled={busy} onClick={() => onRun(name)}>
      {label}
    </button>
  );
  return (
    <div className="controls">
      {btn('deploy', 'Deploy (healthy)', 'ok')}
      {btn('break', 'Break (ship bad config)', 'bad')}
      {btn('rollback', 'Rollback', 'warn')}
    </div>
  );
}

function stepClass(s) {
  if (s.status !== 'completed') return s.status === 'in_progress' ? 'running' : 'queued';
  if (s.conclusion === 'success') return 'ok';
  if (s.conclusion === 'failure') return 'bad';
  return 'skipped';
}

function Pipeline() {
  const { data } = usePolled('/api/pipeline', 5000);
  if (!data) return null;

  if (!data.configured) {
    return (
      <section className="pipeline">
        <h2>pipeline — GitHub Actions</h2>
        <p className="muted">
          Set <code>GITHUB_TOKEN</code> and <code>GITHUB_REPO</code> on the backend to show live runs.
        </p>
      </section>
    );
  }

  const run = data.run;
  return (
    <section className="pipeline">
      <h2>pipeline — GitHub Actions</h2>
      {!run && <p className="muted">No runs yet — push a commit to trigger one.</p>}
      {run && (
        <>
          <div className="run-head">
            <a href={run.url} target="_blank" rel="noreferrer">#{run.number}</a>
            <span className="muted">{run.branch}</span>
            <span className="run-title">{run.title}</span>
            <span className={`chip ${run.conclusion || run.status}`}>
              {run.conclusion || run.status}
            </span>
          </div>
          <div className="stages">
            {data.steps.map((s, i) => (
              <div key={i} className={`stage ${stepClass(s)}`} title={s.conclusion || s.status}>
                {s.name}
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

export default function App() {
  const { data: podData, error } = usePolled('/api/pods', 2000);
  const pods = podData?.pods || [];
  const lines = useLogStream();
  const [busy, setBusy] = useState(false);
  const logRef = useRef(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [lines]);

  const run = async (name) => {
    setBusy(true);
    try {
      await fetch(`${API}/api/action/${name}`, { method: 'POST' });
    } finally {
      setTimeout(() => setBusy(false), 1500);
    }
  };

  const healthy = pods.length > 0 && pods.every((p) => p.allReady);
  const banner = error
    ? { cls: 'down', text: 'prod: unknown' }
    : healthy
    ? { cls: 'up', text: 'prod: HEALTHY' }
    : { cls: 'degraded', text: 'prod: DEGRADED / deploy stuck' };

  return (
    <div className="app">
      <header>
        <h1>CI/CD Deploy Simulator</h1>
        <span className={`badge ${banner.cls}`}>{banner.text}</span>
      </header>

      <Controls busy={busy} onRun={run} />

      <Pipeline />

      <section className="pods">
        <h2>prod namespace</h2>
        {error && <p className="err">{error}</p>}
        {!error && pods.length === 0 && <p className="muted">No pods found.</p>}
        <div className="pod-grid">
          {pods.map((p) => (
            <div key={p.name} className={`pod ${p.allReady ? 'ready' : 'notready'}`}>
              <div className="pod-name">{p.name}</div>
              <div className="pod-meta">
                <span>ready {p.ready}</span>
                <span>v:{p.version || '—'}</span>
                <span>restarts {p.restarts}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="logs">
        <h2>live logs</h2>
        <div className="console" ref={logRef}>
          {lines.length === 0 && <div className="muted">Run an action to see logs stream here…</div>}
          {lines.map((l, i) => (
            <div key={i} className="log-line">{l}</div>
          ))}
        </div>
      </section>
    </div>
  );
}