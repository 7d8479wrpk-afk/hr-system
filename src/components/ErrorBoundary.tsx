import React from 'react'

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  info: React.ErrorInfo | null
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null, info: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error, info: null }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('App crashed:', error, info)
    this.setState({ hasError: true, error, info })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
          <div className="w-full max-w-xl rounded-2xl border border-rose-100 bg-white p-6 shadow-lg">
            <h1 className="text-xl font-bold text-rose-700">App crashed</h1>
            <p className="mt-2 text-sm text-slate-700">
              {this.state.error?.message ?? 'Unexpected error'}
            </p>
            {this.state.error?.stack && (
              <pre className="mt-3 max-h-64 overflow-auto rounded bg-slate-900 px-3 py-2 text-xs text-rose-100">
                {this.state.error.stack}
              </pre>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
