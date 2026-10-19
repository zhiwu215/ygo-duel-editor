import type { ToolDefinition } from '@earendil-works/pi-coding-agent'
import { Type } from '../toolSchema'
import type { AgentTextSource, AgentToolDeps } from './toolDeps'

const TEXT_CHUNK_SIZE = 8000

interface TextChunkSlice {
  total: number
  offset: number
  chunk: string
  end: number
  remaining: number
}

const sliceChunk = (text: string, requestedOffset: number | undefined): TextChunkSlice => {
  const total = text.length
  const offset = Math.min(Math.max(0, Math.trunc(requestedOffset ?? 0)), total)
  const chunk = text.slice(offset, offset + TEXT_CHUNK_SIZE)
  const end = offset + chunk.length
  const remaining = total - end
  return { total, offset, chunk, end, remaining }
}

export function createReadTextSourceTool(deps: AgentToolDeps): ToolDefinition {
  const { emitEvent, getTextSource } = deps
  return {
    name: 'read_text_source',
    label: '分段读取文本素材',
    description:
      '分段读取创作者随消息附加的小说/文本素材。消息里标注了【文本素材】时必须先用它通读全文（从 offset 缺省开始，按返回指引传 offset 续读直到读完），再开始整理对局；未附加素材时不要调用',
    parameters: Type.Object({
      chapter: Type.Optional(
        Type.String({
          description:
            '要读取的章节标题（先用不带本参数的调用拿到目录后再传）。缺省时先返回章节目录'
        })
      ),
      offset: Type.Optional(
        Type.Number({
          description: '起始字符偏移，首次调用省略；续读时传上一次返回的 nextOffset'
        })
      )
    }),
    execute: async (_toolCallId, p: { chapter?: string; offset?: number }) => {
      emitEvent({
        type: 'tool_call_start',
        id: _toolCallId,
        toolName: 'read_text_source',
        params: { chapter: p.chapter ?? null, offset: p.offset ?? 0 }
      })

      const source: AgentTextSource | null = getTextSource()
      if (!source) {
        emitEvent({
          type: 'tool_call_end',
          id: _toolCallId,
          toolName: 'read_text_source',
          resultSummary: '本轮未附加文本素材'
        })
        return {
          content: [
            {
              type: 'text',
              text: '本轮消息没有附加文本素材。若创作者的诉求需要原文，请直接请对方通过「附加文本素材」按钮选择章节后再发送，不要凭空猜测剧情。'
            }
          ],
          details: { attached: false }
        }
      }

      if (!p.chapter && source.chapters && p.offset === undefined) {
        const toc = source.chapters
          .map((c, i) => `${i + 1}. ${c.title}（${c.content.length} 字）`)
          .join('\n')
        emitEvent({
          type: 'tool_call_end',
          id: _toolCallId,
          toolName: 'read_text_source',
          resultSummary: `《${source.title}》共 ${source.chapters.length} 章，返回目录`
        })
        const text = [
          `【文本素材】《${source.title}》`,
          `共 ${source.chapters.length} 章。请先看目录定位需要改写成决斗的段落，再用 chapter 参数读取对应章节（可多次调用）。`,
          '',
          toc
        ].join('\n')
        return {
          content: [{ type: 'text', text }],
          details: { title: source.title, chapters: source.chapters.length }
        }
      }

      const text = p.chapter
        ? (source.chapters?.find((c) => c.title === p.chapter)?.content ?? '')
        : source.content
      if (p.chapter && !text) {
        emitEvent({
          type: 'tool_call_end',
          id: _toolCallId,
          toolName: 'read_text_source',
          resultSummary: `章节「${p.chapter}」不存在`
        })
        return {
          content: [
            {
              type: 'text',
              text: `素材里没有名为「${p.chapter}」的章节，请按目录里的准确标题重试。`
            }
          ],
          details: { chapter: p.chapter, found: false }
        }
      }

      const slice = sliceChunk(text, p.offset)
      const scope = p.chapter ? `第「${p.chapter}」章` : `《${source.title}》`

      emitEvent({
        type: 'tool_call_end',
        id: _toolCallId,
        toolName: 'read_text_source',
        resultSummary: `读取${scope}第 ${slice.offset}-${slice.end} 字，共 ${slice.total} 字`
      })

      const header = [
        `【文本素材】${scope}`,
        `共 ${slice.total} 字；本次输出第 ${slice.offset}-${slice.end} 字。`,
        slice.remaining > 0
          ? `本章尚未读完（剩余 ${slice.remaining} 字），请继续调用本工具并传 offset: ${slice.end}。`
          : '本章已全部读完。'
      ].join('\n')

      const details: Record<string, unknown> = {
        title: source.title,
        chapter: p.chapter,
        total: slice.total,
        offset: slice.offset,
        end: slice.end,
        remaining: slice.remaining
      }
      return { content: [{ type: 'text', text: `${header}\n\n${slice.chunk}` }], details }
    }
  }
}
