import { BrowserWindow, dialog } from 'electron'
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'fs'
import { extname, join } from 'path'
import { CustomCard, CustomCardPickImageResult } from '@shared/index'

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif']

function isCardImageFile(name: string, id: number): boolean {
  const ext = extname(name).toLocaleLowerCase()
  return IMAGE_EXTENSIONS.includes(ext) && name.slice(0, name.length - ext.length) === String(id)
}

export function findCustomCardImage(imageDir: string, id: number): string | null {
  try {
    if (!existsSync(imageDir)) return null
    for (const name of readdirSync(imageDir)) {
      if (isCardImageFile(name, id)) return join(imageDir, name)
    }
  } catch (err) {
    console.error('[CustomCardService] find image error:', err)
  }
  return null
}

export function removeCustomCardImages(imageDir: () => string, id: number): void {
  if (!existsSync(imageDir())) return
  for (const name of readdirSync(imageDir())) {
    if (isCardImageFile(name, id)) rmSync(join(imageDir(), name))
  }
}

export function applyCustomCardImage(
  id: number,
  imageSourcePath: string | undefined,
  imageDir: () => string
): void {
  if (!imageSourcePath) return
  try {
    if (!existsSync(imageSourcePath)) {
      console.warn(`[CustomCardService] picked image not found: ${imageSourcePath}`)
      return
    }
    mkdirSync(imageDir(), { recursive: true })
    removeCustomCardImages(imageDir, id)
    const targetExt = extname(imageSourcePath).toLocaleLowerCase() || '.jpg'
    copyFileSync(imageSourcePath, join(imageDir(), `${id}${targetExt}`))
  } catch (err) {
    console.error('[CustomCardService] apply image error:', err)
  }
}

export async function pickCustomCardImage(): Promise<CustomCardPickImageResult> {
  const picked = await dialog.showOpenDialog(BrowserWindow.getFocusedWindow()!, {
    title: '导入自定义卡片图片',
    properties: ['openFile'],
    filters: [
      { name: '图片', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'] },
      { name: '所有文件', extensions: ['*'] }
    ]
  })
  if (picked.canceled || picked.filePaths.length === 0) return { success: false, canceled: true }
  const source = picked.filePaths[0]
  if (!existsSync(source)) return { success: false, error: '文件不存在' }
  const ext = extname(source).toLocaleLowerCase()
  const mime =
    ext === '.png'
      ? 'image/png'
      : ext === '.webp'
        ? 'image/webp'
        : ext === '.gif'
          ? 'image/gif'
          : 'image/jpeg'
  let previewDataUrl: string | undefined
  try {
    previewDataUrl = `data:${mime};base64,${readFileSync(source).toString('base64')}`
  } catch (err) {
    console.error('[CustomCardService] read picked image error:', err)
  }
  return { success: true, filePath: source, previewDataUrl }
}

export async function pickAndApplyCustomCardImage(
  id: number,
  imageDir: () => string,
  getById: (id: number) => CustomCard | null,
  onApplied: () => void
): Promise<CustomCardPickImageResult> {
  if (!getById(id)) return { success: false, error: '自定义卡片不存在' }
  const picked = await pickCustomCardImage()
  if (!picked.success || !picked.filePath) return picked
  try {
    applyCustomCardImage(id, picked.filePath, imageDir)
    onApplied()
    return { success: true }
  } catch (err) {
    console.error('[CustomCardService] apply image error:', err)
    return { success: false, error: '图片更新失败' }
  }
}
