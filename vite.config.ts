import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

// 事前キャッシュしないファイル（アプリの動作に使わないもの）
const PRECACHE_EXCLUDE = new Set(['sw.js', 'og-image.png'])

// ビルド結果（dist/）の全ファイルを事前キャッシュする Service Worker を dist/sw.js に書き出す。
// 版はファイルの中身から決めるので、ビルド結果が変わったときだけ Service Worker が更新される。
function serviceWorker(): Plugin {
  let root = ''
  let outDir = ''
  return {
    name: 'harmonic-bench:service-worker',
    apply: 'build',
    configResolved(config) {
      root = config.root
      outDir = resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      const files = readdirSync(outDir, { recursive: true, encoding: 'utf8' })
        .map((file) => file.split(sep).join('/'))
        .filter((file) => statSync(join(outDir, file)).isFile())
        .filter((file) => !PRECACHE_EXCLUDE.has(file) && !file.startsWith('_'))
        .sort()

      const template = readFileSync(resolve(root, 'src/sw.js'), 'utf8')
      const hash = createHash('sha256').update(template)
      for (const file of files) hash.update(file).update(readFileSync(join(outDir, file)))
      const version = hash.digest('hex').slice(0, 12)

      // Cloudflare は /index.html を / へリダイレクトするので、/ としてキャッシュする
      const urls = files.map((file) => (file === 'index.html' ? '/' : `/${file}`))
      const source = template
        .replace("'__VERSION__'", JSON.stringify(version))
        .replace("['__PRECACHE_URLS__']", JSON.stringify(urls))
      if (source.includes('__VERSION__') || source.includes('__PRECACHE_URLS__')) {
        throw new Error('src/sw.js のプレースホルダーを置き換えられませんでした')
      }
      writeFileSync(join(outDir, 'sw.js'), source)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), serviceWorker()],
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['./tests/setup.ts'],
  },
})
