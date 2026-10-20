import React, { useState } from 'react'
import { CustomCardScriptInfo } from '@shared/index'
import { Button } from '../ui/button'
import { FileCode2, FolderOpen, RefreshCw, Trash2 } from 'lucide-react'
import { formatScriptSize } from '../../utils/customCardForm'
import { useConfigStore } from '../../stores/useConfigStore'
import { useFlashMessage } from '../../hooks/useFlashMessage'

interface ScriptSectionProps {
  editingId: number | null
  scriptInfo: CustomCardScriptInfo | null
  scriptBusy: boolean
  onPickScript: () => void
  onRemoveScript: () => void
}

export const ScriptSection: React.FC<ScriptSectionProps> = ({
  editingId,
  scriptInfo,
  scriptBusy,
  onPickScript,
  onRemoveScript
}) => {
  const gameDirectory = useConfigStore((s) => s.config.gameDirectory)
  const [syncing, setSyncing] = useState<boolean>(false)
  const [syncNote, flashSyncNote] = useFlashMessage<{ text: string; error: boolean }>(4000)

  const handleSync = async (): Promise<void> => {
    if (!gameDirectory || syncing) return
    setSyncing(true)
    try {
      const res = await window.api.syncCustomCardsToGame()
      if (!res.success) {
        flashSyncNote({ text: res.error || '同步失败', error: true })
        return
      }
      const parts = [
        res.cdb ? '卡库' : '',
        res.scripts > 0 ? `${res.scripts} 个脚本` : '',
        res.pics > 0 ? `${res.pics} 张卡图` : ''
      ].filter(Boolean)
      flashSyncNote({
        text: parts.length ? `已同步到游戏：${parts.join('、')}` : '游戏目录已是最新，无需同步',
        error: false
      })
    } catch (err) {
      console.error('[ScriptSection] sync to game failed:', err)
      flashSyncNote({ text: '同步失败', error: true })
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-border/70 bg-muted/20 p-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <FileCode2 className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
          <span className="text-[11px] text-muted-foreground shrink-0">引擎脚本</span>
          <span className="truncate font-mono text-[11px] text-foreground/80">
            {editingId === null
              ? '保存后可用'
              : scriptInfo?.exists
                ? `${scriptInfo.fileName}（${formatScriptSize(scriptInfo.size)}）`
                : '未配置'}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="xs"
            className="gap-1"
            disabled={editingId === null || scriptBusy}
            onClick={onPickScript}
          >
            <FileCode2 className="w-3 h-3" />
            <span>{scriptInfo?.exists ? '替换 Lua' : '导入 Lua'}</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="gap-1"
            disabled={!scriptInfo?.exists || scriptBusy}
            onClick={onRemoveScript}
          >
            <Trash2 className="w-3 h-3" />
            <span>移除</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="xs"
            className="gap-1"
            disabled={!gameDirectory || syncing}
            onClick={() => void handleSync()}
          >
            <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? '同步中…' : '同步到游戏'}</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="gap-1"
            onClick={() => void window.api.openCustomCardScriptDir()}
          >
            <FolderOpen className="w-3 h-3" />
            <span>目录</span>
          </Button>
        </div>
      </div>
      <p className="text-[11px] leading-snug text-muted-foreground">
        {editingId === null
          ? gameDirectory
            ? '保存后脚本写入游戏目录 expansions/script（c<卡密>.lua），本编辑器与 YGOPro 均可直接读取。'
            : '保存后可在自建卡脚本目录放置 c<卡密>.lua 让引擎执行效果；配置游戏目录后，游戏目录下的脚本同样会被读取。'
          : scriptInfo?.exists
            ? gameDirectory
              ? '引擎会加载该脚本，这张卡按脚本效果参与对局；脚本保存在游戏目录 expansions/script，YGOPro 可直接读取。'
              : '引擎会加载该脚本，这张卡按脚本效果参与对局；配置游戏目录后，游戏目录下的脚本同样会被读取。'
            : '没有脚本时按白板卡参与对局：召唤、盖放、战斗、墓地/除外规则正常，只是效果不发生。'}
      </p>
      {syncNote && (
        <p
          className={`text-[11px] leading-snug ${
            syncNote.error ? 'text-red-500' : 'text-emerald-500'
          }`}
        >
          {syncNote.text}
        </p>
      )}
    </div>
  )
}
