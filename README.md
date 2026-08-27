# 理理理 · lilili

治愈系「故事存档 + 角色陪伴」Demo —— 黑客松前端主链路。
用说话的方式记录一天 → 选出要带入的故事角色 → 进入 sandplay(直播间)以该角色视角聊透这一天 → Keep 页确认标题/封面/可见性 → 存入长廊。

**权威来源**:视觉/像素 = `sandplay-handoff-v1`(spec.html + screens/*.html);交互/产品决策 = `理理理.md v3`;工程方案 = `hackathon-plan.md`。

## 快速开始

```bash
npm install
npm run dev          # http://localhost:3000
```

不配任何环境变量 = **全 mock 模式**,五帧四转场完整可走通。

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

配上 `BACKEND_URL` 后,`app/api/[...path]/route.ts` 自动转发所有 `/api/*` 请求;
前端所有请求收敛在 **`lib/api.ts`**,逐条把 mock 分支换成真接口即可。

### API 契约(待与后端确认,错误格式统一 `{ code, data, message }`)

| 接口 | 方法 | 请求 | 响应 | 现状 |
|---|---|---|---|---|
| `/health` | GET | — | `{ ok: true }` | 联调第一个测它 |
| `/stories` | GET | — | `Story[]` | mock:localStorage + 种子 |
| `/stories` | POST | `{ title, transcript, cover, reflection? }` | `{ id }` | mock |
| `/ai/title` | POST | `{ transcript }` | `{ title }` (≤8 词,名词短语,不剧透) | mock:标题池 |
| `/sandplay/opening` | POST | `{ storyId, transcript }` | `{ speakerId, text }[]` | mock:脚本开场 |
| `/sandplay/turn` | POST | `{ storyId, history }` | `{ speakerId, text }[]` (1–2 位回应,每句 ≤30 词) | mock:回应池轮转 |

## 结构

```
app/page.tsx                # 帧状态机 F1–F5 + T1 转场 overlay
app/api/[...path]/route.ts  # 通用代理路由(转发时去掉 /api 前缀)
app/globals.css             # handoff §2 design tokens + §6 全部动效
lib/api.ts                  # 唯一请求入口 + USE_MOCK 开关
lib/store.tsx               # stories + Lv 进度(localStorage 持久化)
lib/mock/                   # 种子故事 / 伪转写文本 / 标题池 / 脚本对白 / 人设 Top 3
docs/backend-progress.md    # 后端联调进度实测记录(按时间戳往顶部追加)
docs/product-flow.md        # 产品与交互定义(逐页确认的唯一口径)
public/avatars/             # handoff 角色 PNG(占位美术,正式交付后整体替换)
components/characters/      # Avatar 组件(img 封装,接口稳定)
components/scene/           # F4 沙盘(AIGC video 槽位:shimmer 兜底 + speaker 焦点)
components/frames/          # F1Home F2Listening PickRole F3Draft F4Sandplay F5Spaces
components/ui/              # MountedPrint / NewStorySlot / Waveform / TypeText / TypingIndicator / Toast
```

## 两份文档的取舍记录(冲突时怎么落的)

- F3:挪到沙盘对话结束之后(Keep 页)—— 封面系统生成,标题可编辑,可见性 Private / Friends / Community,"In your words" 转写回顾;理理理的封面选择行/反思输入未做
- F4:外观按 handoff 沙盘(196px tray + sway 小像),行为按理理理 —— 说话者焦点联动、shimmer 兜底(它是 AIGC video 槽位)
- F5:计数徽标按理理理 v3 决策移除;Ivo 的 PNG 是鸭(理理理写作 owl),正式美术交付时统一
- §8 a11y 已落:需阅读的弱色(日期/speaker 名/placeholder)加深到 #7A7364、44px 触控区、prefers-reduced-motion

## 后续计划(按 hackathon-plan 时间表)

- **Capacitor iOS 打包(20–24h)**:`npm i @capacitor/core @capacitor/cli @capacitor/ios` →
  `npx cap init` → `npx cap add ios` → `npm run sync:ios`(脚本已就位;
  `build:app` 会先临时挪走 app/api 再静态导出)。打包后在 `lib/api.ts` 加
  `CapacitorHttp` 原生直连分支(文件内有 TODO)。
- **EdgeOne Pages 部署(24–28h)**:推 GitHub → 导入 → 构建命令 `npm run build`
  (不是 `build:app`)→ 环境变量加 `BACKEND_URL`。
- **AIGC 视频**:F4 舞台已是槽位 —— 真视频就绪后在 `SandplayStage` 里 crossfade 600ms 接入。
