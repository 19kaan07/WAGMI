// public/icon.svg dosyasından telefon ikonlarını üretir. Logo değişirse: npm run icons
import sharp from 'sharp'
const svg = new URL('../public/icon.svg', import.meta.url).pathname
for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  await sharp(svg, { density: 300 }).resize(size, size).png().toFile(new URL('../public/' + name, import.meta.url).pathname)
}
console.log('ikonlar hazır')
