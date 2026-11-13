import type { ReactNode } from 'react'

/**
 * ホームと準備画面に出す、課題の内容がひと目でわかる小さな絵(オリジナルのSVG)。
 * 見当識の絵には実際の日付を出さない(患者さんに答えが見えてしまうため)。
 */

const INK = '#1d2320'
const SUB = '#4a524d'
const LINE = '#cfc9bb'
const SURF = '#ffffff'
const PRIMARY = '#2f6f5e'
const PRIMARY_SOFT = '#dcebe5'
const LIT = '#ffd23f'
const COLORS = ['#d64545', '#2f6fd0', '#e3a400', '#2f9a55', '#8a52c9'] as const

const W = 160
const H = 100

function Frame({ children, label }: { children: ReactNode; label: string }) {
  return (
    <svg className="game-thumb" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      {children}
    </svg>
  )
}

/** マスを並べて図形を描く */
function Cells({ cells, x, y, s, fill }: { cells: [number, number][]; x: number; y: number; s: number; fill: string }) {
  return (
    <>
      {cells.map(([r, c]) => (
        <rect key={`${r}-${c}`} x={x + c * s} y={y + r * s} width={s - 1.5} height={s - 1.5} rx={s * 0.15} fill={fill} />
      ))}
    </>
  )
}

function Circle({ x, y, r, label, done, fs }: { x: number; y: number; r: number; label: string; done?: boolean; fs?: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={done ? PRIMARY : SURF} stroke={done ? PRIMARY : INK} strokeWidth={1.8} />
      <text x={x} y={y} dy="0.36em" textAnchor="middle" fontSize={fs ?? r * 1.15} fontWeight={800} fill={done ? '#fff' : INK}>
        {label}
      </text>
    </g>
  )
}

const L_SHAPE: [number, number][] = [
  [0, 0],
  [1, 0],
  [2, 0],
  [2, 1],
]

function FigureMatch() {
  return (
    <Frame label="みほんと おなじ かたちを えらぶ">
      <rect x={8} y={14} width={50} height={72} rx={8} fill={SURF} stroke={INK} strokeWidth={2.5} />
      <text x={33} y={26} textAnchor="middle" fontSize={9} fontWeight={700} fill={SUB}>
        みほん
      </text>
      <Cells cells={L_SHAPE} x={21} y={36} s={12} fill="#2c4a6e" />
      {[
        { x: 66, ok: false, cells: [[0, 0], [0, 1], [1, 1], [2, 1]] as [number, number][] },
        { x: 97, ok: true, cells: L_SHAPE },
        { x: 128, ok: false, cells: [[0, 1], [1, 1], [2, 1], [2, 0]] as [number, number][] },
      ].map((o) => (
        <g key={o.x}>
          <rect
            x={o.x}
            y={24}
            width={27}
            height={52}
            rx={6}
            fill={o.ok ? PRIMARY_SOFT : SURF}
            stroke={o.ok ? PRIMARY : LINE}
            strokeWidth={o.ok ? 3 : 1.5}
          />
          <Cells cells={o.cells} x={o.x + 7} y={36} s={7.5} fill="#2c4a6e" />
        </g>
      ))}
    </Frame>
  )
}

function IroKeshi() {
  const grid = [
    [0, 0, 1, 2, 2, 3, 1, 1],
    [0, 1, 1, 2, 3, 3, 0, 1],
    [2, 1, 3, 3, 0, 2, 0, 0],
    [2, 2, 3, 1, 0, 2, 2, 1],
    [3, 0, 0, 1, 1, 2, 3, 3],
  ]
  const s = 17
  const x0 = (W - 8 * s) / 2
  const y0 = (H - 5 * s) / 2
  return (
    <Frame label="おなじ いろの ブロックを けす">
      {grid.flatMap((row, r) =>
        row.map((c, col) => (
          <rect
            key={`${r}-${col}`}
            x={x0 + col * s}
            y={y0 + r * s}
            width={s - 2}
            height={s - 2}
            rx={3}
            fill={COLORS[c]}
          />
        )),
      )}
      {/* タップしたひとかたまり */}
      <path
        d={`M${x0 + 2 * s - 1} ${y0 + 2 * s - 1} h${2 * s} v${2 * s} h${-2 * s} z`}
        fill="none"
        stroke={INK}
        strokeWidth={2.5}
        strokeDasharray="4 3"
      />
    </Frame>
  )
}

function Viewpoint() {
  return (
    <Frame label="どこから みた え かを あてる">
      {/* 横から見た絵 */}
      <rect x={6} y={10} width={70} height={80} rx={8} fill="#eef3fb" stroke={INK} strokeWidth={2} />
      <rect x={12} y={72} width={58} height={5} rx={2} fill="#c9a06a" />
      <rect x={16} y={56} width={15} height={16} rx={2} fill={COLORS[0]} />
      <rect x={34} y={40} width={15} height={32} rx={2} fill={COLORS[4]} />
      <rect x={52} y={56} width={14} height={16} rx={2} fill={COLORS[2]} />
      <text x={41} y={24} textAnchor="middle" fontSize={9} fontWeight={700} fill={SUB}>
        この え
      </text>
      {/* 上から見た机と、見る場所 */}
      <rect x={98} y={22} width={44} height={44} rx={4} fill="#e8d3ad" stroke="#9a7240" strokeWidth={1.5} />
      <rect x={103} y={52} width={10} height={10} rx={2} fill={COLORS[0]} />
      <rect x={115} y={52} width={10} height={10} rx={2} fill={COLORS[4]} />
      <rect x={127} y={52} width={10} height={10} rx={2} fill={COLORS[2]} />
      <path d="M120 70 l-7 10 h14 z" fill={PRIMARY} />
      <text x={120} y={93} textAnchor="middle" fontSize={9} fontWeight={800} fill={PRIMARY}>
        まえ？
      </text>
      <path d="M146 44 l9 -6 v12 z" fill={LINE} />
      <path d="M94 44 l-9 -6 v12 z" fill={LINE} />
      <path d="M120 18 l-6 -8 h12 z" fill={LINE} />
    </Frame>
  )
}

function OrientationDate() {
  return (
    <Frame label="きょうの ひづけを こたえる">
      <rect x={44} y={10} width={72} height={80} rx={8} fill={SURF} stroke={INK} strokeWidth={2.5} />
      <path d="M44 18 a8 8 0 0 1 8 -8 h56 a8 8 0 0 1 8 8 v12 h-72 z" fill="#c53b3b" />
      <text x={80} y={25} textAnchor="middle" fontSize={11} fontWeight={800} fill="#fff">
        ？がつ
      </text>
      <text x={80} y={66} textAnchor="middle" fontSize={34} fontWeight={800} fill={INK}>
        ？
      </text>
      <text x={80} y={83} textAnchor="middle" fontSize={10} fontWeight={700} fill={SUB}>
        ？ようび
      </text>
      <circle cx={56} cy={10} r={3} fill={INK} />
      <circle cx={104} cy={10} r={3} fill={INK} />
    </Frame>
  )
}

function FlashSequence() {
  const s = 24
  const x0 = (W - 3 * s - 8) / 2
  const y0 = (H - 3 * s - 8) / 2
  const order: Record<number, string> = { 1: '1', 5: '2', 6: '3' }
  return (
    <Frame label="ひかった じゅんばんに タップ">
      {Array.from({ length: 9 }, (_, i) => {
        const x = x0 + (i % 3) * (s + 4)
        const y = y0 + Math.floor(i / 3) * (s + 4)
        const lit = i === 6
        return (
          <g key={i}>
            {lit && <rect x={x - 3} y={y - 3} width={s + 6} height={s + 6} rx={7} fill={LIT} opacity={0.45} />}
            <rect x={x} y={y} width={s} height={s} rx={5} fill={lit ? LIT : '#8a9bab'} />
            {order[i] && !lit && (
              <text x={x + s / 2} y={y + s / 2} dy="0.36em" textAnchor="middle" fontSize={12} fontWeight={800} fill="#fff">
                {order[i]}
              </text>
            )}
          </g>
        )
      })}
    </Frame>
  )
}

function Emoji({ x, y, size, children }: { x: number; y: number; size: number; children: string }) {
  return (
    <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={size}>
      {children}
    </text>
  )
}

function PictureMemory() {
  const cards = [
    { e: '🍎', n: 'りんご' },
    { e: '🐶', n: 'いぬ' },
    { e: '🚗', n: 'くるま' },
  ]
  return (
    <Frame label="えを おぼえて あとで えらぶ">
      {cards.map((c, i) => {
        const x = 12 + i * 37
        return (
          <g key={c.n}>
            <rect x={x} y={18} width={32} height={46} rx={5} fill={SURF} stroke={LINE} strokeWidth={1.5} />
            <Emoji x={x + 16} y={36} size={18}>
              {c.e}
            </Emoji>
            <text x={x + 16} y={57} textAnchor="middle" fontSize={7} fontWeight={700} fill={INK}>
              {c.n}
            </text>
          </g>
        )
      })}
      <path d="M126 41 h10" stroke={SUB} strokeWidth={2} />
      <path d="M134 37 l5 4 l-5 4" fill="none" stroke={SUB} strokeWidth={2} />
      <rect x={124} y={50} width={30} height={40} rx={5} fill={PRIMARY_SOFT} stroke={PRIMARY} strokeWidth={2} />
      <text x={139} y={70} dy="0.36em" textAnchor="middle" fontSize={20} fontWeight={800} fill={PRIMARY}>
        ？
      </text>
      <text x={60} y={80} textAnchor="middle" fontSize={9} fontWeight={700} fill={SUB}>
        おぼえる
      </text>
    </Frame>
  )
}

function StoryMemory() {
  return (
    <Frame label="おはなしを よんで しつもんに こたえる">
      <rect x={10} y={10} width={78} height={80} rx={6} fill={SURF} stroke={INK} strokeWidth={2} />
      {[22, 34, 46, 58, 70].map((y, i) => (
        <rect key={y} x={18} y={y} width={i === 4 ? 36 : 62} height={5} rx={2.5} fill={LINE} />
      ))}
      <rect x={18} y={34} width={22} height={5} rx={2.5} fill={COLORS[1]} opacity={0.75} />
      <path d="M100 22 h48 a6 6 0 0 1 6 6 v28 a6 6 0 0 1 -6 6 h-30 l-10 10 v-10 h-8 a6 6 0 0 1 -6 -6 v-28 a6 6 0 0 1 6 -6 z" fill={PRIMARY_SOFT} stroke={PRIMARY} strokeWidth={2} />
      <text x={124} y={42} dy="0.36em" textAnchor="middle" fontSize={11} fontWeight={800} fill={PRIMARY}>
        だれと？
      </text>
    </Frame>
  )
}

function NumberPath() {
  const values = [
    [7, 1, 2, 9],
    [3, 5, 3, 6],
    [8, 4, 4, 5],
  ]
  const path = new Set(['0-1', '0-2', '1-2', '2-2', '2-3'])
  const s = 22
  const x0 = (W - 4 * s) / 2
  const y0 = (H - 3 * s) / 2
  return (
    <Frame label="1から となりの マスへ じゅんばんに すすむ">
      {values.flatMap((row, r) =>
        row.map((v, c) => {
          const on = path.has(`${r}-${c}`)
          const cur = r === 2 && c === 3
          return (
            <g key={`${r}-${c}`}>
              <rect
                x={x0 + c * s}
                y={y0 + r * s}
                width={s - 2}
                height={s - 2}
                rx={3}
                fill={cur ? PRIMARY : on ? PRIMARY_SOFT : SURF}
                stroke={on || cur ? PRIMARY : LINE}
                strokeWidth={1.5}
              />
              <text
                x={x0 + c * s + (s - 2) / 2}
                y={y0 + r * s + (s - 2) / 2}
                dy="0.36em"
                textAnchor="middle"
                fontSize={11}
                fontWeight={800}
                fill={cur ? '#fff' : on ? PRIMARY : INK}
              >
                {v}
              </text>
            </g>
          )
        }),
      )}
    </Frame>
  )
}

function KanaOrder() {
  const pts = [
    { l: 'あ', x: 34, y: 66 },
    { l: 'い', x: 62, y: 30 },
    { l: 'う', x: 96, y: 58 },
    { l: 'え', x: 126, y: 26 },
    { l: 'お', x: 132, y: 74 },
  ]
  return (
    <Frame label="あいうえお じゅんに タップ">
      <polyline points={pts.slice(0, 3).map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke={PRIMARY} strokeWidth={3} opacity={0.6} />
      {pts.map((p, i) => (
        <Circle key={p.l} x={p.x} y={p.y} r={13} label={p.l} done={i < 3} />
      ))}
    </Frame>
  )
}

function NumberStroke() {
  const s = 26
  const x0 = (W - 3 * s) / 2
  const y0 = (H - 3 * s) / 2
  const c = (r: number, col: number) => [x0 + col * s + s / 2, y0 + r * s + s / 2]
  const route: [number, number][] = [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 2],
    [1, 1],
    [1, 0],
    [2, 0],
  ]
  return (
    <Frame label="すべての マスを ひとふでで とおる">
      {Array.from({ length: 9 }, (_, i) => (
        <rect
          key={i}
          x={x0 + (i % 3) * s + 1}
          y={y0 + Math.floor(i / 3) * s + 1}
          width={s - 2}
          height={s - 2}
          rx={4}
          fill={i < 6 || i === 6 ? PRIMARY_SOFT : SURF}
          stroke={LINE}
          strokeWidth={1.5}
        />
      ))}
      <polyline
        points={route.map(([r, col]) => c(r, col).join(',')).join(' ')}
        fill="none"
        stroke={PRIMARY}
        strokeWidth={6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {[
        { at: [0, 0], l: '1' },
        { at: [1, 1], l: '2' },
        { at: [2, 2], l: '3' },
      ].map(({ at, l }) => {
        const [x, y] = c(at[0], at[1])
        return <Circle key={l} x={x} y={y} r={9} label={l} fs={11} />
      })}
    </Frame>
  )
}

function NumberOrder() {
  const pts = [
    { l: '1', x: 30, y: 70 },
    { l: '2', x: 58, y: 28 },
    { l: '3', x: 86, y: 62 },
    { l: '4', x: 128, y: 30 },
    { l: '5', x: 116, y: 78 },
    { l: '6', x: 146, y: 56 },
  ]
  return (
    <Frame label="1から じゅんばんに タップ">
      <polyline points={pts.slice(0, 3).map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke={PRIMARY} strokeWidth={3} opacity={0.6} />
      {pts.map((p, i) => (
        <Circle key={p.l} x={p.x} y={p.y} r={12} label={p.l} done={i < 3} />
      ))}
    </Frame>
  )
}

function SamePicture() {
  const field = ['🍎', '🍒', '🍅', '🍎', '🍒', '🍅', '🍎', '🍅', '🍎', '🍒', '🍅', '🍎']
  const found = new Set([1, 9])
  return (
    <Frame label="みほんと おなじ えを ぜんぶ さがす">
      <rect x={6} y={30} width={30} height={40} rx={6} fill={SURF} stroke={PRIMARY} strokeWidth={2} />
      <Emoji x={21} y={52} size={18}>
        🍒
      </Emoji>
      <text x={21} y={39} textAnchor="middle" fontSize={7} fontWeight={700} fill={SUB}>
        みほん
      </text>
      {field.map((e, i) => {
        const x = 54 + (i % 4) * 26
        const y = 22 + Math.floor(i / 4) * 28
        return (
          <g key={i}>
            <Emoji x={x} y={y} size={17}>
              {e}
            </Emoji>
            {found.has(i) && <circle cx={x} cy={y} r={12} fill="none" stroke={PRIMARY} strokeWidth={2.5} />}
          </g>
        )
      })}
    </Frame>
  )
}

function Stopwatch() {
  return (
    <Frame label="きめた びょうすうで ストップ">
      <rect x={30} y={12} width={100} height={42} rx={8} fill={SURF} stroke={INK} strokeWidth={2.5} />
      <text x={74} y={34} dy="0.36em" textAnchor="middle" fontSize={26} fontWeight={800} fill={INK}>
        ？
      </text>
      <text x={110} y={42} textAnchor="middle" fontSize={9} fontWeight={700} fill={SUB}>
        びょう
      </text>
      <rect x={42} y={62} width={76} height={28} rx={8} fill="#c0502a" />
      <text x={80} y={76} dy="0.36em" textAnchor="middle" fontSize={13} fontWeight={800} fill="#fff">
        ストップ
      </text>
    </Frame>
  )
}

function ColorWord() {
  return (
    <Frame label="もじの いみと いろが あっているか">
      <rect x={22} y={8} width={116} height={50} rx={8} fill="#2f3437" />
      <text x={80} y={33} dy="0.36em" textAnchor="middle" fontSize={26} fontWeight={800} fill="#4a9eff">
        あか
      </text>
      <rect x={22} y={64} width={55} height={28} rx={6} fill={SURF} stroke={SUB} strokeWidth={1.5} />
      <rect x={83} y={64} width={55} height={28} rx={6} fill={SURF} stroke={SUB} strokeWidth={1.5} />
      <text x={49.5} y={78} dy="0.36em" textAnchor="middle" fontSize={9} fontWeight={800} fill={INK}>
        あっている
      </text>
      <text x={110.5} y={78} dy="0.36em" textAnchor="middle" fontSize={9} fontWeight={800} fill={INK}>
        ちがう
      </text>
    </Frame>
  )
}

function DriveMaze() {
  const road = 'M 18 78 H 62 V 30 H 112 V 72 H 142'
  return (
    <Frame label="くるまを まがりかどで みちびいて ゴールへ">
      <rect x={4} y={6} width={152} height={88} rx={10} fill="#e3ecd6" />
      {/* 行き止まりのわき道 */}
      <path d="M 62 54 H 34 M 112 30 V 14 H 140" fill="none" stroke="#686d73" strokeWidth={12} strokeLinecap="round" />
      <path d={road} fill="none" stroke="#686d73" strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" />
      <path d={road} fill="none" stroke="#fff" strokeWidth={1.2} strokeDasharray="4 4" />
      {/* 次の曲がり角と、決めた向き */}
      <circle cx={62} cy={54} r={11} fill="none" stroke={LIT} strokeWidth={2.5} strokeDasharray="4 3" />
      <path d="M 62 54 V 44" stroke={PRIMARY} strokeWidth={3.5} strokeLinecap="round" />
      <path d="M 62 37 L 56.5 45 L 67.5 45 Z" fill={PRIMARY} />
      {/* 車(上向き) */}
      <g transform="translate(62 70) rotate(-90)">
        <rect x={-8} y={-5.5} width={16} height={11} rx={3} fill="#d64545" stroke="#7a1f1f" strokeWidth={0.8} />
        <rect x={2} y={-4} width={3} height={8} rx={1} fill="#cfe6f7" />
      </g>
      {/* ゴールの旗 */}
      <line x1={142} y1={80} x2={142} y2={58} stroke={INK} strokeWidth={1.8} />
      <path d="M 142 58 L 154 63 L 142 68 Z" fill="#d64545" />
    </Frame>
  )
}

function RoadRotate() {
  // 3×2のタイル。右上のタイルだけ向きがずれていて、回す矢印がついている
  const s = 30
  const x0 = 35
  const y0 = 20
  const roads: { c: number; r: number; d: string }[] = [
    { c: 0, r: 0, d: 'M 0 15 H 30' },
    { c: 1, r: 0, d: 'M 0 15 H 15 V 30' },
    { c: 1, r: 1, d: 'M 15 0 V 15 H 30' },
    { c: 2, r: 1, d: 'M 0 15 H 30' },
    { c: 2, r: 0, d: 'M 15 0 V 30' },
    { c: 0, r: 1, d: 'M 0 15 H 15 V 0' },
  ]
  return (
    <Frame label="みちを まわして スタートから ゴールまで つなげる">
      <rect x={x0} y={y0} width={s * 3} height={s * 2} rx={4} fill="#e3ecd6" />
      {roads.map(({ c, r, d }) => (
        <g key={`${c}-${r}`} transform={`translate(${x0 + c * s} ${y0 + r * s})`}>
          <rect width={s} height={s} fill="none" stroke={LINE} strokeWidth={0.8} />
          <path d={d} fill="none" stroke="#686d73" strokeWidth={12} strokeLinejoin="round" />
        </g>
      ))}
      <rect x={x0 + 2 * s} y={y0} width={s} height={s} fill="none" stroke={LIT} strokeWidth={2.5} />
      <path d={`M ${x0 + 2 * s + 6} ${y0 - 6} A 14 14 0 0 1 ${x0 + 3 * s + 4} ${y0 + 6}`} fill="none" stroke={PRIMARY} strokeWidth={2.5} />
      <path d={`M ${x0 + 3 * s + 8} ${y0 + 2} L ${x0 + 3 * s + 2} ${y0 + 10} L ${x0 + 3 * s - 2} ${y0 + 2} Z`} fill={PRIMARY} />
      {/* 入口と出口 */}
      <path d={`M 10 ${y0 + 15} H ${x0}`} stroke="#686d73" strokeWidth={12} />
      <path d={`M ${x0 + 3 * s} ${y0 + s + 15} H 150`} stroke="#686d73" strokeWidth={12} />
      <g transform={`translate(18 ${y0 + 15})`}>
        <rect x={-7} y={-4.5} width={14} height={9} rx={2.5} fill="#d64545" stroke="#7a1f1f" strokeWidth={0.8} />
        <rect x={2} y={-3.2} width={2.6} height={6.4} rx={1} fill="#cfe6f7" />
      </g>
      <line x1={150} y1={y0 + s + 24} x2={150} y2={y0 + s + 2} stroke={INK} strokeWidth={1.8} />
      <path d={`M 150 ${y0 + s + 2} L 158 ${y0 + s + 6} L 150 ${y0 + s + 10} Z`} fill="#d64545" />
      <text x={80} y={96} textAnchor="middle" fontSize={8} fontWeight={700} fill={SUB}>
        タップで まわす
      </text>
    </Frame>
  )
}

function Maze() {
  // 5×3マスの小さな迷路と、なぞった線
  const s = 18
  const x0 = 35
  const y0 = 23
  const walls = [
    `M ${x0} ${y0} H ${x0 + 5 * s}`,
    `M ${x0} ${y0 + 3 * s} H ${x0 + 5 * s}`,
    `M ${x0} ${y0 + s} V ${y0 + 3 * s}`,
    `M ${x0 + 5 * s} ${y0} V ${y0 + 2 * s}`,
    `M ${x0 + s} ${y0} V ${y0 + 2 * s}`,
    `M ${x0 + 2 * s} ${y0 + s} V ${y0 + 3 * s}`,
    `M ${x0 + 3 * s} ${y0} V ${y0 + 2 * s}`,
    `M ${x0 + 4 * s} ${y0 + s} V ${y0 + 3 * s}`,
  ]
  const c = (col: number, row: number) => `${x0 + col * s + s / 2},${y0 + row * s + s / 2}`
  const trail = [`${x0 - 12},${y0 + s / 2}`, c(0, 0), c(0, 2), c(1, 2), c(1, 0), c(2, 0)].join(' ')
  return (
    <Frame label="めいろを ゆびで なぞって ゴールへ">
      <rect x={x0} y={y0} width={5 * s} height={3 * s} fill={SURF} />
      <polyline points={trail} fill="none" stroke={PRIMARY} strokeOpacity={0.55} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x0 + 2 * s + s / 2} cy={y0 + s / 2} r={5.5} fill={PRIMARY} stroke="#fff" strokeWidth={1.2} />
      {walls.map((d) => (
        <path key={d} d={d} stroke={INK} strokeWidth={2.5} strokeLinecap="square" fill="none" />
      ))}
      <line x1={x0 + 5 * s + 12} y1={y0 + 3 * s - 2} x2={x0 + 5 * s + 12} y2={y0 + 2 * s + 1} stroke={INK} strokeWidth={1.6} />
      <path d={`M ${x0 + 5 * s + 12} ${y0 + 2 * s + 1} L ${x0 + 5 * s + 20} ${y0 + 2 * s + 5} L ${x0 + 5 * s + 12} ${y0 + 2 * s + 9} Z`} fill="#d64545" />
    </Frame>
  )
}

function Clock() {
  // 3じ を指した時計と、針を動かすボタン
  return (
    <Frame label="とけいの はりを あわせる">
      <circle cx={58} cy={50} r={38} fill={SURF} stroke={INK} strokeWidth={3} />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i * 30 * Math.PI) / 180
        return <line key={i} x1={58 + Math.sin(a) * 32} y1={50 - Math.cos(a) * 32} x2={58 + Math.sin(a) * 36} y2={50 - Math.cos(a) * 36} stroke={INK} strokeWidth={2} />
      })}
      <line x1={58} y1={50} x2={58} y2={20} stroke={PRIMARY} strokeWidth={3.5} strokeLinecap="round" />
      <line x1={58} y1={50} x2={80} y2={50} stroke={INK} strokeWidth={5} strokeLinecap="round" />
      <circle cx={58} cy={50} r={3.5} fill={INK} />
      <rect x={106} y={26} width={22} height={20} rx={5} fill={PRIMARY_SOFT} stroke={PRIMARY} strokeWidth={1.5} />
      <rect x={132} y={26} width={22} height={20} rx={5} fill={PRIMARY_SOFT} stroke={PRIMARY} strokeWidth={1.5} />
      <path d="M 121 36 L 113 31 L 113 41 Z" fill={PRIMARY} transform="rotate(180 117 36)" />
      <path d="M 147 36 L 139 31 L 139 41 Z" fill={PRIMARY} />
      <text x={130} y={68} textAnchor="middle" fontSize={12} fontWeight={800} fill={INK}>
        3じ
      </text>
    </Frame>
  )
}

function NBack() {
  // 絵が順に出て、ひとつ前と同じなら「おなじ！」
  const seq = ['🍎', '🍌', '🍌']
  return (
    <Frame label="ひとつ まえと おなじ えなら おす">
      {seq.map((e, i) => (
        <g key={i} opacity={i === 2 ? 1 : 0.45}>
          <rect x={12 + i * 48} y={12} width={40} height={44} rx={8} fill={SURF} stroke={i === 2 ? PRIMARY : LINE} strokeWidth={i === 2 ? 3 : 1.5} />
          <Emoji x={32 + i * 48} y={34} size={24}>
            {e}
          </Emoji>
        </g>
      ))}
      <path d="M 70 62 Q 94 74 118 62" fill="none" stroke={SUB} strokeWidth={1.5} strokeDasharray="3 3" />
      <rect x={44} y={70} width={72} height={24} rx={8} fill={PRIMARY} />
      <text x={80} y={82} dy="0.36em" textAnchor="middle" fontSize={12} fontWeight={800} fill="#fff">
        おなじ！
      </text>
    </Frame>
  )
}

function StepOrder() {
  // お茶をいれる手順を 1・2・3 の順に並べる
  const steps = ['🔥', '💧', '🍵']
  return (
    <Frame label="てじゅんの カードを じゅんばんに ならべる">
      {steps.map((e, i) => (
        <g key={i}>
          <rect x={10 + i * 50} y={22} width={42} height={52} rx={8} fill={SURF} stroke={PRIMARY} strokeWidth={2} />
          <text x={18 + i * 50} y={34} fontSize={10} fontWeight={800} fill={SUB}>
            {i + 1}
          </text>
          <Emoji x={31 + i * 50} y={54} size={22}>
            {e}
          </Emoji>
          {i < 2 && <path d={`M ${54 + i * 50} 48 l 4 0`} stroke={SUB} strokeWidth={2} />}
        </g>
      ))}
    </Frame>
  )
}

function Payment() {
  // 金額と、出したお金
  return (
    <Frame label="きんがく ちょうどの おかねを はらう">
      <rect x={20} y={8} width={120} height={30} rx={6} fill={SURF} stroke={INK} strokeWidth={2.5} />
      <text x={80} y={23} dy="0.36em" textAnchor="middle" fontSize={17} fontWeight={800} fill={INK}>
        160えん
      </text>
      <rect x={14} y={46} width={132} height={46} rx={10} fill="#efe6d2" />
      <circle cx={42} cy={69} r={16} fill="#c3c9ce" stroke="rgba(0,0,0,0.15)" strokeWidth={2} />
      <text x={42} y={69} dy="0.36em" textAnchor="middle" fontSize={10} fontWeight={800} fill={INK}>
        100
      </text>
      <circle cx={80} cy={69} r={15} fill="#cfd4d8" stroke="rgba(0,0,0,0.15)" strokeWidth={2} />
      <circle cx={80} cy={64} r={3.5} fill="#efe6d2" />
      <text x={80} y={75} dy="0.36em" textAnchor="middle" fontSize={8} fontWeight={800} fill={INK}>
        50
      </text>
      <circle cx={116} cy={69} r={15} fill="#c07a45" stroke="rgba(0,0,0,0.15)" strokeWidth={2} />
      <text x={116} y={69} dy="0.36em" textAnchor="middle" fontSize={10} fontWeight={800} fill={INK}>
        10
      </text>
    </Frame>
  )
}

function GoNoGo() {
  // りんごは押す、ハチは押さない
  return (
    <Frame label="きまった えの ときだけ おす">
      <rect x={14} y={12} width={60} height={56} rx={10} fill={SURF} stroke="#1f7a4d" strokeWidth={3} />
      <Emoji x={44} y={40} size={30}>
        🍎
      </Emoji>
      <rect x={86} y={12} width={60} height={56} rx={10} fill={SURF} stroke="#b23a3a" strokeWidth={3} />
      <Emoji x={116} y={40} size={30}>
        🐝
      </Emoji>
      <text x={44} y={84} dy="0.36em" textAnchor="middle" fontSize={11} fontWeight={800} fill="#1f7a4d">
        おす
      </text>
      <text x={116} y={84} dy="0.36em" textAnchor="middle" fontSize={11} fontWeight={800} fill="#b23a3a">
        おさない
      </text>
    </Frame>
  )
}

const THUMBS: Record<string, () => ReactNode> = {
  clock: Clock,
  'n-back': NBack,
  'step-order': StepOrder,
  payment: Payment,
  'go-nogo': GoNoGo,
  maze: Maze,
  'road-rotate': RoadRotate,
  'drive-maze': DriveMaze,
  'figure-match': FigureMatch,
  'iro-keshi': IroKeshi,
  viewpoint: Viewpoint,
  'orientation-date': OrientationDate,
  'flash-sequence': FlashSequence,
  'picture-memory': PictureMemory,
  'story-memory': StoryMemory,
  'number-path': NumberPath,
  'kana-order': KanaOrder,
  'number-stroke': NumberStroke,
  'number-order': NumberOrder,
  'same-picture': SamePicture,
  stopwatch: Stopwatch,
  'color-word': ColorWord,
}

export function GameThumb({ id }: { id: string }) {
  const Thumb = THUMBS[id]
  return Thumb ? <Thumb /> : null
}
