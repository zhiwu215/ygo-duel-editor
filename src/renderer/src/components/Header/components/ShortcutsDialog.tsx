import React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../ui/dialog'
import { Keyboard, X } from 'lucide-react'

interface ShortcutsDialogProps {
  onClose: () => void
}

export const ShortcutsDialog: React.FC<ShortcutsDialogProps> = ({ onClose }) => (
  <Dialog open onOpenChange={(open) => !open && onClose()}>
    <DialogContent showCloseButton={false} className="max-w-md space-y-3 p-5">
      <DialogHeader className="flex-row items-center justify-between space-y-0 border-b border-border pb-2.5">
        <DialogTitle className="flex items-center gap-2 font-semibold text-sm">
          <Keyboard className="w-4 h-4 text-muted-foreground" />
          快捷键参考
        </DialogTitle>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </DialogHeader>
      <div className="space-y-1 text-xs">
        {[
          ['删除卡片', 'Delete / Del'],
          ['超量叠放', '拖放到有卡的怪兽区'],
          ['战术透视', 'Tab'],
          ['使用 ygo 测试该局', 'Ctrl + T'],
          ['攻守与指示物', 'Shift + 鼠标左键'],
          ['双击卡堆', '查看卡组列表（额外/卡组/墓地/除外）'],
          ['切换默认放置状态', 'Ctrl + 拖放']
        ].map(([name, key]) => (
          <div key={name} className="flex justify-between py-1 border-b border-border/40">
            <span className="text-muted-foreground">{name}</span>
            <kbd className="bg-muted px-1.5 py-0.5 rounded font-mono text-[11px]">{key}</kbd>
          </div>
        ))}
      </div>
    </DialogContent>
  </Dialog>
)
