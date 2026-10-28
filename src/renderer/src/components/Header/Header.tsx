import React from 'react'
import appIcon from '../../assets/app-icon.png'
import { useDuelStore } from '../../stores/useDuelStore'
import { useDuelEngineStore } from '../../stores/useDuelEngineStore'
import {
  boardFingerprintMatches,
  computeBoardFingerprint,
  MASTER_RULES,
  MasterRule,
  SELECTABLE_MASTER_RULES
} from '@shared/index'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Separator } from '../ui/separator'
import { WindowControls } from '../ui/window-controls'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Check, Clapperboard, ShieldCheck, Square, Play, Loader2, RotateCcw } from 'lucide-react'
import { ChainModeToggle } from '../Board/ChainModeToggle'
import { MenuBar } from './MenuBar'
import { MatchSelector } from './components/MatchSelector'
import { TurnPhaseIndicator } from './components/TurnPhaseIndicator'
import { UpdateIndicator } from './components/UpdateIndicator'
import { UpdateDialog } from './components/UpdateDialog'
import { useProjectCommands } from '../../hooks/useProjectCommands'
import { useGlobalShortcuts } from '../../hooks/useGlobalShortcuts'
import { useSceneMode } from '../../hooks/useSceneMode'
import { useStartEngine } from '../../hooks/useStartEngine'
import { SCENE_STEP_INDEX } from '../../utils/openingScene'
import { useConfigStore } from '../../stores/useConfigStore'
import { useUpdateStore } from '../../stores/useUpdateStore'
import { commitDuelDocumentTitle } from '../../utils/duelDocumentTitle'
import { alertDialog, confirmDialog } from '../../stores/useDialogStore'

export const Header: React.FC = () => {
  const engineMode = useDuelEngineStore((s) => s.engineMode)
  const isEngineLoading = useDuelEngineStore((s) => s.loading)
  const mergedMatch = useDuelEngineStore((s) => s.mergedMatch)
  const suspendEngine = useDuelEngineStore((s) => s.suspendEngine)
  const resumeSuspended = useDuelEngineStore((s) => s.resumeSuspended)
  const resumeSuspendedFromStart = useDuelEngineStore((s) => s.resumeSuspendedFromStart)
  const suspendedDoc = useDuelEngineStore((s) => s.suspendedDoc)
  const replayInfo = useDuelEngineStore((s) => s.replayInfo)
  const importingReplay = useDuelEngineStore((s) => s.importingReplay)
  const engineSupport = useConfigStore((s) => s.engineSupport)
  const engineUnsupported = engineSupport?.supported === false
  const { state, setMasterRule, setTitle, previewReturn, sceneEditing, currentStepIndex } =
    useDuelStore()
  const sceneDirty = useDuelStore((s) => (s.sceneEditing ? s.isSceneDirty() : false))
  const { toggleSceneMode } = useSceneMode()
  const startEngine = useStartEngine()
  const canResume = suspendedDoc
    ? sceneEditing
      ? !sceneDirty
      : boardFingerprintMatches(
          suspendedDoc.boardFingerprint,
          computeBoardFingerprint(previewReturn?.state ?? state)
        )
    : false
  const showStartOver =
    suspendedDoc !== null &&
    suspendedDoc.timeline.length > 1 &&
    currentStepIndex === SCENE_STEP_INDEX &&
    !sceneDirty

  const handleResume = async (): Promise<void> => {
    const restored = await resumeSuspended()
    if (restored) return
    const ok = await confirmDialog({
      title: '继续上次会话失败',
      description: `${useDuelEngineStore.getState().error ?? '引擎无法恢复上次的会话。'}\n\n要从当前盘面开始新的引擎会话吗？已有步骤会保留为历史。`,
      confirmText: '开始新会话'
    })
    if (!ok) return
    await startEngine({ skipResume: true })
  }

  const handleStartOver = async (): Promise<void> => {
    const restored = await resumeSuspendedFromStart()
    if (restored) return
    await alertDialog(
      `从头开始失败\n${useDuelEngineStore.getState().error ?? '引擎无法从初始步骤恢复上次的会话。'}`
    )
  }

  const {
    handleNew,
    handleSaveProject,
    handleSaveProjectAs,
    handleOpenProject,
    handleExportLua,
    handleTestInYgo,
    handleImportLua,
    handleExportYrp,
    handleImportReplay,
    handleOpenReplayInYgo
  } = useProjectCommands()

  useGlobalShortcuts({
    handleNew,
    handleSaveProject,
    handleOpenProject,
    handleExportLua,
    handleTestInYgo,
    handleImportLua
  })

  return (
    <header className="border-b border-border bg-card select-none flex flex-col shrink-0">
      <div className="h-9 pl-3 pr-3 flex items-center justify-between border-b border-border/60 gap-2 [-webkit-app-region:drag]">
        <div className="flex items-center gap-1 min-w-0">
          <div className="flex items-center gap-1.5 mr-2 shrink-0">
            <img
              src={appIcon}
              alt=""
              className="w-4 h-4 rounded-[3px] object-cover"
              draggable={false}
            />
            <span className="text-[13px] font-semibold tracking-wide">YGO Duel Editor</span>
          </div>

          <div className="[-webkit-app-region:no-drag]">
            <MenuBar
              onNew={handleNew}
              onOpenProject={handleOpenProject}
              onSaveProject={handleSaveProject}
              onSaveProjectAs={handleSaveProjectAs}
              onTestInYgo={handleTestInYgo}
              onImportLua={handleImportLua}
              onExportLua={handleExportLua}
              onExportYrp={handleExportYrp}
              onImportReplay={handleImportReplay}
              onOpenReplayInYgo={handleOpenReplayInYgo}
              canOpenReplay={Boolean(replayInfo?.filePath)}
              isReplay={replayInfo !== null}
              onCheckUpdates={() => void useUpdateStore.getState().check()}
            />
          </div>
        </div>

        <div className="flex-1 h-full" />

        <div className="flex items-center gap-2 shrink-0 [-webkit-app-region:no-drag]">
          <Input
            type="text"
            value={state.title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={(e) => void commitDuelDocumentTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
            }}
            placeholder="未命名对局"
            className="h-7 w-52 bg-transparent hover:bg-muted/40 focus:bg-background text-xs font-medium border-transparent focus:border-border transition-colors"
          />

          <UpdateIndicator />

          <WindowControls className="-mr-3 ml-1" />
        </div>
      </div>

      <div className="h-9 px-3 bg-muted/30 flex items-center text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Select
              value={state.masterRule}
              onValueChange={(val) => {
                if (val !== null) setMasterRule(val as MasterRule)
              }}
            >
              <SelectTrigger size="sm" className="w-40 h-7 text-xs bg-background/60">
                <SelectValue>
                  {MASTER_RULES[state.masterRule]?.name ?? '大师规则（2020）'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {SELECTABLE_MASTER_RULES.map((rule) => {
                  const info = MASTER_RULES[rule]
                  return (
                    <SelectItem key={info.rule} value={info.rule}>
                      {info.name}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          <Separator orientation="vertical" className="h-4" />

          <MatchSelector />

          <Separator orientation="vertical" className="h-4" />

          <TurnPhaseIndicator />

          <Separator orientation="vertical" className="h-4" />

          <Button
            variant="outline"
            size="xs"
            disabled={isEngineLoading}
            onClick={() => void toggleSceneMode()}
            className={`h-7 px-2 text-[11px] font-bold gap-1 ${
              sceneEditing
                ? 'bg-amber-500/15 text-amber-600 border-amber-500/40 hover:bg-amber-500/25 dark:text-amber-400'
                : 'bg-background/60 text-muted-foreground border-border hover:bg-muted'
            }`}
          >
            {sceneEditing ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Clapperboard className="w-3.5 h-3.5" />
            )}
            <span>{sceneEditing ? (sceneDirty ? '完成布景' : '退出布景') : '布景'}</span>
          </Button>

          <Separator orientation="vertical" className="h-4" />

          {engineMode === 'running' ? (
            <div className="flex items-center gap-1.5">
              {mergedMatch && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                  近似校验
                </span>
              )}
              <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-500 dark:text-emerald-400 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping mr-0.5" />
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>规则校验中</span>
              </span>
              {!replayInfo && (
                <>
                  <Separator orientation="vertical" className="h-4" />
                  <ChainModeToggle />
                </>
              )}
              <Button
                variant="outline"
                size="xs"
                onClick={() => void suspendEngine()}
                className="h-7 px-2 text-[11px] font-bold gap-1 bg-background/60 text-muted-foreground hover:bg-destructive/10 hover:text-destructive border-border"
              >
                <Square className="w-3 h-3 fill-current" />
                <span>退出引擎</span>
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              {suspendedDoc && canResume && (
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => void handleResume()}
                  disabled={isEngineLoading || engineUnsupported}
                  className="h-7 px-2 text-[11px] font-bold gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                >
                  {isEngineLoading ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Play className="w-3 h-3 fill-current" />
                  )}
                  <span>{isEngineLoading ? '正在恢复...' : '继续上次会话'}</span>
                </Button>
              )}
              {showStartOver && (
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => void handleStartOver()}
                  disabled={isEngineLoading || engineUnsupported}
                  className="h-7 px-2 text-[11px] font-bold gap-1 bg-background/60 text-muted-foreground border-border hover:bg-muted"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>从头开始</span>
                </Button>
              )}
              {!canResume && (
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => void startEngine()}
                  disabled={isEngineLoading || engineUnsupported}
                  className="h-7 px-2 text-[11px] font-bold gap-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>
                    {isEngineLoading
                      ? '正在启动...'
                      : engineUnsupported
                        ? 'KCG 不支持'
                        : '启动规则校验'}
                  </span>
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      <UpdateDialog />

      {importingReplay && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/35 backdrop-blur-[2px]"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-5 py-4 shadow-2xl">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <div>
              <div className="text-sm font-semibold">正在导入回放</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                正在启动内置引擎并解析 YRP，可能需要几秒
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
