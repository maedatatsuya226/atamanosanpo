import { useSound } from '../core/sound'

interface Props {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  maxLength: number
  /** 入力欄の後ろに付ける単位(例: 月) */
  unit?: string
  disabled?: boolean
}

/** 大きなボタンの数字入力パッド */
export function NumberPad({ value, onChange, onSubmit, maxLength, unit, disabled }: Props) {
  const sound = useSound()

  const press = (digit: string) => {
    if (disabled || value.length >= maxLength) return
    sound('tap')
    // 先頭の0は入れない
    onChange(value === '' && digit === '0' ? '' : value + digit)
  }

  return (
    <div className="numpad">
      <div className="numpad-display" aria-live="polite">
        <span className="numpad-value">{value || ' '}</span>
        {unit && <span className="numpad-unit">{unit}</span>}
      </div>
      <div className="numpad-keys">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} type="button" className="key" onClick={() => press(d)} disabled={disabled}>
            {d}
          </button>
        ))}
        <button
          type="button"
          className="key key-sub"
          onClick={() => onChange(value.slice(0, -1))}
          disabled={disabled || value === ''}
        >
          けす
        </button>
        <button type="button" className="key" onClick={() => press('0')} disabled={disabled}>
          0
        </button>
        <button type="button" className="key key-ok" onClick={onSubmit} disabled={disabled || value === ''}>
          けってい
        </button>
      </div>
    </div>
  )
}
