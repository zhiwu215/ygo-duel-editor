// 冒烟测试打包配置（esbuild JS API）
import path from 'path'
import { createRequire } from 'module'

// 项目未直接依赖 esbuild；vite 依赖它，用 vite 的 require 上下文解析
const viteRequire = createRequire(
  path.join(
    path.dirname(createRequire(import.meta.url).resolve('vite/package.json')),
    'package.json'
  )
)
const esbuild = await import(pathToFileUrl(viteRequire.resolve('esbuild')))

function pathToFileUrl(p) {
  return 'file:///' + p.replace(/\\/g, '/')
}

const root = path.resolve(import.meta.dirname, '../..')

const cdbShimPath = path.join(root, 'scripts/smoke/cdb-shim.ts')
const configShimPath = path.join(root, 'scripts/smoke/config-shim.ts')
const engineShimPath = path.join(root, 'scripts/smoke/ocgcore-engine-shim.ts')
const shimPlugin = {
  name: 'smoke-shims',
  setup(build) {
    build.onResolve({ filter: /^\.\.\/\.\.\/db\/cdbService$/ }, () => ({ path: cdbShimPath }))
    build.onResolve({ filter: /^(\.\.\/|\.\.\/\.\.\/|\.\/)configService$/ }, () => ({
      path: configShimPath
    }))
    build.onResolve({ filter: /^\.\/ocgcore-engine$/ }, () => ({ path: engineShimPath }))
  }
}
const commonOptions = {
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  alias: {
    '@shared': path.join(root, 'src/shared'),
    // 强制全 CJS：koishipro/ygopro 的 ESM 构建在纯 node 下有兼容问题，
    // 且 CJS/ESM 两构建的类不相等——必须统一到 CJS
    'koishipro-core.js': path.join(root, 'node_modules/koishipro-core.js/dist/index.cjs'),
    'ygopro-msg-encode': path.join(root, 'node_modules/ygopro-msg-encode/dist/index.cjs')
  },
  plugins: [shimPlugin],
  external: ['koishipro-core.js', 'sql.js', 'ygopro-msg-encode', 'better-sqlite3'],
  logLevel: 'info'
}

const entries = [
  'field-reader-main',
  'language-pack-smoke',
  'real-language-smoke',
  'session-smoke',
  'attack-smoke',
  'atk-propagation-smoke',
  'inject-smoke',
  'placeholder-convert-smoke',
  'placeholder-game-smoke',
  'renderer-inject-smoke',
  'renderer-repos-smoke',
  'renderer-turn-steps-smoke',
  'hand-shuffle-smoke',
  'hand-shuffle-timing-smoke',
  'lua-placement-smoke',
  'announce-order-smoke',
  'policy-smoke',
  'provenance-smoke',
  'tag-card-edit-smoke',
  'session-doc-smoke',
  'yrp-export-smoke',
  'yrp-tag-smoke',
  'tag-replay-smoke',
  'replay-import-smoke',
  'hand-idle-smoke',
  'hand-menu-smoke',
  'deck-dup-smoke',
  'engine-start-dup-smoke',
  'turn-progression-smoke',
  'editor-battle-smoke',
  'undo-opening-smoke',
  'reset-duel-smoke',
  'hand-open-smoke',
  'scene-opening-smoke',
  'autosave-smoke',
  'session-suspend-smoke',
  'card-relations-smoke',
  'start-over-dup-smoke'
]

let failed = 0
for (const name of entries) {
  try {
    await esbuild.build({
      ...commonOptions,
      entryPoints: [path.join(root, `scripts/smoke/${name}.ts`)],
      outfile: `scripts/smoke/${name}.bundle.cjs`
    })
  } catch (err) {
    failed++
    console.error(`[smoke-build] ${name} 构建失败: ${err.errors?.[0]?.text ?? err.message}`)
  }
}
if (failed > 0) process.exitCode = 1
