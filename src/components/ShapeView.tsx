import { MAX_SPAN, span, type Shape } from '../games/figure-match/logic'

/** マスを組み合わせた図形を、4×4の枠の中央に描く */
export function ShapeView({ shape, color = 'var(--shape-fill)' }: { shape: Shape; color?: string }) {
  const { rows, cols } = span(shape)
  const offR = (MAX_SPAN - rows) / 2
  const offC = (MAX_SPAN - cols) / 2
  const pad = 0.3
  return (
    <svg
      className="shape-view"
      viewBox={`${-pad} ${-pad} ${MAX_SPAN + pad * 2} ${MAX_SPAN + pad * 2}`}
      aria-hidden="true"
    >
      {shape.map(([r, c]) => (
        <rect
          key={`${r},${c}`}
          x={c + offC + 0.04}
          y={r + offR + 0.04}
          width={0.92}
          height={0.92}
          rx={0.12}
          fill={color}
        />
      ))}
    </svg>
  )
}
