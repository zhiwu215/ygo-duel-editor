import React, { useState, useRef, useEffect } from 'react'
import { isInfiniteVal, INFINITY_VALUE } from '@shared/index'
import {
  parseLpExpression,
  detectCurrentOp,
  switchOperator,
  LpOperator
} from '../../../utils/lpMath'
import { cn } from '../../../lib/utils'

export interface LpInputProps {
  /** 当前生命值数值 */
  lp: number
  /** 生命值变更回调 */
  onLpChange: (lp: number) => void
  /** 可选：玩家编号 (0: 我方, 1: 对方) */
  player?: 0 | 1
  /** 可选：前置标签（如 'LP', '队伍 LP'；缺省时不显示） */
  label?: string
  /** 可选：前置指示圆点的颜色类名 (如 'bg-blue-500' / 'bg-red-500') */
  dotClass?: string
  /** 可选：输入框尺寸模式 ('default' | 'sm'，默认 'sm') */
  size?: 'default' | 'sm'
  /** 可选：弹窗弹出方向 ('top' | 'bottom' | 'auto')，默认 player === 0 向上弹，player === 1 向下弹 */
  popoverPlacement?: 'top' | 'bottom' | 'auto'
  /** 可选：水平对齐 ('left' | 'right'，默认 'right') */
  align?: 'left' | 'right'
  /** 可选：外层 className */
  className?: string
}

/** 四则运算与直接修改按钮配置 */
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

/**
 * 决斗生命值计算器输入组件：
 * - 纯净文本框，无原生微调箭头，支持显示无限生命值 (无限)
 * - 点击聚焦浮出加减乘除四则运算与无限设置面板
 * - 支持点击选择 [减/加/除/乘/改/无限] 后直接输入自选数值或一键设为无限
 * - 支持直接从键盘键入任意数值、算式或 无限/inf (如 -1100, /2, 4000, inf, 无限)
 * - 实时显示公式计算结果，按 Enter 提交
 */
export const LpInput: React.FC<LpInputProps> = ({
  lp,
  onLpChange,
  player,
  label,
  dotClass,
  size = 'sm',
  popoverPlacement = 'auto',
  align = 'right',
  className
}) => {
  const [isFocused, setIsFocused] = useState(false)
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const isCommittingRef = useRef(false)

  // 未聚焦时直接展示外部传入的最新 lp (若为无限则展示 '无限')；聚焦时使用编辑草稿 text
  const displayValue = isFocused ? text : isInfiniteVal(lp) ? '无限' : String(lp)
  const parseResult = parseLpExpression(displayValue, lp)
  const activeOp = detectCurrentOp(displayValue)

  // 保证 textRef 始终同步最新的 displayValue，防止闭包陈旧
  const textRef = useRef(displayValue)
  useEffect(() => {
    textRef.current = displayValue
  }, [displayValue])

  const commitValue = (targetVal: number): void => {
    if (isCommittingRef.current) return
    isCommittingRef.current = true

    if (targetVal !== lp) {
      onLpChange(targetVal)
    }
    setIsFocused(false)
    inputRef.current?.blur()

    setTimeout(() => {
      isCommittingRef.current = false
    }, 120)
  }

  const handleCommit = (): void => {
    if (isCommittingRef.current) return
    const parsed = parseLpExpression(textRef.current, lp)
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

  const isTop = popoverPlacement === 'top' || (popoverPlacement === 'auto' && player === 0)
  const isRight = align === 'right'

  return (
    <div className={cn('relative flex items-center gap-1 select-none', className)}>
      {dotClass && <span className={cn('w-2 h-2 rounded-full shrink-0', dotClass)} />}
      {label && (
        <span
          className={cn(
            'text-muted-foreground select-none font-medium',
            size === 'sm' ? 'text-[10px]' : 'text-[11px]'
          )}
        >
          {label}
        </span>
      )}

      {/* 纯净数字输入框 (无原生微调箭头，等宽字体右对齐) */}
      <input
        ref={inputRef}
        type="text"
        inputMode="text"
        value={displayValue}
        onFocus={(e) => {
          setIsFocused(true)
          const initialText = isInfiniteVal(lp) ? '无限' : String(lp)
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
        className={cn(
          size === 'sm' ? 'w-14 h-4.5 text-[10px] px-1' : 'w-16 h-6 text-xs px-1.5',
          'rounded border border-border/60 bg-background/60 text-right font-mono font-medium select-all text-foreground',
          'focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 transition-colors',
          isInfiniteVal(lp) && !isFocused && 'font-bold',
          isFocused &&
            parseResult.valid &&
            parseResult.result !== lp &&
            'border-blue-400/80 bg-blue-500/5'
        )}
        title={
          label
            ? `${label}：${isInfiniteVal(lp) ? '无限' : `${lp} LP`}。点击直接改写，或选择加减乘除四则运算与无限`
            : `生命值：${isInfiniteVal(lp) ? '无限' : `${lp} LP`}。点击直接改写，或选择加减乘除四则运算与无限`
        }
      />

      {/* 聚焦时浮出的四则运算选择面板与实时算式预览 */}
      {isFocused && (
        <div
          onMouseDown={(e) => e.preventDefault()} // 阻止失焦，允许连贯点击运算符
          className={cn(
            'absolute z-50 bg-popover/95 text-popover-foreground border border-border/80 shadow-xl rounded-lg p-2 flex flex-col gap-1.5 backdrop-blur-md min-w-[240px] select-none animate-in fade-in-0 zoom-in-95 duration-100',
            isTop ? 'bottom-full mb-1' : 'top-full mt-1',
            isRight ? 'right-0' : 'left-0'
          )}
        >
          {/* 运算模式选择条 (减 / 加 / 除 / 乘 / 直接改 / 无限) */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-[9px] text-muted-foreground font-medium px-0.5">
              <span>选择运算模式</span>
              <span>输入任意数值或键入 inf</span>
            </div>
            <div className="grid grid-cols-6 gap-1">
              {OP_BUTTONS.map((btn) => (
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
                    const nextText = switchOperator(displayValue, btn.op, lp)
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
                  className={cn(
                    'py-0.5 text-[10px] font-mono font-semibold rounded border transition-colors flex items-center justify-center whitespace-nowrap',
                    activeOp === btn.op
                      ? btn.activeClass
                      : 'border-border/60 bg-background/80 hover:bg-muted text-muted-foreground hover:text-foreground'
                  )}
                  title={`切换为 ${btn.label} 模式`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          {/* 实时算式解析状态 */}
          <div className="flex items-center justify-between text-[11px] font-mono px-2 py-1 rounded bg-muted/60 border border-border/40">
            <span
              className="text-muted-foreground truncate max-w-[120px]"
              title={parseResult.formula}
            >
              {parseResult.formula}
            </span>
            <span
              className={cn(
                'font-bold shrink-0 ml-1.5',
                parseResult.valid ? 'text-foreground' : 'text-muted-foreground text-[10px]'
              )}
            >
              {parseResult.valid
                ? `→ ${isInfiniteVal(parseResult.result) ? '无限' : parseResult.result} LP`
                : '等待输入'}
            </span>
          </div>

          {/* 交互提示与快捷操作按钮 */}
          <div className="flex items-center justify-between pt-1 border-t border-border/40 gap-2">
            <span className="text-[9px] text-muted-foreground/75 truncate">
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
      )}
    </div>
  )
}
