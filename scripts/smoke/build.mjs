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
    build.onResolve({ filter: /^\.\.\/configService$/ }, () => ({ path: configShimPath }))
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
  external: ['koishipro-core.js', 'sql.js', 'ygopro-msg-encode'],
  logLevel: 'info'
}

await esbuild.build({
  ...commonOptions,
  entryPoints: [path.join(root, 'scripts/smoke/field-reader-main.ts')],
  outfile: 'scripts/smoke/field-reader-main.bundle.cjs'
})

await esbuild.build({
  ...commonOptions,
  entryPoints: [path.join(root, 'scripts/smoke/session-smoke.ts')],
  outfile: 'scripts/smoke/session-smoke.bundle.cjs'
})

await esbuild.build({
  ...commonOptions,
  entryPoints: [path.join(root, 'scripts/smoke/attack-smoke.ts')],
  outfile: 'scripts/smoke/attack-smoke.bundle.cjs'
})

await esbuild.build({
  ...commonOptions,
  entryPoints: [path.join(root, 'scripts/smoke/atk-propagation-smoke.ts')],
  outfile: 'scripts/smoke/atk-propagation-smoke.bundle.cjs'
})

await esbuild.build({
  ...commonOptions,
  entryPoints: [path.join(root, 'scripts/smoke/inject-smoke.ts')],
  outfile: 'scripts/smoke/inject-smoke.bundle.cjs'
})

await esbuild.build({
  ...commonOptions,
  entryPoints: [path.join(root, 'scripts/smoke/hand-shuffle-smoke.ts')],
  outfile: 'scripts/smoke/hand-shuffle-smoke.bundle.cjs'
})

await esbuild.build({
  ...commonOptions,
  entryPoints: [path.join(root, 'scripts/smoke/policy-smoke.ts')],
  outfile: 'scripts/smoke/policy-smoke.bundle.cjs'
})

await esbuild.build({
  ...commonOptions,
  entryPoints: [path.join(root, 'scripts/smoke/provenance-smoke.ts')],
  outfile: 'scripts/smoke/provenance-smoke.bundle.cjs'
})

await esbuild.build({
  ...commonOptions,
  entryPoints: [path.join(root, 'scripts/smoke/session-doc-smoke.ts')],
  outfile: 'scripts/smoke/session-doc-smoke.bundle.cjs'
})
