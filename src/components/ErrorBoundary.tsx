import { Component, ReactNode, ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { safeStorage } from '../services/storageHelper';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    showDetails: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by VozPDF ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  private handleResetAndReload = () => {
    try {
      safeStorage.removeItem('vozpdf_theme');
      safeStorage.removeItem('vozpdf_engine');
      safeStorage.removeItem('vozpdf_voice');
      safeStorage.removeItem('vozpdf_speed');
      safeStorage.removeItem('vozpdf_pitch');
      safeStorage.removeItem('vozpdf_volume');
      safeStorage.removeItem('vozpdf_cleaning');
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.clear();
      }
    } catch {
      // ignore
    }
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      const errorMessage = this.state.error?.message || 'Error desconocido';
      const errorStack = this.state.error?.stack || '';
      const componentStack = this.state.errorInfo?.componentStack || '';

      return (
        <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-2xl">
            <div className="w-14 h-14 bg-red-500/20 text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <h2 className="text-xl font-bold text-center mb-2">Se ha producido un error</h2>
            <p className="text-sm text-slate-300 text-center mb-4">
              Ocurrió un problema durante la ejecución:
            </p>

            <div className="bg-slate-950/80 border border-red-500/30 rounded-xl p-3 mb-5 font-mono text-xs text-red-300 break-words max-h-32 overflow-y-auto">
              {errorMessage}
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 mb-4">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-medium text-white transition-colors cursor-pointer shadow-lg shadow-indigo-600/20 text-sm"
              >
                <RefreshCw className="w-4 h-4" />
                Recargar
              </button>

              <button
                type="button"
                onClick={this.handleResetAndReload}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 font-medium text-slate-200 transition-colors cursor-pointer text-sm"
                title="Borra la configuración local guardada y reintenta"
              >
                <Trash2 className="w-4 h-4" />
                Restablecer datos
              </button>
            </div>

            {/* Collapsible Details */}
            <div className="border-t border-slate-700/80 pt-3">
              <button
                type="button"
                onClick={() => this.setState((prev) => ({ showDetails: !prev.showDetails }))}
                className="w-full flex items-center justify-between text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer py-1"
              >
                <span>Detalles técnicos del error</span>
                {this.state.showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {this.state.showDetails && (
                <pre className="mt-2 p-3 bg-slate-950 rounded-lg text-[10px] text-slate-400 overflow-x-auto max-h-48 whitespace-pre-wrap">
                  {errorStack || componentStack || 'No hay traza adicional disponible.'}
                </pre>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
