import React from 'react'
import { useDialogStore } from '../../stores/useDialogStore'
import { ConfirmDialog } from './ConfirmDialog'
import { PromptDialog } from './PromptDialog'

export const ConfirmDialogHost: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const requests = useDialogStore((state) => state.requests)
  const settle = useDialogStore((state) => state.settle)

  return (
    <>
      {children}
      {requests.map((request) =>
        request.kind === 'prompt' ? (
          <PromptDialog
            key={request.id}
            open
            title={request.title}
            placeholder={request.placeholder}
            confirmText={request.confirmText}
            initialValue={request.initialValue}
            validate={request.validate}
            onConfirm={(text) => settle(request.id, text)}
            onCancel={() => settle(request.id, null)}
          />
        ) : (
          <ConfirmDialog
            key={request.id}
            open
            title={request.title}
            description={request.description}
            confirmText={request.kind === 'alert' ? '知道了' : request.confirmText}
            destructive={request.kind === 'confirm' && (request.destructive ?? true)}
            icon={request.icon ?? (request.kind === 'alert' ? 'info' : 'warning')}
            showCancel={request.kind === 'confirm'}
            extraText={request.extraAction?.text}
            onConfirm={() => settle(request.id, true)}
            onCancel={() => settle(request.id, false)}
            onExtra={
              request.extraAction
                ? () => {
                    const action = request.extraAction
                    if (action) settle(request.id, action.value)
                  }
                : undefined
            }
          />
        )
      )}
    </>
  )
}
