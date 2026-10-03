import React, { useState, useRef } from 'react'
import {
  parseLpExpression,
  detectCurrentOp,
  switchOperator,
  LpOperator
} from '../../../utils/lpMath'
import { cn } from '../../../lib/utils'

interface LpInputProps {
  /** 玩家标签（如 '我方' / '对方'） */
  label: string
  /** 玩家编号 (0: 我方, 1: 对方) */
  player: 0 | 1
  /** 当前生命值数值 */
  lp: number
  /** 前置指示圆点的颜色类名 (如 'bg-blue-500' / 'bg-red-500') */
  dotClass: string
  /** 生命值变更回调 */
  onLpChange: (player: 0 | 1, lp: number) => void
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
    activeClass:
      'bg-slate-700 text-white dark:bg-slate-300 dark:text-slate-900 border-transparent shadow-sm'
  }
]

/**
 * 决斗生命值计算器输入组件：
 * - 纯净文本框，无原生微调箭头
 * - 点击聚焦浮出加减乘除四则运算面板
 * - 支持点击选择 [减/加/除/乘/改] 后直接输入自选数值
 * - 支持直接从键盘键入任意数值或算式 (如 -1100, /2, 4000)
 * - 实时显示公式计算结果，按 Enter 提交
 */
export const LpInput: React.FC<LpInputProps> = ({ label, player, lp, dotClass, onLpChange }) => {
  const [isFocused, setIsFocused] = useState(false)
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // 未聚焦时直接展示外部传入的最新 lp；聚焦时使用编辑草稿 text
  const displayValue = isFocused ? text : String(lp)
  const parseResult = parseLpExpression(displayValue, lp)
  const activeOp = detectCurrentOp(displayValue)

  const handleCommit = (): void => {
    if (parseResult.valid && parseResult.result !== lp) {
      onLpChange(player, parseResult.result)
    }
    setIsFocused(false)
    inputRef.current?.blur()
  }

  const handleCancel = (): void => {
    setIsFocused(false)
    inputRef.current?.blur()
  }

  return (
    <div className="relative flex items-center gap-1.5">
      <span className={cn('w-2 h-2 rounded-full shrink-0', dotClass)} />
      <span className="text-[11px] text-muted-foreground select-none">{label}</span>

      {/* 纯净数字输入框 (无原生微调箭头，等宽字体右对齐) */}
      <input
        ref={inputRef}
        type="text"
        inputMode="text"
        value={displayValue}
        onFocus={(e) => {
          setIsFocused(true)
          setText(String(lp))
          e.currentTarget.select()
        }}
        onBlur={() => {
          // 失去焦点自动提交有效算式结果
          handleCommit()
        }}
        onChange={(e) => {
          setText(e.target.value)
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
          'w-16 h-6 rounded border border-border/60 bg-background/60 text-right font-mono font-semibold text-xs px-1.5 py-0 select-all',
          'focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 transition-colors',
          // 当输入有效且有数值变动时，给予轻微高亮反馈
          isFocused &&
            parseResult.valid &&
            parseResult.result !== lp &&
            'border-blue-400/80 bg-blue-500/5'
        )}
        title={`${label}生命值：点击直接改写，或选择加减乘除四则运算`}
      />

      {/* 聚焦时浮出的四则运算选择面板与实时算式预览 */}
      {isFocused && (
        <div
          onMouseDown={(e) => e.preventDefault()} // 阻止失焦，允许连贯点击运算符
          className="absolute top-full left-0 mt-1 z-50 bg-popover/95 text-popover-foreground border border-border/80 shadow-xl rounded-lg p-2.5 flex flex-col gap-2 backdrop-blur-md min-w-[220px] select-none animate-in fade-in-0 zoom-in-95 duration-100"
        >
          {/* 四则运算选择条 (减 / 加 / 除 / 乘 / 直接改) */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground font-medium px-0.5">
              <span>选择运算模式</span>
              <span>输入任意数值</span>
            </div>
            <div className="grid grid-cols-5 gap-1">
              {OP_BUTTONS.map((btn) => (
                <button
                  key={btn.op}
                  type="button"
                  onClick={() => {
                    const nextText = switchOperator(displayValue, btn.op, lp)
                    setText(nextText)
                    inputRef.current?.focus()
                    setTimeout(() => {
                      if (inputRef.current) {
                        const len = inputRef.current.value.length
                        inputRef.current.setSelectionRange(len, len)
                      }
                    }, 0)
                  }}
                  className={cn(
                    'py-1 text-xs font-mono font-semibold rounded border transition-colors flex items-center justify-center',
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
          <div className="flex items-center justify-between text-xs font-mono px-2 py-1.5 rounded bg-muted/60 border border-border/40">
            <span
              className="text-muted-foreground truncate max-w-[110px]"
              title={parseResult.formula}
            >
              {parseResult.formula}
            </span>
            <span
              className={cn(
                'font-bold shrink-0 ml-1.5',
                parseResult.valid
                  ? 'text-blue-500 dark:text-blue-400'
                  : 'text-muted-foreground text-[11px]'
              )}
            >
              {parseResult.valid ? `→ ${parseResult.result} LP` : '等待输入'}
            </span>
          </div>

          {/* 交互提示 */}
          <div className="flex items-center justify-between text-[10px] text-muted-foreground/75 px-0.5 pt-0.5 border-t border-border/40">
            <span>点击运算符或直接键入</span>
            <span>
              <kbd className="font-sans px-1 rounded bg-muted border border-border/40">Enter</kbd>{' '}
              确认
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
