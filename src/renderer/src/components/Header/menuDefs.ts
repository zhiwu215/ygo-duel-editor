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
  onExportScreenplay?: () => void
  onExportSession: () => void
  onImportSession: () => void

  isEngineActive: boolean

  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void

  onSwapSides: () => void
  onResetDuel: () => void

  tacticalView: boolean
  onToggleTacticalView: () => void
  onOpenArchives: () => void
  onOpenScreenplay: () => void

  onShowShortcutsDialog: () => void
  onShowAboutDialog: () => void
  onShowSupportDialog: () => void
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
          label: '决斗档案库',
          action: actions.onOpenArchives
        },
        {
          label: '保存工程',
          shortcut: 'Ctrl+S',
          action: actions.onSaveProject
        },
        {
          label: '另存为...',
          shortcut: 'Ctrl+Alt+S',
          action: actions.onSaveProjectAs
        },
        { label: '', separator: true },
        {
          label: '导出同人剧本台本',
          action: actions.onExportScreenplay
        },
        { label: '', separator: true },
        {
          label: '导出对局剧本...',
          disabled: !actions.isEngineActive,
          action: actions.onExportSession
        },
        {
          label: '载入对局剧本...',
          action: actions.onImportSession
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
          label: '翻转双方场地',
          disabled: actions.isEngineActive,
          action: actions.onSwapSides
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
          label: '决斗台本',
          action: actions.onOpenScreenplay
        },
        {
          label: '卡组编辑器',
          action: () => window.api.openDeckEditor()
        },
        {
          label: '卡牌图鉴',
          action: () => window.api.openCardNoteWindow()
        },
        {
          label: '文本素材库',
          action: () => void window.api.openTextLibrary()
        }
      ]
    },
    {
      id: 'ygo',
      label: 'ygo',
      items: [
        {
          label: '使用游戏测试该局',
          shortcut: 'Ctrl+T',
          action: actions.onTestInYgo
        },
        {
          label: '导入残局脚本',
          shortcut: 'Ctrl+I',
          action: actions.onImportLua
        },
        {
          label: '导出残局脚本',
          shortcut: 'Ctrl+E',
          action: actions.onExportLua
        },
        {
          label: '导入对局回放',
          action: actions.onImportReplay
        },
        {
          label: '导出对局回放',
          action: actions.onExportYrp
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
          label: '关于 YGO Duel Editor',
          action: actions.onShowAboutDialog
        }
      ]
    }
  ]
}
