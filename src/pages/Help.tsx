import { useState } from "react";
import {
  LayoutDashboard,
  Search,
  Send,
  Settings,
  LifeBuoy,
  ChevronDown,
  Zap,
  Radio,
  Code2,
  Lightbulb,
  AlertCircle,
} from "lucide-react";
import { Layout, PageHeader } from "@/components/Layout";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { id: "quick-start", label: "快速开始", icon: Zap },
  { id: "dashboard", label: "总览仪表盘", icon: LayoutDashboard },
  { id: "explorer", label: "日志探索", icon: Search },
  { id: "ingest", label: "数据接入", icon: Send },
  { id: "settings", label: "系统设置", icon: Settings },
  { id: "api", label: "API 参考", icon: Code2 },
  { id: "faq", label: "常见问题", icon: AlertCircle },
];

export default function Help() {
  const [activeSection, setActiveSection] = useState("quick-start");

  const scrollTo = (id: string) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <Layout>
      <PageHeader
        title="帮助手册"
        subtitle="了解 LogVerse 各功能模块的使用方法"
        actions={
          <span className="flex items-center gap-1.5 rounded-lg border border-amber/30 bg-amber/10 px-3 py-2 text-xs text-amber">
            <LifeBuoy className="h-3.5 w-3.5" />
            v1.1 指南
          </span>
        }
      />

      <div className="flex gap-8 p-8">
        {/* 左侧目录 */}
        <aside className="sticky top-0 h-fit w-48 shrink-0">
          <nav className="space-y-1">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => scrollTo(s.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                  activeSection === s.id
                    ? "bg-base-600 text-amber"
                    : "text-zinc-500 hover:bg-base-700 hover:text-zinc-300",
                )}
              >
                <s.icon className="h-4 w-4 shrink-0" />
                {s.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* 右侧内容 */}
        <div className="min-w-0 flex-1 space-y-12 pb-20">
          {/* 快速开始 */}
          <Section id="quick-start" icon={Zap} title="快速开始" desc="3 步上手 LogVerse">
            <Steps
              steps={[
                {
                  title: "生成演示数据",
                  desc: "进入「数据接入」页面，点击「生成模拟数据」按钮，系统会自动创建一批模拟日志，让你立即看到仪表盘和日志流的效果。",
                },
                {
                  title: "查看总览仪表盘",
                  desc: "回到「总览」页面，你将看到实时 EPS、日志总数、错误数等 KPI 指标，以及 24 小时趋势图、级别分布和 Top 服务排行。",
                },
                {
                  title: "探索实时日志",
                  desc: "进入「日志探索」页面，默认开启实时模式，新日志会通过 WebSocket 自动推送到列表中。点击任意日志可查看详情。",
                },
              ]}
            />
            <Callout type="tip" title="小贴士">
              你也可以在「数据接入」页面用测试发送器手动发送一条日志，然后切换到「日志探索」页面观察它实时出现。
            </Callout>
          </Section>

          {/* 总览仪表盘 */}
          <Section id="dashboard" icon={LayoutDashboard} title="总览仪表盘" desc="全局监控日志健康度">
            <p className="text-sm text-zinc-400 leading-relaxed">
              仪表盘是 LogVerse 的首页，提供日志系统的全局视图。页面每 5 秒自动刷新数据。
            </p>
            <FeatureList
              items={[
                {
                  title: "KPI 卡片",
                  desc: "展示 5 个核心指标：实时 EPS（每秒入库事件数）、总日志数、今日入库、错误日志数（ERROR+FATAL）、服务数。",
                },
                {
                  title: "24h 日志趋势",
                  desc: "按小时聚合的堆叠面积图，展示 INFO/WARN/ERROR/FATAL 四个级别在过去 24 小时的变化趋势。鼠标悬停可查看具体数值。",
                },
                {
                  title: "级别分布饼图",
                  desc: "展示所有日志按级别（TRACE/DEBUG/INFO/WARN/ERROR/FATAL）的占比分布。",
                },
                {
                  title: "Top 服务条形图",
                  desc: "按日志量降序排列的服务排行，帮助快速定位日志量最大的服务。",
                },
                {
                  title: "实时异常流",
                  desc: "通过 WebSocket 实时推送最近的 ERROR 和 FATAL 日志，无需手动刷新。点击日志可查看详情。",
                },
              ]}
            />
          </Section>

          {/* 日志探索 */}
          <Section id="explorer" icon={Search} title="日志探索" desc="实时流式检索与过滤">
            <p className="text-sm text-zinc-400 leading-relaxed">
              日志探索是核心工作台，支持实时流模式和历史查询模式。
            </p>
            <FeatureList
              items={[
                {
                  title: "实时模式（默认）",
                  desc: "通过 WebSocket 实时接收新日志，日志自动追加到列表顶部。适合监控实时故障。点击「暂停实时」可切换到历史查询模式。",
                },
                {
                  title: "关键词搜索",
                  desc: "在搜索框输入关键词后，需按回车键或点击「搜索」按钮才触发查询，避免每次按键都发起请求。支持全文匹配。",
                },
                {
                  title: "多维过滤",
                  desc: "可按服务名、日志级别、时间范围（15分钟/1小时/6小时/24小时）组合过滤。切换级别或时间范围会自动重置到第 1 页。",
                },
                {
                  title: "日志详情",
                  desc: "点击任意日志行（或用 Tab 聚焦后按 Enter/空格），右侧滑出详情抽屉，展示完整消息、属性字段、JSON 原始数据，支持复制。按 Esc 键可关闭抽屉。",
                },
                {
                  title: "清空实时流",
                  desc: "在实时模式下点击「清空」按钮可清除当前显示的日志列表。切换过滤条件时实时缓冲也会自动清空。",
                },
              ]}
            />
            <Callout type="info" title="实时 vs 历史">
              实时模式通过 WebSocket 推送新写入的日志（最多保留 500 条）。历史模式从数据库查询，支持分页浏览全部历史数据。切换模式时会自动清空另一方的缓冲，避免数据混淆。
            </Callout>
          </Section>

          {/* 数据接入 */}
          <Section id="ingest" icon={Send} title="数据接入" desc="将日志写入 LogVerse">
            <p className="text-sm text-zinc-400 leading-relaxed">
              提供三种方式将日志写入平台。所有写入请求均需在请求头携带 <code className="font-mono text-xs">X-API-Key</code>，可在「系统设置 → 数据源管理」中创建服务后获取。
            </p>
            <FeatureList
              items={[
                {
                  title: "测试发送器",
                  desc: "在页面上填写服务名、级别、消息和属性（JSON），点击「发送日志」即可写入一条日志。适合测试和调试。需先填入有效的 API Key。",
                },
                {
                  title: "cURL 接入",
                  desc: "复制页面上的 cURL 命令，在终端执行即可通过 HTTP API 写入日志。适合脚本和自动化场景。注意替换 X-API-Key 为你的服务密钥。",
                },
                {
                  title: "SDK 接入",
                  desc: "参考 SDK 示例代码，在你的应用中集成 LogVerse SDK，实现结构化日志上报。",
                },
                {
                  title: "生成模拟数据",
                  desc: "点击右上角「生成模拟数据」按钮，一键批量生成 30 条随机日志，用于演示和测试。该接口需 ENABLE_SEED=true 且管理员令牌鉴权。",
                },
              ]}
            />
            <Callout type="info" title="API Key 等级与配额">
              不同等级的 API Key 享有不同配额：FREE（60 次/分，10,000 条/天）、PRO（300 次/分，100,000 条/天）、ENTERPRISE（不限速，不限量）。超出限制的请求将被拒绝（429）。可在「系统设置」中为每个服务单独配置等级。
            </Callout>
            <CodeBlock
              title="最简单的接入方式（需替换 YOUR_API_KEY）"
              code={`curl -X POST http://localhost:1001/api/logs \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -d '{
    "service": "my-app",
    "level": "INFO",
    "message": "用户登录成功"
  }'`}
            />
          </Section>

          {/* 系统设置 */}
          <Section id="settings" icon={Settings} title="系统设置" desc="管理数据源与配置">
            <FeatureList
              items={[
                {
                  title: "数据源管理",
                  desc: "添加、删除日志来源服务。每个服务会生成唯一的 API Key，用于接入认证。添加时需选择密钥等级（FREE/PRO/ENTERPRISE），不同等级享有不同的速率限制与每日配额。服务名不可重复，重名会返回 409 提示。删除服务会级联删除其所有历史日志，操作前会二次确认。每行右侧「切换等级」下拉可随时调整服务的密钥等级。",
                },
                {
                  title: "API 密钥等级",
                  desc: "三档等级：FREE（60 次/分，10,000 条/天）、PRO（300 次/分，100,000 条/天）、ENTERPRISE（不限速，不限量）。等级越高配额越宽裕，可根据服务重要性灵活分配。",
                },
                {
                  title: "数据保留策略",
                  desc: "通过滑块设置日志保留天数（1-365 天），超过保留期的日志将被自动清理（每小时检查一次）。缩短保留天数后会立即触发一次清理，无需等待下个周期。也可点击「立即清理」按钮手动执行。",
                },
                {
                  title: "系统信息",
                  desc: "查看当前版本、运行模式、数据库类型、实时引擎等系统信息。",
                },
              ]}
            />
            <Callout type="warn" title="删除不可恢复">
              删除服务会级联删除该服务的全部历史日志，且操作不可撤销。系统会弹出二次确认对话框，请仔细核对服务名后再确认。
            </Callout>
          </Section>

          {/* API 参考 */}
          <Section id="api" icon={Code2} title="API 参考" desc="REST API 与 WebSocket 接口">
            <Callout type="info" title="认证方式">
              接口分两类认证：日志写入类（POST /api/logs）使用 <code className="font-mono text-xs">X-API-Key</code> 请求头，值为服务创建时生成的 API Key；查询/统计/服务管理/保留策略等管理类接口使用 <code className="font-mono text-xs">X-Admin-Token</code> 请求头，值为环境变量 <code className="font-mono text-xs">ADMIN_TOKEN</code>。WebSocket 在连接 URL 的 query 参数中携带 <code className="font-mono text-xs">adminToken</code>。
            </Callout>

            <div className="mt-4 space-y-3">
              <ApiRow method="POST" path="/api/logs" desc="写入单条日志（X-API-Key 认证）" />
              <ApiRow method="POST" path="/api/logs/batch" desc="批量写入日志（X-API-Key 认证）" />
              <ApiRow method="GET" path="/api/logs" desc="查询日志（X-Admin-Token，支持 service/level/keyword/时间范围/分页）" />
              <ApiRow method="GET" path="/api/logs/recent-errors" desc="获取最近的 ERROR/FATAL 日志（X-Admin-Token）" />
              <ApiRow method="GET" path="/api/stats/overview" desc="获取总览统计数据（X-Admin-Token）" />
              <ApiRow method="GET" path="/api/services" desc="获取服务列表（X-Admin-Token）" />
              <ApiRow method="POST" path="/api/services" desc="添加新服务（X-Admin-Token，重名返回 409）" />
              <ApiRow method="DELETE" path="/api/services/:id" desc="删除服务及其日志（X-Admin-Token）" />
              <ApiRow method="PUT" path="/api/services/:id/tier" desc="切换服务密钥等级（X-Admin-Token）" />
              <ApiRow method="GET" path="/api/retention" desc="获取保留天数（X-Admin-Token）" />
              <ApiRow method="PUT" path="/api/retention" desc="更新保留天数，缩短时即时触发清理（X-Admin-Token）" />
              <ApiRow method="POST" path="/api/logs/cleanup" desc="手动触发过期日志清理（X-Admin-Token）" />
              <ApiRow method="POST" path="/api/seed" desc="生成模拟日志（X-Admin-Token + ENABLE_SEED=true）" />
              <ApiRow method="WS" path="/ws" desc="WebSocket 实时日志流（query 携带 adminToken）" />
            </div>

            <CodeBlock
              title="写入日志示例（X-API-Key 认证）"
              code={`curl -X POST http://localhost:1001/api/logs \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -d '{
    "service": "payment-service",
    "level": "ERROR",
    "message": "Database connection timeout",
    "attributes": { "host": "prod-db-01" }
  }'`}
            />

            <CodeBlock
              title="查询日志示例（X-Admin-Token 认证）"
              code={`curl "http://localhost:1001/api/logs?service=payment-service&level=ERROR&page=1&pageSize=50" \\
  -H "X-Admin-Token: YOUR_ADMIN_TOKEN"`}
            />

            <div className="mt-4">
              <h4 className="mb-2 flex items-center gap-2 text-sm font-medium text-zinc-300">
                <Radio className="h-4 w-4 text-teal" />
                WebSocket 使用
              </h4>
              <CodeBlock
                code={`// 连接 WebSocket（需在 query 携带管理员令牌鉴权）
const ws = new WebSocket('ws://localhost:1001/ws?adminToken=YOUR_ADMIN_TOKEN');

// 订阅日志流（可按服务/级别过滤）
ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'subscribe',
    filters: { service: 'payment-service', level: 'ERROR' }
  }));
};

// 接收实时日志
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === 'log') {
    console.log('新日志:', msg.data);
  }
};`}
              />
            </div>
          </Section>

          {/* FAQ */}
          <Section id="faq" icon={AlertCircle} title="常见问题" desc="">
            <FaqList
              items={[
                {
                  q: "仪表盘上的数据多久刷新一次？",
                  a: "仪表盘每 5 秒自动刷新统计数据。你也可以点击右上角「刷新」按钮手动刷新。",
                },
                {
                  q: "实时日志流最多显示多少条？",
                  a: "实时模式最多保留 500 条最新日志。更早的日志可以通过历史查询模式从数据库中检索。",
                },
                {
                  q: "日志数据存储在哪里？",
                  a: "当前使用 SQLite 数据库（WAL 模式）存储，数据文件为 logs.db。架构设计支持未来迁移到 ClickHouse。",
                },
                {
                  q: "如何清除所有数据重新开始？",
                  a: "停止服务后删除 logs.db 文件，重启服务会自动创建空数据库。",
                },
                {
                  q: "支持哪些日志级别？",
                  a: "支持 6 个级别：TRACE、DEBUG、INFO、WARN、ERROR、FATAL，按严重程度递增。",
                },
                {
                  q: "WebSocket 连接不上怎么办？",
                  a: "自托管部署：确保后端服务（端口 1001）正在运行，Nginx 已配置 /ws 反代并开启 Upgrade/Connection 头。开发模式下 Vite 会自动代理 WebSocket 到后端。Vercel 等 Serverless 平台不支持长连接 WebSocket，前端会自动降级为关闭实时流，不影响查询功能。",
                },
                {
                  q: "如何部署到生产环境？",
                  a: "推荐方案：1) npm run build 生成 dist/ 静态产物；2) PM2 启动后端（pm2 start deploy/ecosystem.config.js）；3) Nginx 直接托管 dist/ 目录并反代 /api 和 /ws 到后端 1001 端口（参考 deploy/nginx.conf）。Nginx 已配置 gzip 压缩、静态资源长缓存与安全响应头。",
                },
                {
                  q: "Vercel 部署后数据会丢失吗？",
                  a: "会。Vercel 等 Serverless 平台的文件系统是临时的，每次冷启动 /tmp 目录会被重置，SQLite 数据无法持久化。Serverless 部署仅适合演示，生产环境请使用自托管部署。若必须在 Vercel 使用，请设置 DB_PATH 环境变量指向外部持久化存储。",
                },
                {
                  q: "需要配置哪些环境变量？",
                  a: "后端必需：ADMIN_TOKEN（≥32 位强随机令牌）、CORS_ORIGINS、DB_PATH（Serverless 必填）。前端必需：VITE_ADMIN_TOKEN（须与 ADMIN_TOKEN 一致）。可选：ENABLE_SEED=true（开发环境开启种子接口）、PORT（默认 1001）、NODE_ENV。完整说明见项目根目录 .env.example 文件。",
                },
                {
                  q: "键盘可以操作吗？",
                  a: "可以。日志列表行支持 Tab 聚焦，按 Enter 或空格键打开详情抽屉，按 Esc 键关闭抽屉。所有交互元素均可键盘访问，符合 WCAG AA 可访问性标准。",
                },
                {
                  q: "缩短保留天数后旧日志会立即删除吗？",
                  a: "会。调整保留策略缩短天数时，系统会异步触发一次清理任务，立即删除超出新保留期的日志，无需等待下一次定时检查。你也可以在设置页面点击「立即清理」手动执行。",
                },
              ]}
            />
          </Section>
        </div>
      </div>
    </Layout>
  );
}

// --- 子组件 ---

function Section({
  id,
  icon: Icon,
  title,
  desc,
  children,
}: {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-8">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-base-700 border border-base-500">
          <Icon className="h-4.5 w-4.5 text-amber" />
        </div>
        <div>
          <h3 className="font-display text-xl font-bold text-white">{title}</h3>
          {desc && <p className="text-sm text-zinc-500">{desc}</p>}
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Steps({ steps }: { steps: { title: string; desc: string }[] }) {
  return (
    <div className="space-y-3">
      {steps.map((step, i) => (
        <div key={step.title} className="flex gap-4 rounded-lg border border-base-600 bg-base-700 p-4">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber/10 font-display text-sm font-bold text-amber">
            {i + 1}
          </div>
          <div>
            <h4 className="text-sm font-medium text-zinc-200">{step.title}</h4>
            <p className="mt-1 text-sm text-zinc-500 leading-relaxed">{step.desc}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function FeatureList({ items }: { items: { title: string; desc: string }[] }) {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.title} className="rounded-lg border border-base-600 bg-base-700/50 px-4 py-3">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-xs text-amber">▸</span>
            <h4 className="text-sm font-medium text-zinc-200">{item.title}</h4>
          </div>
          <p className="mt-1 pl-5 text-sm text-zinc-500 leading-relaxed">{item.desc}</p>
        </div>
      ))}
    </div>
  );
}

function Callout({
  type,
  title,
  children,
}: {
  type: "tip" | "info" | "warn";
  title: string;
  children: React.ReactNode;
}) {
  const styles = {
    tip: "border-teal/30 bg-teal/5 text-teal",
    info: "border-blue-500/30 bg-blue-500/5 text-blue-400",
    warn: "border-amber/30 bg-amber/5 text-amber",
  };
  const Icon = type === "tip" ? Lightbulb : type === "info" ? AlertCircle : AlertCircle;
  return (
    <div className={cn("rounded-lg border px-4 py-3", styles[type])}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-4 w-4" />
        <span className="text-sm font-medium">{title}</span>
      </div>
      <p className="text-sm text-zinc-400 leading-relaxed">{children}</p>
    </div>
  );
}

function CodeBlock({ title, code }: { title?: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    // P2: clipboard 在非 HTTPS 或权限拒绝时会 reject，需 try/catch
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      console.error("复制失败：剪贴板不可用");
    }
  };
  return (
    <div className="overflow-hidden rounded-lg border border-base-500">
      {title && (
        <div className="border-b border-base-500 bg-base-700 px-4 py-2 text-xs font-medium text-zinc-400">
          {title}
        </div>
      )}
      <div className="relative bg-base-900">
        <button
          onClick={handleCopy}
          className="absolute right-2 top-2 rounded px-2 py-1 text-xs text-zinc-400 transition-colors hover:text-amber"
        >
          {copied ? "已复制" : "复制"}
        </button>
        <pre className="overflow-x-auto p-4 font-mono text-xs text-zinc-300">{code}</pre>
      </div>
    </div>
  );
}

function ApiRow({ method, path, desc }: { method: string; path: string; desc: string }) {
  const methodColor =
    method === "GET"
      ? "text-blue-400 bg-blue-500/10"
      : method === "POST"
        ? "text-teal bg-teal/10"
        : "text-amber bg-amber/10";
  return (
    <div className="flex items-center gap-3 rounded-lg border border-base-600 bg-base-700 px-4 py-2.5">
      <span className={cn("rounded px-1.5 py-0.5 font-mono text-[10px] font-bold", methodColor)}>
        {method}
      </span>
      <code className="font-mono text-xs text-zinc-300">{path}</code>
      <span className="ml-auto text-xs text-zinc-400">{desc}</span>
    </div>
  );
}

function FaqList({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={item.q} className="overflow-hidden rounded-lg border border-base-600 bg-base-700">
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-base-600/50"
          >
            <span className="text-sm font-medium text-zinc-200">{item.q}</span>
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 text-zinc-500 transition-transform",
                open === i && "rotate-180",
              )}
            />
          </button>
          {open === i && (
            <div className="border-t border-base-600 px-4 py-3 text-sm text-zinc-400 leading-relaxed animate-fade-in">
              {item.a}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
