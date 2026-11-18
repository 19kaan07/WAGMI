// WAGMI tetikleyici (Cloudflare Worker)
// GitHub'ın kendi zamanlayıcısı güvenilir olmadığı için Cloudflare'in zamanlayıcısı GitHub'a "şimdi çalış" der.
//   Her 30 dakikada bir : haberleri yenile + gün içi olay haberi kontrolü
//   Her gün 06:00 UTC   : (= 09:00 Türkiye) Telegram sabah özeti
// Cloudflare'de Cron Triggers: "*/30 * * * *" ve "0 6 * * *" (iki satır)
// Gizli ayar: GITHUB_TOKEN (sadece WAGMI deposu, Actions: Read and write izinli anahtar)

const REPO = '19kaan07/WAGMI';
const BRANCH = 'main';

async function dispatch(env, workflow, inputs = {}) {
  const r = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${workflow}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'wagmi-tetikleyici',
      'content-type': 'application/json'
    },
    body: JSON.stringify({ ref: BRANCH, inputs })
  });
  if (r.status !== 204) throw new Error(`${workflow}: GitHub ${r.status} ${(await r.text()).slice(0, 200)}`);
}

async function run(cron, env) {
  const jobs = cron === '0 6 * * *'
    ? [['bildirim.yml', { mod: 'morning' }]]
    : [['yayin.yml'], ['bildirim.yml', { mod: 'breaking' }]];
  // Biri başarısız olsa da diğeri denensin
  const results = await Promise.allSettled(jobs.map(([wf, inputs]) => dispatch(env, wf, inputs)));
  const errors = results.filter((x) => x.status === 'rejected').map((x) => x.reason.message);
  if (errors.length) throw new Error(errors.join(' | '));
}

export default {
  async scheduled(event, env, ctx) {
    // Hata olursa metni günlüğe yaz (Cloudflare → Observability → Logs), yoksa sadece "exception" görünür.
    ctx.waitUntil(
      run(event.cron, env).then(
        () => console.log(`OK ${event.cron}`),
        (e) => { console.error(`HATA ${event.cron}: ${e.message}`); throw e; }
      )
    );
  },
  // Tarayıcıdan adresi açınca çalıştığını görmek için (hiçbir şey tetiklemez)
  async fetch() {
    return new Response('WAGMI tetikleyici çalışıyor.');
  }
};
