import React, { useEffect } from 'react'
import { Header } from './components/Header/Header'
import { CardSearchPanel } from './components/CardSearch/CardSearchPanel'
import { DuelBoard } from './components/Board/DuelBoard'
import { CardDetailPanel } from './components/CardDetail/CardDetailPanel'
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

      {/* 主工作区：左侧卡库搜索 + 中央主对战台 + 右侧卡片详情 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧：卡片资料检索抽屉 */}
        <CardSearchPanel />

        {/* 中央：MR 动态决斗战场 */}
        <DuelBoard />

        {/* 右侧：卡片大图与详细效果 */}
        <CardDetailPanel />
      </div>
    </div>
  )
}

export default App
