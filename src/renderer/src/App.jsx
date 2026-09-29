import { useEffect, useState } from 'react'

const SETTINGS_KEY = 'auto-typer-settings'
const DEFAULT_SETTINGS = { countdown: 5, delayMs: 20, pressEnter: false, mode: 'unicode', alwaysOnTop: true }

function loadSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export default function App() {
  const [text, setText] = useState('')
  const [settings, setSettings] = useState(loadSettings)
  const [status, setStatus] = useState({ phase: 'idle' })

  const busy = status.phase === 'countdown' || status.phase === 'typing'

  useEffect(() => window.api.onStatus(setStatus), [])

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    } catch {
      // settings are a convenience only
    }
    window.api.setAlwaysOnTop(settings.alwaysOnTop)
  }, [settings])

  const update = (key) => (event) => {
    const { type, checked, value } = event.target
    setSettings((prev) => ({
      ...prev,
      [key]: type === 'checkbox' ? checked : type === 'number' ? Math.max(0, Number(value)) : value
    }))
  }

  const pasteClipboard = async () => setText(await window.api.readClipboard())

  const start = () => window.api.start({ text, ...settings })

  const cancel = () => window.api.cancel()

  const percent = status.phase === 'typing' && status.total ? Math.round((status.done / status.total) * 100) : 0

  return (
    <main className="app">
      <header>
        <h1>Auto Typer</h1>
        <p>Paste text, press Start, then click the target field (e.g. inside Remote Desktop).</p>
      </header>

      <div className="text-block">
        <div className="text-toolbar">
          <span>{text.length} characters</span>
          <div>
            <button type="button" className="link" onClick={pasteClipboard} disabled={busy}>
              Paste clipboard
            </button>
            <button type="button" className="link" onClick={() => setText('')} disabled={busy || !text}>
              Clear
            </button>
          </div>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste the link or text to type here..."
          disabled={busy}
          spellCheck={false}
        />
      </div>

      <section className="options">
        <label>
          Countdown (s)
          <input type="number" min="0" max="60" value={settings.countdown} onChange={update('countdown')} disabled={busy} />
        </label>
        <label>
          Delay per key (ms)
          <input type="number" min="0" max="1000" value={settings.delayMs} onChange={update('delayMs')} disabled={busy} />
        </label>
        <label>
          Typing mode
          <select value={settings.mode} onChange={update('mode')} disabled={busy}>
            <option value="unicode">Unicode (default)</option>
            <option value="scancode">Scan code (if RDP drops chars)</option>
          </select>
        </label>
        <label className="check">
          <input type="checkbox" checked={settings.pressEnter} onChange={update('pressEnter')} disabled={busy} />
          Press Enter at the end
        </label>
        <label className="check">
          <input type="checkbox" checked={settings.alwaysOnTop} onChange={update('alwaysOnTop')} />
          Keep window on top
        </label>
      </section>

      <StatusPanel status={status} percent={percent} />

      <footer>
        {busy ? (
          <button type="button" className="danger" onClick={cancel}>
            Cancel <kbd>Ctrl+Alt+X</kbd>
          </button>
        ) : (
          <button type="button" className="primary" onClick={start} disabled={!text}>
            Start
          </button>
        )}
      </footer>
    </main>
  )
}

function StatusPanel({ status, percent }) {
  switch (status.phase) {
    case 'countdown':
      return (
        <div className="status countdown">
          <strong>{status.remaining}</strong>
          <span>Click the place you want to type into…</span>
        </div>
      )
    case 'typing':
      return (
        <div className="status">
          <span>
            Typing… {status.done} / {status.total}
          </span>
          <div className="progress">
            <div style={{ width: `${percent}%` }} />
          </div>
        </div>
      )
    case 'done':
      return <div className="status ok">Done — typed {status.total} characters.</div>
    case 'cancelled':
      return <div className="status warn">Cancelled.</div>
    case 'error':
      return <div className="status error">Error: {status.message}</div>
    default:
      return <div className="status muted">Ready.</div>
  }
}
