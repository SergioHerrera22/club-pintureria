import React from 'react';

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Error en la aplicación:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-white border border-red-200 rounded-xl p-6">
            <h1 className="text-xl font-bold text-red-600 mb-2">Ocurrió un error</h1>
            <p className="text-sm text-gray-600 mb-4">
              {this.state.error.message || 'Error desconocido'}
            </p>
            <pre className="text-xs bg-gray-50 border border-gray-200 rounded-lg p-3 overflow-auto max-h-48 mb-4 whitespace-pre-wrap">
              {this.state.error.stack}
            </pre>
            <div className="flex gap-3">
              <button
                onClick={() => { this.setState({ error: null }); window.location.href = '/'; }}
                className="btn-primary flex-1"
              >
                Recargar
              </button>
              <button
                onClick={() => { localStorage.clear(); window.location.href = '/login'; }}
                className="btn-secondary flex-1"
              >
                Cerrar sesión y recargar
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
