import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";

/* Tile OS runs in the browser only: sign in, then the company's data comes from the database. */
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
