// Okunanlar, kaydedilenler ve tema sadece bu telefonda (localStorage) tutulur.
function get(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback } catch { return fallback }
}
function set(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* özel sekme vb. */ }
}
export const loadRead = () => get('wagmi.read', {})
export const saveRead = v => set('wagmi.read', v)
export const loadSaved = () => get('wagmi.saved', [])
export const saveSaved = v => set('wagmi.saved', v)
export const loadTheme = () => get('wagmi.theme', 'auto')
export const saveTheme = v => set('wagmi.theme', v)
export const loadFont = () => get('wagmi.font', 15)
export const saveFont = v => set('wagmi.font', v)
