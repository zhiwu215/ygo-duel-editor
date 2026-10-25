import React from 'react'
import { Pencil } from 'lucide-react'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { formatSetcodeInput } from '../../utils/customCardForm'
import { SetcodeNamePicker } from './SetcodeNamePicker'

interface SetcodeFieldsProps {
  values: string[]
  options: Array<{ code: number; name: string }>
  localNames: Record<string, string>
  onChange: (index: number, value: string) => void
  onRename: (codeHex: string) => void
}

export const SetcodeFields: React.FC<SetcodeFieldsProps> = ({
  values,
  options,
  localNames,
  onChange,
  onRename
}) => {
  const known = new Map<string, string>()
  for (const option of options) {
    const hex = option.code.toString(16).padStart(4, '0').toUpperCase()
    if (!known.has(hex)) known.set(hex, option.name)
  }

  const focusHexInput = (index: number): void => {
    requestAnimationFrame(() => {
      const input = document.getElementById(`setcode-hex-${index}`) as HTMLInputElement | null
      input?.focus()
      input?.select()
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-[54px_104px_minmax(0,1fr)_28px] items-center gap-2">
        <span />
        <span className="text-[10px] text-muted-foreground">代码（hex）</span>
        <span className="text-[10px] text-muted-foreground">名称 / 搜索或选择系列</span>
        <span />
      </div>
      {values.map((value, index) => {
        const hex = value.toUpperCase()
        const normalizedHex = hex ? hex.padStart(4, '0') : ''
        const hasCode = Boolean(normalizedHex) && normalizedHex !== '0000'
        const knownName = hasCode ? known.get(normalizedHex) : undefined
        const localName = hasCode ? localNames[normalizedHex] : undefined
        return (
          <div
            key={index}
            className="grid grid-cols-[54px_104px_minmax(0,1fr)_28px] items-center gap-2"
          >
            <span className="text-[11px] text-muted-foreground">字段 {index + 1}</span>
            <div className="relative">
              <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 font-mono text-[10px] text-muted-foreground">
                0x
              </span>
              <Input
                id={`setcode-hex-${index}`}
                value={value}
                onChange={(event) => onChange(index, formatSetcodeInput(event.target.value))}
                onFocus={(event) => event.currentTarget.select()}
                aria-label={`字段 ${index + 1} 代码`}
                placeholder="0000"
                maxLength={6}
                spellCheck={false}
                className="h-8 pl-6 font-mono text-xs uppercase"
              />
            </div>
            <SetcodeNamePicker
              value={hasCode ? normalizedHex : ''}
              options={options}
              localName={localName}
              onSelect={(next) => onChange(index, next ? next.toUpperCase() : '')}
              onCustom={() => focusHexInput(index)}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              disabled={!hasCode || Boolean(knownName)}
              aria-label="编辑字段名称"
              onClick={() => onRename(normalizedHex)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </div>
        )
      })}
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        系列在游戏里用 4
        位十六进制代码保存，名称只用于显示和搜索；自定义代码可以点铅笔设置本地名称。
      </p>
      {options.length === 0 && (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          未读取到系列名称；请确认游戏目录下的 strings.conf 已加载，或直接填写十六进制代码。
        </p>
      )}
    </div>
  )
}
