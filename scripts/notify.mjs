// Telegram bildirimleri. Kullanım: node scripts/notify.mjs [breaking|morning|test]
//   breaking: son saatlerde en az 3 kaynağın yazdığı yeni haberi gönderir (günde en fazla 3, gece sessiz)
//   morning : her kanaldan son 24 saatin en çok yazılan 5 haberini tek mesajda gönderir
//   test    : bağlantıyı denemek için kısa bir mesaj gönderir
// Gizli ayarlar (GitHub Actions): TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID. DRY_RUN=1 ise mesajları göndermez, yazdırır.
import { readFile, writeFile } from 'node:fs/promises'

const mode = process.argv[2] ?? 'breaking'
const TOKEN = process.env.TELEGRAM_BOT_TOKEN
const CHAT = process.env.TELEGRAM_CHAT_ID
const DRY = process.env.DRY_RUN === '1'
const STATE = new URL('../notify-state.json', import.meta.url)
const NEWS = new URL('../public/news.json', import.meta.url)

const MIN_SOURCES = 3          // "olay yaratan": en az bu kadar ayrı kaynak yazmış olmalı
const MAX_PER_DAY = 3          // gün içi bildirim sınırı
const FRESH_MS = 4 * 3600e3    // sadece son 4 saatte çıkan haber
const TZ = 'Europe/Istanbul'

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const cut = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s)
const hourTR = d => Number(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false }).format(d)) % 24
const dayTR = d => new Date(d).toLocaleDateString('sv-SE', { timeZone: TZ })
const byImportance = (a, b) => b.n - a.n || b.t.localeCompare(a.t)

async function send(text) {
  if (DRY) { console.log('--- (deneme, gönderilmedi)\n' + text + '\n'); return }
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT, text, parse_mode: 'HTML', disable_web_page_preview: true }),
    signal: AbortSignal.timeout(20000)
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok || !j.ok) throw new Error(`Telegram hatası: ${j.description ?? r.status}`)
}

async function readJson(url, fallback) {
  try { return JSON.parse(await readFile(url, 'utf8')) } catch { return fallback }
}

if (!DRY && (!TOKEN || !CHAT)) {
  if (mode === 'test') { console.error('TELEGRAM_BOT_TOKEN ve TELEGRAM_CHAT_ID gizli ayarları eklenmemiş.'); process.exit(1) }
  console.log('Telegram ayarı yok, bildirim atlandı.')
  process.exit(0)
}

if (mode === 'test') {
  await send('WAGMI Telegram bağlantısı çalışıyor ✅\nBundan sonra buraya günün önemli haberleri ve sabah özeti gelecek.')
  console.log('Test mesajı gönderildi.')
  process.exit(0)
}

const news = await readJson(NEWS, null)
if (!news?.updated) { console.log('news.json boş, bildirim atlandı.'); process.exit(0) }
const now = Date.now()

if (mode === 'morning') {
  const blocks = []
  for (const [key, title] of [['tr', 'Türkiye'], ['world', 'Dünya']]) {
    const top = (news[key] ?? []).filter(n => now - new Date(n.t) <= 24 * 3600e3).sort(byImportance).slice(0, 5)
    if (!top.length) continue
    blocks.push(`<b>${title}</b>\n` + top.map(n => {
      const badge = n.n > 1 ? ` (${n.n} kaynak)` : ''
      const sum = n.p ? `\n${esc(cut(n.p, 140))}` : ''
      return `• <a href="${esc(n.link)}">${esc(n.h)}</a>${badge}${sum}`
    }).join('\n\n'))
  }
  if (!blocks.length) { console.log('Son 24 saatte haber yok, sabah özeti atlandı.'); process.exit(0) }
  await send('☀️ <b>Günaydın, WAGMI sabah özeti</b>\n\n' + blocks.join('\n\n'))
  console.log('Sabah özeti gönderildi.')
  process.exit(0)
}

// ---- breaking ----
const h = hourTR(new Date())
if (h >= 23 || h < 8) { console.log('Gece sessiz saati, bildirim atlandı.'); process.exit(0) }

const state = await readJson(STATE, { sent: {} })
for (const [id, t] of Object.entries(state.sent)) if (now - new Date(t) > 3 * 86400e3) delete state.sent[id]
const today = dayTR(now)
let left = MAX_PER_DAY - Object.values(state.sent).filter(t => dayTR(t) === today).length

const candidates = [...(news.tr ?? []), ...(news.world ?? [])]
  .filter(n => n.n >= MIN_SOURCES && !state.sent[n.id] && now - new Date(n.t) <= FRESH_MS)
  .sort(byImportance)

let count = 0
for (const n of candidates) {
  if (left <= 0) break
  const also = n.also?.length ? `\nBunu yazanlar: ${esc([n.s, ...n.also].join(', '))}` : ''
  const sum = n.p ? `\n${esc(cut(n.p, 200))}` : ''
  await send(`🔥 <b>Olay yaratan haber</b> · ${n.n} kaynak yazdı\n<a href="${esc(n.link)}">${esc(n.h)}</a>${sum}${also}`)
  state.sent[n.id] = new Date().toISOString()
  await writeFile(STATE, JSON.stringify(state))   // her gönderimden sonra kaydet: yarıda kesilirse tekrar gitmesin
  left--; count++
}
await writeFile(STATE, JSON.stringify(state))
console.log(`${candidates.length} aday haber, ${count} bildirim gönderildi (günlük kalan hak: ${left}).`)
