import { useEffect, useMemo, useState } from 'react'
import { loadRead, saveRead, loadSaved, saveSaved, loadTheme, saveTheme, loadFont, saveFont } from './store.js'

const CATS = [['all', 'Tümü'], ['k', 'Kripto'], ['f', 'Fintech']]
const CAT_NAME = { k: 'Kripto', f: 'Fintech' }
const THEMES = { auto: 'Sistem', light: 'Açık', dark: 'Koyu' }

function ago(iso) {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso)) / 60000))
  if (m < 60) return `${Math.max(m, 1)} dk önce`
  if (m < 1440) return `${Math.floor(m / 60)} saat önce`
  return `${Math.floor(m / 1440)} gün önce`
}
function clock(iso) {
  return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
}

function Meta({ n }) {
  return (
    <div className="meta">
      <span className="src">{n.s}</span><span className="dot" />
      <span className="time">{ago(n.t)}</span><span className="dot" />
      <span className="tag">{CAT_NAME[n.c]}</span>
    </div>
  )
}

function Item({ n, hero, read, saved, onOpen, onSave }) {
  return (
    <div className="item">
      {hero ? (
        <button className={'hero' + (read ? ' read' : '')} onClick={() => onOpen(n)}>
          <span className="lab">Günün haberi</span>
          {n.n > 1 && <span className="badge">{n.n} kaynak yazdı</span>}
          <h3>{n.h}</h3>
          {n.p && <p>{n.p}</p>}
          <Meta n={n} />
        </button>
      ) : (
        <button className={'card' + (read ? ' read' : '')} onClick={() => onOpen(n)}>
          <Meta n={n} />
          <h3>{n.h}</h3>
          {n.p && <p>{n.p}</p>}
        </button>
      )}
      <button className="save" aria-pressed={saved} aria-label={saved ? 'Kaydı kaldır' : 'Kaydet'} onClick={() => onSave(n)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z" /></svg>
      </button>
    </div>
  )
}

function Reader({ n, font, setFont, onClose }) {
  const paras = n.body?.length ? n.body : [n.p].filter(Boolean)
  const onlySummary = paras.length <= 1
  return (
    <div className="reader" role="dialog" aria-label={n.h}>
      <div className="rbar">
        <button className="back" onClick={onClose}>‹ Geri</button>
        <span className="sp" />
        <button className="sz" aria-label="Yazıyı küçült" disabled={font <= 13} onClick={() => setFont(font - 2)}>A−</button>
        <button className="sz" aria-label="Yazıyı büyüt" disabled={font >= 21} onClick={() => setFont(font + 2)}>A+</button>
      </div>
      <div className="rbody" style={{ fontSize: font }}>
        <Meta n={n} />
        <h2>{n.h}</h2>
        {paras.map((p, i) => <p key={i}>{p}</p>)}
        {onlySummary && <p className="mute">Bu kaynak haberin sadece özetini paylaşıyor. Tamamı için aşağıdaki düğmeyi kullan.</p>}
        {n.also?.length > 0 && <p className="mute">Bu konuyu ayrıca şunlar da yazdı: {n.also.join(', ')}</p>}
      </div>
      <div className="rfoot">
        <a className="go" href={n.link} target="_blank" rel="noopener noreferrer">Siteye git ↗</a>
        <div className="hint">{n.s} sayfasını açar</div>
      </div>
    </div>
  )
}

export default function App() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(false)
  const [ch, setCh] = useState('tr')
  const [cat, setCat] = useState('all')
  const [nav, setNav] = useState('feed')
  const [open, setOpen] = useState(null)
  const [read, setRead] = useState(loadRead)
  const [saved, setSaved] = useState(loadSaved)
  const [theme, setTheme] = useState(loadTheme)
  const [font, setFontState] = useState(loadFont)

  useEffect(() => {
    fetch('./news.json?' + Math.floor(Date.now() / 60000)).then(r => r.json()).then(setData).catch(() => setError(true))
  }, [])
  useEffect(() => {
    const el = document.documentElement
    if (theme === 'auto') el.removeAttribute('data-theme'); else el.setAttribute('data-theme', theme)
    saveTheme(theme)
  }, [theme])

  const setFont = v => { setFontState(v); saveFont(v) }
  const openItem = n => { const r = { ...read, [n.id]: 1 }; setRead(r); saveRead(r); setOpen(n) }
  const toggleSave = n => {
    const next = saved.some(x => x.id === n.id) ? saved.filter(x => x.id !== n.id) : [n, ...saved]
    setSaved(next); saveSaved(next)
  }
  const cycleTheme = () => setTheme({ auto: 'light', light: 'dark', dark: 'auto' }[theme])

  const list = useMemo(() => (data?.[ch] ?? []).filter(n => cat === 'all' || n.c === cat), [data, ch, cat])
  const { hero, rest } = useMemo(() => {
    if (!list.length) return { hero: null, rest: [] }
    const h = list.reduce((a, b) => (b.n > a.n || (b.n === a.n && b.t > a.t) ? b : a))
    return { hero: h, rest: list.filter(n => n !== h) }
  }, [list])

  const itemProps = n => ({ n, read: !!read[n.id], saved: saved.some(x => x.id === n.id), onOpen: openItem, onSave: toggleSave })

  return (
    <div className="app">
      <header className="top">
        <span className="logo">WAGMI</span>
        <span className="upd">
          {data?.updated ? `Son güncelleme ${clock(data.updated)}` : ''}
          <button className="theme" onClick={cycleTheme} aria-label="Tema değiştir">{THEMES[theme]}</button>
        </span>
      </header>

      {nav === 'feed' && (
        <>
          <div className="tabs" role="tablist">
            {[['tr', 'Türkiye'], ['world', 'Dünya']].map(([k, label]) => (
              <button key={k} className="tab" role="tab" aria-selected={ch === k} onClick={() => setCh(k)}>{label}</button>
            ))}
          </div>
          <div className="chips">
            {CATS.map(([k, label]) => (
              <button key={k} className="chip" aria-pressed={cat === k} onClick={() => setCat(k)}>{label}</button>
            ))}
          </div>
        </>
      )}

      <main className="feed">
        {nav === 'saved' ? (
          saved.length
            ? <><div className="sec">Kaydedilenler</div>{saved.map(n => <Item key={n.id} {...itemProps(n)} />)}</>
            : <div className="empty">Henüz kaydettiğin haber yok.<br />Bir kartın sağ üstündeki yer imine dokun.</div>
        ) : error ? (
          <div className="empty">Haberler yüklenemedi. İnternet bağlantını kontrol edip uygulamayı yeniden aç.</div>
        ) : !data ? (
          <div className="empty">Haberler yükleniyor…</div>
        ) : !hero ? (
          <div className="empty">Bu filtrede şu an haber yok.</div>
        ) : (
          <>
            <Item {...itemProps(hero)} hero />
            {rest.length > 0 && <div className="sec">Diğer haberler</div>}
            {rest.map(n => <Item key={n.id} {...itemProps(n)} />)}
          </>
        )}
      </main>

      <nav className="nav">
        <button aria-selected={nav === 'feed'} onClick={() => setNav('feed')}>Akış</button>
        <button aria-selected={nav === 'saved'} onClick={() => setNav('saved')}>Kaydedilenler{saved.length ? ` (${saved.length})` : ''}</button>
      </nav>

      {open && <Reader n={open} font={font} setFont={setFont} onClose={() => setOpen(null)} />}
    </div>
  )
}
