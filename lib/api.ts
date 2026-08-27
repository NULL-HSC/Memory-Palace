import type { CharacterId, Persona, Story } from "./types";
import { pickMockTitle } from "./mock/titles";
import { nextResponseTurns, OPENING_TURNS } from "./mock/dialogue";
import { MOCK_PERSONAS } from "./mock/personas";

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

/* ---------------- F4 对白编排（契约: POST /sandplay/turn {storyId, history} → {speakerId, text}[]） ---------------- */

export async function getOpeningTurns(): Promise<
  Array<{ speakerId: CharacterId; text: string }>
> {
  if (USE_MOCK) return OPENING_TURNS;
  return api("/sandplay/opening", { method: "POST" });
}

export async function getResponseTurns(): Promise<
  Array<{ speakerId: CharacterId; text: string }>
> {
  if (USE_MOCK) {
    await delay(400);
    return nextResponseTurns();
  }
  return api("/sandplay/turn", { method: "POST" });
}

/* ---------------- 人设提取（契约: GET /api/sessions/{session_id}/personas，Top 3） ---------------- */

export async function getPersonas(): Promise<Persona[]> {
  if (USE_MOCK) {
    await delay(800 + Math.random() * 400); // 模拟 LLM 人设提取
    return MOCK_PERSONAS;
  }
  // TODO(联调): 前置 POST /api/sessions 拿 session_id，再 GET /sessions/{id}/personas（见 frontend-api.md）
  throw new Error("personas 真接口待联调");
}

/* ---------------- 健康检查（契约: GET /health）—— 联调第一个测它 ---------------- */

export const health = () => api<{ ok: boolean }>("/health");
