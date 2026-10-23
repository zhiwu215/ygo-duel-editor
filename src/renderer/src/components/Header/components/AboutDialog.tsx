import React from 'react'
import { Dialog, DialogContent } from '../../ui/dialog'
import { Check, Copy, X } from 'lucide-react'
import appIcon from '../../../assets/app-icon.png'
import { useCopyFeedback } from '../../../hooks/useCopyFeedback'
import { APP_INFO_ROWS, PROJECT_CREDITS } from '@shared/index'

interface AboutDialogProps {
  appVersion: string
  onClose: () => void
}

export const AboutDialog: React.FC<AboutDialogProps> = ({ appVersion, onClose }) => {
  const { copiedField, copy } = useCopyFeedback('MenuBar')

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent showCloseButton={false} className="max-w-sm space-y-3 p-5">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="text-center space-y-1">
          <img
            src={appIcon}
            alt=""
            aria-hidden="true"
            className="w-10 h-10 mx-auto rounded-md object-cover"
            draggable={false}
          />
          <h3 className="font-semibold text-base pt-1">YGO Duel Editor</h3>
          <p className="text-xs text-muted-foreground">版本 {appVersion}</p>
        </div>

        <div className="space-y-1.5 text-xs border-t border-border pt-3">
          {APP_INFO_ROWS.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground shrink-0">{row.label}</span>
              {row.href ? (
                <a
                  href={row.href}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline truncate"
                >
                  {row.value}
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => void copy(row.label, row.value)}
                  className="group flex items-center gap-1.5 truncate hover:text-foreground transition-colors"
                >
                  <span className="truncate">{row.value}</span>
                  {copiedField === row.label ? (
                    <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                  ) : (
                    <Copy className="w-3 h-3 opacity-0 group-hover:opacity-60 shrink-0 transition-opacity" />
                  )}
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="border-t border-border pt-3 space-y-1.5">
          <p className="text-xs text-muted-foreground">本项目使用了以下开源项目：</p>
          <div className="text-xs space-y-1">
            {PROJECT_CREDITS.map((project) => (
              <div key={project.name}>
                <a
                  href={project.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {project.name}
                </a>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
