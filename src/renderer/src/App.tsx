import React, { useEffect } from 'react'
import { Header } from './components/Header/Header'
import { RightSidebar } from './components/RightSidebar/RightSidebar'
import { DuelBoard } from './components/Board/DuelBoard'
import { CardDetailPanel } from './components/CardDetail/CardDetailPanel'
import { DuelScreenplayModal } from './components/StorySequencer/DuelScreenplayModal'
import { useConfigStore } from './stores/useConfigStore'

export function App(): React.JSX.Element {
  const { loadConfig } = useConfigStore()

  useEffect(() => {
    loadConfig()
  }, [])

  return (
    <div className="flex flex-col h-screen w-screen bg-background text-foreground overflow-hidden">
      {/* 顶部工具与状态栏 */}
      <Header />

      {/* 主工作区：左侧卡片详情 + 中央决斗战场 + 右侧双模态检索/步骤编排栏 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧：卡片大图与详细效果 */}
        <CardDetailPanel />

        {/* 中央：MR 动态决斗战场 */}
        <DuelBoard />

        {/* 右侧：卡片检索 / 步骤编排双模态面板 */}
        <RightSidebar />
      </div>

      {/* 决斗台本与剧本创作工作台全局弹窗 */}
      <DuelScreenplayModal />
    </div>
  )
}

export default App
