import './assets/globals.css'

import { Component, ErrorInfo, ReactNode, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { Button } from './components/ui/button'
import { ConfirmDialogHost } from './components/ui/ConfirmDialogHost'
import { TooltipProvider } from './components/ui/tooltip'

class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): { hasError: boolean; error: Error } {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught error:', error, errorInfo)
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-destructive bg-card h-screen w-screen overflow-auto font-mono text-xs">
          <h2 className="text-lg font-bold mb-2">运行时错误 (Runtime Error)</h2>
          <pre className="p-4 bg-muted rounded border border-border overflow-auto whitespace-pre-wrap">
            {this.state.error?.stack || this.state.error?.message}
          </pre>
          <Button
            variant="default"
            size="sm"
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-4"
          >
            重试 (Retry)
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <TooltipProvider>
        <ConfirmDialogHost>
          <App />
        </ConfirmDialogHost>
      </TooltipProvider>
    </ErrorBoundary>
  </StrictMode>
)
