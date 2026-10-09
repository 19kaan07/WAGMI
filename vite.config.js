import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' : site GitHub Pages'te alt klasörde (…github.io/wagmi/) yayınlandığı için göreli yollar kullanılır.
export default defineConfig({ base: './', plugins: [react()] })
