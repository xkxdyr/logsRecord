import { useState } from "react";
import { Send, Copy, Check, Terminal, Zap, BookOpen, KeyRound } from "lucide-react";
import { Layout, PageHeader } from "@/components/Layout";
import { api } from "@/lib/api";
import type { LogLevel } from "../../shared/types";
import { LEVELS } from "../../shared/types";
import { cn } from "@/lib/utils";

const CURL_EXAMPLE = `curl -X POST http://localhost:3001/api/logs \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -d '{
    "service": "payment-service",
    "level": "ERROR",
    "message": "Database connection timeout after 30s",
    "attributes": {
      "host": "prod-db-01",
      "trace_id": "abc123"
    }
  }'`;

const SDK_EXAMPLE = `import { LogVerse } from '@logverse/sdk';

const logger = new LogVerse({
  endpoint: 'http://localhost:3001',
  service: 'payment-service',
  apiKey: 'YOUR_API_KEY',   // 必填
});

logger.info('User login', { userId: '12345' });
logger.error('Payment failed', { orderId: 'ord_001' });`;

export default function Ingest() {
  const [form, setForm] = useState({
    service: "demo-service",
    level: "INFO" as LogLevel,
    message: "Hello from LogVerse test sender!",
  });
  const [apiKey, setApiKey] = useState("");
  const [attrsText, setAttrsText] = useState('{"env": "dev", "version": "1.0.0"}');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const handleSend = async () => {
    if (!apiKey.trim()) {
      setResult({ ok: false, msg: "请先填写 API Key（在系统设置中创建服务获取）" });
      return;
    }
    setSending(true);
    setResult(null);
    try {
      let attributes: Record<string, string> = {};
      try {
        attributes = attrsText ? JSON.parse(attrsText) : {};
      } catch {
        setResult({ ok: false, msg: "属性 JSON 格式错误" });
        setSending(false);
        return;
      }
      const res = await api.ingestLog({
        service: form.service,
        level: form.level,
        message: form.message,
        attributes,
      }, apiKey.trim());
      setResult({ ok: true, msg: `发送成功！ID: ${res.id.slice(0, 8)}` });
    } catch (err) {
      setResult({ ok: false, msg: `发送失败: ${(err as Error).message}` });
    } finally {
      setSending(false);
    }
  };

  const handleBatchSeed = async () => {
    setSending(true);
    try {
      const res = await api.seed(30);
      setResult({ ok: true, msg: `已生成 ${res.generated} 条模拟日志` });
    } catch (err) {
      setResult({ ok: false, msg: `生成失败: ${(err as Error).message}` });
    } finally {
      setSending(false);
    }
  };

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <Layout>
      <PageHeader
        title="数据接入"
        subtitle="通过 API 或 SDK 将日志写入 LogVerse"
        actions={
          <button
            onClick={handleBatchSeed}
            disabled={sending}
            className="flex items-center gap-1.5 rounded-lg border border-teal/30 bg-teal/10 px-3 py-2 text-sm text-teal transition-colors hover:bg-teal/20 disabled:opacity-50"
          >
            <Zap className="h-3.5 w-3.5" />
            生成模拟数据
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-6 p-8 lg:grid-cols-2">
        {/* 测试发送器 */}
        <div className="space-y-4">
          <div className="panel p-5">
            <div className="mb-4 flex items-center gap-2">
              <Send className="h-4 w-4 text-amber" />
              <h3 className="font-display text-base font-semibold text-white">测试发送器</h3>
            </div>

            <div className="space-y-4">
              {/* API Key */}
              <div>
                <label className="mb-1.5 flex items-center gap-1 text-xs font-medium text-zinc-500">
                  <KeyRound className="h-3 w-3" />
                  API Key（必填）
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="粘贴在系统设置中创建服务时获取的密钥"
                  className="w-full rounded-lg border border-base-500 bg-base-700 px-3 py-2 font-mono text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-amber/50"
                />
                <p className="mt-1 text-[11px] text-zinc-600">
                  没有密钥？前往「系统设置 → 数据源管理」创建服务获取
                </p>
              </div>

              {/* 服务名 */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-500">服务名</label>
                <input
                  type="text"
                  value={form.service}
                  onChange={(e) => setForm({ ...form, service: e.target.value })}
                  className="w-full rounded-lg border border-base-500 bg-base-700 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-amber/50"
                />
              </div>

              {/* 级别 */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-500">级别</label>
                <div className="flex flex-wrap gap-2">
                  {LEVELS.map((l) => (
                    <button
                      key={l}
                      onClick={() => setForm({ ...form, level: l })}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 font-mono text-xs uppercase transition-colors",
                        form.level === l
                          ? "border-amber bg-amber/10 text-amber"
                          : "border-base-500 text-zinc-500 hover:text-zinc-300",
                      )}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              {/* 消息 */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-500">消息</label>
                <textarea
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border border-base-500 bg-base-700 px-3 py-2 font-mono text-sm text-zinc-200 outline-none focus:border-amber/50 resize-none"
                />
              </div>

              {/* 属性 */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-500">
                  属性 (JSON)
                </label>
                <textarea
                  value={attrsText}
                  onChange={(e) => setAttrsText(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-base-500 bg-base-700 px-3 py-2 font-mono text-xs text-zinc-200 outline-none focus:border-amber/50 resize-none"
                />
              </div>

              {/* 发送按钮 */}
              <button
                onClick={handleSend}
                disabled={sending}
                className="w-full rounded-lg bg-amber py-2.5 text-sm font-medium text-base-900 transition-colors hover:bg-amber/90 disabled:opacity-50"
              >
                {sending ? "发送中..." : "发送日志"}
              </button>

              {/* 结果 */}
              {result && (
                <div
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm animate-fade-in",
                    result.ok
                      ? "bg-teal/10 text-teal border border-teal/30"
                      : "bg-red-500/10 text-red-400 border border-red-500/30",
                  )}
                >
                  {result.msg}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* API 文档 */}
        <div className="space-y-4">
          {/* cURL 示例 */}
          <div className="panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-base-500 px-5 py-3">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-teal" />
                <h3 className="font-display text-sm font-semibold text-white">cURL 接入</h3>
              </div>
              <button
                onClick={() => copy(CURL_EXAMPLE, "curl")}
                className="flex items-center gap-1 text-xs text-zinc-500 hover:text-amber"
              >
                {copied === "curl" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied === "curl" ? "已复制" : "复制"}
              </button>
            </div>
            <pre className="bg-base-900 p-4 font-mono text-xs text-zinc-300 overflow-x-auto">
              {CURL_EXAMPLE}
            </pre>
          </div>

          {/* SDK 示例 */}
          <div className="panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-base-500 px-5 py-3">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-teal" />
                <h3 className="font-display text-sm font-semibold text-white">SDK 接入</h3>
              </div>
              <button
                onClick={() => copy(SDK_EXAMPLE, "sdk")}
                className="flex items-center gap-1 text-xs text-zinc-500 hover:text-amber"
              >
                {copied === "sdk" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied === "sdk" ? "已复制" : "复制"}
              </button>
            </div>
            <pre className="bg-base-900 p-4 font-mono text-xs text-zinc-300 overflow-x-auto">
              {SDK_EXAMPLE}
            </pre>
          </div>

          {/* API 端点说明 */}
          <div className="panel p-5">
            <h3 className="mb-3 font-display text-sm font-semibold text-white">API 端点</h3>
            <div className="space-y-2">
              <Endpoint method="POST" path="/api/logs" desc="写入单条日志（需密钥）" />
              <Endpoint method="POST" path="/api/logs/batch" desc="批量写入（需密钥）" />
              <Endpoint method="GET" path="/api/logs" desc="查询日志（支持过滤分页）" />
              <Endpoint method="GET" path="/api/stats/overview" desc="获取总览统计" />
              <Endpoint method="WS" path="/ws" desc="实时日志流（WebSocket）" />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

function Endpoint({ method, path, desc }: { method: string; path: string; desc: string }) {
  const methodColor =
    method === "GET"
      ? "text-blue-400 bg-blue-500/10"
      : method === "POST"
        ? "text-teal bg-teal/10"
        : "text-amber bg-amber/10";
  return (
    <div className="flex items-center gap-3 rounded-lg bg-base-700 px-3 py-2">
      <span className={cn("rounded px-1.5 py-0.5 font-mono text-[10px] font-bold", methodColor)}>
        {method}
      </span>
      <code className="font-mono text-xs text-zinc-300">{path}</code>
      <span className="ml-auto text-xs text-zinc-600">{desc}</span>
    </div>
  );
}
