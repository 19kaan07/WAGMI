# WAGMI

Kripto ve fintech haberlerini günlük gösteren uygulama (Türkiye + Dünya kanalı). Sahibi Kaan yazılımcı değil: her şeyi Türkçe, adım adım, sade anlat; acele ettirme. Evimiz ve Diligenc3'ten bağımsız bir proje.

## Kurallar (Kaan'ın isteği)
- Kaan onay vermeden uygulama/depo üzerinde işlem yapma; önce tasarımı göster.
- Ücretsiz çözümler, **kart yok**. Sunucu yok, veritabanı yok.

## Yapı
- React + Vite PWA (`src/`). Okunanlar, kaydedilenler, tema ve yazı boyutu sadece telefonda (`localStorage`, `src/store.js`).
- Haberler: `scripts/sources.json` içindeki RSS adreslerinden `scripts/fetch-news.mjs` çeker, `public/news.json` yazar (git'e girmez).
  - Aynı konuyu yazan kaynaklar sayılır (`n`); aynı grubun siteleri (`group`) tek sayılır. "Günün haberi" = en çok kaynağın yazdığı haber.
  - RSS adresleri sandbox'ta doğrulanamadı; çalışmayan adres Actions günlüğünde `HATA` olarak görünür.
- Yayın: `.github/workflows/yayin.yml` her 30 dakikada çek → derle → GitHub Pages. (Zamanlanmış çalışma yalnızca `main` dalında çalışır.)
- Bildirim: Telegram botu (`scripts/notify.mjs`, `.github/workflows/bildirim.yml`). Gün içi: son 4 saatte en az 3 kaynağın yazdığı haber, günde en fazla 3, 23:00-08:00 sessiz. Sabah 09:00 (TR): her kanaldan en çok yazılan 5 haber. Gizli ayarlar: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` (birden fazla kişi için numaralar virgülle: `123,456`; her alıcı botu bir kez Başlat demiş olmalı). Gönderilenlerin kaydı Actions önbelleğinde (`notify-state.json`). Elle deneme: Actions → Telegram bildirimi → Run workflow → `test`.
- X ve LinkedIn'den çekmiyoruz (ücretsiz API yok). Telegram şimdilik dışarıda.

## Komutlar
- `npm run dev` yerelde çalıştır (önce `npm run news` ile haberleri çek), `npm run build` derle, `npm run icons` logo değişince ikonları üret.
- Kod değişince önce `npm run build` ile derle, sonra commit.
