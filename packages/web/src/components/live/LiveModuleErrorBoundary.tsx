import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../config/paths.js';

type Props = {
  moduleName: string;
  children: ReactNode;
};

type State = {
  error: Error | null;
};

/** Keeps a single live module failure from crashing the whole shell. */
export default class LiveModuleErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`[Hub CRM] ${this.props.moduleName} render error`, error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="card hub-live-empty" style={{ margin: '24px' }}>
          <p className="hub-live-empty__title">{this.props.moduleName} could not load</p>
          <p className="text-muted text-sm" style={{ marginTop: 8 }}>
            {this.state.error.message || 'An unexpected error occurred.'}
          </p>
          <Link to={ROUTES.dashboard} className="btn btn-secondary btn-sm" style={{ marginTop: 16 }}>
            Back to Home
          </Link>
        </div>
      );
    }
    return this.props.children;
  }
}

export function withLiveModuleBoundary(moduleName: string, page: ReactNode): ReactNode {
  return <LiveModuleErrorBoundary moduleName={moduleName}>{page}</LiveModuleErrorBoundary>;
}
