export default function Loading() {
  return (
    <main className="route-state" aria-live="polite">
      <div className="route-state-brand">N</div>
      <p>Preparing story clusters…</p>
      <div className="loading-list" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </main>
  );
}
