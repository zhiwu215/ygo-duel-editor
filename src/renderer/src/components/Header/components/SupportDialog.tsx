import React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../ui/dialog'
import { Button } from '../../ui/button'
import { Coffee, X } from 'lucide-react'

const AUTHOR_AFDIAN_URL = 'https://afdian.com/a/zhiwu215'

interface SupportDialogProps {
  onClose: () => void
}

export const SupportDialog: React.FC<SupportDialogProps> = ({ onClose }) => (
  <Dialog open onOpenChange={(open) => !open && onClose()}>
    <DialogContent showCloseButton={false} className="max-w-sm space-y-2 p-4 pb-3">
      <DialogHeader className="flex-row items-center justify-between space-y-0 border-b border-border pb-2">
        <DialogTitle className="flex items-center gap-2 font-semibold text-sm">
          <Coffee className="w-4 h-4 text-muted-foreground" />
          支持作者
        </DialogTitle>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </DialogHeader>

      <p className="text-xs text-muted-foreground leading-relaxed text-center">
        如果 YGO Duel Editor 对你有帮助，欢迎请作者喝杯咖啡
      </p>

      <p className="text-[11px] text-muted-foreground/80 leading-relaxed text-center">
        全部功能免费开放，赞助仅作自愿支持，不影响任何功能
      </p>

      <Button
        onClick={() => {
          onClose()
          void window.api.openExternal(AUTHOR_AFDIAN_URL)
        }}
        className="w-full"
      >
        <span>打开爱发电主页</span>
      </Button>
    </DialogContent>
  </Dialog>
)
