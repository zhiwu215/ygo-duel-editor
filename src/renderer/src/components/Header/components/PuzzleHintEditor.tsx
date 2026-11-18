import { useRef } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useDuelStore } from '../../../stores/useDuelStore'
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger
} from '../../ui/popover'
import { Textarea } from '../../ui/textarea'
import { Button } from '../../ui/button'

export function PuzzleHintEditor() {
  const hint = useDuelStore((state) => state.state.hint)
  const setHint = useDuelStore((state) => state.setHint)
  const focusAdded = useRef(false)
  function removeEmptyHints() {
    const { state, setHint } = useDuelStore.getState()
    if (state.hint.some((text) => !text.trim())) setHint(state.hint.filter((text) => text.trim()))
  }
  return (
    <Popover onOpenChange={() => removeEmptyHints()}>
      <PopoverTrigger render={<Button variant="outline" size="xs" />}>开场提示</PopoverTrigger>
      <PopoverContent className="w-80">
        <PopoverTitle>开场提示</PopoverTitle>
        <PopoverDescription>玩家打开残局时，游戏会依次弹出这里填写的消息。</PopoverDescription>
        <div className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto">
          {hint.map((message, index) => (
            <div
              key={index}
              className="flex items-start gap-1"
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget) && !message.trim())
                  removeEmptyHints()
              }}
            >
              <Textarea
                className="focus-visible:ring-0"
                aria-label={`第 ${index + 1} 条开场提示`}
                ref={(element) => {
                  if (element && focusAdded.current && index === hint.length - 1) {
                    focusAdded.current = false
                    element.focus()
                  }
                }}
                value={message}
                onChange={(event) =>
                  setHint(hint.map((text, i) => (i === index ? event.target.value : text)))
                }
              />
              <Button
                variant="ghost"
                size="xs"
                aria-label={`删除第 ${index + 1} 条提示`}
                onClick={() => setHint(hint.filter((_, i) => i !== index))}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
        </div>
        <Button
          variant="ghost"
          size="xs"
          className="self-start"
          onClick={() => {
            focusAdded.current = true
            setHint([...useDuelStore.getState().state.hint.filter((text) => text.trim()), ''])
          }}
        >
          <Plus />
          添加文本
        </Button>
      </PopoverContent>
    </Popover>
  )
}
