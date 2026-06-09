import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { error: Error | null };

export default class RootErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Hub CRM] Root render error', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="root-error" role="alert">
        <h1>Something went wrong loading the app</h1>
        <p>{this.state.error.message}</p>
        <p className="root-error__hint">
          Try a hard refresh (Ctrl+Shift+R). If this persists, restart the dev server on the port Vite
          prints (often <strong>5173</strong> or <strong>5174</strong>).
        </p>
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    );
  }
}
