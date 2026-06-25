import { Layout, PageHeader } from "@/components/Layout";

export default function PrivacyPolicy() {
  return (
    <Layout>
      <PageHeader title="隐私政策" subtitle="LogVerse 尊重并保护您的隐私" />
      <div className="max-w-3xl p-8">
        <div className="space-y-6">
          <div>
            <h2 className="mb-2 font-display text-lg font-semibold text-white">1. 我们收集的数据</h2>
            <p className="text-sm text-zinc-400">
              LogVerse 作为日志分析平台，您上传的日志数据仅用于日志存储、分析和展示。我们不会读取或分析日志中的个人身份信息，除非您明确授权。
            </p>
          </div>
          <div>
            <h2 className="mb-2 font-display text-lg font-semibold text-white">2. 数据存储</h2>
            <p className="text-sm text-zinc-400">
              您的日志数据存储在您选择的服务器上（自托管部署）。LogVerse 不会在任何外部服务器上存储您的日志数据。
            </p>
          </div>
          <div>
            <h2 className="mb-2 font-display text-lg font-semibold text-white">3. API Key 安全</h2>
            <p className="text-sm text-zinc-400">
              API Key 用于认证日志写入请求。请妥善保管您的 API Key，不要泄露给未授权人员。您可以随时在系统设置中重新生成或删除 API Key。
            </p>
          </div>
          <div>
            <h2 className="mb-2 font-display text-lg font-semibold text-white">4. Cookie 和追踪</h2>
            <p className="text-sm text-zinc-400">
              LogVerse 不使用任何第三方追踪服务或分析工具。前端页面不设置任何 Cookie。
            </p>
          </div>
          <div>
            <h2 className="mb-2 font-display text-lg font-semibold text-white">5. 数据保留</h2>
            <p className="text-sm text-zinc-400">
              您可以在系统设置中配置日志保留期限。超过保留期的日志将被自动清理。
            </p>
          </div>
          <div className="border-t border-base-600 pt-6">
            <p className="text-xs text-zinc-600">
              本政策自 2026 年 6 月生效。我们可能会不定期更新本政策，请定期查看。
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}