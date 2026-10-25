import React from 'react'
import { Folder } from 'lucide-react'
import { cn } from '../../lib/utils'

interface DeckFolderTileProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string
  highlight?: boolean
}

export const DeckFolderTile: React.FC<DeckFolderTileProps> = ({
  label,
  highlight = false,
  className,
  ...props
}) => (
  <div
    className={cn(
      'group cursor-pointer rounded-md px-2 py-2.5 flex flex-col items-center gap-1.5 min-w-0 transition-colors',
      highlight ? 'bg-primary/15 ring-1 ring-inset ring-primary/50' : 'hover:bg-accent',
      className
    )}
    {...props}
  >
    <Folder
      className="h-11 w-11 text-foreground/75 fill-foreground/5 transition-colors group-hover:text-foreground"
      strokeWidth={1.5}
    />
    <span className="max-w-full rounded-sm px-1 text-center text-[11px] leading-tight font-medium text-foreground line-clamp-2 break-words group-hover:bg-accent-foreground/10">
      {label}
    </span>
  </div>
)
