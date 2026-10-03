/* eslint-disable */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')
const docsDir = path.join(rootDir, 'docs')

const IMAGE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.svg',
  '.bmp',
  '.ico',
  '.avif'
])

const isDryRun = process.argv.includes('--dry-run')

/**
 * 递归收集指定目录下所有匹配扩展名的文件路径
 * @param {string} dir
 * @param {(filePath: string) => boolean} filter
 * @returns {string[]}
 */
function walkDir(dir, filter) {
  const results = []
  if (!fs.existsSync(dir)) return results

  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...walkDir(fullPath, filter))
    } else if (entry.isFile() && filter(fullPath)) {
      results.push(fullPath)
    }
  }
  return results
}

/**
 * 从文本中提取所有引用的图片文件名
 * @param {string} content
 * @returns {Set<string>}
 */
function extractImageReferences(content) {
  const referencedNames = new Set()

  // 1. Markdown 图片语法: ![alt](url)
  const mdImgRegex = /!\[.*?\]\((.*?)\)/g
  let match
  while ((match = mdImgRegex.exec(content)) !== null) {
    addRef(match[1])
  }

  // 2. HTML <img> 标签: <img src="url" />
  const htmlImgRegex = /<img\b[^>]*?\bsrc=["'](.*?)["']/gi
  while ((match = htmlImgRegex.exec(content)) !== null) {
    addRef(match[1])
  }

  // 3. Markdown 普通超链接若指向图片: [link](url.png)
  const mdLinkRegex = /\[.*?\]\((.*?)\)/g
  while ((match = mdLinkRegex.exec(content)) !== null) {
    addRef(match[1])
  }

  function addRef(rawUrl) {
    if (!rawUrl) return
    // 去除查询参数与 hash
    const cleanUrl = rawUrl.trim().split('?')[0].split('#')[0]
    let decoded = cleanUrl
    try {
      decoded = decodeURIComponent(cleanUrl)
    } catch {
      // 保留原始字符串
    }
    const ext = path.extname(decoded).toLowerCase()
    if (IMAGE_EXTENSIONS.has(ext)) {
      referencedNames.add(path.basename(decoded))
    }
  }

  return referencedNames
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function run() {
  if (!fs.existsSync(docsDir)) {
    console.log(`[clean-imgs] docs 目录不存在: ${docsDir}`)
    return
  }

  console.log(`[clean-imgs] 扫描 docs 目录下的 Markdown 文档与图片资源...`)

  // 1. 获取所有 .md 文档
  const mdFiles = walkDir(docsDir, (file) => file.endsWith('.md'))
  const allReferencedImages = new Set()

  for (const mdFile of mdFiles) {
    const content = fs.readFileSync(mdFile, 'utf-8')
    const refs = extractImageReferences(content)
    for (const ref of refs) {
      allReferencedImages.add(ref)
    }
  }

  console.log(
    `[clean-imgs] 扫描到 ${mdFiles.length} 个 Markdown 文档，共引用 ${allReferencedImages.size} 张图片`
  )

  // 2. 获取 docs 目录下所有物理图片文件
  const diskImageFiles = walkDir(docsDir, (file) => {
    const ext = path.extname(file).toLowerCase()
    return IMAGE_EXTENSIONS.has(ext)
  })

  // 3. 找出未被引用的孤儿图片
  const orphanFiles = []
  let totalOrphanBytes = 0

  for (const imagePath of diskImageFiles) {
    const baseName = path.basename(imagePath)
    if (!allReferencedImages.has(baseName)) {
      const stats = fs.statSync(imagePath)
      orphanFiles.push({ path: imagePath, size: stats.size })
      totalOrphanBytes += stats.size
    }
  }

  if (orphanFiles.length === 0) {
    console.log(`[clean-imgs] 未发现孤儿图片，文档图片目录整洁。`)
    return
  }

  console.log(
    `\n[clean-imgs] 发现 ${orphanFiles.length} 个未被任何文档引用的孤儿图片 (共计 ${formatBytes(totalOrphanBytes)}):`
  )
  for (const orphan of orphanFiles) {
    const relPath = path.relative(rootDir, orphan.path)
    console.log(`   - ${relPath} (${formatBytes(orphan.size)})`)
  }

  if (isDryRun) {
    console.log(
      `\n[clean-imgs] 当前为 --dry-run 预览模式，未执行真实删除。若要清理，请执行不带该参数的命令。`
    )
    return
  }

  // 4. 执行删除
  for (const orphan of orphanFiles) {
    fs.unlinkSync(orphan.path)
  }

  console.log(
    `\n[clean-imgs] 已成功清理 ${orphanFiles.length} 个孤儿图片，释放磁盘空间 ${formatBytes(totalOrphanBytes)}。`
  )
}

run()
