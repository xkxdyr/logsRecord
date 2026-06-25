import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/Layout";
import { AlertTriangle, Home, ArrowLeft } from "lucide-react";

export default function NotFound() {
  const goBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = "/";
    }
  };

  return (
    <Layout>
      <PageHeader title="404" subtitle="页面未找到" />
      <div className="flex flex-col items-center justify-center p-12">
        <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-red-500/10">
          <AlertTriangle className="h-12 w-12 text-red-400" />
        </div>
        <h1 className="mb-3 font-display text-3xl font-bold text-white">页面不存在</h1>
        <p className="mb-8 text-zinc-500">
          您访问的页面可能已被删除、移动或从未存在过
        </p>
        <div className="flex gap-3">
          <button
            onClick={goBack}
            className="flex items-center gap-2 rounded-lg border border-base-500 bg-base-700 px-4 py-2.5 text-sm text-zinc-300 transition-colors hover:bg-base-600"
          >
            <ArrowLeft className="h-4 w-4" />
            返回上一页
          </button>
          <button
            onClick={() => window.location.href = "/"}
            className="flex items-center gap-2 rounded-lg bg-amber px-4 py-2.5 text-sm font-medium text-base-900 transition-colors hover:bg-amber/90"
          >
            <Home className="h-4 w-4" />
            返回首页
          </button>
        </div>
      </div>
    </Layout>
  );
}