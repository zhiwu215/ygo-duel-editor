import { useState, type JSX } from 'react'
import { Loader2 } from 'lucide-react'
import { GameLanguageOption } from '@shared/index'
import { useGameLanguageStore } from '../../../stores/useGameLanguageStore'
import { useConfigStore } from '../../../stores/useConfigStore'
import { alertDialog } from '../../../stores/useDialogStore'
import { languageLabel, mdpro3LocaleIdFromCdbPath } from '../../../utils/gameLanguage'
import { cn } from '../../../lib/utils'
import { Dialog, DialogContent, DialogTitle } from '../../ui/dialog'

export function GameLanguageDialog(): JSX.Element {
  const { open, options, target, hide } = useGameLanguageStore()
  const config = useConfigStore((state) => state.config)
  const extraLanguages = useConfigStore((state) => state.extraLanguages)
  const setExtraCdbLanguage = useConfigStore((state) => state.setExtraCdbLanguage)
  const [busyId, setBusyId] = useState<string | null>(null)

  if (!open) return <></>

  const extraTarget = target.kind === 'extra' ? target : null
  const extraLanguage = extraTarget
    ? Object.values(extraLanguages).find((info) => info.root === extraTarget.root)
    : undefined
  const currentId = extraTarget
    ? (extraLanguage?.language ?? null)
    : config.gameType === 'mdpro3'
      ? mdpro3LocaleIdFromCdbPath(config.cdbPath)
      : (config.gameLanguage ?? null)

  const handleChoose = async (option: GameLanguageOption): Promise<void> => {
    if (busyId) return
    setBusyId(option.id)
    try {
      if (extraTarget) {
        const res = await setExtraCdbLanguage(extraTarget.root, option.id)
        if (!res.success) {
          void alertDialog(res.error ?? '切换附加卡库语言失败')
          return
        }
      } else {
        const res = await window.api.setGameLanguage(option.id)
        if (!res.success) {
          void alertDialog(res.error ?? '切换卡库语言失败')
          return
        }
        await useConfigStore.getState().loadConfig()
      }
      hide()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Dialog open onOpenChange={(next) => !next && hide()}>
      <DialogContent className="max-w-[460px] gap-3 p-5">
        <DialogTitle className="text-sm font-semibold">
          {extraTarget ? '附加卡库语言' : '游戏多语言卡库'}
        </DialogTitle>
        {extraTarget && (
          <div className="text-[10px] break-all text-muted-foreground">{extraTarget.root}</div>
        )}

        <div className="flex max-h-64 flex-col gap-1 overflow-y-auto pr-0.5">
          {options.map((option) => {
            const isCurrent = option.id === currentId
            return (
              <button
                key={option.id}
                type="button"
                disabled={busyId !== null}
                onClick={() => void handleChoose(option)}
                className={cn(
                  'flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition-colors disabled:opacity-60',
                  isCurrent
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-border hover:bg-muted/60 cursor-pointer'
                )}
              >
                <span className="min-w-0">
                  <span className="block text-xs font-medium text-foreground">
                    {languageLabel(option.id)}
                  </span>
                  {option.detail && (
                    <span className="mt-0.5 block text-[10px] break-all text-muted-foreground">
                      {option.detail}
                    </span>
                  )}
                </span>
                {busyId === option.id ? (
                  <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin text-muted-foreground" />
                ) : isCurrent ? (
                  <span className="shrink-0 text-xs text-primary">当前</span>
                ) : null}
              </button>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
