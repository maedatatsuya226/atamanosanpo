import { domainOf } from '../core/domains'
import type { DomainId } from '../core/types'

export function DomainBadge({ domain }: { domain: DomainId }) {
  const d = domainOf(domain)
  return (
    <span className="domain-badge" style={{ background: `var(${d.colorVar})` }}>
      {d.label}
    </span>
  )
}
