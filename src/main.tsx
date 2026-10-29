import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/app.css'
import App from './App.tsx'

const root = document.getElementById('root')
if (!root) throw new Error('#root 要素が見つかりません')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// PWA: オフラインで起動できるようにする。dist/sw.js はビルド時に生成するので、本番ビルドでだけ登録する
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
      console.warn('Service Worker を登録できませんでした', error)
    })
  })
}
