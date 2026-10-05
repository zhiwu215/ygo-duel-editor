import React, { useEffect } from 'react'
import { Header } from './components/Header/Header'
import { RightSidebar } from './components/RightSidebar/RightSidebar'
import { DuelBoard } from './components/Board/DuelBoard'
import { LeftSidebar } from './components/LeftSidebar/LeftSidebar'
import { DuelScreenplayModal } from './components/StorySequencer/DuelScreenplayModal'
import { DeckEditorApp } from './components/DeckEditor/DeckEditorApp'
import { SettingsApp } from './components/Settings/SettingsApp'
import { CdbSetupModal } from './components/CardSearch/CdbSetupModal'
import { useConfigStore } from './stores/useConfigStore'

export function App(): React.JSX.Element {
  const { loadConfig } = useConfigStore()
  const isDeckEditor = window.location.hash === '#deck-editor'
  const isSettingsWindow = window.location.hash === '#settings'

  useEffect(() => {
    loadConfig()
  }, [loadConfig])

  if (isSettingsWindow) {
    return <SettingsApp />
  }

  if (isDeckEditor) {
    return (
      <>
        <DeckEditorApp />
        <CdbSetupModal />
      </>
    )
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-background text-foreground overflow-hidden">
      {/* 顶部工具与状态栏 */}
      <Header />

      {/* 主工作区：左侧工具栏 (VSCode 风格活动栏 + 卡片详情/背后灵) + 中央决斗战场 + 右侧检索/编排栏 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧：VSCode 风格活动栏与双模态面板 (卡片详情 / 背后灵) */}
        <LeftSidebar />

        {/* 中央：MR 动态决斗战场 */}
        <DuelBoard />

        {/* 右侧：卡片检索 / 步骤编排双模态面板 */}
        <RightSidebar />
      </div>

      {/* 决斗台本与剧本创作工作台全局弹窗 */}
      <DuelScreenplayModal />

      {/* 数据库未加载时的全局引导弹窗 */}
      <CdbSetupModal />
    </div>
  )
}

export default App
