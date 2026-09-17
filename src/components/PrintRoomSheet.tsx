import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { PackageSnapshot, PackageSnapshotRow } from "@/lib/packages";

/**
 * Jobsite room sheet. One page per room, printed from the same snapshot the
 * office reviews — nothing here is a second data model. It is deliberately
 * plain black-on-white so it stays legible taped to a wall.
 */

export type RoomSheetInput = {
  projectName: string;
  projectAddress: string | null;
  snapshot: PackageSnapshot;
  revisionLabel: string;
  publishedBy: string | null;
  publishedAt: string | null;
  photoPaths: { path: string; caption: string | null }[];
};

export function PrintRoomSheet({ sheets }: { sheets: RoomSheetInput[] }) {
  return (
    <div className="print-sheet">
      {sheets.map((sheet) => (
        <RoomPage key={sheet.snapshot.room} sheet={sheet} />
      ))}
    </div>
  );
}

function RoomPage({ sheet }: { sheet: RoomSheetInput }) {
  const photos = useSignedPhotos(sheet.photoPaths);
  return (
    <article className="print-page">
      <header className="print-head">
        <div>
          <h1>{sheet.snapshot.room}</h1>
          <p>
            {sheet.projectName}
            {sheet.projectAddress ? ` · ${sheet.projectAddress}` : ""}
          </p>
        </div>
        <div className="print-meta">
          <b>{sheet.revisionLabel}</b>
          <span>
            {sheet.publishedAt ? new Date(sheet.publishedAt).toLocaleString() : "Draft — not published"}
          </span>
          {sheet.publishedBy ? <span>Published by {sheet.publishedBy}</span> : null}
        </div>
      </header>

      {sheet.snapshot.rows.length === 0 ? (
        <p className="print-empty">No surfaces recorded in this room.</p>
      ) : (
        sheet.snapshot.rows.map((row, index) => <SurfaceBlock key={`${row.surface}-${row.zone}-${index}`} row={row} />)
      )}

      {photos.length > 0 ? (
        <section className="print-photos">
          <h3>Reference photos</h3>
          <div className="print-photo-grid">
            {photos.map((photo) => (
              <figure key={photo.url}>
                <img src={photo.url} alt={photo.caption ?? `${sheet.snapshot.room} reference photo`} />
                {photo.caption ? <figcaption>{photo.caption}</figcaption> : null}
              </figure>
            ))}
          </div>
        </section>
      ) : null}

      <footer className="print-foot">
        Questions or a conflict on site? Stop and call the office before installing. Do not deviate from this
        sheet — a change requires a new published revision.
      </footer>
    </article>
  );
}

function SurfaceBlock({ row }: { row: PackageSnapshotRow }) {
  const dashed = (v?: string) => (!v || v === "—" ? null : v);
  const facts: [string, string | null][] = [
    ["Tile / product", dashed(row.tile)],
    ["Manufacturer", dashed(row.manufacturer)],
    ["SKU / item", dashed(row.sku)],
    ["Nominal size", dashed(row.size)],
    ["Actual tile dimension", dashed(row.actual_size)],
    ["Tile finish", dashed(row.tile_finish)],
    ["Supplier", dashed(row.supplier)],
    ["Layout direction", dashed(row.direction)],
    ["Pattern", dashed(row.pattern)],
    ["Start point", dashed(row.start)],
    ["Feature alignment", dashed(row.alignment)],
    ["Grout / color", dashed(row.grout)],
    ["Joint size", dashed(row.joint)],
    ["Edge / metal / miter", dashed(row.edge)],
    ["Finish height", dashed(row.height)],
    ["Termination / transition", dashed(row.transition)],
    ["Niche / bench / curb / saddle", dashed(row.features)],
    ["Measurements", dashed(row.measurements)],
    ["Prep / substrate", dashed(row.prep)],
    ["Underlayment", dashed(row.underlayment)],
    ["Waterproofing", dashed(row.waterproofing)],
  ];
  const present = facts.filter(([, value]) => value);
  const missing = facts.filter(([, value]) => !value).map(([label]) => label);
  return (
    <section className="print-surface">
      <h2>
        {row.surface}
        <span>{row.zone}</span>
      </h2>
       <dl>
         {present.map(([label, value]) => (
           <div key={label}>
            <dt>{label}</dt>
             <dd>{value}</dd>
          </div>
        ))}
      </dl>
        {missing.length ? <div className="print-open"><b>OPEN — CONFIRM WITH OFFICE</b><p>{missing.map((item) => `• ${item}`).join("   ")}</p></div> : null}
      {row.instructions && row.instructions !== "—" ? (
        <p className="print-note">
          <b>Important instructions:</b> {row.instructions}
        </p>
      ) : null}
    </section>
  );
}

function useSignedPhotos(paths: { path: string; caption: string | null }[]) {
  const [photos, setPhotos] = useState<{ url: string; caption: string | null }[]>([]);
  const key = paths.map((p) => p.path).join("|");
  useEffect(() => {
    let cancelled = false;
    if (!paths.length) {
      setPhotos([]);
      return;
    }
    void supabase.storage
      .from("project-files")
      .createSignedUrls(
        paths.map((p) => p.path),
        3600,
      )
      .then(({ data }) => {
        if (cancelled || !data) return;
        setPhotos(
          data
            .map((row, index) => ({ url: row.signedUrl ?? "", caption: paths[index]?.caption ?? null }))
            .filter((row) => row.url),
        );
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return photos;
}
