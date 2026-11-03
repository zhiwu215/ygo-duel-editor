import { readdir, readFile, rm, stat } from 'node:fs/promises'
import path from 'node:path'

const IMAGE_EXTENSIONS = new Set([
  '.avif',
  '.bmp',
  '.gif',
  '.ico',
  '.jpeg',
  '.jpg',
  '.png',
  '.svg',
  '.webp'
])
const TEXT_EXTENSIONS = new Set([
  '.canvas',
  '.csv',
  '.htm',
  '.html',
  '.json',
  '.jsonc',
  '.markdown',
  '.md',
  '.mdx',
  '.svg',
  '.txt',
  '.yaml',
  '.yml'
])
const SKIPPED_DIRECTORIES = new Set(['.git', 'node_modules'])
const TEXT_SCAN_LIMIT = 8 * 1024 * 1024
const HELP = `删除 docs 目录下没有被任何文档引用的图片（默认只预览，不删除）

用法:
  node scripts/prune-docs-images.mjs [选项]

选项:
  --docs <目录>  文档根目录，默认 ./docs
  --delete       真正删除未引用的图片
  -h, --help     显示帮助

示例:
  node scripts/prune-docs-images.mjs
  node scripts/prune-docs-images.mjs --delete
  node scripts/prune-docs-images.mjs --docs docs/使用教程`

function parseArgs(args) {
  const options = { docs: 'docs', delete: false, help: false }
  for (let index = 0; index < args.length; index++) {
    const arg = args[index]
    if (arg === '--help' || arg === '-h') options.help = true
    else if (arg === '--delete') options.delete = true
    else if (arg === '--') continue
    else if (arg === '--docs' || arg.startsWith('--docs=')) {
      const value = arg === '--docs' ? args[++index] : arg.slice('--docs='.length)
      if (!value) throw new Error('--docs 缺少目录参数')
      options.docs = value
    } else throw new Error(`未知参数: ${arg}`)
  }
  return options
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      if (SKIPPED_DIRECTORIES.has(entry.name)) continue
      files.push(...(await collectFiles(fullPath)))
    } else if (entry.isFile()) files.push(fullPath)
  }
  return files
}

async function collectImages(files) {
  const images = []
  for (const file of files) {
    const extension = path.extname(file).toLowerCase()
    if (!IMAGE_EXTENSIONS.has(extension)) continue
    const { size } = await stat(file)
    images.push({ file, name: path.basename(file).toLowerCase(), size })
  }
  return images.sort((left, right) => left.file.localeCompare(right.file))
}

async function collectDocumentTexts(files) {
  const texts = []
  for (const file of files) {
    if (!TEXT_EXTENSIONS.has(path.extname(file).toLowerCase())) continue
    if ((await stat(file)).size > TEXT_SCAN_LIMIT) continue
    texts.push((await readFile(file, 'utf8')).toLowerCase())
  }
  return texts
}

function imageNameVariants(name) {
  return new Set([name, encodeURIComponent(name).toLowerCase()])
}

function findReferencedNames(images, texts) {
  const owners = new Map()
  for (const image of images) {
    for (const variant of imageNameVariants(image.name)) {
      if (!owners.has(variant)) owners.set(variant, new Set())
      owners.get(variant).add(image.name)
    }
  }
  const alternatives = [...owners.keys()]
    .sort((left, right) => right.length - left.length)
    .map(escapeRegExp)
  const pattern = new RegExp(`(?<![\\w.-])(?:${alternatives.join('|')})(?![\\w.-])`, 'g')
  const names = new Set()
  for (const text of texts) {
    for (const match of text.matchAll(pattern)) {
      for (const name of owners.get(match[0])) names.add(name)
    }
  }
  return names
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    console.log(HELP)
    return
  }

  const docsDir = path.resolve(options.docs)
  const docsStat = await stat(docsDir).catch(() => null)
  if (!docsStat?.isDirectory()) throw new Error(`文档目录不存在: ${docsDir}`)

  const files = await collectFiles(docsDir)
  const images = await collectImages(files)
  if (images.length === 0) {
    console.log(`${docsDir} 下没有图片。`)
    return
  }
  const documents = await collectDocumentTexts(files)

  const referenced = findReferencedNames(images, documents)
  const unused = images.filter((image) => !referenced.has(image.name))
  const totalSize = images.reduce((sum, image) => sum + image.size, 0)
  const unusedSize = unused.reduce((sum, image) => sum + image.size, 0)
  console.log(`文档目录: ${docsDir}`)
  console.log(`扫描文档: ${documents.length} 个`)
  console.log(
    `图片引用: ${images.length - unused.length}/${images.length} 张，共 ${formatSize(totalSize)}`
  )

  if (unused.length === 0) {
    console.log('没有未引用的图片。')
    return
  }

  const rows = unused.map((image) => ({
    label: path.relative(docsDir, image.file).split(path.sep).join('/'),
    size: image.size
  }))
  const labelWidth = Math.max(...rows.map((row) => row.label.length))
  console.log(`\n未引用图片 ${unused.length} 张，共 ${formatSize(unusedSize)}:`)
  for (const row of rows) {
    console.log(`  ${row.label.padEnd(labelWidth)}  ${formatSize(row.size).padStart(9)}`)
  }

  if (!options.delete) {
    console.log('\n预览模式未删除任何文件；确认无误后加 --delete 执行删除。')
    return
  }

  for (const image of unused) await rm(image.file)
  console.log(`\n已删除 ${unused.length} 张图片，释放 ${formatSize(unusedSize)}。`)
}

try {
  await main()
} catch (error) {
  console.error(`[prune-docs-images] ${error.message}`)
  process.exitCode = 1
}
