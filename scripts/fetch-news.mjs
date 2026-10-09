// RSS kaynaklarından haberleri çeker, aynı konuyu yazan kaynakları sayar ve public/news.json'a yazar.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { XMLParser } from 'fast-xml-parser'

const OUT = new URL('../public/news.json', import.meta.url)
const SOURCES = JSON.parse(await readFile(new URL(process.env.SOURCES_FILE ?? './sources.json', import.meta.url), 'utf8'))
const MAX_AGE_MS = 48 * 3600 * 1000
const MAX_PER_CHANNEL = 40

const CRYPTO = /bitcoin|btc|ethereum|\beth\b|kripto|crypto|coin|token|blockchain|blokzincir|stablecoin|defi|nft|binance|solana|ripple|\bxrp\b|altcoin|web3|borsa.*kripto/i
const FINTECH = /fintech|banka|bank|ödeme|odeme|payment|payments|neobank|kredi|lending|visa|mastercard|swift|paypal|stripe|sigorta|insurtech|regtech|open banking|dijital para|cbdc/i

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', textNodeName: '#text', cdataPropName: '__cdata' })
const ENT = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&nbsp;': ' ' }

function text(v) {
  if (v == null) return ''
  if (typeof v === 'string' || typeof v === 'number') return String(v)
  if (Array.isArray(v)) return text(v[0])
  if (v.__cdata != null) return text(v.__cdata)
  if (v['#text'] != null) return text(v['#text'])
  return ''
}
function decode(s) {
  return s.replace(/&(amp|lt|gt|quot|apos|nbsp|#39);/g, m => ENT[m]).replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
}
// HTML'i düz paragraflara çevirir (güvenli: uygulamada HTML olarak gösterilmez).
function toParagraphs(html) {
  const raw = decode(html)
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<\/(p|div|li|h\d|blockquote)>|<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
  return decode(raw)
    .split(/\n+/)
    .map(x => x.replace(/\s+/g, ' ').trim())
    .filter(x => x.length > 0 && !/appeared first on|The post .* appeared|Continue reading|Devamını oku/i.test(x))
}
function safeLink(u) {
  try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : '' } catch { return '' }
}

async function load(src) {
  if (src.url.startsWith('file:')) return readFile(new URL(src.url), 'utf8')
  const r = await fetch(src.url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WAGMI-news/1.0)', Accept: 'application/rss+xml, application/xml, text/xml, */*' }, signal: AbortSignal.timeout(20000), redirect: 'follow' })
  if (!r.ok) throw new Error('HTTP ' + r.status)
  return r.text()
}

function parseFeed(xml) {
  const j = parser.parse(xml)
  let items = j?.rss?.channel?.item ?? j?.feed?.entry ?? j?.['rdf:RDF']?.item ?? []
  if (!Array.isArray(items)) items = [items]
  return items.map(it => {
    const link = typeof it.link === 'object' && !Array.isArray(it.link) ? (it.link['@_href'] ?? text(it.link)) : Array.isArray(it.link) ? (it.link[0]?.['@_href'] ?? text(it.link[0])) : text(it.link)
    const date = text(it.pubDate) || text(it.published) || text(it.updated) || text(it['dc:date'])
    const body = text(it['content:encoded']) || text(it.content) || text(it.description) || text(it.summary)
    return { title: decode(text(it.title)).replace(/\s+/g, ' ').trim(), link: safeLink(link.trim()), date: new Date(date).getTime(), html: body }
  })
}

function classify(src, title, summary) {
  const t = title + ' ' + summary
  if (src.cat === 'f') return CRYPTO.test(title) ? 'k' : 'f'
  if (src.cat === 'k') return FINTECH.test(title) && !CRYPTO.test(title) ? 'f' : 'k'
  return CRYPTO.test(t) ? 'k' : 'f'
}

const STOP = new Set('the and for with from that this are was has have into over after will its about their than they but not you your new says say yeni ile için bir ve bu da de daha olarak sonra kadar gibi çok ise oldu olan'.split(' '))
function tokens(title) {
  return new Set(title.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(w => w.length > 2 && !STOP.has(w)))
}
function similar(a, b) {
  let shared = 0
  for (const w of a) if (b.has(w)) shared++
  if (shared < 3) return false
  return shared / (a.size + b.size - shared) >= 0.4 || shared / Math.min(a.size, b.size) >= 0.7
}

const now = Date.now()
const report = []
const all = []
await Promise.all(SOURCES.map(async (src, order) => {
  try {
    const entries = parseFeed(await load(src))
    let kept = 0
    for (const e of entries) {
      if (!e.title || !e.link || !(e.date <= now + 3600e3) || now - e.date > MAX_AGE_MS) continue
      const paras = toParagraphs(e.html)
      const summary = (paras[0] ?? '').slice(0, 220)
      if (src.filter && !(CRYPTO.test(e.title + ' ' + summary) || FINTECH.test(e.title + ' ' + summary))) continue
      all.push({ src, order, e, paras, summary, cat: classify(src, e.title, summary) })
      kept++
    }
    report.push(`OK    ${src.name}: ${entries.length} haber, ${kept} tanesi son 48 saatte`)
  } catch (err) {
    report.push(`HATA  ${src.name}: ${err.message}  (${src.url})`)
  }
}))

const out = { updated: new Date().toISOString(), tr: [], world: [] }
for (const channel of ['tr', 'world']) {
  const list = all.filter(x => x.src.channel === channel).sort((a, b) => a.order - b.order || b.e.date - a.e.date)
  const clusters = []
  for (const x of list) {
    x.tok = tokens(x.e.title)
    const c = clusters.find(c => c.items.some(y => y.src.id !== x.src.id && similar(x.tok, y.tok)) || c.items.some(y => y.e.link === x.e.link))
    if (c) c.items.push(x); else clusters.push({ items: [x] })
  }
  const items = clusters.map(c => {
    const main = c.items.slice().sort((a, b) => b.paras.join(' ').length - a.paras.join(' ').length || a.order - b.order)[0]
    const groups = new Set(c.items.map(y => y.src.group ?? y.src.id))
    const others = [...new Set(c.items.filter(y => y.src.id !== main.src.id).map(y => y.src.name))]
    let len = 0
    const body = main.paras.filter(p => (len += p.length) < 3000).slice(0, 8)
    return {
      id: createHash('sha1').update(main.e.link).digest('hex').slice(0, 10),
      s: main.src.name, t: new Date(main.e.date).toISOString(), h: main.e.title, p: main.summary,
      body, link: main.e.link, c: main.cat, n: groups.size, also: others
    }
  }).sort((a, b) => b.t.localeCompare(a.t)).slice(0, MAX_PER_CHANNEL)
  out[channel] = items
}

await mkdir(new URL('../public/', import.meta.url), { recursive: true })
await writeFile(OUT, JSON.stringify(out))
console.log(report.sort().join('\n'))
console.log(`\nTürkiye: ${out.tr.length} haber, Dünya: ${out.world.length} haber`)
