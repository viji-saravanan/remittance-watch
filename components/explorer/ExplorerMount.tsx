"use client";

import { useEffect, useState, type ComponentType } from "react";
import { RotateCw, SearchX } from "lucide-react";

import { Loading } from "./Loading";

/* The explorer is a client-only island (ADR-0006 §4): the page prerenders its
   shell + noscript fallback, and the interactive app mounts in the browser —
   it needs the DOM to resolve the bundle URL relative to the page, and the
   loading skeleton below is the genuine first state of that fetch.

   The import is kicked from a rAF→timeout yield rather than at hydration
   time: the rAF signs up for the next frame, the timeout runs the import
   AFTER that frame paints — so the browser paints the prerendered shell +
   skeleton before the island's chunk eval + bundle parse + first render
   queue up. The skeleton the user sees is real, and the heavy work never
   delays the first paint. */
export function ExplorerMount() {
  const [Client, setClient] = useState<ComponentType | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const raf = requestAnimationFrame(() => {
      timer = setTimeout(() => {
        import("./ExplorerClient")
          .then((m) => {
            if (alive) setClient(() => m.ExplorerClient);
          })
          .catch(() => {
            // a failed chunk must not strand the skeleton forever
            if (alive) setFailed(true);
          });
      }, 0);
    });
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      if (timer) clearTimeout(timer);
    };
  }, [attempt]);

  if (Client) return <Client />;
  if (failed)
    return (
      <div className="ex-state ex-state--error" role="alert">
        <SearchX size="1.5em" aria-hidden />
        <p>The explorer didn&rsquo;t load. It&rsquo;s a static page — this is usually transient.</p>
        <button
          type="button"
          className="ex-retry"
          onClick={() => {
            setFailed(false);
            setAttempt((a) => a + 1);
          }}
        >
          <RotateCw size="1em" aria-hidden /> Retry
        </button>
      </div>
    );
  return <Loading label="Loading corridor prices" />;
}
