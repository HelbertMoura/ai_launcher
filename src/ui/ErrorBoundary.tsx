import { Component, type ErrorInfo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import "./ErrorBoundary.css";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  reset = (): void => this.setState({ error: null });

  render(): ReactNode {
    if (this.state.error) {
      return (
        this.props.fallback ?? (
          <ErrorFallback error={this.state.error} reset={this.reset} />
        )
      );
    }
    return this.props.children;
  }
}

function ErrorFallback({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}): ReactNode {
  const { t } = useTranslation();
  return (
    <div className="cd-error-boundary" role="alert">
      <h2 className="cd-error-boundary__title">{t("errorBoundary.title")}</h2>
      <p className="cd-error-boundary__message">{t("errorBoundary.message")}</p>
      <pre className="cd-error-boundary__details">{error.message}</pre>
      <button
        type="button"
        className="cd-error-boundary__button"
        onClick={reset}
      >
        {t("errorBoundary.retry")}
      </button>
    </div>
  );
}
