import { Component, type ReactNode, type ErrorInfo } from "react";
import { AlertCircle, RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("Error Boundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-base-900 p-8">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10">
            <AlertCircle className="h-10 w-10 text-red-400" />
          </div>
          <h2 className="mb-2 font-display text-2xl font-bold text-white">
            应用出错了
          </h2>
          <p className="mb-6 text-zinc-500">
            {this.state.error?.message || "未知错误"}
          </p>
          {/* P1-9: 提供两个动作 - 返回首页（避免同 URL 再崩溃）+ 刷新重试 */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.location.assign("/")}
              className="flex items-center gap-2 rounded-lg bg-amber px-4 py-2.5 text-sm font-medium text-base-900 transition-colors hover:bg-amber/90"
            >
              <Home className="h-4 w-4" />
              返回首页
            </button>
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 rounded-lg border border-base-500 bg-base-700 px-4 py-2.5 text-sm text-zinc-300 transition-colors hover:border-base-400 hover:text-white"
            >
              <RefreshCw className="h-4 w-4" />
              刷新重试
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}