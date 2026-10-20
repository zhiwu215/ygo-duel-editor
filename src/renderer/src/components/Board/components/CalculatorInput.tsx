import React, { useEffect, useRef, useState } from 'react'
import { INFINITY_VALUE, isInfiniteVal } from '@shared/index'
import {
  parseLpExpression,
  detectCurrentOp,
  switchOperator,
  LpOperator
} from '../../../utils/lpMath'
import { Button } from '../../ui/button'
import { RotateCcw } from 'lucide-react'
import { cn } from '../../../lib/utils'

const OP_BUTTONS: {
  op: LpOperator
  label: string
  activeClass: string
}[] = [
  { op: '-', label: '- 减', activeClass: 'bg-rose-600 text-white border-rose-600 shadow-sm' },
  { op: '+', label: '+ 加', activeClass: 'bg-emerald-600 text-white border-emerald-600 shadow-sm' },
  { op: '/', label: '÷ 除', activeClass: 'bg-blue-600 text-white border-blue-600 shadow-sm' },
  { op: '*', label: '× 乘', activeClass: 'bg-purple-600 text-white border-purple-600 shadow-sm' },
  {
    op: '=',
    label: '= 改',
    activeClass: 'border-border bg-background text-foreground'
  },
  {
    op: 'inf',
    label: '无限',
    activeClass:
      'bg-slate-700 text-white dark:bg-slate-300 dark:text-slate-900 border-transparent shadow-sm'
  }
]

export interface CalculatorInputProps {
  label?: string
  unit: string
  value: number
  displayValue?: number
  inputTitle: string
  origVal?: number
  isModified?: boolean
  size?: 'default' | 'sm'
  density?: 'default' | 'compact'
  popoverPlacement?: 'top' | 'bottom'
  align?: 'left' | 'right'
  onCommit: (val: number | undefined) => void
}

export const CalculatorInput: React.FC<CalculatorInputProps> = ({
  label,
  unit,
  value,
  displayValue = value,
  inputTitle,
  origVal,
  isModified,
  size = 'default',
  density = 'default',
  popoverPlacement = 'bottom',
  align = 'right',
  onCommit
}) => {
  const [isFocused, setIsFocused] = useState(false)
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const isCommittingRef = useRef(false)

  const isCompact = density === 'compact'
  const withTooltips = isCompact
  const isInf = isInfiniteVal(value)
  const shownValue = isFocused ? text : isInf ? '无限' : String(displayValue)
  const parseResult = parseLpExpression(shownValue, value)
  const activeOp = detectCurrentOp(shownValue)

  const textRef = useRef(shownValue)
  useEffect(() => {
    textRef.current = shownValue
  }, [shownValue])

  const commitValue = (targetVal: number | undefined): void => {
    if (isCommittingRef.current) return
    isCommittingRef.current = true

    onCommit(targetVal)
    setIsFocused(false)
    inputRef.current?.blur()

    setTimeout(() => {
      isCommittingRef.current = false
    }, 120)
  }

  const handleCommit = (): void => {
    if (isCommittingRef.current) return
    const parsed = parseLpExpression(textRef.current, value)
    if (parsed.valid) {
      commitValue(parsed.result)
    } else {
      setIsFocused(false)
      inputRef.current?.blur()
    }
  }

  const handleCancel = (): void => {
    setIsFocused(false)
    inputRef.current?.blur()
  }

  const isTop = popoverPlacement === 'top'
  const isRight = align === 'right'

  const inputNode = (
    <input
      ref={inputRef}
      type="text"
      inputMode="text"
      value={shownValue}
      onFocus={(e) => {
        setIsFocused(true)
        const initialText = isInf ? '无限' : String(value)
        setText(initialText)
        textRef.current = initialText
        e.currentTarget.select()
      }}
      onBlur={() => {
        handleCommit()
      }}
      onChange={(e) => {
        setText(e.target.value)
        textRef.current = e.target.value
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          handleCommit()
        } else if (e.key === 'Escape') {
          e.preventDefault()
          handleCancel()
        }
      }}
      title={withTooltips ? undefined : inputTitle}
      className={cn(
        isCompact
          ? size === 'sm'
            ? 'w-14 h-4.5 text-[10px] px-1'
            : 'w-16 h-6 text-xs px-1.5'
          : 'w-16 h-6 rounded border border-border/70 bg-background text-right font-mono font-bold text-xs px-1.5 select-all text-foreground',
        isCompact
          ? 'rounded border border-border/60 bg-background/60 text-right font-mono font-medium select-all text-foreground'
          : '',
        'focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 transition-colors',
        isCompact ? isInf && !isFocused && 'font-bold' : isInf && !isFocused && 'font-bold text-xs',
        isFocused &&
          parseResult.valid &&
          parseResult.result !== value &&
          'border-blue-400/80 bg-blue-500/5'
      )}
    />
  )

  const inputElement = withTooltips ? inputNode : inputNode

  const opPanel = isFocused ? (
    <div
      onMouseDown={(e) => e.preventDefault()}
      className={cn(
        isCompact
          ? 'absolute z-50 bg-popover/95 text-popover-foreground border border-border/80 shadow-xl rounded-lg px-2 py-1.5 flex flex-col gap-1 backdrop-blur-md min-w-[240px] select-none animate-in fade-in-0 zoom-in-95 duration-100'
          : 'absolute top-full right-0 mt-1 z-50 bg-popover/95 text-popover-foreground border border-border/80 shadow-2xl rounded-lg p-2.5 flex flex-col gap-2 backdrop-blur-md min-w-[264px] select-none animate-in fade-in-0 zoom-in-95 duration-100',
        isCompact && (isTop ? 'bottom-full mb-1' : 'top-full mt-1'),
        isCompact && (isRight ? 'right-0' : 'left-0')
      )}
    >
      <div className="flex flex-col gap-1">
        <div
          className={
            isCompact
              ? 'flex items-center justify-between text-[9px] text-muted-foreground font-medium px-0.5'
              : 'flex items-center justify-between text-[10px] text-muted-foreground font-medium px-0.5'
          }
        >
          <span>选择运算模式</span>
          <span>{isCompact ? '输入任意数值或键入 inf' : '输入数值或键入 inf'}</span>
        </div>
        <div className="grid grid-cols-6 gap-1">
          {OP_BUTTONS.map((btn) => {
            const buttonNode = (
              <button
                key={btn.op}
                type="button"
                onClick={() => {
                  if (btn.op === 'inf') {
                    setText('无限')
                    textRef.current = '无限'
                    commitValue(INFINITY_VALUE)
                    return
                  }
                  const nextText = switchOperator(shownValue, btn.op, value)
                  setText(nextText)
                  textRef.current = nextText
                  inputRef.current?.focus()
                  setTimeout(() => {
                    if (inputRef.current) {
                      const len = inputRef.current.value.length
                      inputRef.current.setSelectionRange(len, len)
                    }
                  }, 0)
                }}
                title={withTooltips ? undefined : `切换为 ${btn.label} 模式`}
                className={cn(
                  isCompact
                    ? 'py-0.5 text-[10px] font-mono font-semibold rounded border transition-colors flex items-center justify-center whitespace-nowrap'
                    : 'py-1 text-[11px] font-mono font-semibold rounded border transition-colors flex items-center justify-center whitespace-nowrap',
                  activeOp === btn.op
                    ? btn.activeClass
                    : 'border-border/60 bg-background/80 hover:bg-muted text-muted-foreground hover:text-foreground'
                )}
              >
                {btn.label}
              </button>
            )
            return withTooltips ? buttonNode : buttonNode
          })}
        </div>
      </div>

      <div
        className={
          isCompact
            ? 'flex items-center justify-between text-[11px] font-mono px-2 py-0.5 rounded bg-muted/60 border border-border/40'
            : 'flex items-center justify-between text-xs font-mono px-2 py-1.5 rounded bg-muted/60 border border-border/40'
        }
      >
        {withTooltips ? (
          <span className="text-muted-foreground truncate max-w-[120px]">
            {parseResult.formula}
          </span>
        ) : (
          <span
            className="text-muted-foreground truncate max-w-[125px]"
            title={parseResult.formula}
          >
            {parseResult.formula}
          </span>
        )}
        <span
          className={cn(
            'font-bold shrink-0 ml-1.5',
            parseResult.valid
              ? 'text-foreground'
              : isCompact
                ? 'text-muted-foreground text-[10px]'
                : 'text-muted-foreground text-[11px]'
          )}
        >
          {parseResult.valid
            ? `→ ${isInfiniteVal(parseResult.result) ? '无限' : parseResult.result} ${unit}`
            : '等待输入'}
        </span>
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-border/40 gap-2">
        <span
          className={
            isCompact
              ? 'text-[9px] text-muted-foreground/75 truncate'
              : 'text-[10px] text-muted-foreground/75 truncate'
          }
        >
          输入后按 Enter 或点击确定
        </span>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleCancel}
            className="px-2 py-0.5 text-[10px] rounded border border-border/60 hover:bg-muted text-muted-foreground transition-colors"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleCommit}
            disabled={!parseResult.valid}
            className={cn(
              'px-2 py-0.5 text-[10px] font-bold rounded shadow-xs transition-colors',
              parseResult.valid
                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                : 'bg-muted text-muted-foreground cursor-not-allowed opacity-50'
            )}
          >
            确定
          </button>
        </div>
      </div>
    </div>
  ) : null

  return (
    <>
      {isModified && origVal !== undefined && (
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => commitValue(undefined)}
          title={`恢复原本${label} (${origVal === -2 ? '?' : origVal})`}
          className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-muted shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </Button>
      )}
      {inputElement}
      {opPanel}
    </>
  )
}
