# 后端联调进度记录

实时接口文档:https://video-chat-ai-5-people-group.icu/docs(OpenAPI JSON:`/openapi.json`)
契约文档:`~/Downloads/frontend-api.md`(静态约定,以线上文档 + 实测为准)

> 用法:每次对线上后端做实测后,把新一期记录**追加到本文件顶部**,旧记录保留作历史。

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
5. **异步语义**:`POST /api/sessions` 与 `POST /api/sessions/{id}/messages` 均为 202;前端拿 `reply_run_id` 后纯靠 SSE 收结果,不轮询。仅视频任务轮询 `GET /api/video-tasks/{task_id}`。
6. **小事**:`/health` 返回 `{"status":"ok"}` 裸 JSON 不走信封,前端健康检查按此处理,确认即可。

### 前端对应状态

- 当前全 mock(`lib/api.ts` 的 `/stories`、`/ai/title`、`/sandplay/*` 为旧约定),联调时按 `frontend-api.md` 重写
- 认证页/UI 未做,等后端主链路接口就绪后一并排期
