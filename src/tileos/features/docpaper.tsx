/* What every printed paper shares — Cobblestone's own layout (the scope of work, the room sheets, the estimate):
 * the logo on the left, what the paper is on the right (SCOPE OF WORK), the address under it in bold, a thin gray
 * rule; at the bottom of every page the project on the left and the page number on the right. Dark green, Helvetica. */
import * as React from 'react'
import markSvg from '@/tileos/assets/mark.svg?raw'
import wordSvg from '@/tileos/assets/wordmark.svg?raw'

export const DOC_GREEN = '#2c4a3e'
export const DOC_GRAY = '#f0f1ef'
export const DOC_FONT = 'font-[Helvetica,Arial,sans-serif]'

/* the logo is drawn right in the page (not a picture to load), so it's always on the paper, even printed at once */
const fit = (svg: string) => svg.replace('<svg ', '<svg width="100%" height="100%" preserveAspectRatio="xMinYMid meet" ')
const MARK = fit(markSvg)
const WORD = fit(wordSvg)
/** the stone and COBBLESTONE · TILE INSTALLATION, side by side */
export function DocLogo({ height = 40 }: { height?: number }) {
  return (
    <span className="inline-flex shrink-0 items-center" style={{ gap: Math.round(height * 0.28) }} data-doc-logo aria-label="Cobblestone Tile Installation">
      <span className="block" style={{ height, width: Math.round(height * 0.95) }} dangerouslySetInnerHTML={{ __html: MARK }} />
      <span className="block" style={{ height: Math.round(height * 0.72), width: Math.round(height * 0.72 * 5.9) }} dangerouslySetInnerHTML={{ __html: WORD }} />
    </span>
  )
}

/** the top of a page: the logo, what it is, the address, a gray rule */
export function DocHead({ kind, line, sub }: { kind: string; line: string; sub?: React.ReactNode }) {
  return (
    <header data-doc-head>
      <div className="flex items-center justify-between gap-4">
        <DocLogo />
        <div className="text-right text-[0.78125rem] font-bold uppercase tracking-[0.04em]" style={{ color: DOC_GREEN }}>{kind}</div>
      </div>
      <div className="mt-4 text-[1.0625rem] font-bold leading-snug text-[#222]">{line}</div>
      {sub && <div className="mt-0.5 text-[0.75rem] text-[#555]">{sub}</div>}
      <div className="mt-3 h-[0.09375rem] bg-[#cfcfcf]" />
    </header>
  )
}

/** "1248 Wilkinson Drive | Lot 1" — the address first, as on the paperwork; the project's name when there's no address */
export const docLine = (j: { name: string; address?: string }) => (j.address && j.address.trim() && j.address.trim() !== j.name.trim() ? `${j.address.trim()}` : j.name)

const cssStr = (v: string) => `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ')}"`
/** the bottom of every printed page: the project on the left, the page number on the right (the printer adds them
 *  to each page); on the screen, a line under the page */
export function DocFoot({ left, page }: { left: string; page?: number | string }) {
  return (
    <>
      <style>{`@page { @bottom-left { content: ${cssStr(left)}; font: 8pt Helvetica, Arial, sans-serif; color: #777; } @bottom-right { content: counter(page); font: 8pt Helvetica, Arial, sans-serif; color: #777; } }`}</style>
      <div className="mt-10 flex justify-between text-[0.625rem] text-[#777] print:hidden" data-doc-foot><span>{left}</span><span>{page ?? ''}</span></div>
    </>
  )
}
