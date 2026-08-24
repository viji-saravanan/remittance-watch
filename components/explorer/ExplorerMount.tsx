"use client";

import { useEffect, useState, type ComponentType } from "react";

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

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const raf = requestAnimationFrame(() => {
      timer = setTimeout(() => {
        import("./ExplorerClient").then((m) => {
          if (alive) setClient(() => m.ExplorerClient);
        });
      }, 0);
    });
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      if (timer) clearTimeout(timer);
    };
  }, []);

  return Client ? <Client /> : <Loading label="Loading corridor prices" />;
}
