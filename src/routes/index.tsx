import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";

/* Tile OS runs in the browser only: sign in, then the company's data comes from the database. */
/* this is the real app: it never holds the preview's sample, not even before the database answers */
(globalThis as any).__TILEOS_REAL__ = true;
const Boot = React.lazy(() => import("@/tileos/Boot"));

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
