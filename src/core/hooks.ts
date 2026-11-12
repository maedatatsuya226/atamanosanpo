import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'

/** 要素の大きさ(px)を追いかける。画面の回転にも追従する */
export function useElementSize<T extends HTMLElement>(): [RefObject<T | null>, { width: number; height: number }] {
  const ref = useRef<T | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setSize({ width: el.clientWidth, height: el.clientHeight })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, size]
}
import { Stopwatch } from './stopwatch'

/**
 * 一時停止に対応した setTimeout。
 * delayMs が null のとき・一時停止中は予約しない。key が変わると予約し直す。
 * 一時停止から戻ると、その待ち時間を最初から数え直す。
 */
export function usePausableTimeout(callback: () => void, delayMs: number | null, paused: boolean, key?: unknown) {
  const cb = useRef(callback)
  useEffect(() => {
    cb.current = callback
  })
  useEffect(() => {
    if (delayMs === null || paused) return
    const t = window.setTimeout(() => cb.current(), delayMs)
    return () => window.clearTimeout(t)
  }, [delayMs, paused, key])
}

export interface TrialClock {
  /** 0から測り直す */
  restart: () => void
  /** 経過時間(ミリ秒)。一時停止中の時間は含まない */
  read: () => number
}

/** 1問ごとの反応時間を測る。一時停止中は自動で止まる */
export function useTrialClock(paused: boolean): TrialClock {
  const sw = useRef<Stopwatch | null>(null)
  if (sw.current === null) sw.current = new Stopwatch()
  const pausedRef = useRef(paused)

  useEffect(() => {
    pausedRef.current = paused
    if (paused) sw.current!.pause()
    else sw.current!.start()
  }, [paused])

  return useMemo(
    () => ({
      restart: () => {
        sw.current!.reset()
        if (!pausedRef.current) sw.current!.start()
      },
      read: () => sw.current!.elapsedMs(),
    }),
    [],
  )
}

export function average(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}
