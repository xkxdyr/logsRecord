# LogVerse · 技术架构设计文档 (TDD)

> 文档版本：v1.0 · 关联文档：PROJECT.md
> 目标读者：架构师、后端工程师、SRE、数据工程师

---

## 一、架构原则

1. **分层解耦** —— 采集、存储、计算、智能、交互五层独立演进。
2. **写读分离** —— 写入路径（Hot Path）与查询路径独立扩缩。
3. **多引擎融合** —— 没有银弹，不同数据形态走不同存储引擎。
4. **AI 原生** —— LLM 不是外挂，而是查询与分析的一等公民。
5. **可观测自身** —— 平台自身全链路可观测（元日志独立存储）。
6. **降级优先** —— 任何 AI 能力失败都需有规则/统计降级方案。

---

## 二、系统组件视图

### 2.1 组件清单

| 编号 | 组件 | 语言 | 职责 | 部署形态 |
|------|------|------|------|---------|
| C01 | logverse-collector | Rust | eBPF + OTLP 采集 | DaemonSet |
| C02 | logverse-gateway | Go | API 网关、认证、限流 | Deployment |
| C03 | logverse-ingester | Rust | 写入 Kafka + 预处理 | Deployment |
| C04 | logverse-streamer | Java/Scala | Flink 流处理作业 | Flink K8s Operator |
| C05 | logverse-indexer | Rust | 实时索引 + 向量化 | Deployment |
| C06 | logverse-query | Rust | 查询联邦 + 谓词下推 | Deployment |
| C07 | logverse-llm-gateway | Python | LLM 编排 + RAG | Deployment + GPU |
| C08 | logverse-chain | Go | 区块链存证适配器 | Deployment |
| C09 | logverse-web | React/TS | 前端 + WebGPU + WASM | CDN |
| C10 | logverse-collab | Go + WebSocket | 实时协同服务 | Deployment |
| C11 | logverse-billing | Go | 计量计费 | Deployment |
| C12 | logverse-control | Go | 控制面 API | Deployment |

### 2.2 组件交互图

```
[SDK/Agent] ──OTLP──→ [gateway] ──→ [ingester] ──→ Kafka ──→ [streamer]
                          │                          │            │
                          │                          ↓            ↓
                       [auth]                  [indexer]    ClickHouse
                          │                          │        Qdrant
                          │                          ↓        S3
                       [RBAC]                  [chain]──→ Fabric
                          │
   [web] ←─WS─→ [collab]  │
      │                   │
      └──→ [query] ←──────┘
            │   ↑
            │   └── [llm-gateway] ──→ vLLM (7B/GPT-4)
            ↓
        查询融合层
```

---

## 三、关键模块详细设计

### 3.1 采集层（logverse-collector）

#### 3.1.1 eBPF 采集器

```rust
// 伪代码：eBPF 程序挂载点
#[ebpf(program = "tracepoint/syscalls/sys_enter_write")]
fn on_sys_enter_write(ctx: &mut TracePointContext) -> i32 {
    let fd: i32 = ctx.read("fd");
    let buf: *const u8 = ctx.read("buf");
    let count: usize = ctx.read("count");

    // 仅捕获写入 stdout/stderr 的日志
    if is_log_fd(fd) {
        let pid = bpf_get_current_pid_tgid() >> 32;
        let payload = unsafe { read_user_bytes(buf, count.min(4096)) };
        events::output(&LogEvent {
            pid,
            ts: bpf_ktime_get_ns(),
            fd,
            payload,
        });
    }
    0
}
```

**性能保障**：
- Ring Buffer 无锁传递，单核 200 万事件/秒。
- 采样策略：ERROR 全量、WARN 100%、INFO 10%、DEBUG 1%（可配）。
- 内存上限：每 Agent 64MB，超限丢弃最旧事件并计数。

#### 3.1.2 OTLP 接入

兼容 OpenTelemetry 标准，支持 30+ 语言 SDK 自动埋点：

```yaml
# otel-collector 配置示例
receivers:
  otlp:
    protocols:
      grpc: { endpoint: 0.0.0.0:4317 }
      http: { endpoint: 0.0.0.0:4318 }
processors:
  batch: { timeout: 1s, send_batch_size: 8192 }
  memory_limiter: { check_interval: 1s, limit_percentage: 80 }
  logverse_enrich:  # 自定义处理器
    extract_fields: [service.name, trace_id]
    add_tenant: ${env:TENANT_ID}
exporters:
  logverse_kafka:
    brokers: [kafka:9092]
    topic: logs.${env:TENANT_ID}
```

### 3.2 存储引擎层

#### 3.2.1 ClickHouse 表设计

```sql
-- 热表（最近 7 天）
CREATE TABLE logs_hot ON CLUSTER '{shard}' (
  timestamp           DateTime64(3) CODEC(Delta, ZSTD),
  tenant_id           LowCardinality(String),
  service_name        LowCardinality(String),
  severity            Enum8('TRACE'=1,'DEBUG'=2,'INFO'=3,'WARN'=4,'ERROR'=5,'FATAL'=6),
  trace_id            String,
  body                String CODEC(ZSTD(9)),
  attributes          Map(String, String) CODEC(ZSTD),
  pattern_id          LowCardinality(String),
  ingestion_ts        DateTime64(3) DEFAULT now()
)
ENGINE = MergeTree()
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (tenant_id, service_name, timestamp)
TTL timestamp + INTERVAL 7 DAY TO VOLUME 'warm'
SETTINGS index_granularity = 8192;

-- 向量索引（Qdrant）
collection: log_vectors
vectors: { size: 768, distance: Cosine }
payload: { tenant_id, ts, service, pattern_id, log_id }
```

#### 3.2.2 谓词下推与查询联邦

```rust
// 查询联邦层：跨热/温/冷/向量统一查询
pub async fn federated_query(q: &Query) -> Result<ResultSet> {
    let mut futures = vec![];

    // 1. 热数据 → ClickHouse SQL
    if q.time_range.intersects(HOT_RANGE) {
        futures.push(clickhouse_query(q));
    }
    // 2. 温/冷数据 → Parquet 元数据 + 按需扫描
    if q.time_range.intersects(COLD_RANGE) {
        futures.push(parquet_query(q));
    }
    // 3. 语义检索 → Qdrant 向量
    if q.semantic {
        let vec = embed(&q.natural_language).await?;
        futures.push(qdrant_search(vec, q.filters));
    }
    // 4. 区块链存证查询
    if q.verified_only {
        futures.push(chain_verify(q));
    }

    // 合并 + 去重 + 排序
    let results = try_join_all(futures).await?;
    Ok(merge_dedup_sort(results, q.order_by))
}
```

### 3.3 AI 分析层

#### 3.3.1 RAG 管线

```
用户问题
   ↓
[1] 意图识别 (LLM)
   ├── 检索类 → [2a] 语义检索 + 关键词检索
   ├── 分析类 → [2b] 聚合查询 + 时序分析
   └── 诊断类 → [2c] 多步检索 + Trace 关联
   ↓
[3] 上下文压缩 (LongLLMLingua)
   ├── 日志去重
   ├── 模式提取
   └── Token 预算控制 (≤ 8K)
   ↓
[4] Prompt 工程
   ├── System: 日志专家角色
   ├── Context: 检索结果
   └── User: 原始问题
   ↓
[5] 生成 (vLLM 推理)
   ↓
[6] 后处理
   ├── 置信度评估
   ├── 引用溯源 (每条结论标注 log_id)
   └── 不确定时反问澄清
```

#### 3.3.2 日志领域小模型训练

```
数据准备：
  - 50 亿条脱敏日志（开源 + 客户授权）
  - 100 万条人工标注（意图/根因/摘要）

训练流程：
  Qwen2.5-7B 基座
    → LoRA 微调（日志理解任务）
    → DPO 对齐（偏好优化）
    → 量化（AWQ INT4，显存占用 6GB）

部署：
  vLLM 服务 + PagedAttention
  单卡 A10 (24GB) 支持 50 QPS
```

### 3.4 区块链存证层

#### 3.4.1 存证流程

```
[关键日志] → [Merkle 批处理] (10s/批 或 1万条/批)
                ↓
         计算 Merkle Root
                ↓
         [Fabric 交易] 上链
                ↓
         返回 Block Height + Tx Hash
                ↓
         回写 logverse_chain 表
```

#### 3.4.2 验证流程

```go
func VerifyLog(logID string) (*VerifyResult, error) {
    log := db.GetLog(logID)
    proof := db.GetMerkleProof(logID)
    root := db.GetMerkleRoot(log.BatchID)

    // 1. 本地验证 Merkle Proof
    if !merkle.Verify(log.Hash, proof, root) {
        return &VerifyResult{Valid: false, Reason: "merkle mismatch"}, nil
    }
    // 2. 链上验证 Root
    chainRoot, err := fabric.Query(log.BatchID)
    if err != nil || chainRoot != root {
        return &VerifyResult{Valid: false, Reason: "chain mismatch"}, nil
    }
    return &VerifyResult{
        Valid: true,
        BlockHeight: chainRoot.Height,
        TxHash: chainRoot.TxHash,
        Timestamp: chainRoot.Timestamp,
    }, nil
}
```

### 3.5 WebGPU 可视化层

#### 3.5.1 日志宇宙渲染管线

```typescript
// WebGPU 渲染管线（伪代码）
const pipeline = device.createRenderPipeline({
  vertex: { module: shaderModule, entryPoint: 'vs_universe' },
  fragment: { module: shaderModule, entryPoint: 'fs_universe' },
  primitive: { topology: 'point-list' },
});

// 每帧渲染 10 万服务节点
function renderFrame() {
  // 1. 计算节点位置（力导向布局，GPU 计算）
  computePass.dispatch(nodeCount / 64);

  // 2. 渲染服务星球
  renderPass.setPipeline(pipeline);
  renderPass.setVertexBuffer(0, nodeBuffer); // 位置 + 健康度
  renderPass.setVertexBuffer(1, flowBuffer);  // 流量 + 异常
  renderPass.draw(nodeCount);

  // 3. 渲染故障流星轨迹
  renderPass.setPipeline(trailPipeline);
  renderPass.draw(trailCount);
}
```

**性能保障**：
- WebGPU Compute Shader 做力导向布局，10 万节点 60fps。
- LOD（Level of Detail）：远视图只渲染聚合节点。
- 降级：不支持 WebGPU 时降级为 WebGL + Canvas（1 万节点）。

---

## 四、高可用与容灾

### 4.1 可用性设计

| 组件 | 副本数 | 故障切换 | RTO | RPO |
|------|-------|---------|-----|-----|
| Gateway | 3+ | 自动（无状态） | 0 | 0 |
| Kafka | 3 副本 RF=3 | ISR 自动选主 | < 10s | 0 |
| ClickHouse | 2 副本 + 3 分片 | 自动故障转移 | < 30s | 0 |
| Qdrant | 3 副本 | Raft 选主 | < 10s | 0 |
| LLM Gateway | 3+ | 自动（无状态） | 0 | 0 |
| Fabric | 4 节点 | PBFT 共识 | 0 | 0 |

### 4.2 容灾策略

- **同城双活**：双可用区部署，流量负载均衡。
- **异地灾备**：核心数据异步复制到异地，RPO < 1 分钟。
- **混沌工程**：定期 Chaos 测试（杀 Pod、断网、磁盘满）。

### 4.3 降级矩阵

| 故障 | 降级策略 |
|------|---------|
| LLM 不可用 | 降级为关键词检索 + 规则告警 |
| Qdrant 不可用 | 降级为 ClickHouse 全文检索 |
| ClickHouse 不可用 | 降级为 Kafka 直查（最近数据） |
| Fabric 不可用 | 本地暂存存证请求，恢复后补链 |
| WebGPU 不可用 | 降级为 WebGL 2D 仪表盘 |

---

## 五、性能保障设计

### 5.1 写入路径优化

```
[SDK] ──批量(8192条/1s)──→ [Gateway] ──→ [Kafka]
                                              ↓
                                      [Flink 预聚合]
                                              ↓
                                      [ClickHouse 批量写入]
                                       (每 1s / 每 10万条)
```

**关键优化**：
- 客户端批量 + 压缩（zstd），减少 70% 网络传输。
- Kafka 分区按 tenant_id，保证租户内有序。
- ClickHouse 异步批量写入，避免小写入。
- 写入前预聚合：相同 pattern 日志合并计数。

### 5.2 查询路径优化

- **谓词下推**：时间、租户、服务过滤下推到存储引擎。
- **索引加速**：ClickHouse 主键索引 + 跳数索引（skipping index）。
- **缓存层**：查询结果 Redis 缓存，TTL 30s。
- **预计算**：高频聚合指标物化视图，每分钟刷新。
- **向量化执行**：ClickHouse SIMD 向量化，单核扫描 5 亿行/秒。

### 5.3 容量规划

| 日志量 | 集群规模 | 月成本(估) |
|-------|---------|-----------|
| 1 TB/天 | 6 节点 CH + 3 Kafka | ¥8 万 |
| 10 TB/天 | 30 节点 CH + 9 Kafka | ¥60 万 |
| 100 TB/天 | 100+ 节点 + 冷热分层 | ¥300 万 |

---

## 六、可观测性（自身）

平台自身需可观测，元日志独立存储：

- **Metrics**：Prometheus + Grafana，采集 QPS/延迟/错误率。
- **Logging**：平台日志写入独立 ClickHouse 集群（元日志）。
- **Tracing**：OpenTelemetry 全链路追踪，Jaeger 展示。
- **Profiling**：Pyroscope 持续性能剖析，发现热点。

---

## 七、开发规范

### 7.1 代码规范

- Rust：`cargo fmt` + `cargo clippy` 强制通过。
- Go：`gofmt` + `golangci-lint`。
- Python：`black` + `ruff` + `mypy`。
- 前端：ESLint + Prettier + TypeScript strict。

### 7.2 CI/CD

```yaml
# .github/workflows/ci.yml
on: [push, pull_request]
jobs:
  test:
    strategy: { matrix: { service: [collector, gateway, ingester, query] } }
    steps:
      - uses: actions/checkout@v4
      - run: cargo test -p ${{ matrix.service }}
      - run: cargo clippy -p ${{ matrix.service }} -- -D warnings
  integration:
    needs: test
    services: { clickhouse, kafka, qdrant, postgres }
    steps:
      - run: ./scripts/integration-test.sh
  security:
    steps:
      - run: cargo audit
      - run: trivy fs .
```

### 7.3 发布策略

- **灰度发布**：按租户百分比灰度（1% → 10% → 50% → 100%）。
- **金丝雀**：新版本先部署到内部租户，观察 24h。
- **回滚**：Argo Rollouts 自动回滚（错误率 > 1% 触发）。

---

## 八、开放 API 设计

### 8.1 REST API

```
POST   /api/v1/logs/ingest          # 写入日志
GET    /api/v1/logs/search          # 查询日志
POST   /api/v1/logs/semantic-search # 语义检索
POST   /api/v1/llm/query            # 自然语言查询
GET    /api/v1/alerts               # 告警列表
POST   /api/v1/alerts/rules         # 创建告警规则
GET    /api/v1/dashboards           # 仪表盘
POST   /api/v1/chain/verify         # 存证验证
GET    /api/v1/export               # 导出日志
```

### 8.2 GraphQL（灵活查询）

```graphql
query {
  logs(
    timeRange: { start: "2026-06-24T00:00:00Z", end: "2026-06-24T23:59:59Z" }
    filter: { service: "payment", severity: ERROR }
  ) {
    timestamp
    body
    trace { duration rootSpan }
    pattern { id count }
  }
}
```

### 8.3 Webhook 与集成

- 告警 Webhook：飞书、钉钉、企业微信、Slack。
- 工单集成：Jira、GitHub Issues、PagerDuty。
- 数据导出：S3、Kafka、HTTP Stream。

---

> **下一步**：进入 API 详细设计 + 数据库 DDL 评审。
