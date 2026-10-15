/* Product pictures for the materials catalog. A real photo shows when the item has one (imported from the
 * supplier's catalog or added by hand); otherwise a studio-style drawing of how it's packed — bag, pail, roll,
 * board, box, trim, tube, jug or kit — in the category's color. */
import * as React from 'react'

export type PicKind = 'bag' | 'pail' | 'roll' | 'sheet' | 'box' | 'trim' | 'tube' | 'jug' | 'kit'

const shade = (hex: string, k: number) => {
  const n = parseInt(hex.slice(1), 16)
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(k > 0 ? c + (255 - c) * k : c * (1 + k))))
  const r = f((n >> 16) & 255), g = f((n >> 8) & 255), b = f(n & 255)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

export function ProductPic({ kind, color, label, size = 96, className, bg = true, photo, sub }: { kind: PicKind; color: string; label?: string; size?: number; className?: string; bg?: boolean; photo?: string; sub?: string }) {
  const raw = React.useId().replace(/:/g, '')
  if (photo) return <img src={photo} alt={label || ''} width={size} height={size} className={className} style={{ width: size, height: size, objectFit: 'contain', borderRadius: bg ? 14 : 0, background: bg ? '#fff' : undefined }} />
  const id = (k: string) => `${k}${raw}`
  const c = color
  const d1 = shade(c, -0.18)
  const d2 = shade(c, -0.38)
  const l1 = shade(c, 0.28)
  const l2 = shade(c, 0.55)
  const txt = (label || '').slice(0, 14)
  const fit = (w: number, per: number) => (txt.length * per > w ? { textLength: w, lengthAdjust: 'spacingAndGlyphs' as const } : {})
  const font = { fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 800 } as const
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} className={className} role="img" aria-label={label || kind}>
      <defs>
        <linearGradient id={id('side')} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor={d2} />
          <stop offset=".18" stopColor={d1} />
          <stop offset=".42" stopColor={l1} />
          <stop offset=".62" stopColor={c} />
          <stop offset="1" stopColor={d2} />
        </linearGradient>
        <linearGradient id={id('top')} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={l2} />
          <stop offset="1" stopColor={c} />
        </linearGradient>
        <linearGradient id={id('metal')} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={shade(c, 0.7)} />
          <stop offset=".35" stopColor={l1} />
          <stop offset=".55" stopColor={d1} />
          <stop offset=".8" stopColor={l1} />
          <stop offset="1" stopColor={d2} />
        </linearGradient>
        <radialGradient id={id('bg')} cx=".5" cy=".38" r=".75">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor={shade(c, 0.86)} />
        </radialGradient>
        <filter id={id('soft')} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.2" /></filter>
        <pattern id={id('grain')} width="4" height="4" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r=".45" fill="#000" opacity=".07" />
          <circle cx="3" cy="2.6" r=".35" fill="#fff" opacity=".12" />
        </pattern>
        <pattern id={id('waffle')} width="5" height="5" patternUnits="userSpaceOnUse">
          <rect width="5" height="5" fill="none" />
          <rect x=".8" y=".8" width="3.4" height="3.4" rx=".8" fill="#000" opacity=".13" />
        </pattern>
      </defs>
      {bg && <rect x="0" y="0" width="120" height="120" rx="18" fill={`url(#${id('bg')})`} />}
      <ellipse cx="60" cy="103" rx="38" ry="6" fill="#141a24" opacity=".18" filter={`url(#${id('soft')})`} />

      {kind === 'bag' && (
        <g>
          {/* a paper sack, gusseted, folded and stitched at the top */}
          <path d="M30 30 Q29 66 31 98 Q60 103 89 98 Q91 66 90 30 Z" fill={`url(#${id('side')})`} />
          <path d="M30 30 Q29 66 31 98 Q60 103 89 98 Q91 66 90 30 Z" fill={`url(#${id('grain')})`} />
          <path d="M34 24 L86 24 L90 31 L30 31 Z" fill={d1} />
          <path d="M34 24 L86 24" stroke={d2} strokeWidth="1.2" strokeDasharray="2 1.6" />
          <path d="M38 33 Q37 64 39 95 M81 33 Q83 64 81 95" stroke="#000" strokeOpacity=".08" strokeWidth="1.4" fill="none" />
          <path d="M47 34 Q46 60 48 92" stroke="#fff" strokeOpacity=".18" strokeWidth="5" fill="none" />
          <rect x="35" y="45" width="50" height="31" rx="3" fill="#fff" opacity=".95" />
          <rect x="35" y="45" width="50" height="6" rx="2" fill={d1} />
          <text x="60" y="64" textAnchor="middle" fontSize={txt.length > 9 ? 8.6 : 10.5} fill="#1f2937" {...font} {...fit(44, txt.length > 9 ? 5.2 : 6.3)}>{txt}</text>
          <text x="60" y="72.5" textAnchor="middle" fontSize="5.4" fill="#6b7280" {...font} fontWeight={700}>{(sub || '').slice(0, 18)}</text>
          <rect x="35" y="82" width="22" height="3.4" rx="1.7" fill="#fff" opacity=".55" />
        </g>
      )}

      {kind === 'pail' && (
        <g>
          {/* a plastic pail: tapered body, rings, lid and handle */}
          <path d="M31 36 L35 96 Q60 102 85 96 L89 36 Z" fill={`url(#${id('side')})`} />
          <path d="M33 47 Q60 52 87 47 M34 58 Q60 63 86 58" stroke="#000" strokeOpacity=".1" strokeWidth="1.3" fill="none" />
          <ellipse cx="60" cy="36" rx="30" ry="7.5" fill={`url(#${id('top')})`} />
          <ellipse cx="60" cy="36" rx="30" ry="7.5" fill="none" stroke={d2} strokeOpacity=".5" strokeWidth="1" />
          <ellipse cx="60" cy="35" rx="23" ry="4.6" fill={l1} opacity=".7" />
          <path d="M30.5 41 Q60 16 89.5 41" stroke="#5a6372" strokeWidth="2.2" fill="none" />
          <rect x="53" y="18.5" width="14" height="4.5" rx="2" fill="#394150" />
          <path d="M37 64 Q60 69 83 64 L82 86 Q60 91 38 86 Z" fill="#fff" opacity=".95" />
          <text x="60" y="78" textAnchor="middle" fontSize={txt.length > 9 ? 8.2 : 10} fill="#1f2937" {...font} {...fit(40, txt.length > 9 ? 5 : 6)}>{txt}</text>
          <text x="60" y="84.5" textAnchor="middle" fontSize="5.2" fill="#6b7280" {...font} fontWeight={700}>{(sub || '').slice(0, 16)}</text>
        </g>
      )}

      {kind === 'roll' && (
        <g>
          {/* a roll lying down: textured face, the wound end showing its layers */}
          <rect x="18" y="43" width="72" height="44" rx="3" fill={`url(#${id('metal')})`} />
          <rect x="18" y="43" width="72" height="44" rx="3" fill={`url(#${id('waffle')})`} />
          <ellipse cx="90" cy="65" rx="13" ry="22" fill={l1} />
          {[18, 14.5, 11, 7.5].map((ry, i) => <ellipse key={i} cx="90" cy="65" rx={ry * 0.59} ry={ry} fill="none" stroke={d1} strokeOpacity={0.5 + i * 0.1} strokeWidth="1.1" />)}
          <ellipse cx="90" cy="65" rx="3" ry="5" fill="#6b5b45" />
          <rect x="30" y="54" width="44" height="22" rx="2" fill="#fff" opacity=".95" />
          <text x="52" y="66.5" textAnchor="middle" fontSize="8.6" fill="#1f2937" {...font} {...fit(38, 5.4)}>{txt}</text>
          <text x="52" y="73" textAnchor="middle" fontSize="5" fill="#6b7280" {...font} fontWeight={700}>{(sub || '').slice(0, 18)}</text>
        </g>
      )}

      {kind === 'sheet' && (
        <g>
          {/* two boards on a stack: the cement face, the edge, the printed grid */}
          <path d="M16 82 L64 34 L104 46 L56 94 Z" fill={d1} />
          <path d="M20 78 L66 30 L104 41 L58 90 Z" fill={c} />
          <path d="M20 78 L66 30 L104 41 L58 90 Z" fill={`url(#${id('grain')})`} />
          <path d="M58 90 L104 41 L104 47 L58 96 Z" fill={d2} />
          <path d="M20 78 L58 90 L58 96 L20 84 Z" fill={shade(c, -0.28)} />
          <path d="M32 74 L74 33 M44 78 L86 37 M56 82 L96 42" stroke="#fff" strokeOpacity=".2" strokeWidth="1" />
          <path d="M28 70 L96 49 M38 60 L92 44" stroke="#fff" strokeOpacity=".12" strokeWidth="1" />
          <text x="62" y="66" textAnchor="middle" fontSize="9" fill="#fff" {...font} transform="rotate(-42 62 64) skewX(-14)" {...fit(46, 5.8)}>{txt}</text>
        </g>
      )}

      {(kind === 'box' || kind === 'kit') && (
        <g>
          {/* a cardboard box, taped, with the product label */}
          <path d="M26 44 L60 31 L94 44 L60 57 Z" fill={kind === 'kit' ? l1 : '#e9d5b0'} />
          <path d="M26 44 L60 57 L60 99 L26 86 Z" fill={kind === 'kit' ? c : '#d9bb8a'} />
          <path d="M60 57 L94 44 L94 86 L60 99 Z" fill={kind === 'kit' ? d1 : '#c4a170'} />
          <path d="M26 44 L60 57 L60 99 L26 86 Z" fill={`url(#${id('grain')})`} />
          <path d="M43 37.5 L77 50.5 L77 56 L43 43" fill="#fff" opacity=".35" />
          <path d="M31 58 L55 67 L55 84 L31 75 Z" fill="#fff" opacity=".95" />
          <path d="M31 58 L55 67 L55 70.5 L31 61.5 Z" fill={kind === 'kit' ? d2 : c} />
          <text x="43" y="76" textAnchor="middle" fontSize="6.4" fill="#1f2937" {...font} transform="skewY(20.5) translate(0 -15.5)" {...fit(20, 4.1)}>{txt}</text>
          {kind === 'kit' && <path d="M52 34 Q60 25 68 38" stroke="#394150" strokeWidth="2.4" fill="none" />}
        </g>
      )}

      {kind === 'trim' && (
        <g>
          {/* a metal profile: two lengths, the L-shaped end catching the light */}
          <path d="M12 84 L98 30 L108 34 L22 88 Z" fill={`url(#${id('metal')})`} />
          <path d="M22 88 L108 34 L108 42 L22 96 Z" fill={d1} />
          <path d="M12 84 L22 88 L22 96 L16 93 L16 88 L12 86 Z" fill={d2} />
          <path d="M18 86 L102 33" stroke="#fff" strokeOpacity=".65" strokeWidth="1.2" />
          <path d="M20 74 L86 33 L94 36 L28 77 Z" fill={`url(#${id('metal')})`} opacity=".85" />
          <path d="M28 77 L94 36 L94 41 L28 82 Z" fill={d1} opacity=".85" />
          {txt && <text x="60" y="110" textAnchor="middle" fontSize="9" fill={shade(c, -0.55)} {...font} {...fit(84, 5.8)}>{txt}</text>}
        </g>
      )}

      {kind === 'tube' && (
        <g>
          {/* a caulk cartridge */}
          <rect x="40" y="30" width="34" height="66" rx="4" fill={`url(#${id('side')})`} />
          <path d="M49 30 L56.5 10 L58 10 L65 30 Z" fill="#f2f4f7" stroke="#9aa1ad" strokeWidth=".8" />
          <rect x="38" y="92" width="38" height="7" rx="2" fill={d2} />
          <rect x="43" y="46" width="28" height="30" rx="2.5" fill="#fff" opacity=".95" />
          <text x="57" y="61" textAnchor="middle" fontSize="7" fill="#1f2937" {...font} {...fit(23, 4.4)}>{txt}</text>
          <text x="57" y="68" textAnchor="middle" fontSize="4.6" fill="#6b7280" {...font} fontWeight={700}>{(sub || '').slice(0, 12)}</text>
          <path d="M46 33 L46 92" stroke="#fff" strokeOpacity=".3" strokeWidth="3" />
        </g>
      )}

      {kind === 'jug' && (
        <g>
          {/* a gallon jug with its handle and cap */}
          <path d="M34 42 Q34 32 44 32 L64 32 L66 22 L78 22 L80 33 Q88 37 88 48 L88 92 Q88 98 81 98 L41 98 Q34 98 34 92 Z" fill={`url(#${id('side')})`} />
          <path d="M42 39 Q42 36 47 36 L58 36 L58 54 L42 54 Z" fill="#fff" opacity=".22" />
          <path d="M44 40 L56 40 L56 50 L44 50 Z" fill={d2} opacity=".35" />
          <rect x="65" y="16" width="14" height="8" rx="2" fill={d2} />
          <rect x="40" y="60" width="44" height="28" rx="3" fill="#fff" opacity=".95" />
          <text x="62" y="75" textAnchor="middle" fontSize="8.4" fill="#1f2937" {...font} {...fit(38, 5.3)}>{txt}</text>
          <text x="62" y="82" textAnchor="middle" fontSize="5" fill="#6b7280" {...font} fontWeight={700}>{(sub || '').slice(0, 16)}</text>
        </g>
      )}
    </svg>
  )
}
