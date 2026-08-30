# 开发指南（原 README 技术部分）

治愈系「故事存档 + 角色陪伴」Demo —— 黑客松前端主链路。
用说话的方式记录一天 → 选出要带入的故事角色 → 进入 sandplay(直播间)以该角色视角聊透这一天 → Keep 页确认标题/封面/可见性 → 存入长廊。

**权威来源**:视觉/像素 = `sandplay-handoff-v1`(spec.html + screens/*.html);交互/产品决策 = `docs/product-flow.md`;工程方案 = `hackathon-plan.md`。

## 快速开始

```bash
npm install
npm run dev          # http://localhost:3000
```

不配后端环境变量 = **本地演示路径**(人设/群聊走同源 `/api/llm/*` 真实 LLM,需配 `LLM_*` key;画廊数据为本地种子)。
配上后端环境变量 = 真后端联调,详见 `docs/integration-checklist.md`。

### 演示/调试捷径(URL 直达任意帧)

```
/?frame=listening    # F2 语音转写
/?frame=pick         # 沙盘板块一:选带入角色
/?frame=draft        # F3 标题封面(带 mock 转写)
/?frame=sandplay     # F4 直播间对话
/?frame=spaces       # F5 他人房间
```

## 后端联调(hackathon-plan §4)

```bash
cp .env.example .env.local
# 填入队友地址:
# BACKEND_URL=http://公网IP:8000            (浏览器走 /api/* 同源代理,服务端转发)
# NEXT_PUBLIC_BACKEND_URL=http://公网IP:8000 (iOS App 直连用)
```

配上后端环境变量后,`app/api/[...path]/route.ts` 自动转发所有 `/api/*` 请求;
前端所有请求收敛在 **`lib/api.ts`**(认证/session/SSE/视频契约已类型化封装)。联调步骤与已知问题见 `docs/integration-checklist.md`。

### API 契约（OpenAPI 0.1.0，错误格式统一 `{ code, data, message }`）

| 接口 | 方法 | 请求 | 响应 | 现状 |
|---|---|---|---|---|
| `/health` | GET | — | `{ status: "ok" }` | 裸 JSON，不走信封 |
| `/api/sessions` | POST | `{ final_text }` | `202 + {session_id,video_task_id,...}` | 新建故事与异步生成 |
| `/api/sessions/{id}/personas` | GET | — | `{items: Persona[]}` | 选带入角色 |
| `/api/sessions/{id}/messages` | POST | `{persona_id,content}` | `202 + {reply_run_id,message_id,status}` | 用户发言 |
| `/api/sessions/{id}/reply-runs` | POST | `{persona_id}` | `202 + {reply_run_id,status}` | 无用户新消息时启动回复 |
| `/api/sessions/{id}/events` | GET | `cursor?` | SSE | `role.delta` 按 `message_id` 聚合 |
| `/api/sessions/{id}` | GET | — | `{...,video}` | 会话/人设/视频状态 |
| `/api/videos/{video_id}/playback` | GET | — | `{playback_url}` | 视频播放地址 |
| `/api/sessions/{id}/visibility` | PATCH | `{visibility: private|public}` | `data:null` | Keep 时更新 |
| `/api/transcriptions` | POST | multipart `audio` | `{transcript}` | 待录音 UI 改为真采集后调用 |

## 结构

```
app/page.tsx                # 帧状态机 Auth + F1–F5 + T1 转场 overlay
app/api/[...path]/route.ts  # 通用代理路由(转发时去掉 /api 前缀)
app/globals.css             # design tokens(晴空蓝剪贴簿色系,美术 2026-08)+ 全部动效
lib/api.ts                  # 唯一请求入口 + 认证/session/SSE/视频契约
lib/store.tsx               # stories + Lv 进度(localStorage 持久化)
lib/mock/                   # 种子故事 / 伪转写文本 / 标题池 / 人设 Top 3(对话链路已无 mock,全真实 LLM)
docs/backend-progress.md    # 后端联调进度实测记录(按时间戳往顶部追加)
docs/integration-checklist.md # 前后端联调检查表(怎么联、看什么)
docs/product-flow.md        # 产品与交互定义(逐页确认的唯一口径)
docs/visual-direction.md    # 视觉方向(晴空蓝色板 + 剪贴簿语言,2026-08 定稿)
public/avatars/             # handoff 角色 PNG(占位美术,正式交付后整体替换)
components/characters/      # Avatar 组件(img 封装,接口稳定)
components/scene/           # F4 舞台(AIGC video 槽位:"演绎中"加载态 + crossfade 进场 + 说话者焦点)
components/frames/          # Auth F1Home F2Listening PickRole F3Draft F4Sandplay F5Spaces
components/ui/              # MountedPrint / NewStorySlot / Waveform / TypeText / TypingIndicator / Toast
```

## 两份文档的取舍记录(冲突时怎么落的)

- F3:挪到沙盘对话结束之后(Keep 页)—— 封面系统生成,标题可编辑,可见性 Private / Friends / Community,"In your words" 转写回顾;产品稿的封面选择行/反思输入未做
- F4:直播间形态 —— 全幅舞台(AIGC video 槽位,"演绎中"加载态 + crossfade 进场)+ 弹幕式对话浮层;群聊 = 故事 Top 3 人设,用户带入一角,说话者焦点联动(详见 docs/product-flow.md)
- F5:计数徽标按产品稿 v3 决策移除;Ivo 的 PNG 是鸭(产品稿写作 owl),正式美术交付时统一
- §8 a11y 已落:需阅读的弱色(日期/speaker 名/placeholder)用加深的 `--readable`,44px 触控区,prefers-reduced-motion

## 后续计划(按 hackathon-plan 时间表)

- **Capacitor iOS 打包(20–24h)**:`npm i @capacitor/core @capacitor/cli @capacitor/ios` →
  `npx cap init` → `npx cap add ios` → `npm run sync:ios`(脚本已就位;
  `build:app` 会先临时挪走 app/api 再静态导出)。打包后在 `lib/api.ts` 加
  `CapacitorHttp` 原生直连分支(文件内有 TODO)。
- **EdgeOne Pages 部署(24–28h)**:推 GitHub → 导入 → 构建命令 `npm run build`
  (不是 `build:app`)→ 环境变量加 `BACKEND_URL`。
- **AIGC 视频**:F4 舞台已是槽位 —— 真视频就绪后在 `SandplayStage` 里 crossfade 600ms 接入。

- 后端仓库：https://gitee.com/pastyy/shenicest-backend/invite_link?invite=f6c55a84c7a18d975046256cc77f01db71dd7cf55caa3d2ce511b1509403e86e96b74f9670d13b6dbf94c493d6df8dec
