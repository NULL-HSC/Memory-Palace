# 后端联调进度记录

实时接口文档:https://video-chat-ai-5-people-group.icu/docs(OpenAPI JSON:`/openapi.json`)
契约文档:`~/Downloads/frontend-api.md`(静态约定,以线上文档 + 实测为准)

> 用法:每次对线上后端做实测后,把新一期记录**追加到本文件顶部**,旧记录保留作历史。

---

## 2026-08-28 OpenAPI 0.1.0 对齐

### 前端已对齐

- 统一解包 `{code,data,message}`，Bearer token 由单一 API 层附加；同源代理现在正确保留后端 `/api` 前缀，`/health` 例外。
- 新建故事:`POST /api/sessions {final_text}` → 等待 `GET personas` → 选角色。
- 群聊:先打开 `GET events`；用户发言再 `POST messages`（返回 `message_id/turn_id/status`），事件按 `message_id` 分桶，支持多角色交错 delta。
- 视频:轮询 `GET /api/sessions/{id}` 的 `video.status`，就绪后用 `video.id` 请求 `GET /api/videos/{video_id}/playback`，并在舞台播放。
- Keep 时调 `PATCH visibility`。后端只有 `private/public`，前端 `community → public`，`friends → private`。
- 认证、转写、session 列表/详情/删除、消息列表已在 `lib/api.ts` 建好类型化封装，群聊通过 `messages` + `events` 工作。

### 待后端关注（按优先级）

1. **P0 域名在国内无法直连**:公共 DNS 解析为 `120.53.103.128`，HTTP 被 DNSPod 重定向到备案拦截页；本机代理 DNS 返回 `198.18.0.205` 时，TLS 成功但应用返回 empty response。需处理备案/域名/CDN 或提供可访问的备用 API 域名，否则国内手机与部署机器都无法联调。
2. **P0 SSE 契约未进 OpenAPI**:`GET events` 当前被写成 `application/json` 空 schema。请明确 `text/event-stream`、心跳、所有 event name，以及 `event_id/reply_run_id/message_id/persona_id/delta`、消息完成、run 完成与失败的完整 JSON 示例。
3. **P0 `persona_id` 语义需确认**:`SendMessageRequest` 和 `StartReplyRunRequest` 都只写 `persona_id`，但未说它是“用户带入的发言角色”还是“希望回复的目标角色”。前端当前按前者传值。
4. **P1 状态字段都是无约束 string**:`status/persona_status/video.status/reply-run status/sender_type/author_type/kind`应提供 enum 及转移图，特别是视频成功/失败值和人设未就绪时 `GET personas` 的 HTTP/响应行为。
5. **P1 视频任务标识有歧义**:`POST sessions` 返回 `video_task_id`，但无 video-task 查询接口；会话详情又返回 `video.id`。请在文档中明确两者关系和官方轮询流程。
6. **P1 可见性产品不对齐**:后端只允许 `private|public`，前端有 `private|friends|community`。需决定是后端新增 `friends`，还是前端删掉该选项。
7. **P1 认证缺少生命周期**:OpenAPI 无 token 过期时间、refresh 接口和 401 错误 schema。正式版不应依赖手工注入 access token。
8. **P1 播放地址约定**:请说明 `playback_url` TTL，并确保对浏览器/iOS 支持 HTTPS、CORS、Range 请求与正确 video Content-Type。
9. **P2 文档 schema 仍与实测不一致**:OpenAPI 0.1.0 的 422 仍是 FastAPI `{detail:[...]}`，而 2026-08-27 实测为统一信封。请修正 OpenAPI，并补齐 401/403/404/409/429/5xx 的统一错误响应。
10. **P2 转写约束缺失**:`audio` 只写为 binary，请补支持的 MIME/容器、大小、时长、超时和 413/415 错误。

### 联调说明

- 无后端环境变量时保留本地演示路径。启用真后端需配置 `BACKEND_URL` 和 `NEXT_PUBLIC_BACKEND_URL`，并通过认证 UI 或黑客松短期 `NEXT_PUBLIC_BACKEND_ACCESS_TOKEN` 提供 Bearer token。
- 因域名当前被拦截，本次只能完成 OpenAPI 契约级对齐，无法对新业务接口做端到端实测。

---

## 2026-08-27 实测

### 已上线且实测通过

- 认证全链路:`POST /api/auth/verification-codes`(demo 直接返回码,201)→ `register`(201)→ `login`(200)→ `logout`
- 信封格式 `{code, data, message}` 正确;422 也已包成信封(实测 `{"code":422,"message":"请求参数不合法"}`)
- `/health` → `{"status":"ok"}`;`/health/ready` → database + redis 均 ok
- CORS 已配好:允许 `http://localhost:3000` 来源,`Access-Control-Allow-Headers` 含 `authorization`(SSE 用 fetch 订阅的前提已满足)

### 待后端注意(check 清单)

1. **主链路接口均未上线**:转写、session 增删查、可见性、人设、群聊消息、reply-run、SSE 事件流、视频任务轮询、公开视频、播放地址。建议按前端联调顺序排优先级:
   `POST /api/transcriptions` → `POST /api/sessions` → `GET personas` → `POST messages` + `GET events (SSE)` → 视频相关
2. **文档与实际不符(1 处)**:OpenAPI 中 422 响应 schema 写的是 FastAPI 默认 `{detail: [...]}`,实际返回统一信封。行为正确,建议改文档 schema,避免前端按文档写解析踩空。
3. **参数约束(契约文档未写,前端表单需按此校验)**:
   - `password`:8–128 位
   - `verification_code`:6 位纯数字(`^\d{6}$`)
   - `username`:1–64 位
   - `phone`:目前无格式校验,任意字符串可注册 —— demo 可接受,需确认是否有意为之
4. **SSE 关键约定**:
   - 事件流必须支持 `Authorization: Bearer` 头(前端用 fetch 流式读取,`EventSource` 无法自定义头)
   - 断线重连:`cursor` 参数回传最后收到的 `event_id`,只发其后的新事件
   - `role.delta` 按 `message_id` 聚合成气泡;多角色并发时不同 `message_id` 的 delta 会交错
5. **异步语义**:`POST /api/sessions` 与 `POST /api/sessions/{id}/messages` 均为 202;前端订阅 SSE 收取群聊结果,不调用 reply-runs。仅视频任务轮询会话详情中的 `video.status`。
6. **小事**:`/health` 返回 `{"status":"ok"}` 裸 JSON 不走信封,前端健康检查按此处理,确认即可。

### 前端对应状态

- 当前全 mock(`lib/api.ts` 的 `/stories`、`/ai/title`、`/sandplay/*` 为旧约定),联调时按 `frontend-api.md` 重写
- 认证页/UI 已接入(2026-08-28):`components/frames/Auth.tsx` 登录/注册同屏,启动无 token 进 auth 帧,mock 模式有 demo 跳过入口
