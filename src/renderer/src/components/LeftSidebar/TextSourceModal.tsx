import React, { useState } from 'react'
import { BookOpen, ChevronLeft, Loader2, Upload, X } from 'lucide-react'
import { TextChapter, TextMeta } from '@shared/index'
import { ScrollArea } from '../ui/scroll-area'
import { useAgentStore } from '../../stores/useAgentStore'
import { useDuelStore } from '../../stores/useDuelStore'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { LibraryGrid } from '../TextLibrary/LibraryGrid'
import { useTextLibrary } from '../../hooks/useTextLibrary'
import { buildExtractHandoffPrompt } from '../../utils/agentHandoffPrompt'
import { ChapterPicker } from './ChapterPicker'

interface TextSourceModalProps {
  onClose: () => void
  onSent?: (chapterCount: number) => void
}

export const TextSourceModal: React.FC<TextSourceModalProps> = ({ onClose, onSent }) => {
  const { sendMessage, isGenerating } = useAgentStore()
  const { setSeries } = useDuelStore()

  const [search, setSearch] = useState('')
  const [selectedText, setSelectedText] = useState<TextMeta | null>(null)
  const [chapters, setChapters] = useState<TextChapter[]>([])
  const [chaptersLoading, setChaptersLoading] = useState(false)

  const { texts, loading, busy, feedback, error, flash, importText, removeText, resplitText } =
    useTextLibrary({
      tag: 'TextSourceModal',
      activeId: selectedText?.id ?? null,
      onActiveReplaced: (text) => {
        setSelectedText(text)
        setChapters([])
      }
    })

  const handleOpenText = async (text: TextMeta): Promise<void> => {
    setSelectedText(text)
    setChapters([])
    setChaptersLoading(true)
    try {
      setChapters(await window.api.getTextChapters(text.id))
    } catch (err) {
      console.error('[TextSourceModal] 章节读取失败:', err)
      flash('章节读取失败')
    } finally {
      setChaptersLoading(false)
    }
  }

  const registerSeries = async (title: string): Promise<void> => {
    const name = title.trim()
    if (!name || !window.api.createProjectSeries) return
    try {
      await window.api.createProjectSeries(name)
    } catch (err) {
      console.warn('[TextSourceModal] 登记作品分类失败:', err)
    }
    setSeries(name)
  }

  const handleSend = async (text: TextMeta, pickedChapters: TextChapter[]): Promise<void> => {
    const picked = pickedChapters.filter((c) => c.content)
    if (picked.length === 0) {
      flash('所选章节没有正文内容')
      return
    }
    await registerSeries(text.title)
    const total = picked.reduce((sum, c) => sum + (c.content?.length || 0), 0)
    const materials = picked.map((c) => `【${c.title}】\n${c.content}`).join('\n\n---\n\n')
    const injected = buildExtractHandoffPrompt({ title: text.title, materials })

    await sendMessage(
      `请根据《${text.title}》的这几章内容，编排一场决斗剧情（共 ${picked.length} 章、约 ${total} 字）。`,
      undefined,
      injected,
      undefined,
      {
        textId: text.id,
        title: text.title,
        wordCount: total,
        chapterIds: picked.map((c) => c.id)
      }
    )
    flash(`已把 ${picked.length} 章原文交给背后灵`)
    onSent?.(picked.length)
  }

  const filtered = texts.filter((n) =>
    search.trim() ? n.title.toLowerCase().includes(search.trim().toLowerCase()) : true
  )

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="!flex !flex-col !p-0 !bg-card !text-card-foreground !max-w-2xl border border-border rounded-xl shadow-2xl w-full max-h-[80vh] overflow-hidden select-none"
      >
        <DialogHeader className="!flex !flex-row items-center gap-2 px-4 py-3 border-b border-border/60 shrink-0 space-y-0">
          <BookOpen className="w-4 h-4 text-primary shrink-0" />
          <div className="min-w-0 flex-1">
            <DialogTitle className="font-bold text-sm">
              {selectedText ? `挑选章节 · ${selectedText.title}` : '从文本提取对局'}
            </DialogTitle>
          </div>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onClose}
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </Button>
        </DialogHeader>

        <div className="px-4 py-2.5 border-b border-border/60 flex items-center gap-2 shrink-0">
          {selectedText ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedText(null)}
              className="h-7 gap-1 text-[11px] shrink-0"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>返回列表</span>
            </Button>
          ) : (
            <>
              <div className="relative flex-1">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="搜索已导入的文本"
                  className="h-7 pl-2.5 text-[11px] bg-muted/40"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void importText()}
                disabled={busy}
                className="h-7 text-[11px] gap-1.5 shrink-0"
              >
                {busy ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Upload className="w-3 h-3" />
                )}
                <span>导入文本</span>
              </Button>
            </>
          )}
        </div>

        {error && (
          <div className="px-4 py-1.5 bg-destructive/10 border-b border-destructive/30 text-destructive text-[11px] shrink-0">
            {error}
          </div>
        )}
        {feedback && (
          <div className="px-4 py-1.5 bg-emerald-500/10 border-b border-emerald-500/30 text-emerald-500 text-[11px] shrink-0">
            {feedback}
          </div>
        )}

        {selectedText ? (
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-3">
              {chaptersLoading ? (
                <div className="py-12 flex items-center justify-center text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              ) : chapters.length === 0 ? (
                <p className="py-8 text-center text-[11px] text-muted-foreground">
                  未能从该文件拆出章节，可能是格式不受支持；可在素材库中重新拆分。
                </p>
              ) : (
                <ChapterPicker
                  chapters={chapters}
                  busy={isGenerating}
                  onSend={(picked) => void handleSend(selectedText, picked)}
                />
              )}
            </div>
          </ScrollArea>
        ) : (
          <LibraryGrid
            texts={filtered}
            loading={loading}
            search={search}
            onOpen={(text) => void handleOpenText(text)}
            onDelete={(text) => void removeText(text)}
            onResplit={(text) => void resplitText(text)}
            onImport={() => void importText()}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
