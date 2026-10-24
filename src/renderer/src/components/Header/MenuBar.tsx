import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Check } from 'lucide-react'
import { isExportableMatch, isInGameTestSupported } from '@shared/index'
import { useDuelStore } from '../../stores/useDuelStore'
import { useDuelEngineStore } from '../../stores/useDuelEngineStore'
import { confirmDialog } from '../../stores/useDialogStore'
import { cn } from '../../lib/utils'
import { buildMenus } from './menuDefs'
import { useEngineAwareUndoRedo } from '../../hooks/useEngineAwareUndoRedo'
import { ShortcutsDialog } from './components/ShortcutsDialog'
import { AboutDialog } from './components/AboutDialog'
import { SupportDialog } from './components/SupportDialog'

interface MenuBarProps {
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
}

export const MenuBar: React.FC<MenuBarProps> = ({
  onNew,
  onOpenProject,
  onSaveProject,
  onSaveProjectAs,
  onTestInYgo,
  onImportLua,
  onExportLua,
  onExportYrp,
  onImportReplay,
  onOpenReplayInYgo,
  canOpenReplay,
  isReplay
}) => {
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null)
  const [showShortcutsDialog, setShowShortcutsDialog] = useState(false)
  const [showAboutDialog, setShowAboutDialog] = useState(false)
  const [showSupportDialog, setShowSupportDialog] = useState(false)
  const [appVersion, setAppVersion] = useState('')
  const menuBarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void window.api.getAppVersion().then(setAppVersion)
  }, [])

  const { resetDuel, toggleViewSide, tacticalView, toggleTacticalView } = useDuelStore()

  const isEngineActive = useDuelEngineStore((s) => s.isInitialized)
  const hasEngineActions = useDuelEngineStore((s) => s.timeline.length > 1)
  const matchConfig = useDuelStore((s) => s.state.matchConfig)
  const canExportMatch = isExportableMatch(matchConfig)
  const canTestInYgo = isInGameTestSupported(matchConfig)
  const canExportYrp = canExportMatch && isEngineActive && hasEngineActions && !isReplay

  const { canUndo, canRedo, undo, redo } = useEngineAwareUndoRedo()

  const handleResetDuel = useCallback((): void => {
    void confirmDialog({
      title: '清空重置局面',
      description: '确定清空当前场面上所有摆放的卡片吗？'
    }).then((ok) => {
      if (ok) resetDuel()
    })
  }, [resetDuel])

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent): void => {
      if (menuBarRef.current && !menuBarRef.current.contains(e.target as Node)) {
        setActiveMenuId(null)
      }
    }
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setActiveMenuId(null)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const menus = buildMenus({
    onNew,
    onOpenProject,
    onSaveProject,
    onSaveProjectAs,
    onTestInYgo,
    onImportLua,
    onExportLua,
    onExportYrp,
    onImportReplay,
    onOpenReplayInYgo,
    canOpenReplay,
    isReplay,
    canExportYrp,
    canExportLua: canExportMatch,
    canTestInYgo,
    isEngineActive,
    canUndo,
    canRedo,
    onUndo: undo,
    onRedo: redo,
    onToggleViewSide: () => toggleViewSide(),
    onResetDuel: handleResetDuel,
    tacticalView,
    onToggleTacticalView: () => toggleTacticalView(),
    onShowShortcutsDialog: () => setShowShortcutsDialog(true),
    onShowAboutDialog: () => setShowAboutDialog(true),
    onShowSupportDialog: () => setShowSupportDialog(true)
  })

  return (
    <>
      <div ref={menuBarRef} className="flex items-center gap-0.5 select-none relative">
        {menus.map((menu) => {
          const isOpen = activeMenuId === menu.id
          return (
            <div key={menu.id} className="relative">
              <button
                type="button"
                onClick={() => setActiveMenuId(isOpen ? null : menu.id)}
                className={cn(
                  'px-2.5 py-1 text-xs rounded-md transition-colors',
                  isOpen
                    ? 'bg-foreground/10 text-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                )}
              >
                {menu.label}
              </button>

              {isOpen && (
                <div className="absolute left-0 top-full mt-1 min-w-[220px] bg-popover text-popover-foreground rounded-md shadow-lg border border-border p-1 z-50 text-xs animate-in fade-in-50">
                  {menu.items.map((item, idx) => {
                    if (item.separator) {
                      return <div key={`sep-${idx}`} className="h-px bg-border my-1" />
                    }
                    return (
                      <button
                        key={item.label}
                        type="button"
                        disabled={item.disabled}
                        onClick={() => {
                          setActiveMenuId(null)
                          item.action?.()
                        }}
                        className="w-full flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-muted text-left transition-colors disabled:opacity-40 disabled:pointer-events-none"
                      >
                        <div className="flex items-center gap-2">
                          {item.checked && <Check className="w-3.5 h-3.5 text-primary" />}
                          <span>{item.label}</span>
                        </div>
                        {item.shortcut && (
                          <span className="text-[10px] text-muted-foreground/70 font-mono ml-4 tracking-tight">
                            {item.shortcut}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {showShortcutsDialog && <ShortcutsDialog onClose={() => setShowShortcutsDialog(false)} />}

      {showAboutDialog && (
        <AboutDialog appVersion={appVersion} onClose={() => setShowAboutDialog(false)} />
      )}

      {showSupportDialog && <SupportDialog onClose={() => setShowSupportDialog(false)} />}
    </>
  )
}
