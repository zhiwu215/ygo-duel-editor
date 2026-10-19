import React, { useCallback, useEffect, useState } from 'react'
import { CardNoteKind } from '@shared/index'
import { useCardNoteStore } from '../../stores/useCardNoteStore'
import { CardNoteList, type CardNoteEditorState } from './CardNoteList'
import { CardNoteEditor } from './CardNoteEditor'
import { CardNoteAdder } from './CardNoteAdder'
import { CardImageViewer } from '../CardDetail/CardImageViewer'
import { CardImageVariantMenu, type CardImageMenuState } from './CardImageVariantMenu'
import type { DisplayEntry } from '../../utils/cardNoteSort'

export const CardNoteApp: React.FC = () => {
  const { entries, save, fetchAll } = useCardNoteStore()
  const [editor, setEditor] = useState<CardNoteEditorState | null>(null)
  const [showAdder, setShowAdder] = useState(false)
  const [previewCard, setPreviewCard] = useState<number | null>(null)
  const [cardMenu, setCardMenu] = useState<CardImageMenuState | null>(null)

  useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  const handleOpenCardMenu = useCallback((e: React.MouseEvent, entry: DisplayEntry): void => {
    e.preventDefault()
    e.stopPropagation()
    setCardMenu({
      cardCode: entry.cardCode,
      cardName: entry.cardName,
      isCustom: Boolean(entry.isCustom),
      variantCodes: entry.variantCodes,
      x: e.clientX,
      y: e.clientY
    })
  }, [])

  const existingLabelsFor = useCallback(
    (cardCode: number, kind: CardNoteKind): string[] => {
      const entry = entries.find((e) => e.cardCode === cardCode)
      if (!entry) return []
      return (kind === 'chant' ? entry.chants : entry.notes).map((c) => c.label)
    },
    [entries]
  )

  return (
    <div className="h-screen w-screen flex flex-col bg-background text-foreground overflow-hidden">
      <CardNoteList
        onEdit={setEditor}
        onPreview={setPreviewCard}
        onOpenCardMenu={handleOpenCardMenu}
        onOpenAdder={() => setShowAdder(true)}
      />

      {editor && (
        <CardNoteEditor
          cardName={editor.cardName}
          kind={editor.kind}
          initial={editor.initial}
          existingLabels={existingLabelsFor(editor.cardCode, editor.kind)}
          onSave={(label, text, kind, source) => save(editor.cardCode, kind, label, text, source)}
          onClose={() => setEditor(null)}
        />
      )}

      {showAdder && (
        <CardNoteAdder
          existingLabelsFor={existingLabelsFor}
          onSave={(cardCode, kind, label, text, source) =>
            save(
              cardCode,
              kind,
              label,
              text,
              source,
              kind === 'chant' ? '已录入召唤词' : '已添加备注'
            )
          }
          onClose={() => setShowAdder(false)}
        />
      )}

      {previewCard !== null && (
        <CardImageViewer
          cardCode={previewCard}
          cardName={entries.find((e) => e.cardCode === previewCard)?.cardName ?? ''}
          onClose={() => setPreviewCard(null)}
        />
      )}

      {cardMenu && <CardImageVariantMenu menu={cardMenu} onClose={() => setCardMenu(null)} />}
    </div>
  )
}
