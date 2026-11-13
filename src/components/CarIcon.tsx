/**
 * 上から見た車(右向き)。SVG の中で使う。大きさはマス目1つ分を基準にしている。
 * 向きは呼び出し側で rotate する。
 */
export function CarIcon() {
  return (
    <g>
      <rect x={-0.2} y={-0.2} width={0.12} height={0.05} rx={0.02} fill="#1d2320" />
      <rect x={0.1} y={-0.2} width={0.12} height={0.05} rx={0.02} fill="#1d2320" />
      <rect x={-0.2} y={0.15} width={0.12} height={0.05} rx={0.02} fill="#1d2320" />
      <rect x={0.1} y={0.15} width={0.12} height={0.05} rx={0.02} fill="#1d2320" />
      <rect x={-0.27} y={-0.17} width={0.54} height={0.34} rx={0.09} fill="#d64545" stroke="#7a1f1f" strokeWidth={0.02} />
      <rect x={0.06} y={-0.13} width={0.1} height={0.26} rx={0.03} fill="#cfe6f7" />
      <rect x={-0.2} y={-0.12} width={0.07} height={0.24} rx={0.03} fill="#cfe6f7" />
    </g>
  )
}

/** 向き(0=上 1=右 2=下 3=左)を、右向きの絵からの回転角度にする */
export const CAR_ANGLE = [-90, 0, 90, 180] as const
