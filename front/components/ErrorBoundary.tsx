import React, { Component, type ErrorInfo, type ReactNode } from 'react';

export interface ErrorBoundaryProps {
  children: ReactNode;
  /** Mensagem amigável exibida ao utilizador */
  message?: string;
  /** Título da área (ex: "Área Admin", "Loja") para contexto */
  areaName?: string;
  /** Callback ao clicar em "Voltar" */
  onBack?: () => void;
  /** Mostrar botão "Tentar novamente" que remonta os filhos */
  onRetry?: () => void;
  /** Conteúdo do botão voltar */
  backLabel?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary por área (admin / rotas públicas).
 * Em caso de erro no render ou lifecycle dos filhos, mostra mensagem amigável
 * e opção de voltar em vez de tela branca.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, State> {
  state: State = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    if (import.meta.env.DEV) {
      console.error('[ErrorBoundary]', error, errorInfo);
    }
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
    if (this.props.onRetry) {
      this.props.onRetry();
    } else {
      window.location.reload();
    }
  };

  private isNetworkOr504Error(error: Error): boolean {
    const msg = (error?.message ?? '').toLowerCase();
    return (
      msg.includes('504') ||
      msg.includes('gateway timeout') ||
      msg.includes('failed to fetch') ||
      msg.includes('networkerror') ||
      msg.includes('network request failed') ||
      msg.includes('load failed') ||
      msg.includes('chunk') && msg.includes('load')
    );
  }

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      const {
        message,
        areaName,
        onBack,
        backLabel = 'Voltar',
      } = this.props;

      const is504OrNetwork = this.isNetworkOr504Error(this.state.error);
      const displayMessage = message ?? (
        is504OrNetwork
          ? 'O servidor demorou a responder ou houve um problema de ligação. Tente novamente em instantes.'
          : 'Ocorreu um erro inesperado nesta página.'
      );

      return (
        <div
          className="min-h-[40vh] flex flex-col items-center justify-center p-6 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200"
          role="alert"
        >
          <div className="max-w-md text-center space-y-4">
            {areaName && (
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                {areaName}
              </p>
            )}
            <p className="text-lg">{displayMessage}</p>
            {import.meta.env.DEV && this.state.error && (
              <pre className="text-left text-xs bg-gray-200 dark:bg-gray-800 p-3 rounded overflow-auto max-h-32">
                {this.state.error.message}
              </pre>
            )}
            <div className="flex flex-wrap gap-3 justify-center">
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="px-4 py-2 rounded-lg bg-brand-600 text-white hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  {backLabel}
                </button>
              )}
              <button
                type="button"
                onClick={this.handleRetry}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-400"
              >
                Tentar novamente
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
