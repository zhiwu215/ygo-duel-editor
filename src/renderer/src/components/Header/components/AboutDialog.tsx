import React from 'react'
import { Tooltip, TooltipTrigger, TooltipContent } from '../../ui/tooltip'
import { Dialog, DialogContent } from '../../ui/dialog'
import { Check, Copy, X } from 'lucide-react'
import appIcon from '../../../assets/app-icon.png'
import { useCopyFeedback } from '../../../hooks/useCopyFeedback'

interface AboutDialogProps {
  appVersion: string
  onClose: () => void
}

export const AboutDialog: React.FC<AboutDialogProps> = ({ appVersion, onClose }) => {
  const { copiedField, copy } = useCopyFeedback('MenuBar')

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent showCloseButton={false} className="max-w-sm space-y-3 p-5">
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                onClick={onClose}
                className="absolute top-3 right-3 text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            }
          />
          <TooltipContent>关闭</TooltipContent>
        </Tooltip>

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
          {[
            ['作者', '知兀', null],
            ['邮箱', 'zhiwu_215@qq.com', null],
            [
              'B站',
              'space.bilibili.com/3546704263514722',
              'https://space.bilibili.com/3546704263514722'
            ],
            [
              '项目地址',
              'github.com/zhiwu215/ygo-duel-editor',
              'https://github.com/zhiwu215/ygo-duel-editor'
            ]
          ].map(([label, text, href]) => (
            <div key={label} className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground shrink-0">{label}</span>
              {href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline truncate"
                  title={text ?? undefined}
                >
                  {text}
                </a>
              ) : (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        onClick={() => void copy(label!, text!)}
                        className="group flex items-center gap-1.5 truncate hover:text-foreground transition-colors"
                      >
                        <span className="truncate">{text}</span>
                        {copiedField === label ? (
                          <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                        ) : (
                          <Copy className="w-3 h-3 opacity-0 group-hover:opacity-60 shrink-0 transition-opacity" />
                        )}
                      </button>
                    }
                  />
                  <TooltipContent>点击复制</TooltipContent>
                </Tooltip>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
