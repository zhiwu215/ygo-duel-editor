import React, { useState } from 'react'
import { BookOpen } from 'lucide-react'
import { WindowControls } from '../ui/window-controls'
import { cn } from '../../lib/utils'
import { ScreenplayTextLibrary } from './ScreenplayTextLibrary'
import { MaterialLibraryPanel } from '../MaterialLibrary/MaterialLibraryPanel'

type TextLibraryTab = 'screenplay' | 'material'

const TABS: { id: TextLibraryTab; label: string }[] = [
  { id: 'screenplay', label: '台本文本' },
  { id: 'material', label: '素材文本' }
]

export const TextLibraryApp: React.FC = () => {
  const [tab, setTab] = useState<TextLibraryTab>('screenplay')

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      <header className="shrink-0 border-b border-border/60 [-webkit-app-region:drag]">
        <div className="flex h-11 items-center gap-3 px-4">
          <div className="flex min-w-0 items-center gap-2">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-bold">文本库</span>
          </div>
          <div className="ml-2 flex rounded-md border border-border/60 bg-muted/50 p-0.5 [-webkit-app-region:no-drag]">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={cn(
                  'rounded px-2.5 py-1 text-[11px] font-medium transition-colors',
                  tab === item.id
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <div className="mr-[-1rem] flex items-center gap-2 [-webkit-app-region:no-drag]">
            <WindowControls />
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className={cn('flex min-h-0 w-full flex-1', tab !== 'screenplay' && 'hidden')}>
          <ScreenplayTextLibrary />
        </div>
        <div className={cn('flex min-h-0 w-full flex-1', tab !== 'material' && 'hidden')}>
          <MaterialLibraryPanel />
        </div>
      </div>
    </div>
  )
}
