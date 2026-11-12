import type { DomainId } from './types'

export interface DomainDef {
  id: DomainId
  label: string
  /** CSS変数名(styles.css の :root で定義) */
  colorVar: string
}

export const DOMAINS: readonly DomainDef[] = [
  { id: 'spatial', label: '空間認識', colorVar: '--d-spatial' },
  { id: 'orientation', label: '見当識', colorVar: '--d-orientation' },
  { id: 'memory', label: '記憶', colorVar: '--d-memory' },
  { id: 'planning', label: '計画', colorVar: '--d-planning' },
  { id: 'attention', label: '注意', colorVar: '--d-attention' },
]

export function domainOf(id: DomainId): DomainDef {
  const d = DOMAINS.find((x) => x.id === id)
  if (!d) throw new Error(`unknown domain: ${id}`)
  return d
}
