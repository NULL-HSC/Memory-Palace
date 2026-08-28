import type { DialogueTurn, Persona, SpeakerTurn, Story } from "./types";
import { pickMockTitle } from "./mock/titles";

/**
 * 统一请求封装 —— 所有页面只准从这里发请求（hackathon-plan §4.3）
 *
 * Mock 开关：未配置 NEXT_PUBLIC_BACKEND_URL 时走本地 mock（§4.4）。
 * 后端好了：.env.local 填入 BACKEND_URL / NEXT_PUBLIC_BACKEND_URL，逐条把
 * 下面的 mock 分支换成真接口即可。
 *
 * TODO(Capacitor iOS 打包时): `npm i @capacitor/core`，并在下方加原生分支 —
 *   if (Capacitor.isNativePlatform()) { 用 CapacitorHttp 直连 NEXT_PUBLIC_BACKEND_URL }
 */

const USE_MOCK = !process.env.NEXT_PUBLIC_BACKEND_URL;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function api<T = unknown>(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  const method = options.method ?? "GET";
  const res = await fetch(`/api${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) throw new Error(`请求失败 ${res.status}`);
  return res.json() as Promise<T>;
}

/* ---------------- 故事（契约: GET /stories · POST /stories） ---------------- */

export async function createStory(input: {
  title: string;
  transcript: string;
  cover: string;
  reflection?: string;
}): Promise<Pick<Story, "id">> {
  if (USE_MOCK) {
    await delay(300);
    return { id: `story-${Date.now()}` };
  }
  return api("/stories", { method: "POST", body: input });
}

/* ---------------- F3 标题建议（契约: POST /ai/title {transcript} → {title}） ---------------- */

export async function suggestTitle(transcript: string): Promise<string> {
  if (USE_MOCK) {
    await delay(900 + Math.random() * 500); // 模拟 LLM 延迟
    return pickMockTitle(transcript);
  }
  const res = await api<{ title: string }>("/ai/title", {
    method: "POST",
    body: { transcript },
  });
  return res.title;
}

/* ---------------- AIGC:人设提取 + 群聊发言(全真实 LLM,无 mock 兜底) ----------------
 *  服务端路由 /api/llm/*(key 只在服务端,第 i 个角色用第 i 个 key;轮内串行互相可见)。
 *  失败即抛错,由调用方决定重试/提示 —— 演示期要看到 LLM 的真实行为。
 *  契约对应:GET /api/sessions/{id}/personas、POST /reply-runs → SSE role.delta(后端就绪后替换)。 */

export interface ChatCtx {
  transcript: string;
  cast: Persona[];
  history?: DialogueTurn[]; // 群聊近期对话
  userName?: string; // 用户带入角色的名字(invite/answer 模式点名用)
}

/** 真人设头像:LLM 只产出名字/人设;"我"用 companion 图,其余从占位池按序分配(正式美术由服务端 avatar_url 替换) */
const ME_AVATAR = "/avatars/avatar.png";
const AVATAR_POOL = [
  "/avatars/av-bear.png",
  "/avatars/av-bunny.png",
  "/avatars/av-duck.png",
  "/avatars/av-cat.png",
  "/avatars/av-fox.png",
  "/avatars/av-dog.png",
];

/** 调服务端 LLM 路由;非 2xx 一律抛错(不再静默回退 mock) */
async function llm<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? `LLM 请求失败 ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function getPersonas(transcript: string): Promise<Persona[]> {
  const real = await llm<{ personas: Array<{ id: string; name: string; profile: string; isUser?: boolean }> }>(
    "/api/llm/personas",
    { transcript }
  );
  if (real.personas.length === 0) throw new Error("LLM 未提取到人设");
  let pool = 0;
  return real.personas.map((p) => ({
    id: p.id,
    name: p.name,
    profile: p.profile,
    avatar: p.isUser ? ME_AVATAR : AVATAR_POOL[pool++ % AVATAR_POOL.length],
  }));
}

export type TurnMode = "opening" | "continue" | "invite" | "answer";

/** 群聊一轮发言;continue 轮允许全员沉默(返回空数组) */
export async function runTurn(mode: TurnMode, speakers: string[], ctx: ChatCtx): Promise<SpeakerTurn[]> {
  const real = await llm<{ turns: SpeakerTurn[] }>("/api/llm/turn", {
    transcript: ctx.transcript,
    personas: ctx.cast,
    speakers,
    mode,
    history: ctx.history ?? [],
    userName: ctx.userName,
  });
  return real.turns;
}

/* ---------------- 健康检查（契约: GET /health）—— 联调第一个测它 ---------------- */

export const health = () => api<{ ok: boolean }>("/health");
