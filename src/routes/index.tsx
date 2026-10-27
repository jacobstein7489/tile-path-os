import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";

/* Tile OS runs in the browser only: sign in, then the company's data comes from the database. */
/* this is the real app: it never holds the preview's sample, not even before the database answers */
(globalThis as any).__TILEOS_REAL__ = true;
/* After a new publish, an open tab may still point at old (now deleted) files.
   Reload once to pick up the fresh version instead of showing a blank screen. */
const RELOAD_KEY = "tileos:chunk-reload";
function reloadOnce() {
  if (typeof window === "undefined") return false;
  if (sessionStorage.getItem(RELOAD_KEY)) return false;
  sessionStorage.setItem(RELOAD_KEY, "1");
  window.location.reload();
  return true;
}
if (typeof window !== "undefined") {
  window.addEventListener("vite:preloadError", (e) => {
    if (reloadOnce()) e.preventDefault();
  });
}
const Boot = React.lazy(() =>
  import("@/tileos/Boot")
    .then((m) => {
      sessionStorage.removeItem(RELOAD_KEY);
      return m;
    })
    .catch((err) => {
      if (reloadOnce()) return new Promise<never>(() => {});
      throw err;
    }),
);

export const Route = createFileRoute("/")({
  ssr: false,
  component: Home,
});

function Home() {
  return (
    <div id="root">
      <React.Suspense fallback={<div className="min-h-screen bg-canvas" />}>
        <Boot />
      </React.Suspense>
    </div>
  );
}
