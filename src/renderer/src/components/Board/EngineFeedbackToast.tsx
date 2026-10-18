import React, { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useDuelEngineStore } from '../../stores/useDuelEngineStore'

/**
 * 引擎问答的反馈浮层：引擎拒绝操作 / 出错时显示，3 秒后自动消失。
 * 没有它，"点击没反应"的问题无从排查。
 */
export const EngineFeedbackToast: React.FC = () => {
  const error = useDuelEngineStore((s) => s.error)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!error) return
    setVisible(true)
    const timer = setTimeout(() => setVisible(false), 3000)
    return () => clearTimeout(timer)
  }, [error])

  if (!error || !visible) return null
  return (
    <div
      className="fixed top-16 left-1/2 -translate-x-1/2 z-[70] flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600/90 text-white text-xs shadow-2xl animate-in fade-in zoom-in-95 duration-100 select-none"
    >
      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
      <span>{error}</span>
    </div>
  )
}
