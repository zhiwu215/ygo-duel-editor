import React from 'react'
import { useDialogStore } from '../../stores/useDialogStore'
import { ConfirmDialog } from '../Settings/components/ConfirmDialog'

export const ConfirmDialogHost: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const requests = useDialogStore((state) => state.requests)
  const settle = useDialogStore((state) => state.settle)

  return (
    <>
      {children}
      {requests.map((request) => (
        <ConfirmDialog
          key={request.id}
          open
          title={request.title}
          description={request.description}
          confirmText={request.kind === 'alert' ? '知道了' : request.confirmText}
          destructive={request.kind === 'confirm' && (request.destructive ?? true)}
          icon={request.kind === 'alert' ? 'info' : 'warning'}
          showCancel={request.kind === 'confirm'}
          onConfirm={() => settle(request.id, true)}
          onCancel={() => settle(request.id, false)}
        />
      ))}
    </>
  )
}
