import { Layout, PageHeader } from "@/components/Layout";

export default function TermsOfService() {
  return (
    <Layout>
      <PageHeader title="服务条款" subtitle="使用 LogVerse 即表示您同意以下条款" />
      <div className="max-w-3xl p-8">
        <div className="space-y-6">
          <div>
            <h2 className="mb-2 font-display text-lg font-semibold text-white">1. 服务概述</h2>
            <p className="text-sm text-zinc-400">
              LogVerse 是一款开源日志分析平台，提供实时日志流、全文检索、可视化分析等功能。
            </p>
          </div>
          <div>
            <h2 className="mb-2 font-display text-lg font-semibold text-white">2. 使用限制</h2>
            <p className="text-sm text-zinc-400">
              您同意不以任何非法、滥用或损害 LogVerse 或其他用户的方式使用本服务。您负责确保上传的日志内容符合所有适用法律法规。
            </p>
          </div>
          <div>
            <h2 className="mb-2 font-display text-lg font-semibold text-white">3. API Key 使用</h2>
            <p className="text-sm text-zinc-400">
              您需要通过 API Key 接入日志。不同等级的 API Key 有不同的速率限制和配额。超出限制的请求将被拒绝。
            </p>
          </div>
          <div>
            <h2 className="mb-2 font-display text-lg font-semibold text-white">4. 免责声明</h2>
            <p className="text-sm text-zinc-400">
              LogVerse 按"原样"提供，不提供任何明示或暗示的保证。我们不保证服务的不间断或无错误运行。
            </p>
          </div>
          <div>
            <h2 className="mb-2 font-display text-lg font-semibold text-white">5. 开源许可</h2>
            <p className="text-sm text-zinc-400">
              LogVerse 采用 MIT 开源许可证，您可以自由使用、修改和分发代码。
            </p>
          </div>
          <div className="border-t border-base-600 pt-6">
            <p className="text-xs text-zinc-400">
              本条款自 2026 年 6 月生效。我们可能会不定期更新本条款，请定期查看。
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}