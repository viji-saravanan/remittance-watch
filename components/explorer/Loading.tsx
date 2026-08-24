/* Shared loading skeleton — lives in its own module so the dynamic import of
   ExplorerClient stays a real code split (a static import from that module
   here would pull the whole explorer into the entry chunk). */

export function Loading({ label }: { label: string }) {
  return (
    <div className="ex-state ex-state--loading" aria-live="polite" aria-busy="true">
      <p className="sr-only">{label}…</p>
      <div className="ex-skel ex-skel--pickers" />
      <div className="ex-skel ex-skel--head" />
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="ex-skel ex-skel--row" style={{ animationDelay: `${i * 0.08}s` }} />
      ))}
    </div>
  );
}
