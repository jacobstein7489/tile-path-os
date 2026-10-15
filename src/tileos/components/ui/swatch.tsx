import * as React from 'react'
import type { SwatchKey, BuildingKind } from '@/tileos/data/model'
import { cn } from '@/tileos/lib/utils'

/* Tile swatches — each job is identified by its signature tile. Pricing jobs show a blueprint. */
const rnd = (seed: number) => {
  let x = seed
  return () => {
    x = (x * 9301 + 49297) % 233280
    return x / 233280
  }
}

function SwatchArt({ kind, id }: { kind: SwatchKey; id: string }) {
  switch (kind) {
    case 'blueprint':
      return (
        <>
          <rect width="40" height="40" fill="#EDF3FF" />
          <pattern id={id + 'g'} width="5" height="5" patternUnits="userSpaceOnUse">
            <path d="M5 0H0V5" fill="none" stroke="#D3E0FF" strokeWidth=".6" />
          </pattern>
          <rect width="40" height="40" fill={`url(#${id}g)`} />
          <path d="M8 9h24v22H8zM8 19h11M19 9v10M25 19v12" fill="none" stroke="#3A72F7" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M19 25a5 5 0 0 1 5-5" fill="none" stroke="#3A72F7" strokeWidth="1" />
        </>
      )
    case 'grigio':
    case 'slate': {
      const c = kind === 'grigio' ? ['#ABAAA5', '#A3A29D', '#B1B0AB', '#A7A6A1', '#8F8E89'] : ['#5D6771', '#66707A', '#59636D', '#6B7580', '#4A535C']
      return (
        <>
          <rect x="0" y="0" width="20" height="20" fill={c[0]} />
          <rect x="20" y="0" width="20" height="20" fill={c[1]} />
          <rect x="0" y="20" width="20" height="20" fill={c[2]} />
          <rect x="20" y="20" width="20" height="20" fill={c[3]} />
          <circle cx="9" cy="8" r="7" fill="#fff" opacity=".07" />
          <circle cx="29" cy="31" r="8" fill="#000" opacity=".04" />
          <path d="M20 0V40M0 20H40" stroke={c[4]} strokeWidth=".8" />
        </>
      )
    }
    case 'hex':
    case 'blackhex': {
      const dark = kind === 'blackhex'
      return (
        <>
          <rect width="40" height="40" fill={dark ? '#2D323A' : '#FAF9F6'} />
          <pattern id={id + 'h'} width="12" height="6.93" patternUnits="userSpaceOnUse">
            <path d="M0 3.46L2 0H6L8 3.46L6 6.93H2ZM8 3.46H12" fill="none" stroke={dark ? '#4B525D' : '#D5D1C9'} strokeWidth=".7" />
          </pattern>
          <rect width="40" height="40" fill={`url(#${id}h)`} />
        </>
      )
    }
    case 'toscana':
      return (
        <>
          <defs>
            <linearGradient id={id + 't'} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#F2E9D9" />
              <stop offset="1" stopColor="#E2D2B8" />
            </linearGradient>
          </defs>
          <rect width="40" height="40" fill={`url(#${id}t)`} />
          <path d="M-2 30C10 21 18 35 42 17" fill="none" stroke="#D3C09F" strokeWidth=".9" opacity=".8" />
          <path d="M-2 9C13 15 24 3 42 11" fill="none" stroke="#DCCBAD" strokeWidth=".6" opacity=".8" />
          <path d="M20 0V40" stroke="#D8CAB2" strokeWidth=".8" />
        </>
      )
    case 'subway':
    case 'pearl':
    case 'sage': {
      const p = kind === 'subway' ? ['#FBFBFA', '#DDDAD4'] : kind === 'pearl' ? ['#F1EBE2', '#D9CEBE'] : ['#AFC1A9', '#95A98F']
      return (
        <>
          <rect width="40" height="40" fill={p[0]} />
          <pattern id={id + 's'} width="20" height="10" patternUnits="userSpaceOnUse">
            <path d="M0 0H20M0 5H20M0 0V5M10 5V10" fill="none" stroke={p[1]} strokeWidth=".7" />
          </pattern>
          <rect width="40" height="40" fill={`url(#${id}s)`} />
          <defs>
            <linearGradient id={id + 'gl'} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#fff" stopOpacity=".45" />
              <stop offset=".5" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
          </defs>
          <rect width="40" height="40" fill={`url(#${id}gl)`} />
        </>
      )
    }
    case 'bianco':
      return (
        <>
          <rect width="40" height="40" fill="#F4F2EE" />
          <pattern id={id + 'b'} width="24" height="12" patternUnits="userSpaceOnUse">
            <path d="M0 0H24M0 6H24M0 0V6M12 6V12" fill="none" stroke="#E0DDD6" strokeWidth=".8" />
          </pattern>
          <rect width="40" height="40" fill={`url(#${id}b)`} />
        </>
      )
    case 'calacatta':
      return (
        <>
          <rect width="40" height="40" fill="#FAFAF8" />
          <path d="M-4 27C8 18 16 31 26 16S40 9 46 3" fill="none" stroke="#BDB3A2" strokeWidth="1.2" opacity=".8" />
          <path d="M14 24C18 30 22 36 31 44" fill="none" stroke="#CEC6B8" strokeWidth=".7" />
          <path d="M-2 6C6 9 9 4 15 7" fill="none" stroke="#D6CFC3" strokeWidth=".6" />
          <path d="M20 0V40M0 20H40" stroke="#E7E4DE" strokeWidth=".6" />
        </>
      )
    case 'terrazzo': {
      const r = rnd(7)
      const cols = ['#C3B29C', '#8F9AA0', '#D4A387', '#7A8981', '#E2D7C8', '#B9A58A']
      return (
        <>
          <rect width="40" height="40" fill="#EFEBE5" />
          {Array.from({ length: 22 }).map((_, i) => (
            <circle key={i} cx={r() * 40} cy={r() * 40} r={0.7 + r() * 1.6} fill={cols[i % cols.length]} />
          ))}
        </>
      )
    }
    case 'zellige': {
      const greens = ['#5E8C70', '#4E7C61', '#6C9B7D', '#42705A', '#578669', '#63927A']
      const r = rnd(3)
      return (
        <>
          <rect width="40" height="40" fill="#E8E5DE" />
          {Array.from({ length: 16 }).map((_, i) => (
            <rect key={i} x={(i % 4) * 10 + 0.5} y={Math.floor(i / 4) * 10 + 0.5} width="9" height="9" rx=".8" fill={greens[Math.floor(r() * greens.length)]} />
          ))}
          <path d="M0 40L40 0" stroke="#fff" strokeWidth="8" opacity=".08" />
        </>
      )
    }
    case 'travertine':
      return (
        <>
          <rect width="40" height="40" fill="#E9DCC5" />
          {[7, 13, 22, 30, 36].map((y, i) => (
            <path key={i} d={`M0 ${y}C10 ${y - 1.5} 26 ${y + 1.5} 40 ${y}`} fill="none" stroke="#D9C8AB" strokeWidth={i % 2 ? 0.7 : 1.2} opacity=".85" />
          ))}
          <ellipse cx="12" cy="18" rx="1.6" ry=".7" fill="#CDB997" />
          <ellipse cx="29" cy="26" rx="1.2" ry=".5" fill="#CDB997" />
          <path d="M0 20H40M20 0V20M10 20V40M30 20V40" stroke="#DCCDB4" strokeWidth=".7" />
        </>
      )
    case 'herringbone':
      return (
        <>
          <rect width="40" height="40" fill="#C9A47B" />
          <pattern id={id + 'w'} width="12" height="12" patternUnits="userSpaceOnUse">
            <path d="M0 6L6 0L9 3L3 9Z" fill="#BE966B" />
            <path d="M6 12L12 6L15 9L9 15Z" fill="#BE966B" />
            <path d="M0 6L6 0L9 3L3 9ZM6 0L12 6M3 9L9 15" fill="none" stroke="#A88058" strokeWidth=".4" />
          </pattern>
          <rect width="40" height="40" fill={`url(#${id}w)`} />
        </>
      )
    case 'cement':
      return (
        <>
          <rect width="40" height="40" fill="#F2EFE8" />
          {[0, 20].map((x) =>
            [0, 20].map((y) => (
              <g key={x + '-' + y} transform={`translate(${x} ${y})`}>
                <path d="M10 3L17 10L10 17L3 10Z" fill="#3E5C82" />
                <circle cx="10" cy="10" r="2.6" fill="#F2EFE8" />
                <circle cx="0" cy="0" r="3.4" fill="#3E5C82" opacity=".9" />
                <circle cx="20" cy="0" r="3.4" fill="#3E5C82" opacity=".9" />
                <circle cx="0" cy="20" r="3.4" fill="#3E5C82" opacity=".9" />
                <circle cx="20" cy="20" r="3.4" fill="#3E5C82" opacity=".9" />
              </g>
            )),
          )}
          <path d="M20 0V40M0 20H40" stroke="#D8D3C8" strokeWidth=".6" />
        </>
      )
  }
}

export function Swatch({ kind, size = 44, className, radius }: { kind: SwatchKey; size?: number; className?: string; radius?: number }) {
  const id = React.useId().replace(/:/g, '')
  const r = radius ?? Math.round(size * 0.26)
  return (
    <span className={cn('relative inline-block shrink-0 overflow-hidden', className)} style={{ width: size, height: size, borderRadius: r }}>
      <svg viewBox="0 0 40 40" preserveAspectRatio="xMidYMid slice" className="block h-full w-full" aria-hidden>
        <SwatchArt kind={kind} id={id} />
      </svg>
      <span className="pointer-events-none absolute inset-0 shadow-[inset_0_0_0_0.0625rem_rgba(16,24,40,.08)]" style={{ borderRadius: r }} />
    </span>
  )
}

/* ---------------- building illustrations (the job "photo") ---------------- */
function Sky({ id }: { id: string }) {
  return (
    <>
      <defs>
        <linearGradient id={id + 'sky'} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#E3EDFC" />
          <stop offset="1" stopColor="#F5F8FE" />
        </linearGradient>
      </defs>
      <rect width="160" height="120" fill={`url(#${id}sky)`} />
      <circle cx="134" cy="22" r="9" fill="#FFF1D2" />
      <g fill="#fff" opacity=".95">
        <ellipse cx="28" cy="20" rx="13" ry="4.5" />
        <ellipse cx="37" cy="17" rx="8" ry="4.5" />
        <ellipse cx="96" cy="12" rx="10" ry="3.5" />
      </g>
    </>
  )
}
function Ground() {
  return (
    <>
      <rect y="104" width="160" height="16" fill="#E2E7EE" />
      <rect y="104" width="160" height="1.5" fill="#CFD7E2" />
    </>
  )
}
const win = (x: number, y: number, w: number, h: number, fill = '#33415A', frame = '#EFE3D6', key?: string | number) => (
  <g key={key}>
    <rect x={x} y={y} width={w} height={h} fill={fill} />
    <rect x={x} y={y} width={w} height={h} fill="none" stroke={frame} strokeWidth="1.2" />
    <path d={`M${x + w / 2} ${y}V${y + h}`} stroke={frame} strokeWidth=".6" opacity=".8" />
    <path d={`M${x + 1} ${y + 1}L${x + w * 0.6} ${y + 1}L${x + 1} ${y + h * 0.5}Z`} fill="#fff" opacity=".1" />
  </g>
)

function BuildingArt({ kind, id }: { kind: BuildingKind; id: string }) {
  switch (kind) {
    case 'brownstone':
    case 'walkup': {
      const main = kind === 'brownstone' ? '#A96C4F' : '#B4785B'
      return (
        <>
          <Sky id={id} />
          <rect x="4" y="42" width="42" height="62" fill="#C9A893" />
          {[0, 1, 2].map((r) => [10, 26].map((x) => win(x, 50 + r * 17, 9, 11, '#5B6A80', '#E9DDD2', `l${r}${x}`)))}
          <rect x="114" y="36" width="44" height="68" fill="#BB8669" />
          {[0, 1, 2].map((r) => [120, 138].map((x) => win(x, 44 + r * 18, 10, 12, '#56657C', '#EBDDD0', `r${r}${x}`)))}
          <rect x="44" y="26" width="72" height="78" fill={main} />
          <rect x="110" y="26" width="6" height="78" fill="#000" opacity=".1" />
          <rect x="40" y="20" width="80" height="8" fill="#7A4832" />
          {Array.from({ length: 13 }).map((_, i) => <rect key={i} x={42 + i * 6} y="27.5" width="3" height="2" fill="#7A4832" />)}
          {[0, 1].map((r) => [52, 74, 96].map((x) => (
            <g key={r + '-' + x}>
              <rect x={x - 1} y={33 + r * 22} width="14" height="2.5" fill="#D3B39C" />
              {win(x, 36 + r * 22, 12, 15)}
            </g>
          )))}
          {kind === 'walkup' && (
            <g stroke="#2E333B" strokeWidth="1" fill="none">
              <path d="M93 54h18M93 76h18M95 54l14 22" />
              <path d="M93 54v4M111 54v4M93 76v4M111 76v4" />
            </g>
          )}
          <path d="M70 104V88a10 10 0 0 1 20 0V104Z" fill="#3B2A22" />
          <path d="M72 88a8 8 0 0 1 16 0" fill="none" stroke="#E9D8C8" strokeWidth="1" />
          {win(50, 84, 12, 13, '#33415A', '#EFE3D6', 'lw')}
          {win(98, 84, 12, 13, '#33415A', '#EFE3D6', 'rw')}
          <path d="M60 104L68 97H92L100 104Z" fill="#B9AEA3" />
          <path d="M60 104L68 97M100 104L92 97" stroke="#2E333B" strokeWidth="1" />
          <Ground />
        </>
      )
    }
    case 'townhouse':
      return (
        <>
          <Sky id={id} />
          <rect x="10" y="38" width="40" height="66" fill="#B9C4CF" />
          <rect x="112" y="44" width="40" height="60" fill="#C9B29A" />
          <rect x="48" y="28" width="66" height="76" fill="#D9C7B1" />
          <rect x="44" y="22" width="74" height="7" fill="#9C8670" />
          <path d="M60 38h42v30H60z" fill="#C8B49C" />
          {win(64, 42, 10, 22, '#3A4860', '#F3EBE0', 'a')}
          {win(76, 42, 10, 22, '#3A4860', '#F3EBE0', 'b')}
          {win(88, 42, 10, 22, '#3A4860', '#F3EBE0', 'c')}
          <rect x="58" y="68" width="46" height="3" fill="#9C8670" />
          {win(58, 80, 14, 16, '#3A4860', '#F3EBE0', 'd')}
          <rect x="84" y="78" width="16" height="26" fill="#2F4A3E" />
          <circle cx="97" cy="92" r="1" fill="#E8D9B5" />
          <Ground />
        </>
      )
    case 'tower':
      return (
        <>
          <Sky id={id} />
          <defs>
            <linearGradient id={id + 'gl'} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#AFC4DA" />
              <stop offset="1" stopColor="#7F98B5" />
            </linearGradient>
          </defs>
          <rect x="8" y="50" width="38" height="54" fill="#D3D8DF" />
          {[0, 1, 2, 3].map((r) => <rect key={r} x="12" y={56 + r * 11} width="30" height="5" fill="#9AAAC0" opacity=".7" />)}
          <rect x="116" y="58" width="38" height="46" fill="#CDD3DB" />
          {[0, 1, 2].map((r) => <rect key={r} x="120" y={64 + r * 12} width="30" height="5" fill="#9AAAC0" opacity=".7" />)}
          <rect x="50" y="8" width="62" height="96" fill={`url(#${id}gl)`} />
          {Array.from({ length: 15 }).map((_, i) => <path key={'h' + i} d={`M50 ${14 + i * 6}H112`} stroke="#D7E3EF" strokeWidth=".6" opacity=".9" />)}
          {Array.from({ length: 7 }).map((_, i) => <path key={'v' + i} d={`M${58 + i * 8} 8V96`} stroke="#D7E3EF" strokeWidth=".5" opacity=".6" />)}
          <path d="M50 70L112 20V8H96L50 46Z" fill="#fff" opacity=".12" />
          <rect x="66" y="94" width="30" height="10" fill="#4C5F78" />
          <rect x="46" y="6" width="70" height="3" fill="#6D82A0" />
          <Ground />
        </>
      )
    case 'midrise':
      return (
        <>
          <Sky id={id} />
          <rect x="100" y="16" width="44" height="88" fill="#C9D1DC" />
          {Array.from({ length: 6 }).map((_, r) => <rect key={r} x="106" y={24 + r * 12} width="32" height="5" fill="#A8B6C8" />)}
          <rect x="22" y="30" width="96" height="74" fill="#DECFBF" />
          <rect x="20" y="26" width="100" height="5" fill="#BFAE9B" />
          {Array.from({ length: 4 }).map((_, r) =>
            Array.from({ length: 6 }).map((_, c) => win(28 + c * 15, 36 + r * 13, 9, 9, '#3C4B60', '#F5EEE5', `${r}-${c}`)),
          )}
          <rect x="22" y="88" width="96" height="16" fill="#A3B8CC" />
          {Array.from({ length: 8 }).map((_, i) => <path key={i} d={`M${22 + i * 12} 88V104`} stroke="#E8EEF4" strokeWidth=".8" />)}
          <rect x="62" y="86" width="16" height="3" fill="#2F3B4B" />
          <Ground />
        </>
      )
    case 'house':
      return (
        <>
          <Sky id={id} />
          <rect x="44" y="58" width="72" height="46" fill="#F3EDE3" />
          <path d="M36 60L80 28L124 60Z" fill="#596576" />
          <path d="M36 60L80 28L124 60" fill="none" stroke="#475263" strokeWidth="2" />
          <rect x="98" y="34" width="8" height="16" fill="#6B7584" />
          {win(52, 68, 14, 14, '#3E4C5F', '#FFFFFF', 'a')}
          {win(94, 68, 14, 14, '#3E4C5F', '#FFFFFF', 'b')}
          <rect x="73" y="76" width="14" height="28" fill="#7D8A9B" />
          <circle cx="84" cy="90" r="1" fill="#E6D9B8" />
          <rect x="132" y="80" width="3" height="24" fill="#8B6E52" />
          <circle cx="133" cy="74" r="12" fill="#9DC597" />
          <circle cx="127" cy="80" r="8" fill="#89B683" />
          <ellipse cx="34" cy="102" rx="10" ry="5" fill="#9DC597" />
          <Ground />
        </>
      )
    case 'estate':
      return (
        <>
          <Sky id={id} />
          <rect x="16" y="62" width="34" height="42" fill="#EEE7DB" />
          <rect x="110" y="62" width="34" height="42" fill="#EEE7DB" />
          <path d="M12 64L33 50L54 64Z" fill="#525D6C" />
          <path d="M106 64L127 50L148 64Z" fill="#525D6C" />
          <rect x="50" y="46" width="60" height="58" fill="#F4EEE4" />
          <path d="M44 48L80 24L116 48Z" fill="#4C5766" />
          {[58, 70, 88, 100].map((x) => <rect key={x} x={x} y="62" width="3" height="42" fill="#fff" />)}
          <rect x="54" y="58" width="52" height="4" fill="#DCD3C5" />
          {win(22, 72, 10, 12, '#3E4C5F', '#fff', 'w1')}
          {win(36, 72, 10, 12, '#3E4C5F', '#fff', 'w2')}
          {win(114, 72, 10, 12, '#3E4C5F', '#fff', 'w3')}
          {win(128, 72, 10, 12, '#3E4C5F', '#fff', 'w4')}
          <rect x="74" y="80" width="12" height="24" fill="#6D5444" />
          <ellipse cx="80" cy="106" rx="40" ry="2" fill="#CFD7E2" />
          <Ground />
        </>
      )
    case 'retail':
      return (
        <>
          <Sky id={id} />
          <rect x="6" y="48" width="26" height="56" fill="#CBD2DA" />
          <rect x="128" y="44" width="28" height="60" fill="#D4CCC2" />
          <rect x="28" y="34" width="104" height="70" fill="#E5DED5" />
          <rect x="26" y="30" width="108" height="6" fill="#C9BFB3" />
          {[38, 58, 78, 98, 118].map((x) => win(x - 4, 42, 12, 12, '#3C4A5E', '#FFFFFF', x))}
          <path d="M30 62H130L124 73H36Z" fill="#2F5E52" />
          {Array.from({ length: 8 }).map((_, i) => <path key={i} d={`M${36 + i * 12} 62L${38 + i * 11.5} 73`} stroke="#4B7E70" strokeWidth="3" />)}
          <rect x="36" y="76" width="88" height="28" fill="#A9C1D4" />
          {[58, 80, 102].map((x) => <path key={x} d={`M${x} 76V104`} stroke="#EEF3F7" strokeWidth="1.5" />)}
          <rect x="74" y="80" width="12" height="24" fill="#5E7489" />
          <Ground />
        </>
      )
    case 'lobby':
      return (
        <>
          <Sky id={id} />
          <rect x="8" y="40" width="30" height="64" fill="#C7CFD9" />
          <rect x="122" y="32" width="32" height="72" fill="#CCD3DC" />
          <rect x="40" y="18" width="80" height="64" fill="#D9DDE2" />
          {Array.from({ length: 5 }).map((_, r) => (
            <g key={r}>
              <rect x="40" y={22 + r * 12} width="80" height="2" fill="#C4CAD2" />
              <rect x="46" y={26 + r * 12} width="68" height="6" fill="#5E718A" />
            </g>
          ))}
          <rect x="34" y="78" width="92" height="5" fill="#2E3A48" />
          <rect x="38" y="83" width="84" height="21" fill="#B8CDE0" />
          {[52, 66, 80, 94, 108].map((x) => <path key={x} d={`M${x} 83V104`} stroke="#F0F5FA" strokeWidth="1.4" />)}
          <rect x="73" y="88" width="14" height="16" fill="#7E95AD" />
          <Ground />
        </>
      )
  }
}

export function Building({ kind, className, w = 120, h = 90 }: { kind: BuildingKind; className?: string; w?: number; h?: number }) {
  const id = React.useId().replace(/:/g, '')
  return (
    <span className={cn('relative inline-block shrink-0 overflow-hidden rounded-2xl', className)} style={{ width: w, height: h }}>
      <svg viewBox="0 0 160 120" preserveAspectRatio="xMidYMid slice" width={w} height={h} className="block" aria-hidden>
        <BuildingArt kind={kind} id={id} />
      </svg>
      <span className="pointer-events-none absolute inset-0 rounded-2xl shadow-[inset_0_0_0_0.0625rem_rgba(16,24,40,.08)]" />
    </span>
  )
}

/* ---------------- a project's tile: its photo, else the sample's drawn swatch, else a plain tile with its tag ---------------- */
import type { Tile } from '@/tileos/data/jobs'
import { GROUTS } from '@/tileos/data/jobs'
export function TileImg({ tile, size = 44, radius, className }: { tile?: Tile; size?: number; radius?: number; className?: string }) {
  const r = radius ?? Math.round(size * 0.22)
  if (tile?.photo)
    return (
      <span className={cn('relative inline-block shrink-0 overflow-hidden bg-wash-2', className)} style={{ width: size, height: size, borderRadius: r }}>
        <img src={tile.photo} alt={tile.name} className="block h-full w-full object-cover" draggable={false} />
        <span className="pointer-events-none absolute inset-0 shadow-[inset_0_0_0_0.0625rem_rgba(16,24,40,.08)]" style={{ borderRadius: r }} />
      </span>
    )
  if (tile?.swatch) return <Swatch kind={tile.swatch} size={size} radius={r} className={className} />
  return (
    <span className={cn('inline-flex shrink-0 items-center justify-center bg-[#f1eee8] font-bold tracking-[-0.01em] text-[#8c8374] shadow-[inset_0_0_0_0.0625rem_rgba(16,24,40,.08)]', className)} style={{ width: size, height: size, borderRadius: r, fontSize: Math.max(9, Math.round(size * 0.24)) }}>
      {tile?.tag || '—'}
    </span>
  )
}
/** a grout color, as a little round sample */
export function GroutDot({ grout, size = 14, className }: { grout?: string; size?: number; className?: string }) {
  const g = grout ? GROUTS[grout] : undefined
  if (!g) return <span className={cn('inline-block shrink-0 rounded-full border border-dashed border-[#c9ced6]', className)} style={{ width: size, height: size }} />
  return <span className={cn('inline-block shrink-0 rounded-full shadow-[inset_0_0_0_0.0625rem_rgba(16,24,40,.16)]', className)} style={{ width: size, height: size, background: `radial-gradient(circle at 35% 30%, rgba(255,255,255,.45), transparent 50%), ${g.color}` }} title={g.name} />
}
