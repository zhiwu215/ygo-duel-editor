import { useState } from 'react'

interface StagedImage {
  path: string
  preview: string
}

export function useCustomCardImage(reportError: (message: string) => void): {
  stagedImage: StagedImage | null
  pickingImage: boolean
  pickImage: () => Promise<void>
} {
  const [stagedImage, setStagedImage] = useState<StagedImage | null>(null)
  const [pickingImage, setPickingImage] = useState<boolean>(false)

  const pickImage = async (): Promise<void> => {
    setPickingImage(true)
    try {
      const result = await window.api.pickCustomCardImage()
      if (!result.success && result.error) {
        reportError(result.error)
      } else if (result.success && result.filePath) {
        setStagedImage({ path: result.filePath, preview: result.previewDataUrl ?? '' })
        reportError('')
      }
    } finally {
      setPickingImage(false)
    }
  }

  return { stagedImage, pickingImage, pickImage }
}
