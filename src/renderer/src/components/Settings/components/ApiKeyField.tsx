import { useState, type JSX } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '../../../lib/utils'
import { MODEL_HINT, MODEL_INPUT, MODEL_LABEL, MODEL_NOTICE } from './modelSettingsStyles'

interface ApiKeyFieldProps {
  value: string
  stored: boolean
  onChange: (value: string) => void
  message?: string
  messageTone?: 'hint' | 'notice'
}

export function ApiKeyField({
  value,
  stored,
  onChange,
  message,
  messageTone = 'hint'
}: ApiKeyFieldProps): JSX.Element {
  const [show, setShow] = useState(false)

  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex items-center gap-2.5">
        <span className={MODEL_LABEL}>API 密钥</span>
        <button
          type="button"
          title="API 密钥仅保存在本地配置文件，不会发送到模型提供商以外的位置。"
          aria-label="认证说明"
          className="inline-flex h-4 w-4 items-center justify-center rounded-full border-[0.5px] border-foreground/20 text-[9px] leading-none text-[#81858c] transition-colors hover:text-foreground dark:text-[#979da6]"
        >
          ?
        </button>
      </span>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={stored ? '留空使用已保存凭据' : '输入 API 密钥'}
          aria-label="API 密钥"
          spellCheck={false}
          autoComplete="new-password"
          className={cn(MODEL_INPUT, 'pr-10')}
        />
        {value.length > 0 && (
          <button
            type="button"
            onClick={() => setShow((current) => !current)}
            aria-label={show ? '隐藏密钥' : '显示密钥'}
            className="absolute top-1/2 right-1 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-[8px] text-[#81858c] transition-colors hover:bg-foreground/5 hover:text-foreground dark:text-[#979da6]"
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
      {message ? (
        <p className={messageTone === 'notice' ? MODEL_NOTICE : MODEL_HINT}>{message}</p>
      ) : null}
    </div>
  )
}
