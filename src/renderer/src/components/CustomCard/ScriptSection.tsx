import React from 'react'
import { CustomCardScriptInfo } from '@shared/index'
import { Button } from '../ui/button'
import { FileCode2, FolderOpen, Trash2 } from 'lucide-react'
import { formatScriptSize } from '../../utils/customCardForm'

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
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border/70 bg-muted/20 p-3">
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
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        {editingId === null
          ? '保存这张卡后，可在自建卡脚本目录放置 c<卡密>.lua 让引擎执行它的效果。'
          : scriptInfo?.exists
            ? '引擎会加载该脚本，这张卡按脚本效果参与对局。'
            : '没有脚本时，这张卡在引擎里按白板卡参与对局：召唤、盖放、战斗、墓地/除外规则都正常，只是效果不发生。'}
        {' 脚本放在自建卡脚本目录（游戏目录下的脚本同样会被读取）。'}
      </p>
    </div>
  )
}
