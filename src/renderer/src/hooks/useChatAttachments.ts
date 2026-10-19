import { useRef, useState } from 'react'
import type { DragEvent, RefObject } from 'react'
import { AgentTextSourceRef, countWords, CdbCard } from '@shared/index'
import { alertDialog } from '../stores/useDialogStore'

const MAX_DRAGGED_TEXT_CHARS = 800_000

export interface ChatAttachments {
  attachedCards: CdbCard[]
  attachedText: AgentTextSourceRef | null
  isCardDragOver: boolean
  handleDragOver: (e: DragEvent) => void
  handleDragLeave: (e: DragEvent) => void
  handleCardDrop: (e: DragEvent) => void
  removeAttachedCard: (cardId: number) => void
  removeAttachedText: () => void
  attachText: (selection: AgentTextSourceRef) => void
  clearAttachments: () => void
  textPickerOpen: boolean
  textPickerPos: { right: number; bottom: number } | null
  textPickerAnchorRef: RefObject<HTMLDivElement | null>
  openTextPicker: () => void
  closeTextPicker: () => void
}

export function useChatAttachments(): ChatAttachments {
  const [attachedCards, setAttachedCards] = useState<CdbCard[]>([])
  const [isCardDragOver, setIsCardDragOver] = useState(false)
  const [attachedText, setAttachedText] = useState<AgentTextSourceRef | null>(null)
  const [textPickerOpen, setTextPickerOpen] = useState(false)
  const [textPickerPos, setTextPickerPos] = useState<{ right: number; bottom: number } | null>(null)
  const textPickerAnchorRef = useRef<HTMLDivElement>(null)

  const handleDragOver = (e: DragEvent): void => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setIsCardDragOver(true)
  }

  const handleDragLeave = (e: DragEvent): void => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsCardDragOver(false)
  }

  const handleCardDrop = (e: DragEvent): void => {
    e.preventDefault()
    setIsCardDragOver(false)

    const files = Array.from(e.dataTransfer.files).filter((f) =>
      /\.(txt|md|markdown)$/i.test(f.name)
    )
    if (files.length > 0) {
      void handleFileDrop(files)
      return
    }

    const raw = e.dataTransfer.getData('application/json')
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as CdbCard
      if (typeof parsed?.id !== 'number' || !parsed.name) return
      setAttachedCards((prev) => (prev.some((c) => c.id === parsed.id) ? prev : [...prev, parsed]))
    } catch {
      void 0
    }
  }

  const handleFileDrop = async (files: File[]): Promise<void> => {
    const file = files[0]
    if (files.length > 1) {
      void alertDialog('一次只能附加一个文本文件，已取第一个')
    }
    try {
      const content = await file.text()
      if (!content.trim()) {
        void alertDialog('这个文件是空的')
        return
      }
      if (content.length > MAX_DRAGGED_TEXT_CHARS) {
        void alertDialog(
          `文件过大（${content.length} 字，上限 ${MAX_DRAGGED_TEXT_CHARS}）。请拆分后拖入，或先在资料库按章节导入`
        )
        return
      }

      setAttachedText({
        title: file.name,
        wordCount: countWords(content),
        content
      })
    } catch (err) {
      console.error('[BehindSpiritPanel] 读取拖入文件失败:', err)
      void alertDialog('读取文件失败，请确认文件未被占用')
    }
  }

  const removeAttachedCard = (cardId: number): void => {
    setAttachedCards((prev) => prev.filter((c) => c.id !== cardId))
  }

  const removeAttachedText = (): void => {
    setAttachedText(null)
  }

  const attachText = (selection: AgentTextSourceRef): void => {
    setAttachedText(selection)
    setTextPickerOpen(false)
  }

  const clearAttachments = (): void => {
    setAttachedCards([])
    setAttachedText(null)
  }

  const openTextPicker = (): void => {
    if (textPickerOpen) {
      setTextPickerOpen(false)
      return
    }
    const anchor = textPickerAnchorRef.current
    if (anchor) {
      const rect = anchor.getBoundingClientRect()
      setTextPickerPos({
        right: window.innerWidth - rect.right,
        bottom: window.innerHeight - rect.top
      })
    }
    setTextPickerOpen(true)
  }

  const closeTextPicker = (): void => {
    setTextPickerOpen(false)
  }

  return {
    attachedCards,
    attachedText,
    isCardDragOver,
    handleDragOver,
    handleDragLeave,
    handleCardDrop,
    removeAttachedCard,
    removeAttachedText,
    attachText,
    clearAttachments,
    textPickerOpen,
    textPickerPos,
    textPickerAnchorRef,
    openTextPicker,
    closeTextPicker
  }
}
