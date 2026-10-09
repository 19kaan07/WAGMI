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
- X ve LinkedIn'den çekmiyoruz (ücretsiz API yok). Telegram şimdilik dışarıda.

## Komutlar
- `npm run dev` yerelde çalıştır (önce `npm run news` ile haberleri çek), `npm run build` derle, `npm run icons` logo değişince ikonları üret.
- Kod değişince önce `npm run build` ile derle, sonra commit.
