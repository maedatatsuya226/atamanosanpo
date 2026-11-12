/** 一時停止中を除いた経過時間を測る */
export class Stopwatch {
  private accumulated = 0
  private startedAt: number | null = null
  private readonly now: () => number

  constructor(now: () => number = () => performance.now()) {
    this.now = now
  }

  get running(): boolean {
    return this.startedAt !== null
  }

  start(): void {
    if (this.startedAt === null) this.startedAt = this.now()
  }

  pause(): void {
    if (this.startedAt !== null) {
      this.accumulated += this.now() - this.startedAt
      this.startedAt = null
    }
  }

  reset(): void {
    this.accumulated = 0
    this.startedAt = null
  }

  elapsedMs(): number {
    return this.accumulated + (this.startedAt !== null ? this.now() - this.startedAt : 0)
  }
}

/** 例: 8.4秒 / 1分05秒 */
export function formatDuration(ms: number): string {
  const totalSec = Math.max(0, ms) / 1000
  if (totalSec < 60) return `${totalSec.toFixed(1)}秒`
  const min = Math.floor(totalSec / 60)
  const sec = Math.floor(totalSec % 60)
  return `${min}分${String(sec).padStart(2, '0')}秒`
}
