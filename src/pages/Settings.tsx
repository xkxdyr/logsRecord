import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, Key, Server, Clock, Shield, Copy, Check, ChevronDown } from "lucide-react";
import { Layout, PageHeader } from "@/components/Layout";
import { api } from "@/lib/api";
import {
  TIER_CONFIGS,
  TIER_LIST,
  type ServiceSource,
  type KeyTier,
} from "../../shared/types";
import { cn } from "@/lib/utils";

// 等级徽章颜色
const TIER_STYLES: Record<KeyTier, { badge: string; dot: string; label: string }> = {
  free: { badge: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30", dot: "bg-zinc-400", label: "FREE" },
  pro: { badge: "bg-teal/15 text-teal border-teal/30", dot: "bg-teal", label: "PRO" },
  enterprise: { badge: "bg-amber/15 text-amber border-amber/30", dot: "bg-amber", label: "ENTERPRISE" },
};

export default function Settings() {
  const [services, setServices] = useState<ServiceSource[]>([]);
  const [newServiceName, setNewServiceName] = useState("");
  const [newServiceTier, setNewServiceTier] = useState<KeyTier>("free");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [retentionDays, setRetentionDays] = useState(30);
  const [retentionSaving, setRetentionSaving] = useState(false);
  const [retentionMsg, setRetentionMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  // P1-7: 服务管理操作（增/删/改 tier）的错误/成功反馈
  const [mutationMsg, setMutationMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState<number | null>(null);
  const [openTierFor, setOpenTierFor] = useState<number | null>(null);

  // P1-6: 用 data-attr + closest 替代共享 ref
  // 原实现 tierDropdownRef 在 .map 内被多个节点共享，只对最后一个服务生效
  useEffect(() => {
    if (openTierFor === null) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // 点击落在任意 [data-tier-dropdown] 内则不关闭（让按钮 onClick 自行处理切换）
      if (!target.closest("[data-tier-dropdown]")) {
        setOpenTierFor(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openTierFor]);

  const fetchServices = useCallback(async () => {
    try {
      const data = await api.getServices();
      setServices(data);
    } catch (err) {
      console.error("Failed to fetch services:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServices();
    // 加载当前保留策略
    api
      .getRetention()
      .then((data) => setRetentionDays(data.retentionDays))
      .catch((err) => console.error("Failed to fetch retention:", err));
  }, [fetchServices]);

  // P1-7: 统一的 mutation 消息显示，3 秒后自动消失
  const showMutationMsg = useCallback((type: "ok" | "err", text: string) => {
    setMutationMsg({ type, text });
    setTimeout(() => setMutationMsg(null), 3000);
  }, []);

  const handleAdd = async () => {
    if (!newServiceName.trim() || adding) return;
    setAdding(true);
    try {
      await api.addService(newServiceName.trim(), newServiceTier);
      setNewServiceName("");
      setNewServiceTier("free");
      fetchServices();
      showMutationMsg("ok", `服务「${newServiceName.trim()}」已添加`);
    } catch (err) {
      console.error("Failed to add service:", err);
      showMutationMsg("err", `添加失败: ${(err as Error).message}`);
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    // P1-6: 二次确认，删除服务会级联删除其所有日志，不可恢复
    if (!window.confirm(`确认删除服务「${name}」？\n\n该操作将级联删除此服务的所有历史日志，且不可恢复。`)) {
      return;
    }
    try {
      await api.deleteService(id);
      fetchServices();
      showMutationMsg("ok", `服务「${name}」已删除`);
    } catch (err) {
      console.error("Failed to delete service:", err);
      showMutationMsg("err", `删除失败: ${(err as Error).message}`);
    }
  };

  const handleChangeTier = async (id: number, tier: KeyTier) => {
    try {
      await api.updateServiceTier(id, tier);
      setOpenTierFor(null);
      fetchServices();
      showMutationMsg("ok", `等级已切换为 ${TIER_CONFIGS[tier].label}`);
    } catch (err) {
      console.error("Failed to update tier:", err);
      showMutationMsg("err", `等级切换失败: ${(err as Error).message}`);
    }
  };

  const copyKey = async (id: number, key: string) => {
    // P2: clipboard 在非 HTTPS 或权限拒绝时会 reject，需 try/catch
    try {
      await navigator.clipboard.writeText(key);
      setCopiedKey(id);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      console.error("复制失败：剪贴板不可用");
    }
  };

  const handleSaveRetention = async () => {
    setRetentionSaving(true);
    setRetentionMsg(null);
    try {
      await api.updateRetention(retentionDays);
      setRetentionMsg({ type: "ok", text: `保留策略已更新为 ${retentionDays} 天` });
    } catch (err) {
      setRetentionMsg({ type: "err", text: "保存失败，请重试" });
      console.error(err);
    } finally {
      setRetentionSaving(false);
      setTimeout(() => setRetentionMsg(null), 3000);
    }
  };

  const handleManualCleanup = async () => {
    setRetentionSaving(true);
    setRetentionMsg(null);
    try {
      const res = await api.triggerCleanup();
      setRetentionMsg({
        type: "ok",
        text: `清理完成：已删除 ${res.deleted} 条超过 ${res.retentionDays} 天的日志`,
      });
    } catch (err) {
      setRetentionMsg({ type: "err", text: "清理失败，请重试" });
      console.error(err);
    } finally {
      setRetentionSaving(false);
      setTimeout(() => setRetentionMsg(null), 4000);
    }
  };

  return (
    <Layout>
      <PageHeader title="系统设置" subtitle="管理数据源、API 密钥等级、保留策略与系统配置" />

      <div className="space-y-6 p-8 max-w-5xl">
        {/* 等级说明卡片 */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Shield className="h-4 w-4 text-amber" />
            <h3 className="font-display text-base font-semibold text-white">API 密钥等级</h3>
            <span className="ml-auto text-xs text-zinc-400">不同等级享不同配额</span>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {TIER_LIST.map((tier) => {
              const config = TIER_CONFIGS[tier];
              const style = TIER_STYLES[tier];
              return (
                <div
                  key={tier}
                  className={cn(
                    "rounded-xl border p-4 transition-colors",
                    style.badge,
                  )}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className={cn("h-2 w-2 rounded-full", style.dot)} />
                    <span className="font-mono text-xs font-bold tracking-wider">{style.label}</span>
                    <span className="ml-auto text-xs text-zinc-400">{config.label}</span>
                  </div>
                  <div className="space-y-1 text-xs text-zinc-400">
                    <p>
                      速率限制：
                      <span className="font-mono text-zinc-200">
                        {config.rateLimitPerMin === 0 ? "不限" : `${config.rateLimitPerMin} 次/分`}
                      </span>
                    </p>
                    <p>
                      每日配额：
                      <span className="font-mono text-zinc-200">
                        {config.dailyQuota === 0 ? "不限" : config.dailyQuota.toLocaleString()}
                      </span>
                    </p>
                  </div>
                  <ul className="mt-2 space-y-0.5">
                    {config.features.map((f) => (
                      <li key={f} className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                        <Check className="h-3 w-3 text-teal" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>

        {/* 数据源管理 */}
        <div className="panel p-5">
          <div className="mb-4 flex items-center gap-2">
            <Server className="h-4 w-4 text-amber" />
            <h3 className="font-display text-base font-semibold text-white">数据源管理</h3>
            <span className="ml-auto text-xs text-zinc-400">{services.length} 个服务</span>
          </div>

          {/* P1-7: mutation 操作反馈 */}
          {mutationMsg && (
            <div
              className={cn(
                "mb-4 rounded-lg border px-3 py-2 text-xs",
                mutationMsg.type === "ok"
                  ? "border-teal/30 bg-teal/10 text-teal"
                  : "border-red-500/30 bg-red-500/10 text-red-400",
              )}
            >
              {mutationMsg.text}
            </div>
          )}

          {/* 添加新服务 */}
          <div className="mb-4 flex flex-wrap gap-2">
            <input
              type="text"
              value={newServiceName}
              onChange={(e) => setNewServiceName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="输入服务名称，如 payment-service"
              aria-label="服务名称"
              className="flex-1 min-w-[200px] rounded-lg border border-base-500 bg-base-700 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-amber/50"
            />
            <select
              value={newServiceTier}
              onChange={(e) => setNewServiceTier(e.target.value as KeyTier)}
              aria-label="API 密钥等级"
              className="rounded-lg border border-base-500 bg-base-700 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-amber/50"
            >
              {TIER_LIST.map((t) => (
                <option key={t} value={t}>
                  {TIER_CONFIGS[t].label}
                </option>
              ))}
            </select>
            <button
              onClick={handleAdd}
              disabled={adding || !newServiceName.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-amber px-4 py-2 text-sm font-medium text-base-900 transition-colors hover:bg-amber/90 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              {adding ? "添加中..." : "添加"}
            </button>
          </div>

          {/* 服务列表 */}
          <div className="space-y-2">
            {loading ? (
              <div className="py-8 text-center text-sm text-zinc-400">加载中...</div>
            ) : services.length > 0 ? (
              services.map((svc) => {
                const style = TIER_STYLES[svc.tier];
                const isOpen = openTierFor === svc.id;
                return (
                  <div
                    key={svc.id}
                    className="rounded-lg border border-base-600 bg-base-700 px-4 py-3 animate-fade-in"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-base-600">
                        <Server className="h-4 w-4 text-teal" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-zinc-200">{svc.name}</p>
                          <span
                            className={cn(
                              "rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wider",
                              style.badge,
                            )}
                          >
                            {style.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Key className="h-3 w-3 text-zinc-400" />
                          <code className="font-mono text-xs text-zinc-400">
                            {svc.apiKey.slice(0, 20)}...{svc.apiKey.slice(-4)}
                          </code>
                          <button
                            onClick={() => copyKey(svc.id, svc.apiKey)}
                            className="ml-1 text-zinc-400 transition-colors hover:text-amber"
                            title="复制完整密钥"
                            aria-label={copiedKey === svc.id ? "已复制" : "复制完整密钥"}
                          >
                            {copiedKey === svc.id ? (
                              <Check className="h-3 w-3 text-teal" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                      </div>
                      <span className="text-xs text-zinc-400">
                        {(() => {
                          const d = new Date(svc.createdAt);
                          return isNaN(d.getTime()) ? "-" : d.toLocaleDateString("zh-CN");
                        })()}
                      </span>

                      {/* 等级切换下拉 */}
                      <div className="relative" data-tier-dropdown={svc.id}>
                        <button
                          onClick={() => setOpenTierFor(isOpen ? null : svc.id)}
                          className="flex items-center gap-1 rounded-lg border border-base-500 px-2 py-1.5 text-xs text-zinc-400 transition-colors hover:border-amber/50 hover:text-amber"
                        >
                          切换等级
                          <ChevronDown className="h-3 w-3" />
                        </button>
                        {isOpen && (
                          <div className="absolute right-0 top-full z-10 mt-1 w-40 overflow-hidden rounded-lg border border-base-500 bg-base-800 py-1 shadow-xl">
                            {TIER_LIST.map((t) => (
                              <button
                                key={t}
                                onClick={() => handleChangeTier(svc.id, t)}
                                className={cn(
                                  "flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-base-700",
                                  svc.tier === t ? "text-amber" : "text-zinc-400",
                                )}
                              >
                                <span className={cn("h-2 w-2 rounded-full", TIER_STYLES[t].dot)} />
                                {TIER_CONFIGS[t].label}
                                {svc.tier === t && <Check className="ml-auto h-3 w-3" />}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => handleDelete(svc.id, svc.name)}
                        className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-red-500/10 hover:text-red-400"
                        aria-label={`删除服务 ${svc.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-8 text-center text-sm text-zinc-400">
                暂无数据源，添加一个服务开始接入日志
              </div>
            )}
          </div>
        </div>

        {/* 保留策略 */}
        <div className="panel p-5">
          <div className="mb-4 flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber" />
            <h3 className="font-display text-base font-semibold text-white">数据保留策略</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm text-zinc-400">
                日志保留天数: <span className="font-mono text-amber">{retentionDays} 天</span>
              </label>
              <input
                type="range"
                min={1}
                max={365}
                value={retentionDays}
                onChange={(e) => setRetentionDays(Number(e.target.value))}
                className="w-full accent-amber"
              />
              <div className="mt-1 flex justify-between text-xs text-zinc-400">
                <span>1 天</span>
                <span>30 天</span>
                <span>90 天</span>
                <span>365 天</span>
              </div>
            </div>
            <p className="text-xs text-zinc-400">
              超过保留期的日志将被自动清理（每小时检查一次）。也可点击下方按钮立即清理。
            </p>

            {retentionMsg && (
              <div
                className={cn(
                  "rounded-lg border px-3 py-2 text-xs",
                  retentionMsg.type === "ok"
                    ? "border-teal/30 bg-teal/10 text-teal"
                    : "border-red-500/30 bg-red-500/10 text-red-400",
                )}
              >
                {retentionMsg.text}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleSaveRetention}
                disabled={retentionSaving}
                className="rounded-lg bg-amber px-4 py-2 text-sm font-medium text-base-900 transition-colors hover:bg-amber/90 disabled:opacity-50"
              >
                {retentionSaving ? "处理中..." : "保存策略"}
              </button>
              <button
                onClick={handleManualCleanup}
                disabled={retentionSaving}
                className="rounded-lg border border-base-500 px-4 py-2 text-sm text-zinc-300 transition-colors hover:border-amber/50 hover:text-amber disabled:opacity-50"
              >
                立即清理
              </button>
            </div>
          </div>
        </div>

        {/* 系统信息 */}
        <div className="panel p-5">
          <div className="mb-4 flex items-center gap-2">
            <Shield className="h-4 w-4 text-amber" />
            <h3 className="font-display text-base font-semibold text-white">系统信息</h3>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <InfoRow label="版本" value="LogVerse v1.0.0" />
            <InfoRow label="运行模式" value={import.meta.env.MODE === "production" ? "生产模式" : "开发模式"} />
            <InfoRow label="数据库" value="SQLite (WAL)" />
            <InfoRow label="实时引擎" value="WebSocket" />
          </div>
        </div>

        {/* 合规链接 */}
        <div className="flex justify-center gap-6 text-xs text-zinc-400">
          <a href="/privacy" className="transition-colors hover:text-amber">隐私政策</a>
          <span>|</span>
          <a href="/terms" className="transition-colors hover:text-amber">服务条款</a>
        </div>
      </div>
    </Layout>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-base-700 px-3 py-2">
      <span className="text-zinc-500">{label}</span>
      <span className="font-mono text-zinc-300">{value}</span>
    </div>
  );
}
