export default function Home(): JSX.Element {
  return (
    <main style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Ceylon Haven Pinterest Automation</h1>
      <p>Phase 2: Foundation & State Machine</p>
      <ul>
        <li>
          <a href="/api/health">Health Check</a>
        </li>
        <li>
          <a href="/api/cron/facebook-pinterest">Cron Endpoint (GET)</a>
        </li>
      </ul>
      <h2>Status</h2>
      <ul>
        <li>State Machine: Implemented</li>
        <li>Database Schema: Ready for migration</li>
        <li>Mock Services: Active</li>
        <li>Tests: Running</li>
        <li>Real API Calls: 0</li>
      </ul>
    </main>
  );
}
