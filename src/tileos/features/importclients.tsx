/* Import from a spreadsheet — onto Clients, Designers, Installers or Suppliers, the same way on each: the customer
 * list from QuickBooks (Customers → Export to Excel), the vendor list (Vendors → Export to Excel) for installers and
 * suppliers, or any Excel file (.xlsx or the older .xls) or CSV with a name column. It's read right here in the
 * browser (nothing is sent anywhere), you see what it found, uncheck anyone who doesn't belong, and the rest are added:
 *   · a QuickBooks job ("Customer:Job", or an address where the company name goes) is folded into its client — its
 *     address goes on the client, it isn't a client of its own
 *   · our own emails (anything @cobblestonenj.com — a stand-in when the client had none) are left off
 *   · several emails on a client: the first is the client's, the rest are its contacts; on anyone else, the rest are
 *     their more emails. More phone numbers (a cell, a fax) go with them too
 *   · phone numbers, states, zips and capitals tidied; anyone already in Tile OS (same name or email) is left as is */
import * as React from 'react'
import { Upload, FileSpreadsheet, Check, X, CircleAlert, Building2, User, PenTool, HardHat, Truck } from 'lucide-react'
import { useStore } from '@/tileos/store'
import { Button } from '@/tileos/components/ui/core'
import { Modal } from '@/tileos/components/ui/overlay'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, type Customer, type Member, type PersonKey, type Reach } from '@/tileos/data/model'
import { allSubs, type Designer, type SupplierInfo } from '@/tileos/data/directory'

/** our own email domain — never a client's */
const OURS = /@cobblestonenj\.com$/i

/* ---------------- reading the file ---------------- */
export class ImportError extends Error {}

/** a CSV, cell by cell — quotes, commas and line breaks inside quotes */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = [], cell = '', q = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++ } else q = false }
      else cell += ch
    } else if (ch === '"') q = true
    else if (ch === ',' || ch === '\t') { row.push(cell); cell = '' }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = '' }
    else cell += ch
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  return rows
}

/** the files inside an .xlsx (it's a zip) — read with the browser's own unzip */
async function unzip(buf: ArrayBuffer, want: (name: string) => boolean): Promise<Map<string, string>> {
  const dv = new DataView(buf)
  const u8 = new Uint8Array(buf)
  let end = -1
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { end = i; break }
  if (end < 0) throw new ImportError('That file isn’t an Excel file we can read.')
  const count = dv.getUint16(end + 10, true)
  let p = dv.getUint32(end + 16, true)
  const out = new Map<string, string>()
  const dec = new TextDecoder()
  for (let k = 0; k < count && dv.getUint32(p, true) === 0x02014b50; k++) {
    const method = dv.getUint16(p + 10, true), size = dv.getUint32(p + 20, true)
    const nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), at = dv.getUint32(p + 42, true)
    const name = dec.decode(u8.subarray(p + 46, p + 46 + nl))
    p += 46 + nl + el + cl
    if (!want(name)) continue
    const start = at + 30 + dv.getUint16(at + 26, true) + dv.getUint16(at + 28, true)
    const raw = u8.slice(start, start + size)
    const data = method === 0 ? raw : new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer())
    out.set(name, dec.decode(data))
  }
  return out
}
const colIndex = (ref: string) => { const m = /^([A-Z]+)/.exec(ref); let n = 0; for (const ch of m ? m[1] : 'A') n = n * 26 + ch.charCodeAt(0) - 64; return n - 1 }

/** the first sheet of an .xlsx, as rows of text */
async function readXlsx(buf: ArrayBuffer): Promise<string[][]> {
  const files = await unzip(buf, (n) => /^xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|worksheets\/[^/]+\.xml)$/.test(n))
  const xml = (s?: string) => (s ? new DOMParser().parseFromString(s, 'application/xml') : null)
  const all = (d: Document | Element | null, tag: string) => (d ? Array.from(d.getElementsByTagNameNS('*', tag)) : [])
  const strings = all(xml(files.get('xl/sharedStrings.xml')), 'si').map((si) => all(si, 't').map((t) => t.textContent || '').join(''))
  /* the first sheet, by the workbook's order */
  const wb = xml(files.get('xl/workbook.xml'))
  const rels = xml(files.get('xl/_rels/workbook.xml.rels'))
  const rid = all(wb, 'sheet')[0]?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') || all(wb, 'sheet')[0]?.getAttribute('r:id')
  const target = all(rels, 'Relationship').find((r) => r.getAttribute('Id') === rid)?.getAttribute('Target')
  const path = target ? 'xl/' + target.replace(/^\/?xl\//, '').replace(/^\//, '') : [...files.keys()].find((n) => n.startsWith('xl/worksheets/'))
  const sheet = xml(path ? files.get(path) : undefined)
  if (!sheet) throw new ImportError('That Excel file has no sheet we can read.')
  const rows: string[][] = []
  all(sheet, 'row').forEach((r) => {
    const row: string[] = []
    all(r, 'c').forEach((c) => {
      const t = c.getAttribute('t')
      const v = all(c, 'v')[0]?.textContent ?? ''
      const text = t === 's' ? strings[Number(v)] ?? '' : t === 'inlineStr' ? all(c, 't').map((x) => x.textContent || '').join('') : t === 'b' ? (v === '1' ? 'TRUE' : 'FALSE') : v
      row[colIndex(c.getAttribute('r') || 'A')] = text
    })
    rows.push(Array.from(row, (x) => x ?? ''))
  })
  return rows
}

/* ---- the older Excel file (.xls) — what QuickBooks' "Export to Excel" gives: a compound file with a Workbook stream of
   BIFF8 records. Only what a list needs is read: text (the shared strings), numbers, and the first sheet. ---- */
const XLS_OLD = 'This Excel file is too old to read here. Open it in Excel and save it as .xlsx (File → Save As → Excel Workbook), then drop that here.'
/** the Workbook stream out of the compound file */
function workbookStream(buf: ArrayBuffer): Uint8Array {
  const dv = new DataView(buf)
  const u8 = new Uint8Array(buf)
  const ssz = 1 << dv.getUint16(0x1e, true), msz = 1 << dv.getUint16(0x20, true)
  const at = (sec: number) => 512 + sec * ssz
  /* the FAT: its sectors are listed in the header (109 of them) and then in the DIFAT chain */
  const fatSecs: number[] = []
  for (let i = 0; i < 109; i++) { const v = dv.getUint32(0x4c + i * 4, true); if (v < 0xfffffffa) fatSecs.push(v) }
  for (let d = dv.getUint32(0x44, true), n = dv.getUint32(0x48, true); n > 0 && d < 0xfffffffa; n--) {
    for (let i = 0; i < ssz / 4 - 1; i++) { const v = dv.getUint32(at(d) + i * 4, true); if (v < 0xfffffffa) fatSecs.push(v) }
    d = dv.getUint32(at(d) + ssz - 4, true)
  }
  const fat: number[] = []
  fatSecs.forEach((sec) => { for (let i = 0; i < ssz / 4; i++) fat.push(dv.getUint32(at(sec) + i * 4, true)) })
  const chain = (start: number, next: number[]) => { const out: number[] = []; for (let x = start, guard = 0; x < 0xfffffffa && guard < 1e6; x = next[x], guard++) out.push(x); return out }
  const stream = (start: number, size: number) => { const out = new Uint8Array(size); let o = 0; for (const sec of chain(start, fat)) { const take = Math.min(ssz, size - o); if (take <= 0) break; out.set(u8.subarray(at(sec), at(sec) + take), o); o += take } return out }
  /* the directory: the root (it holds the mini stream) and the Workbook */
  let root: { start: number; size: number } | null = null, wb: { start: number; size: number } | null = null
  for (const sec of chain(dv.getUint32(0x30, true), fat)) for (let e = 0; e < ssz / 128; e++) {
    const o = at(sec) + e * 128
    const nl = dv.getUint16(o + 0x40, true), type = u8[o + 0x42]
    if (!nl) continue
    let name = ''; for (let i = 0; i < nl / 2 - 1; i++) name += String.fromCharCode(dv.getUint16(o + i * 2, true))
    const ent = { start: dv.getUint32(o + 0x74, true), size: dv.getUint32(o + 0x78, true) }
    if (type === 5) root = ent
    else if (type === 2 && name.toLowerCase() === 'workbook') wb = ent
    else if (type === 2 && name.toLowerCase() === 'book' && !wb) throw new ImportError(XLS_OLD)
  }
  if (!wb) throw new ImportError('That Excel file has no sheet we can read.')
  if (wb.size >= dv.getUint32(0x38, true) || !root) return stream(wb.start, wb.size)
  /* a small stream lives in the mini stream */
  const mini = stream(root.start, root.size)
  const mfat: number[] = []
  for (const sec of chain(dv.getUint32(0x3c, true), fat)) for (let i = 0; i < ssz / 4; i++) mfat.push(dv.getUint32(at(sec) + i * 4, true))
  const out = new Uint8Array(wb.size); let o = 0
  for (const sec of chain(wb.start, mfat)) { const take = Math.min(msz, wb.size - o); if (take <= 0) break; out.set(mini.subarray(sec * msz, sec * msz + take), o); o += take }
  return out
}
/** reads across a record and its CONTINUE records — a string's characters can carry on in the next one, which then
 *  starts with its own flags byte (8-bit or 16-bit characters) */
class Runs {
  ci = 0
  pos = 0
  chunks: Uint8Array[]
  constructor(chunks: Uint8Array[]) { this.chunks = chunks }
  private ensure() { while (this.ci < this.chunks.length && this.pos >= this.chunks[this.ci].length) { this.ci++; this.pos = 0 } }
  u8() { this.ensure(); return this.chunks[this.ci]?.[this.pos++] ?? 0 }
  u16() { return this.u8() | (this.u8() << 8) }
  u32() { return (this.u16() | (this.u16() << 16)) >>> 0 }
  skip(n: number) { while (n > 0 && this.ci < this.chunks.length) { this.ensure(); const c = this.chunks[this.ci]; if (!c) break; const t = Math.min(n, c.length - this.pos); this.pos += t; n -= t } }
  chars(cch: number, high: boolean) {
    let out = ''
    while (cch > 0 && this.ci < this.chunks.length) {
      if (this.pos >= this.chunks[this.ci].length) { this.ci++; this.pos = 0; if (this.ci >= this.chunks.length) break; high = (this.chunks[this.ci][this.pos++] & 1) === 1 }
      const c = this.chunks[this.ci]
      const n = Math.min(cch, high ? Math.floor((c.length - this.pos) / 2) : c.length - this.pos)
      for (let i = 0; i < n; i++) { if (high) { out += String.fromCharCode(c[this.pos] | (c[this.pos + 1] << 8)); this.pos += 2 } else out += String.fromCharCode(c[this.pos++]) }
      cch -= n
      if (n === 0) this.pos = c.length
    }
    return out
  }
}
const ustr = (r: Runs) => { const cch = r.u16(), f = r.u8(), runs = f & 8 ? r.u16() : 0, ext = f & 4 ? r.u32() : 0; const t = r.chars(cch, (f & 1) === 1); r.skip(runs * 4 + ext); return t }
const rkNum = (rk: number) => { let v: number; if (rk & 2) v = rk >> 2; else { const b = new DataView(new ArrayBuffer(8)); b.setUint32(4, (rk & 0xfffffffc) >>> 0, true); v = b.getFloat64(0, true) } return rk & 1 ? v / 100 : v }
const numText = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 1e9) / 1e9))
function readXls(buf: ArrayBuffer): string[][] {
  const w = workbookStream(buf)
  const dv = new DataView(w.buffer, w.byteOffset, w.byteLength)
  const recs: { t: number; d: Uint8Array }[] = []
  for (let p = 0; p + 4 <= w.length;) { const t = dv.getUint16(p, true), n = dv.getUint16(p + 2, true); recs.push({ t, d: w.subarray(p + 4, p + 4 + n) }); p += 4 + n }
  if (recs[0]?.t !== 0x0809) throw new ImportError(XLS_OLD)
  let sst: string[] = []
  const rows: string[][] = []
  const put = (r: number, c: number, v: string) => { (rows[r] ||= [])[c] = v }
  let part = 0
  let pending: [number, number] | null = null
  for (let i = 0; i < recs.length; i++) {
    const { t, d } = recs[i]
    const v = new DataView(d.buffer, d.byteOffset, d.byteLength)
    if (t === 0x0809) { part++; if (part > 2) break; continue }
    if (t === 0x00fc) {
      const chunks = [d.subarray(8)]
      while (recs[i + 1]?.t === 0x003c) chunks.push(recs[++i].d)
      const r = new Runs(chunks)
      const count = v.getUint32(4, true)
      sst = []
      for (let k = 0; k < count; k++) sst.push(ustr(r))
      continue
    }
    if (part !== 2) continue
    if (t === 0x00fd) put(v.getUint16(0, true), v.getUint16(2, true), sst[v.getUint32(6, true)] ?? '')
    else if (t === 0x0203) put(v.getUint16(0, true), v.getUint16(2, true), numText(v.getFloat64(6, true)))
    else if (t === 0x027e) put(v.getUint16(0, true), v.getUint16(2, true), numText(rkNum(v.getUint32(6, true))))
    else if (t === 0x00bd) { const row = v.getUint16(0, true), first = v.getUint16(2, true), n = (d.length - 6) / 6; for (let k = 0; k < n; k++) put(row, first + k, numText(rkNum(v.getUint32(4 + k * 6 + 2, true)))) }
    else if (t === 0x0204) put(v.getUint16(0, true), v.getUint16(2, true), ustr(new Runs([d.subarray(6)])))
    else if (t === 0x0006) { const row = v.getUint16(0, true), col = v.getUint16(2, true); if (v.getUint16(12, true) !== 0xffff) put(row, col, numText(v.getFloat64(6, true))); else if (d[6] === 0) pending = [row, col] }
    else if (t === 0x0207 && pending) { put(pending[0], pending[1], ustr(new Runs([d]))); pending = null }
    else if (t === 0x0005 && d[7] === 0) put(v.getUint16(0, true), v.getUint16(2, true), d[6] ? 'TRUE' : 'FALSE')
  }
  return Array.from(rows, (r) => Array.from(r || [], (x) => x ?? ''))
}
/** some programs' ".xls" is really a web page table, or the Excel 2003 XML list */
function readMarkup(text: string): string[][] {
  if (/urn:schemas-microsoft-com:office:spreadsheet/.test(text)) {
    const doc = new DOMParser().parseFromString(text, 'application/xml')
    const ws = doc.getElementsByTagNameNS('*', 'Worksheet')[0]
    return Array.from(ws?.getElementsByTagNameNS('*', 'Row') || []).map((r) => {
      const out: string[] = []
      let c = 0
      Array.from(r.getElementsByTagNameNS('*', 'Cell')).forEach((cell) => { const ix = cell.getAttributeNS('urn:schemas-microsoft-com:office:spreadsheet', 'Index') || cell.getAttribute('ss:Index'); if (ix) c = Number(ix) - 1; out[c++] = cell.getElementsByTagNameNS('*', 'Data')[0]?.textContent || '' })
      return Array.from(out, (x) => x ?? '')
    })
  }
  const table = new DOMParser().parseFromString(text, 'text/html').querySelector('table')
  if (!table) throw new ImportError('We couldn’t read that file — try saving it again as .xlsx or CSV.')
  return Array.from(table.querySelectorAll('tr')).map((tr) => Array.from(tr.querySelectorAll('th,td')).map((td) => (td.textContent || '').trim()))
}

/** a spreadsheet file as rows of text — Excel (.xlsx or the older .xls) or CSV — known by what's inside, not its name */
export async function readSheet(file: File): Promise<string[][]> {
  const name = file.name.toLowerCase()
  if (/\.(csv|txt|tsv)$/.test(name)) return parseCSV((await file.text()).replace(/^﻿/, ''))
  const buf = await file.arrayBuffer()
  const head = new Uint8Array(buf.slice(0, 4))
  if (head[0] === 0x50 && head[1] === 0x4b) return readXlsx(buf)
  if (head[0] === 0xd0 && head[1] === 0xcf && head[2] === 0x11 && head[3] === 0xe0) return readXls(buf)
  if (/\.(xls|xml|htm|html)$/.test(name)) return readMarkup(new TextDecoder().decode(buf))
  throw new ImportError('Pick an Excel file (.xlsx or .xls) or a CSV.')
}

/* ---------------- turning rows into clients ---------------- */
export type ImportRow = {
  key: string; name: string; kind: string; street: string; city: string; state: string; zip: string; phone: string; email: string
  more: string[]; jobs: string[]; company?: string; notes: string
  /** more phone numbers — a cell, a fax — besides the main one */
  phones: { label: string; value: string }[]
  /** already in Tile OS — left as it is */
  here?: string
}
export type ImportPlan = { rows: ImportRow[]; read: number; jobs: number; ours: number }

const HEAD: Record<string, string[]> = {
  name: ['name', 'customer', 'customer name', 'display name', 'client', 'client name', 'full name', 'vendor', 'vendor name', 'supplier', 'supplier name', 'designer', 'installer', 'contractor'],
  company: ['company', 'company name', 'business name'],
  street: ['street address', 'street', 'address', 'billing address', 'billing street', 'address 1', 'address line 1'],
  street2: ['address 2', 'address line 2', 'suite'],
  city: ['city', 'billing city', 'town'],
  state: ['state', 'billing state', 'province', 'state/province'],
  zip: ['zip', 'zip code', 'postal code', 'postal', 'billing zip'],
  phone: ['phone', 'phone number', 'phone numbers', 'main phone', 'work phone', 'telephone'],
  mobile: ['mobile', 'mobile phone', 'cell', 'cell phone'],
  alt: ['alt. phone', 'alt phone', 'alternate phone', 'other phone', 'phone 2', 'home phone'],
  fax: ['fax', 'fax number'],
  email: ['email', 'e-mail', 'main email', 'email address'],
  notes: ['notes', 'note', 'memo'],
}
const ROLE_WORD: Record<string, string> = { office: 'Office', billing: 'Billing', info: 'Info', pm: 'Project manager', accounting: 'Accounting', admin: 'Office', contact: 'Contact', sales: 'Sales', estimating: 'Estimating', ap: 'Billing' }
const BUSINESS = /\b(builders?|construction|constroction|contracting|contractors?|developers?|development|developing|group|llc|inc|corp|co|company|management|realty|holdings|bakery|shul|mikvah|express|properties|homes|remodel|renovation|design|services|partners|enterprises)\b/i
const cleanText = (s: string) => (s || '').replace(/[‎‏‪-‮ ]/g, ' ').replace(/\s+/g, ' ').trim()
const titleCase = (s: string) => (s && (s === s.toUpperCase() || s === s.toLowerCase()) ? s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()) : s)
const looksLikeAddress = (s: string) => /^\d+[\w-]*\s+\S/.test(s)
export function tidyPhone(raw: string): string {
  const s = cleanText(raw)
  if (!s) return ''
  const digits = s.replace(/\D/g, '')
  const d = digits.length >= 11 && digits[0] === '1' ? digits.slice(1) : digits
  if (d.length < 10) return s
  const main = `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 10)}`
  const ext = d.slice(10)
  return ext ? `${main} ext ${ext}` : main
}
const STATE: Record<string, string> = { 'new jersey': 'NJ', 'new york': 'NY', pennsylvania: 'PA', connecticut: 'CT', florida: 'FL' }
const tidyState = (raw: string) => { const s = cleanText(raw).replace(/\./g, ''); return STATE[s.toLowerCase()] || (s.length === 2 ? s.toUpperCase() : s) }
const tidyZip = (raw: string) => { const d = cleanText(raw).replace(/\D/g, ''); return d.length === 9 ? `${d.slice(0, 5)}-${d.slice(5)}` : d.length === 4 ? '0' + d : d.length === 5 ? d : cleanText(raw) }
const tidyStreet = (raw: string) => (raw || '').split(/\r?\n/).map(cleanText).filter(Boolean).join(', ').replace(/,\s*$/, '')
const tidyCity = (raw: string) => titleCase(cleanText(raw).replace(/^\d+(?=[A-Za-z])/, ''))
const nameKey = (s: string) => s.toLowerCase().replace(/\b(llc|inc|corp|co|the)\b/g, '').replace(/[^a-z0-9]/g, '')
/** one cell can hold several numbers with their names — "Phone: (732) 555-0101 Mobile: (732) 555-0199" */
const PHONE_WORD: Record<string, string> = { phone: 'Office', work: 'Office', office: 'Office', main: 'Office', mobile: 'Cell', cell: 'Cell', fax: 'Fax', home: 'Home', other: 'Other', alt: 'Other' }
function phonesIn(raw: string): { label: string; value: string }[] {
  const s = cleanText(raw)
  if (!s) return []
  const parts = s.split(/\b(phone|work|office|main|mobile|cell|fax|home|other|alt)\.?\s*:\s*/i)
  if (parts.length < 3) return [{ label: '', value: s }]
  const out: { label: string; value: string }[] = []
  for (let i = 1; i < parts.length; i += 2) { const v = (parts[i + 1] || '').replace(/[,;]\s*$/, '').trim(); if (v) out.push({ label: PHONE_WORD[parts[i].toLowerCase()] || 'Other', value: v }) }
  return out
}
const emailsOf = (raw: string) => (raw || '').split(/[,;\s]+/).map((e) => e.trim()).filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e))

/** the rows of a spreadsheet → the clients to add (and what was tidied on the way) */
/** who's already there — by name, or by any of their emails */
export type Known = { name: string; emails: (string | undefined)[] }
export function planImport(rows: string[][], existing: Known[], o: { jobs?: boolean } = {}): ImportPlan {
  const withJobs = o.jobs !== false
  const at = rows.findIndex((r) => r.some((c) => cleanText(c)))
  if (at < 0) throw new ImportError('That file is empty.')
  const head = rows[at].map((h) => cleanText(h).toLowerCase())
  const col = (k: string) => { const names = HEAD[k]; const i = head.findIndex((h) => names.includes(h)); return i >= 0 ? i : head.findIndex((h) => names.some((n) => h.startsWith(n))) }
  const c = Object.fromEntries(Object.keys(HEAD).map((k) => [k, col(k)])) as Record<keyof typeof HEAD, number>
  if (c.name < 0 && c.company < 0) throw new ImportError('We couldn’t find a Name column. The first row should have the column names — Name, Email, Phone…')
  const get = (r: string[], k: keyof typeof HEAD) => (c[k] >= 0 ? r[c[k]] ?? '' : '')
  const byKey = new Map<string, ImportRow>()
  let read = 0, jobs = 0, ours = 0
  for (const r of rows.slice(at + 1)) {
    const full = cleanText(get(r, 'name')) || cleanText(get(r, 'company'))
    if (!full) continue
    read++
    /* a QuickBooks job — "Customer:Job" — belongs to its customer */
    const [parentRaw, jobRaw] = withJobs && full.includes(':') ? [full.slice(0, full.indexOf(':')), full.slice(full.indexOf(':') + 1)] : [full, '']
    const name = cleanText(parentRaw)
    const key = nameKey(name) || name.toLowerCase()
    let row = byKey.get(key)
    if (!row) { row = { key, name, kind: '', street: '', city: '', state: '', zip: '', phone: '', email: '', more: [], jobs: [], notes: '', phones: [] }; byKey.set(key, row) }
    const company = cleanText(get(r, 'company'))
    const job = cleanText(jobRaw) || (withJobs && company && company.toLowerCase() !== name.toLowerCase() && looksLikeAddress(company) ? company : '')
    if (job) { jobs++; if (!row.jobs.some((j) => j.toLowerCase() === job.toLowerCase())) row.jobs.push(job) }
    else if (company && nameKey(company) !== key && !row.company) row.company = company
    /* the client's own address — not a job's */
    if (!jobRaw && !row.street) {
      row.street = tidyStreet(get(r, 'street') + (get(r, 'street2') ? '\n' + get(r, 'street2') : ''))
      row.city = tidyCity(get(r, 'city'))
      row.state = tidyState(get(r, 'state'))
      row.zip = tidyZip(get(r, 'zip'))
    }
    /* the main phone, then any other numbers (a cell, a fax) — each kept once */
    const nums: { label: string; value: string }[] = []
    ;([['phone', 'Office'], ['mobile', 'Cell'], ['alt', 'Other'], ['fax', 'Fax']] as const).forEach(([k, label]) => phonesIn(get(r, k)).forEach((p) => { const v = tidyPhone(p.value); if (v) nums.push({ label: p.label || label, value: v }) }))
    nums.forEach((p) => {
      if ([row!.phone, ...row!.phones.map((x) => x.value)].includes(p.value)) return
      if (!row!.phone && p.label !== 'Fax') row!.phone = p.value
      else row!.phones.push(p)
    })
    const mails = emailsOf(get(r, 'email'))
    mails.forEach((m) => {
      if (OURS.test(m)) { ours++; return }
      const have = [row!.email, ...row!.more].map((x) => x.toLowerCase())
      if (have.includes(m.toLowerCase())) return
      if (!row!.email) row!.email = m
      else row!.more.push(m)
    })
    const note = cleanText(get(r, 'notes'))
    if (note && !row.notes.includes(note)) row.notes = row.notes ? `${row.notes} · ${note}` : note
  }
  const ex = existing.map((x) => ({ x, key: nameKey(x.name), mails: x.emails.filter((m): m is string => !!m).map((m) => m.toLowerCase()) }))
  const list = [...byKey.values()].map((row) => {
    row.kind = BUSINESS.test(`${row.name} ${row.company || ''}`) || !/^[A-Z][a-z]+(?: [A-Z][a-z]+){1,2}$/.test(row.name) ? 'General contractor' : 'Homeowner'
    const hit = ex.find((e) => (e.key && e.key === row.key) || (row.email && e.mails.includes(row.email.toLowerCase())))
    if (hit) row.here = hit.x.name
    return row
  })
  return { rows: list.sort((a, b) => a.name.localeCompare(b.name)), read, jobs, ours }
}

/** one row → a client, the same shape the New client form makes */
function clientOf(row: ImportRow, id: string): Customer {
  const contact = (m: string) => { const local = m.split('@')[0].toLowerCase(); const role = ROLE_WORD[local.replace(/\d+$/, '')]; return { name: !role && /^[a-z]+$/.test(local) ? local.charAt(0).toUpperCase() + local.slice(1) : '', role: role || 'Contact', phone: '', email: m } }
  const notes = [row.company ? `Company name: ${row.company}` : '', row.jobs.length ? `Jobs in QuickBooks: ${row.jobs.join(' · ')}` : '', row.notes].filter(Boolean).join('\n')
  return {
    id, name: row.name, kind: row.kind,
    address: [row.street, row.city, [row.state, row.zip].filter(Boolean).join(' ')].filter(Boolean).join(', '),
    phone: row.phone, email: row.email, notes,
    city: row.city || undefined, zip: row.zip || undefined, country: 'US',
    more: row.phones.length ? row.phones.map((p) => ({ kind: 'phone' as const, value: p.value, label: p.label })) : undefined,
    contacts: [{ name: '', role: 'Main contact', phone: row.phone, email: row.email }, ...row.more.map(contact)],
  }
}

/** a firm with a person: the firm's name, and who to talk to there */
const firmOf = (row: ImportRow) => (row.company && !looksLikeAddress(row.company) ? { firm: row.company, person: row.name } : { firm: row.name, person: '' })
/** more phones and emails, with what each is for */
const extrasOf = (row: ImportRow): Reach[] | undefined => {
  const out: Reach[] = [...row.phones.map((p) => ({ kind: 'phone' as const, value: p.value, label: p.label })), ...row.more.map((m) => ({ kind: 'email' as const, value: m, label: 'Other' }))]
  return out.length ? out : undefined
}
const placeOf = (row: ImportRow) => [row.street, row.city, [row.state, row.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')
function designerOf(row: ImportRow, id: string): Designer {
  const { firm, person } = firmOf(row)
  return { id, name: firm, contact: person, phone: row.phone, email: row.email, more: extrasOf(row), clients: [], notes: [placeOf(row), row.notes].filter(Boolean).join(' · ') }
}
function supplierOf(row: ImportRow): SupplierInfo {
  const { firm, person } = firmOf(row)
  return { name: firm, supplies: '', contact: person || undefined, phone: row.phone || undefined, email: row.email || undefined, more: extrasOf(row), note: [placeOf(row), row.notes].filter(Boolean).join(' · ') || undefined }
}
function installerOf(row: ImportRow, key: PersonKey): Member {
  const [first, ...rest] = row.name.split(/\s+/)
  return { key, first, last: rest.join(' ') || undefined, phone: row.phone || undefined, email: row.email || undefined, more: extrasOf(row), role: 'crew', status: 'active', trade: 'Tile installation' }
}

/* ---------------- the window ---------------- */
export type ImportKind = 'client' | 'designer' | 'installer' | 'supplier'
const WORDS: Record<ImportKind, { one: string; many: string; page: string; sub: string; drop: string; how: string; tips: string[] }> = {
  client: { one: 'client', many: 'clients', page: 'Clients', sub: 'Your customer list from QuickBooks — or any spreadsheet', drop: 'Drop the customer list here', how: 'From QuickBooks: Customers → Export to Excel, then drop that file here as it is.', tips: ['A QuickBooks job (“Customer:Job”) goes on its client — it isn’t a client of its own.', 'Our own emails (@cobblestonenj.com) are left off. A client with several emails gets the rest as contacts.', 'Anyone already on Clients stays as it is.'] },
  designer: { one: 'designer', many: 'designers', page: 'Designers', sub: 'Your designers from any spreadsheet', drop: 'Drop the designer list here', how: 'Excel or CSV — the firm (or the designer’s name), email and phone. Any more emails and phones go with them.', tips: ['Uncheck anyone who isn’t a designer before you add them.', 'Our own emails (@cobblestonenj.com) are left off.', 'Anyone already on Designers stays as it is.'] },
  installer: { one: 'installer', many: 'installers', page: 'Installers', sub: 'Your installers from QuickBooks — or any spreadsheet', drop: 'Drop the list here', how: 'From QuickBooks: Vendors → Export to Excel. Then uncheck anyone who isn’t an installer (the suppliers on that list).', tips: ['Each one shows on the schedule, in Installer pay, and when you pick who installs a job.', 'Our own emails (@cobblestonenj.com) are left off.', 'Anyone already on Installers stays as it is.'] },
  supplier: { one: 'supplier', many: 'suppliers', page: 'Suppliers', sub: 'Your vendor list from QuickBooks — or any spreadsheet', drop: 'Drop the vendor list here', how: 'From QuickBooks: Vendors → Export to Excel. Then uncheck anyone who isn’t a supplier (the installers on that list).', tips: ['The name shows on every PO — what you buy from each one can be added after.', 'Our own emails (@cobblestonenj.com) are left off.', 'Anyone already on Suppliers stays as it is.'] },
}
const PAGE_OF: Record<ImportKind, string> = { client: 'clients', designer: 'designers', installer: 'subs', supplier: 'suppliers' }
const ICON_OF: Record<Exclude<ImportKind, 'client'>, React.ElementType> = { designer: PenTool, installer: HardHat, supplier: Truck }

/** everyone already on the list — a new row with the same name or email is left as it is */
function knownFor(s: ReturnType<typeof useStore.getState>, kind: ImportKind): Known[] {
  if (kind === 'client') return Object.values(s.clients).map((c) => ({ name: c.name, emails: [c.email, ...(c.contacts || []).map((k) => k.email), ...(c.more || []).map((r) => r.value)] }))
  if (kind === 'designer') return s.designers.map((d) => ({ name: d.name, emails: [d.email, ...(d.more || []).map((r) => r.value)] }))
  if (kind === 'supplier') return s.suppliers.map((x) => ({ name: x.name, emails: [x.email, ...(x.more || []).map((r) => r.value)] }))
  return allSubs().map((x) => { const m = s.team.find((t) => t.key === x.crew); return { name: PEOPLE[x.crew as PersonKey]?.name || x.crew, emails: [m?.email, ...(m?.more || []).map((r) => r.value)] } })
}

/** Clients → Import (the name the app has always opened it by) */
export function ImportClientsModal({ level }: { level: number }) { return <ImportModal kind="client" level={level} /> }
export function ImportModal({ kind, level }: { kind: ImportKind; level: number }) {
  const s = useStore()
  const w = WORDS[kind]
  const input = React.useRef<HTMLInputElement>(null)
  const [over, setOver] = React.useState(false)
  const [err, setErr] = React.useState('')
  const [file, setFile] = React.useState('')
  const [plan, setPlan] = React.useState<ImportPlan | null>(null)
  const [off, setOff] = React.useState<Set<string>>(new Set())
  const read = async (f?: File) => {
    if (!f) return
    setErr('')
    try {
      const rows = await readSheet(f)
      const p = planImport(rows, knownFor(useStore.getState(), kind), { jobs: kind === 'client' })
      setPlan(p); setFile(f.name)
      setOff(new Set(p.rows.filter((r) => r.here).map((r) => r.key)))
    } catch (e: any) {
      setPlan(null)
      setErr(e instanceof ImportError ? e.message : 'We couldn’t read that file — try saving it again as .xlsx or CSV.')
    }
  }
  const picked = plan ? plan.rows.filter((r) => !off.has(r.key)) : []
  const go = () => {
    if (!picked.length) return
    const stamp = Date.now().toString(36)
    const n = `${picked.length} ${picked.length === 1 ? w.one : w.many}`
    s.commit((st) => {
      picked.forEach((r, i) => {
        const id = `${kind[0]}${stamp}${i.toString(36)}`
        if (kind === 'client') st.clients[id] = clientOf(r, id) as any
        else if (kind === 'designer') st.designers.push(designerOf(r, id))
        else if (kind === 'supplier') { const x = supplierOf(r); if (!st.suppliers.some((y) => y.name.toLowerCase() === x.name.toLowerCase())) st.suppliers.push(x) }
        else st.team.push(installerOf(r, id as PersonKey))
      })
      st.notices.unshift({ id: 'ni' + stamp, text: `${n} imported from ${file}`, when: 'Just now', kind: 'pricing', unread: false })
    }, `${n} added`, { close: true, undo: true, sub: `They’re on ${w.page} now — open one to add or fix anything.` })
    /* show them (Clients: all of them — the usual view is the ones with open projects) */
    s.go(kind === 'client' ? { page: 'clients', tab: 'all' } : { page: PAGE_OF[kind] as any })
  }
  const all = (on: boolean) => setOff(on ? new Set(plan ? plan.rows.filter((r) => r.here).map((r) => r.key) : []) : new Set(plan ? plan.rows.map((r) => r.key) : []))
  const flip = (k: string) => setOff((o) => { const n = new Set(o); if (n.has(k)) n.delete(k); else n.add(k); return n })
  const here = plan ? plan.rows.filter((r) => r.here).length : 0
  return (
    <Modal level={level} size="lg" onClose={s.close} title={`Import ${w.many}`} sub={plan ? `From ${file}` : w.sub}
      footer={plan ? <><Button variant="ghost" onClick={() => { setPlan(null); setFile('') }}>Pick another file</Button><span className="ml-auto" /><Button variant="primary" icon={<Check />} disabled={!picked.length} onClick={go} data-import-go>Add {picked.length} {picked.length === 1 ? w.one : w.many}</Button></> : undefined}>
      {!plan ? (
        <div>
          <div
            onDragOver={(e) => { e.preventDefault(); setOver(true) }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); void read(e.dataTransfer.files?.[0]) }}
            className={cn('flex flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition', over ? 'border-brand-400 bg-brand-50/60' : 'border-[#d8d2c8] bg-[#faf8f5]')}
          >
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white text-brand-600 shadow-xs"><FileSpreadsheet className="h-6 w-6" /></span>
            <div className="text-[0.96875rem] font-semibold text-ink">{w.drop}</div>
            <div className="max-w-[28rem] text-[0.84375rem] leading-snug text-muted">Excel or CSV, with the column names in the first row — Name, Email, Phone, Address… {w.how}</div>
            <Button variant="primary" icon={<Upload />} onClick={() => input.current?.click()}>Pick the file</Button>
            <input ref={input} type="file" accept=".xlsx,.csv,.xls,.txt,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; void read(f) }} data-import-file />
          </div>
          {err && <div className="mt-3 flex items-start gap-2 text-[0.84375rem] font-medium text-warn-800" data-import-error><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />{err}</div>}
          <ul className="mt-4 flex flex-col gap-1 text-[0.8125rem] text-muted">
            {w.tips.map((t) => <li key={t}>· {t}</li>)}
          </ul>
        </div>
      ) : (
        <div className="flex min-h-0 flex-col" data-import-plan>
          <div className="flex flex-wrap gap-1.5 text-[0.78125rem]" data-import-summary>
            <span className="rounded-full bg-brand-50 px-2.5 py-1 font-semibold text-brand-700">{picked.length} to add</span>
            <span className="rounded-full bg-wash-2 px-2.5 py-1 font-medium text-ink-2">{plan.read} rows read</span>
            {plan.jobs > 0 && <span className="rounded-full bg-wash-2 px-2.5 py-1 font-medium text-ink-2" data-import-jobs>{plan.jobs} QuickBooks {plan.jobs === 1 ? 'job' : 'jobs'} put on their client</span>}
            {plan.ours > 0 && <span className="rounded-full bg-wash-2 px-2.5 py-1 font-medium text-ink-2" data-import-ours>{plan.ours} of our own {plan.ours === 1 ? 'email' : 'emails'} left off</span>}
            {here > 0 && <span className="rounded-full bg-wash-2 px-2.5 py-1 font-medium text-ink-2" data-import-here>{here} already on {w.page}</span>}
            <span className="ml-auto flex items-center gap-3">
              <button type="button" onClick={() => all(true)} className="font-semibold text-brand-700 hover:underline" data-import-all>Check all</button>
              <button type="button" onClick={() => all(false)} className="font-semibold text-brand-700 hover:underline" data-import-none>Uncheck all</button>
            </span>
          </div>
          <div className="mt-3 max-h-[min(30rem,56vh)] overflow-y-auto rounded-xl border border-line">
            {plan.rows.map((r) => {
              const on = !off.has(r.key)
              const place = [r.city, r.state].filter(Boolean).join(', ')
              return (
                <label key={r.key} data-import-row={r.name} data-on={on || undefined} className={cn('flex cursor-pointer items-start gap-3 border-b border-line-2 px-3.5 py-2.5 last:border-b-0 row-hover', !on && 'opacity-55')}>
                  <input type="checkbox" checked={on} onChange={() => flip(r.key)} className="mt-1 h-4 w-4 shrink-0 accent-[#2650cf]" aria-label={`Add ${r.name}`} />
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-wash-2 text-ink-2">{kind === 'client' ? (r.kind === 'Homeowner' ? <User className="h-4 w-4" /> : <Building2 className="h-4 w-4" />) : React.createElement(ICON_OF[kind], { className: 'h-4 w-4' })}</span>
                  <span className="min-w-0 flex-1 leading-snug">
                    <span className="block truncate text-[0.875rem] font-semibold text-ink">{kind === 'client' ? r.name : firmOf(r).firm}{kind !== 'client' && firmOf(r).person ? <span className="font-medium text-muted"> · {firmOf(r).person}</span> : null}{r.here ? <span className="ml-2 text-[0.75rem] font-medium text-muted">already on {w.page}</span> : null}</span>
                    <span className="block truncate text-[0.78125rem] text-muted">{[r.email, r.phone, place].filter(Boolean).join(' · ') || 'No email or phone'}</span>
                    {(r.more.length > 0 || r.phones.length > 0 || r.jobs.length > 0) && <span className="block truncate text-[0.75rem] text-faint">{[r.more.length ? `+${r.more.length} more ${r.more.length === 1 ? 'email' : 'emails'}${kind === 'client' ? ' — as contacts' : ''}` : '', r.phones.length ? `+${r.phones.length} more ${r.phones.length === 1 ? 'phone' : 'phones'}` : '', r.jobs.length ? `${r.jobs.length === 1 ? 'Job' : 'Jobs'}: ${r.jobs.join(' · ')}` : ''].filter(Boolean).join(' · ')}</span>}
                  </span>
                  {!on && <X className="mt-1 h-4 w-4 shrink-0 text-faint" />}
                </label>
              )
            })}
          </div>
        </div>
      )}
    </Modal>
  )
}
