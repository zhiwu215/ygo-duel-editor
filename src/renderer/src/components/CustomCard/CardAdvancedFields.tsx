import React, { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import type { CustomCardEditorForm } from '../../utils/customCardForm'
import { SetcodeFields } from './SetcodeFields'

interface CardAdvancedFieldsProps {
  form: CustomCardEditorForm
  setForm: React.Dispatch<React.SetStateAction<CustomCardEditorForm>>
  setnames: Array<{ code: number; name: string }>
  customSetcodeNames: Record<string, string>
  usedStringIds: number[]
  onRenameSetcode: (codeHex: string) => void
}

export const CardAdvancedFields: React.FC<CardAdvancedFieldsProps> = ({
  form,
  setForm,
  setnames,
  customSetcodeNames,
  usedStringIds,
  onRenameSetcode
}) => {
  const [open, setOpen] = useState<boolean>(false)
  const used = [...new Set(usedStringIds)]
    .filter((index) => index >= 0 && index < 16)
    .sort((a, b) => a - b)
  const filled = form.strings
    .map((text, index) => (text.trim() ? index : -1))
    .filter((index) => index >= 0)
  const stringIndexes = [...new Set([...used, ...filled])].sort((a, b) => a - b)

  const updateString = (index: number, value: string): void => {
    setForm((current) => {
      const strings = [...current.strings]
      strings[index] = value
      return { ...current, strings }
    })
  }

  const updateSetcode = (index: number, value: string): void => {
    setForm((current) => {
      const setcode = [...current.setcode]
      setcode[index] = value
      return { ...current, setcode }
    })
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-1.5 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/35 hover:text-foreground"
        >
          <ChevronRight className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-90' : ''}`} />
          高级选项
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="mt-3 flex flex-col gap-5 rounded-lg border border-border/60 p-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-[11px] text-muted-foreground">同名卡（Alias）</Label>
            <Input
              value={form.alias}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  alias: event.target.value.replace(/[^\d]/g, '').slice(0, 10)
                }))
              }
              inputMode="numeric"
              placeholder="0"
              className="h-8 font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              0 表示不设置；异画或复刻卡填原卡卡密，规则上会视为同名卡。
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-[11px] text-muted-foreground">字段/系列</Label>
            <SetcodeFields
              values={form.setcode}
              options={setnames}
              localNames={customSetcodeNames}
              onChange={updateSetcode}
              onRename={onRenameSetcode}
            />
          </div>

          {stringIndexes.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <Label className="text-[11px] text-muted-foreground">脚本提示文本</Label>
                <span className="text-[10px] text-muted-foreground">
                  脚本调用 Stringid 时才需要
                </span>
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                只显示脚本用到或已经填写的槽；普通卡不需要填写，它不会显示在卡面上。
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {stringIndexes.map((index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="w-9 shrink-0 font-mono text-[10px] text-muted-foreground">
                      str{index + 1}
                    </span>
                    <Input
                      value={form.strings[index] ?? ''}
                      onChange={(event) => updateString(index, event.target.value)}
                      className="h-8 text-xs"
                      placeholder={`aux.Stringid(id, ${index})`}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
