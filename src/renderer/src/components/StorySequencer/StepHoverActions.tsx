import React from 'react'
import { DuelStep } from '@shared/index'
import { useDuelStore } from '../../stores/useDuelStore'
import { Button } from '../ui/button'
import { BookOpen, ChevronDown, ChevronUp, Trash2 } from 'lucide-react'

interface StepHoverActionsProps {
  step: DuelStep
  index: number
  stepsLength: number
  canReorder: boolean
}

export const StepHoverActions: React.FC<StepHoverActionsProps> = ({
  step,
  index,
  stepsLength,
  canReorder
}) => {
  const moveStep = useDuelStore((state) => state.moveStep)
  const deleteStep = useDuelStore((state) => state.deleteStep)
  const openScreenplayWithStep = useDuelStore((state) => state.openScreenplayWithStep)

  return (
    <div className="absolute right-1 top-1 z-20 flex items-center gap-0.5 rounded border border-border bg-background/95 p-0.5 opacity-0 shadow-sm backdrop-blur-sm transition-opacity group-hover/step:opacity-100">
      <Button
        size="icon-xs"
        variant="ghost"
        onClick={(event) => {
          event.stopPropagation()
          openScreenplayWithStep(step.id)
        }}
        className="h-5 w-5 text-muted-foreground hover:text-foreground"
        aria-label="在台本中查看这一步"
      >
        <BookOpen className="h-3 w-3" />
      </Button>
      {canReorder && (
        <>
          <Button
            size="icon-xs"
            variant="ghost"
            disabled={index === 0}
            onClick={(event) => {
              event.stopPropagation()
              moveStep(step.id, 'up')
            }}
            className="h-5 w-5 text-muted-foreground hover:text-foreground"
            aria-label="上移这一步"
          >
            <ChevronUp className="h-3 w-3" />
          </Button>
          <Button
            size="icon-xs"
            variant="ghost"
            disabled={index === stepsLength - 1}
            onClick={(event) => {
              event.stopPropagation()
              moveStep(step.id, 'down')
            }}
            className="h-5 w-5 text-muted-foreground hover:text-foreground"
            aria-label="下移这一步"
          >
            <ChevronDown className="h-3 w-3" />
          </Button>
          <Button
            size="icon-xs"
            variant="ghost"
            onClick={(event) => {
              event.stopPropagation()
              deleteStep(step.id)
            }}
            className="h-5 w-5 text-muted-foreground hover:text-destructive"
            aria-label="删除这一步"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </>
      )}
    </div>
  )
}
