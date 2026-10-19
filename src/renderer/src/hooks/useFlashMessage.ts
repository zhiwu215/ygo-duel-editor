import { useCallback, useState } from 'react'

export function useFlashMessage<T = string>(duration: number): [T | null, (message: T) => void] {
  const [message, setMessage] = useState<T | null>(null)

  const flash = useCallback(
    (msg: T): void => {
      setMessage(msg)
      setTimeout(() => setMessage(null), duration)
    },
    [duration]
  )

  return [message, flash]
}
