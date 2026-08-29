# 前后端联调清单

> 用途:联调当场对着走的检查表。实测结论追加到 `docs/backend-progress.md` 顶部,本文件只放「怎么联、看什么」。
> 接口以线上 OpenAPI 为准:https://video-chat-ai-5-people-group.icu/docs

## 0. 前置准备

- [ ] 后端给一个可国内直连的 API 地址(当前域名被 DNSPod 备案拦截,见下「后端关注 P0-1」)
- [ ] 后端提供一个可用的 access token(前端暂无登录 UI,短期用 `NEXT_PUBLIC_BACKEND_ACCESS_TOKEN` 注入)
- [ ] 前端 `.env.local` 配置:

```bash
BACKEND_URL=http://后端地址:端口        # 服务端代理用,浏览器走 /api/* 同源转发
NEXT_PUBLIC_USE_BACKEND=true           # 启用真后端(所有请求收敛在 lib/api.ts)
NEXT_PUBLIC_BACKEND_ACCESS_TOKEN=xxx   # 黑客松短期方案:手工注入 Bearer token
```

- [ ] 不配后端环境变量 = 本地演示路径(人设/群聊走本地 `/api/llm/*`,用 kimi key),可随时回退

## 1. 前端侧:按顺序逐环验证

每环挂了都能定位归属,不要跳步:

| 顺序 | 环节 | 接口 | 通过标准 | 挂了看哪 |
|---|---|---|---|---|
| 1 | 健康检查 | `GET /health` | 返回 `{"status":"ok"}`(裸 JSON,不走信封) | 代理/网络 |
| 2 | 认证 | token 注入 | 带 `Authorization: Bearer` 的请求不 401 | token 有效性 |
| 3 | 新建 session | `POST /api/sessions {final_text}` | 202,拿到 `session_id` | 请求体格式 |
| 4 | 人设提取 | `GET /sessions/{id}/personas` | 异步产物,前端轮询 ≤60s;`persona_status` 终态正确 | 状态枚举值 |
| 5 | 群聊 | `GET events`(SSE) + 用户发言时 `POST messages` | `role.delta` 按 `message_id` 聚合成气泡;多角色交错不串话;断线用 `cursor` 重连只收新事件 | SSE 事件格式 |
| 6 | 视频 | 轮询 `GET /api/sessions/{id}` 的 `video.status` → `GET /api/videos/{video_id}/playback` | 就绪后舞台播真视频;失败时本地舞台兜底正常 | 状态值/播放地址 |
| 7 | Keep | `PATCH visibility` | 注意映射:前端 `community → public`、`friends → private` | 可见性枚举 |

### 前端排查纪律

- 浏览器 Network 面板看 `/api/*` 的状态码和信封 `{code, data, message}`
- SSE 用 fetch 流式读取(`EventSource` 不能自定义头),重点看原始事件流是否符合契约
- 群聊失败时界面上有 "the room lost its voice · tap to retry" 重试入口,先看它再查日志
- 每测一轮,实测结果追加到 `docs/backend-progress.md` 顶部(带时间戳)

## 2. 后端侧:需要她关注 / 确认

按优先级,详见 `docs/backend-progress.md` 2026-08-28 条目:

### P0(不解决就无法联调)

1. **域名国内无法直连**:公共 DNS 解析到 `120.53.103.128`,HTTP 被 DNSPod 重定向到备案拦截页。需处理备案/换域名/加 CDN,或提供备用 API 域名——否则国内手机和部署机器都联不了
2. **SSE 契约未进 OpenAPI**:`GET events` 目前文档是空的 `application/json` schema。需补:`text/event-stream`、心跳间隔、全部 event name,以及 `event_id / reply_run_id / message_id / persona_id / delta`、消息完成、run 完成与失败的完整 JSON 示例
3. **`persona_id` 语义**:`SendMessageRequest` / `StartReplyRunRequest` 里的 `persona_id` 是「用户带入的发言角色」还是「希望回复的目标角色」?前端当前按前者传值,需确认

### P1(联调中会踩)

4. **状态字段无枚举约束**:`status / persona_status / video.status / reply-run status / sender_type / author_type / kind` 都是无约束 string。请给枚举值 + 状态转移图,尤其是视频成功/失败值、人设未就绪时 `GET personas` 的 HTTP 行为
5. **视频任务标识歧义**:`POST sessions` 返回 `video_task_id`,但没有 video-task 查询接口;会话详情又返回 `video.id`。请明确两者关系和官方轮询流程
6. **可见性产品不对齐**:后端只有 `private|public`,前端有三档 `private|friends|community`。需一起定:后端加 `friends`,还是前端砍选项(当前临时映射 `friends → private`)
7. **认证生命周期缺失**:无 token 过期时间、refresh 接口、401 错误 schema
8. **播放地址约定**:`playback_url` 的 TTL;需对浏览器/iOS 支持 HTTPS、CORS、Range 请求、正确 video Content-Type

### P2(文档质量)

9. **OpenAPI 与实测不一致**:422 响应文档写的是 FastAPI 默认 `{detail:[...]}`,实测已是统一信封。请修文档,并补齐 401/403/404/409/429/5xx 的统一错误响应
10. **转写约束缺失**:`audio` 只写了 binary,请补支持的 MIME/容器、大小、时长、超时和 413/415 错误

## 3. 需要产品+前后端一起定的(不是纯后端问题)

- **可见性三档 vs 两档**:后端加 `friends` 还是前端删选项?
- **视频轮询流程**:以 `video_task_id` 还是 `video.id` 为准,写进文档后前端照做
