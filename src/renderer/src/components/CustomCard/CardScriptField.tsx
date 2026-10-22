import React from 'react'
import { CustomCardScriptInfo } from '@shared/index'
import { FileCode2, FolderOpen, Loader2, Trash2, Upload } from 'lucide-react'
import { Button } from '../ui/button'
import { formatScriptSize } from '../../utils/customCardForm'
import type { StagedScript } from '../../hooks/useCustomCardScript'

interface CardScriptFieldProps {
  editingId: number | null
  scriptInfo: CustomCardScriptInfo | null
  stagedScript: StagedScript | null
  busy: boolean
  error: string
  notice: string
  onPick: () => void
  onRemove: () => void
}

export const CardScriptField: React.FC<CardScriptFieldProps> = ({
  editingId,
  scriptInfo,
  stagedScript,
  busy,
  error,
  notice,
  onPick,
  onRemove
}) => {
  const hasScript = editingId !== null ? Boolean(scriptInfo?.exists) : stagedScript !== null
  const status =
    editingId !== null
      ? scriptInfo?.exists
        ? `${scriptInfo.fileName} · ${formatScriptSize(scriptInfo.size)}`
        : '未关联'
      : stagedScript
        ? `待保存 · ${stagedScript.fileName} · ${formatScriptSize(stagedScript.size)}`
        : '未关联'

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border/70 bg-muted/20 p-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <FileCode2 className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="shrink-0 text-[11px] text-muted-foreground">效果脚本</span>
          <span className="truncate font-mono text-[11px] text-foreground/80">{status}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="xs"
            className="gap-1"
            disabled={busy}
            onClick={onPick}
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
            <span>{hasScript ? '替换' : '导入 Lua'}</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="gap-1"
            disabled={!hasScript || busy}
            onClick={onRemove}
          >
            <Trash2 className="h-3 w-3" />
            <span>移除</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="gap-1"
            title="在项目脚本目录中显示"
            onClick={() => void window.api.openCustomCardScriptDir()}
          >
            <FolderOpen className="h-3 w-3" />
            <span>目录</span>
          </Button>
        </div>
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        脚本由外部编写，本编辑器只关联、不编辑；保存后按 c&lt;卡密&gt;.lua 使用。
      </p>
      {error && <p className="text-[11px] leading-relaxed text-red-500">{error}</p>}
      {notice && <p className="text-[11px] leading-relaxed text-amber-500">{notice}</p>}
    </div>
  )
}
