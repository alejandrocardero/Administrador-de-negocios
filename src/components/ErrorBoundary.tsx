import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
  componentStack: string
}

/**
 * Evita la "pantalla en blanco": si cualquier componente falla al renderizar,
 * muestra el error exacto y un botón para recargar, en lugar de desmontar toda la app.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, componentStack: '' }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary capturó un error:', error, info.componentStack)
    this.setState({ componentStack: info.componentStack ?? '' })
  }

  render() {
    const { error, componentStack } = this.state

    if (!error) return this.props.children

    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
        <div className="max-w-xl w-full bg-white rounded-lg border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold text-lg">
              !
            </div>
            <h1 className="text-lg font-semibold text-slate-800">Algo salió mal</h1>
          </div>
          <p className="text-sm text-slate-500">
            La app encontró un error inesperado. Copia el mensaje de abajo y repórtalo
            para poder corregirlo.
          </p>
          <pre className="text-xs bg-slate-900 text-red-300 p-3 rounded-md overflow-auto max-h-48 whitespace-pre-wrap">
            {error.message}
          </pre>
          {componentStack ? (
            <pre className="text-xs bg-slate-100 text-slate-600 p-3 rounded-md overflow-auto max-h-48 whitespace-pre-wrap">
              {componentStack}
            </pre>
          ) : null}
          <button
            onClick={() => window.location.reload()}
            className="w-full h-10 rounded-md bg-slate-900 text-white text-sm font-medium"
          >
            Recargar la app
          </button>
        </div>
      </div>
    )
  }
}
