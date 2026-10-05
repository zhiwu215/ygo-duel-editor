import React, { useEffect, useMemo, useState } from 'react'
import { parseYdk } from '@shared/index'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { ClipboardPaste, X } from 'lucide-react'

interface YdkPasteModalProps {
  onConfirm: (text: string, deckName: string) => Promise<boolean>
  onClose: () => void
}

export const YdkPasteModal: React.FC<YdkPasteModalProps> = ({ onConfirm, onClose }) => {
  const [text, setText] = useState<string>('')
  const [deckName, setDeckName] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const preview = useMemo(() => {
    if (!text.trim()) return null
    const deck = parseYdk(text, deckName.trim() || '粘贴导入卡组')
    const total = deck.main.length + deck.extra.length + deck.side.length
    return { deck, total }
  }, [text, deckName])

  const canSubmit = !!preview && preview.total > 0 && !isSubmitting

  const handleConfirm = async (): Promise<void> => {
    if (!preview || preview.total === 0) return
    setIsSubmitting(true)
    const ok = await onConfirm(text, deckName.trim() || preview.deck.name)
    setIsSubmitting(false)
    if (ok) onClose()
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-100 select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-card text-card-foreground border border-border rounded-xl shadow-2xl p-5 flex flex-col gap-4 max-w-[560px] w-full animate-in zoom-in-95 duration-100"
      >
        <div className="flex items-center justify-between border-b border-border/60 pb-2">
          <div className="flex items-center gap-2">
            <ClipboardPaste className="w-4 h-4 text-primary" />
            <span className="font-bold text-sm">粘贴 YDK 卡组文本</span>
          </div>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onClose}
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <p className="text-xs text-muted-foreground leading-5">
          从手机端、小程序或网页版卡组工具复制的 YDK 文本可直接粘贴到此处，无需先保存为 .ydk
          文件。内容需包含 <code className="font-mono text-foreground">#main</code>、
          <code className="font-mono text-foreground">#extra</code>、
          <code className="font-mono text-foreground">!side</code> 段落。
        </p>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-muted-foreground">卡组名称</span>
          <Input
            type="text"
            value={deckName}
            onChange={(e) => setDeckName(e.target.value)}
            placeholder={
              preview?.deck.name !== '粘贴导入卡组'
                ? preview?.deck.name
                : '留空则使用文本内的 #name'
            }
            className="h-8 text-xs bg-muted/40 border-border/80 focus-visible:ring-1"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-muted-foreground">YDK 文本</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'#main\n12345678\n89644567\n\n#extra\n\n!side'}
            spellCheck={false}
            className="w-full h-56 resize-none rounded-lg border border-input bg-muted/40 px-2.5 py-2 font-mono text-xs leading-5 outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1"
          />
        </div>

        <div className="flex items-center justify-between border-t border-border/60 pt-3">
          <div className="text-xs">
            {preview ? (
              preview.total > 0 ? (
                <span className="text-muted-foreground">
                  解析到 <span className="font-semibold text-foreground">{preview.total}</span> 张 —
                  主卡 {preview.deck.main.length} / 额外 {preview.deck.extra.length} / 侧组{' '}
                  {preview.deck.side.length}
                </span>
              ) : (
                <span className="text-destructive">未解析到卡密，请检查文本格式</span>
              )
            ) : (
              <span className="text-muted-foreground">等待粘贴 YDK 文本</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="h-7 text-xs font-semibold"
            >
              取消
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => void handleConfirm()}
              disabled={!canSubmit}
              className="h-7 text-xs font-bold shadow-xs"
            >
              导入卡组
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
