interface MenuItemDef {
  label: string
  shortcut?: string
  action?: () => void
  disabled?: boolean
  separator?: boolean

  checked?: boolean
}

interface MenuDef {
  id: string
  label: string
  items: MenuItemDef[]
}

export interface MenuActions {
  onNew: () => void
  onOpenProject: () => void
  onSaveProject: () => void
  onSaveProjectAs: () => void
  onTestInYgo: () => void
  onImportLua: () => void
  onExportLua: () => void
  onExportYrp: () => void
  onImportReplay: () => void
  onOpenReplayInYgo: () => void
  canOpenReplay: boolean
  isReplay: boolean
  canExportYrp: boolean
  canExportLua: boolean
  canTestInYgo: boolean

  isEngineActive: boolean

  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void

  onToggleViewSide: () => void
  onResetDuel: () => void

  tacticalView: boolean
  onToggleTacticalView: () => void

  onShowShortcutsDialog: () => void
  onShowAboutDialog: () => void
  onShowSupportDialog: () => void
  onCheckUpdates: () => void
}

export function buildMenus(actions: MenuActions): MenuDef[] {
  return [
    {
      id: 'file',
      label: '文件',
      items: [
        {
          label: '新建局面',
          shortcut: 'Ctrl+N',
          action: actions.onNew
        },
        {
          label: '打开工程',
          shortcut: 'Ctrl+O',
          action: actions.onOpenProject
        },
        {
          label: '保存工程',
          shortcut: 'Ctrl+S',
          action: actions.onSaveProject
        },
        {
          label: '另存为...',
          action: actions.onSaveProjectAs
        }
      ]
    },
    {
      id: 'edit',
      label: '编辑',
      items: [
        {
          label: '撤销',
          shortcut: 'Ctrl+Z',
          disabled: !actions.canUndo,
          action: actions.onUndo
        },
        {
          label: '重做',
          shortcut: 'Ctrl+Y',
          disabled: !actions.canRedo,
          action: actions.onRedo
        },
        { label: '', separator: true },
        {
          label: '翻转显示方向（上下）',
          action: actions.onToggleViewSide
        },
        {
          label: '清空重置局面',
          disabled: actions.isEngineActive,
          action: actions.onResetDuel
        }
      ]
    },
    {
      id: 'view',
      label: '查看',
      items: [
        {
          label: '战术透视',
          shortcut: 'Tab',
          checked: actions.tacticalView,
          action: actions.onToggleTacticalView
        },
        { label: '', separator: true },
        {
          label: '卡组库',
          action: () => window.api.openDeckEditor()
        },
        {
          label: '卡牌图鉴',
          action: () => window.api.openCardNoteWindow()
        },
        {
          label: '文本库',
          action: () => void window.api.openTextLibrary()
        }
      ]
    },
    {
      id: 'ygo',
      label: '游戏',
      items: [
        {
          label: '使用游戏测试该局',
          shortcut: 'Ctrl+T',
          action: actions.onTestInYgo,
          disabled: !actions.canTestInYgo
        },
        {
          label: '导入脚本',
          shortcut: 'Ctrl+I',
          action: actions.onImportLua
        },
        {
          label: '导出脚本',
          shortcut: 'Ctrl+E',
          action: actions.onExportLua,
          disabled: !actions.canExportLua
        },
        {
          label: '导入对局回放',
          action: actions.onImportReplay
        },
        {
          label: '用游戏打开当前回放',
          action: actions.onOpenReplayInYgo,
          disabled: !actions.canOpenReplay
        },
        {
          label: actions.isReplay ? '导出对局回放（回放模式只读）' : '导出对局回放',
          action: actions.onExportYrp,
          disabled: !actions.canExportYrp
        }
      ]
    },
    {
      id: 'help',
      label: '帮助',
      items: [
        {
          label: '快捷键参考',
          action: actions.onShowShortcutsDialog
        },
        {
          label: '支持作者',
          action: actions.onShowSupportDialog
        },
        {
          label: '检查更新',
          action: actions.onCheckUpdates
        },
        { label: '', separator: true },
        {
          label: '关于 YGO Duel Editor',
          action: actions.onShowAboutDialog
        }
      ]
    }
  ]
}
