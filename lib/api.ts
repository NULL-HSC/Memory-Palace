import type { DialogueTurn, Persona, SpeakerTurn, Story, StoryScene } from "./types";
import { pickMockTitle } from "./mock/titles";

/**
 * 前端统一 API 层。浏览器只访问同源 /api/*，Next.js 代理到 BACKEND_URL。
 * NEXT_PUBLIC_BACKEND_URL 仅用于标记启用真后端（后续 iOS 原生直连也会用到）。
 */

export const USE_BACKEND =
  process.env.NEXT_PUBLIC_USE_BACKEND === "true" || Boolean(process.env.NEXT_PUBLIC_BACKEND_URL);

const ACCESS_TOKEN_KEY = "sheniceset_access_token";
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiEnvelope<T> {
  code: number;
  data: T | null;
  message: string;
}

export interface UserResponse {
  id: string;
  phone: string;
  username: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: UserResponse;
}

export interface BackendSessionSummary {
  id: string;
  title?: string | null;
  final_text_preview: string;
  visibility: string;
  video_status: string;
  chat_phase?: string;
  created_at: string;
}

export interface VideoDetail {
  id: string;
  status: string;
  duration_seconds?: number | null;
  cover_url?: string | null;
  error_code?: string | null;
  message?: string | null;
}

export interface SessionStatus {
  id: string;
  final_text: string;
  visibility: string;
  persona_status: string;
  video: VideoDetail;
  created_at: string;
}

export interface CreateSessionResponse {
  session_id: string;
  video_task_id: string;
  persona_status: string;
  visibility: string;
  status: string;
}

export interface BackendMessage {
  id: string;
  sender_type: string;
  sender_id: string;
  author_type: string;
  content: string;
  created_at: string;
}

export interface PageResult<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface ReplyRunCreated {
  reply_run_id: string;
  status: string;
  message_id?: string;
}

export interface PreparedSandplay {
  personas: Persona[];
  session?: CreateSessionResponse;
  /** 本地解构产出的场景(真后端模式下由后端自行喂 VLM,这里为 undefined) */
  scene?: StoryScene;
}

function getAccessToken(): string | null {
  if (typeof window !== "undefined") {
    const stored = window.localStorage.getItem(ACCESS_TOKEN_KEY);
    if (stored) return stored;
  }
  // 黑客松短期方案:登录态优先读 localStorage(register/login 写入),
  // 未登录时回落到手工注入的 NEXT_PUBLIC_BACKEND_ACCESS_TOKEN。
  return process.env.NEXT_PUBLIC_BACKEND_ACCESS_TOKEN || null;
}

/** 是否已有登录态(供帧状态机启动时决定是否进 auth 帧) */
export function hasAccessToken(): boolean {
  return Boolean(getAccessToken());
}

export function setAccessToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
  else window.localStorage.removeItem(ACCESS_TOKEN_KEY);
}

function authHeaders(): HeadersInit {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function readError(res: Response): Promise<ApiError> {
  const payload = (await res.json().catch(() => null)) as
    | { code?: number; message?: string; detail?: unknown }
    | null;
  const detail = Array.isArray(payload?.detail) ? "请求参数不合法" : undefined;
  return new ApiError(payload?.message || detail || `请求失败 ${res.status}`, res.status, payload?.code);
}

async function requestEnvelope<T>(
  path: string,
  options: { method?: string; body?: unknown; headers?: HeadersInit } = {}
): Promise<T> {
  const headers = new Headers(authHeaders());
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  new Headers(options.headers).forEach((value, key) => headers.set(key, value));
  const res = await fetch(`/api${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
  });
  if (!res.ok) throw await readError(res);
  const envelope = (await res.json()) as ApiEnvelope<T>;
  if (typeof envelope?.code !== "number") {
    throw new ApiError("后端响应缺少 code/data/message 信封", res.status);
  }
  if (envelope.code !== 0 || envelope.data == null) {
    throw new ApiError(envelope.message || "后端返回失败", res.status, envelope.code);
  }
  return envelope.data;
}

async function requestEmptyEnvelope(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<void> {
  const headers = new Headers(authHeaders());
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  const res = await fetch(`/api${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
  });
  if (!res.ok) throw await readError(res);
  const envelope = (await res.json()) as ApiEnvelope<null>;
  if (envelope.code !== 0) throw new ApiError(envelope.message || "后端返回失败", res.status, envelope.code);
}

/* ── 认证 ── */

export const requestVerificationCode = (phone: string) =>
  requestEnvelope<{ verification_code: string | null; expires_in_seconds: number }>(
    "/auth/verification-codes",
    { method: "POST", body: { phone } }
  );

export async function register(input: {
  phone: string;
  verification_code: string;
  username: string;
  password: string;
}): Promise<AuthResponse> {
  const auth = await requestEnvelope<AuthResponse>("/auth/register", { method: "POST", body: input });
  setAccessToken(auth.access_token);
  return auth;
}

export async function login(phone: string, password: string): Promise<AuthResponse> {
  const auth = await requestEnvelope<AuthResponse>("/auth/login", {
    method: "POST",
    body: { phone, password },
  });
  setAccessToken(auth.access_token);
  return auth;
}

export async function logout(): Promise<void> {
  await requestEmptyEnvelope("/auth/logout", { method: "POST" });
  setAccessToken(null);
}

/* ── 转写与会话 ── */

export async function transcribeAudio(audio: Blob, filename = "recording.webm"): Promise<string> {
  const form = new FormData();
  form.append("audio", audio, filename);
  const res = await fetch("/api/transcriptions", {
    method: "POST",
    headers: authHeaders(),
    body: form,
  });
  if (!res.ok) throw await readError(res);
  const envelope = (await res.json()) as ApiEnvelope<{ transcript: string }>;
  if (envelope.code !== 0 || !envelope.data) {
    throw new ApiError(envelope.message || "转写失败", res.status, envelope.code);
  }
  return envelope.data.transcript;
}

export const createSession = (finalText: string) =>
  requestEnvelope<CreateSessionResponse>("/sessions", {
    method: "POST",
    body: { final_text: finalText },
  });

export const listSessions = (page = 1, limit = 20) =>
  requestEnvelope<PageResult<BackendSessionSummary>>(`/sessions?page=${page}&limit=${limit}`);

const SESSION_COVERS = ["sage", "blush", "lavender"];

export function sessionSummaryToStory(summary: BackendSessionSummary, index: number): Story {
  const createdAt = Date.parse(summary.created_at);
  const title = summary.title?.trim() || summary.final_text_preview.trim() || "未命名故事";
  const date = Number.isNaN(createdAt)
    ? ""
    : new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric" }).format(createdAt);

  return {
    id: `session-${summary.id}`,
    title,
    date,
    cover: SESSION_COVERS[index % SESSION_COVERS.length],
    transcript: summary.final_text_preview,
    visibility: summary.visibility === "public" ? "community" : "private",
    createdAt: Number.isNaN(createdAt) ? Date.now() : createdAt,
    backendSessionId: summary.id,
    backendVideoStatus: summary.video_status,
  };
}

export const getSessionStatus = (sessionId: string) =>
  requestEnvelope<SessionStatus>(`/sessions/${encodeURIComponent(sessionId)}`);

export const deleteSession = (sessionId: string) =>
  requestEmptyEnvelope(`/sessions/${encodeURIComponent(sessionId)}`, { method: "DELETE" });

export const updateSessionVisibility = (sessionId: string, visibility: "private" | "public") =>
  requestEmptyEnvelope(`/sessions/${encodeURIComponent(sessionId)}/visibility`, {
    method: "PATCH",
    body: { visibility },
  });

interface BackendPersona {
  id: string;
  name: string;
  kind: string;
  profile: string;
  avatar_url?: string | null;
}

const ME_AVATAR = "/avatars/avatar.png";
const AVATAR_POOL = [
  "/avatars/av-cat.png",
  "/avatars/av-glasses.png",
  "/avatars/av-bunny.png",
  "/avatars/av-bear.png",
  "/avatars/av-duck.png",
  "/avatars/av-fox.png",
  "/avatars/av-dog.png",
];

const mapPersonas = (items: BackendPersona[]): Persona[] =>
  items.slice(0, 3).map((persona, index) => ({
    id: persona.id,
    name: persona.name,
    profile: persona.profile,
    avatar: persona.avatar_url || (index === 0 ? ME_AVATAR : AVATAR_POOL[(index - 1) % AVATAR_POOL.length]),
  }));

export async function getSessionPersonas(sessionId: string): Promise<Persona[]> {
  const data = await requestEnvelope<{ items: BackendPersona[] }>(
    `/sessions/${encodeURIComponent(sessionId)}/personas`
  );
  return mapPersonas(data.items);
}

/** 会话创建后人设是异步产物；按会话状态轻量等待，不轮询 reply-run。 */
async function waitForPersonas(sessionId: string): Promise<Persona[]> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const status = await getSessionStatus(sessionId);
    const personaStatus = status.persona_status.toLowerCase();
    if (["failed", "error", "cancelled", "canceled"].includes(personaStatus)) {
      throw new ApiError("后端人设提取失败", 502);
    }
    const ready = ["succeeded", "success", "completed", "complete", "ready", "done"].includes(personaStatus);
    if (!ready) {
      await delay(1500);
      continue;
    }
    try {
      const personas = await getSessionPersonas(sessionId);
      if (personas.length > 0) return personas;
    } catch (error) {
      if (error instanceof ApiError && ![404, 409, 425].includes(error.status)) throw error;
    }
    await delay(1500);
  }
  throw new ApiError("等待人设提取超时", 504);
}

/* ── 本地 LLM 降级（未配置真后端时） ── */

async function localLlm<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const error = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(error?.message ?? `LLM 请求失败 ${res.status}`);
  }
  return (await res.json()) as T;
}

async function getLocalPersonas(transcript: string): Promise<{ personas: Persona[]; scene?: StoryScene }> {
  const result = await localLlm<{
    scene?: StoryScene;
    personas: Array<{
      id: string;
      name: string;
      profile: string;
      voice?: string;
      stance?: string;
      appearance?: string;
      isUser?: boolean;
    }>;
  }>("/api/llm/personas", { transcript });
  if (result.personas.length === 0) throw new Error("LLM 未提取到人设");
  let poolIndex = 0;
  return {
    scene: result.scene,
    personas: result.personas.map((persona) => ({
      id: persona.id,
      name: persona.name,
      profile: persona.profile,
      // voice/stance 一路带到群聊 prompt;appearance 留给 VLM
      voice: persona.voice,
      stance: persona.stance,
      appearance: persona.appearance,
      avatar: persona.isUser ? ME_AVATAR : AVATAR_POOL[poolIndex++ % AVATAR_POOL.length],
    })),
  };
}

export async function prepareSandplay(transcript: string): Promise<PreparedSandplay> {
  if (!USE_BACKEND) return getLocalPersonas(transcript);
  const session = await createSession(transcript);
  const personas = await waitForPersonas(session.session_id);
  return { personas, session };
}

/* ── 消息、reply-run 与 SSE ── */

export const listMessages = (sessionId: string, page = 1, limit = 50) =>
  requestEnvelope<PageResult<BackendMessage>>(
    `/sessions/${encodeURIComponent(sessionId)}/messages?page=${page}&limit=${limit}`
  );

export const sendSessionMessage = (sessionId: string, personaId: string, content: string) =>
  requestEnvelope<ReplyRunCreated>(`/sessions/${encodeURIComponent(sessionId)}/messages`, {
    method: "POST",
    body: { persona_id: personaId, content },
  });

export const startReplyRun = (sessionId: string, personaId: string) =>
  requestEnvelope<ReplyRunCreated>(`/sessions/${encodeURIComponent(sessionId)}/reply-runs`, {
    method: "POST",
    body: { persona_id: personaId },
  });

export const cancelReplyRun = (replyRunId: string) =>
  requestEmptyEnvelope(`/reply-runs/${encodeURIComponent(replyRunId)}/cancel`, { method: "POST" });

interface ParsedSseEvent {
  event: string;
  id?: string;
  data: unknown;
}

function parseSseBlock(block: string): ParsedSseEvent | null {
  let event = "message";
  let id: string | undefined;
  const data: string[] = [];
  for (const line of block.split(/\r?\n/)) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("id:")) id = line.slice(3).trim();
    else if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
  }
  if (data.length === 0) return null;
  const raw = data.join("\n");
  try {
    return { event, id, data: JSON.parse(raw) };
  } catch {
    return { event, id, data: raw };
  }
}

const stringField = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

/**
 * 先打开 SSE，再启动 reply-run，避免极快的首个 delta 丢失。
 * role.delta 必须按 message_id 分桶，因为多角色 delta 可能交错到达。
 */
async function collectReplyRun(
  sessionId: string,
  start: () => Promise<ReplyRunCreated>
): Promise<SpeakerTurn[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);
  const headers = new Headers(authHeaders());
  headers.set("Accept", "text/event-stream");
  const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/events`, {
    headers,
    signal: controller.signal,
    cache: "no-store",
  });
  if (!response.ok) {
    clearTimeout(timeout);
    throw await readError(response);
  }
  if (!response.body) {
    clearTimeout(timeout);
    throw new ApiError("SSE 响应没有可读流", 502);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  const byMessage = new Map<string, { speakerId: string; text: string }>();
  const finished = new Map<string, SpeakerTurn>();

  try {
    const run = await start();
    while (true) {
      const { value, done } = await reader.read();
      pending += decoder.decode(value, { stream: !done });
      const blocks = pending.split(/\r?\n\r?\n/);
      pending = blocks.pop() ?? "";
      for (const block of blocks) {
        const parsed = parseSseBlock(block);
        if (!parsed) continue;
        const payload = parsed.data && typeof parsed.data === "object"
          ? (parsed.data as Record<string, unknown>)
          : { data: parsed.data };
        const nested = payload.data && typeof payload.data === "object"
          ? (payload.data as Record<string, unknown>)
          : payload;
        const eventName = (stringField(payload.type) || stringField(payload.event) || parsed.event).toLowerCase();
        const eventRunId = stringField(nested.reply_run_id) || stringField(payload.reply_run_id);
        if (eventRunId && eventRunId !== run.reply_run_id) continue;

        if (eventName.includes("error") || eventName.includes("failed")) {
          throw new ApiError(
            stringField(nested.message) || stringField(payload.message) || "reply-run 执行失败",
            502
          );
        }

        const messageId =
          stringField(nested.message_id) || stringField(payload.message_id) || stringField(parsed.id);
        const speakerId =
          stringField(nested.persona_id) ||
          stringField(nested.sender_id) ||
          stringField(nested.role_id) ||
          stringField(payload.persona_id);
        const delta =
          stringField(nested.delta) ||
          stringField(nested.text_delta) ||
          stringField(nested.content_delta);
        const fullText = stringField(nested.content) || stringField(nested.text);

        if (messageId && (delta || fullText)) {
          const current = byMessage.get(messageId) ?? { speakerId: speakerId || "unknown", text: "" };
          if (speakerId) current.speakerId = speakerId;
          current.text = fullText || `${current.text}${delta || ""}`;
          byMessage.set(messageId, current);
        }

        if (messageId && (eventName.includes("message.completed") || eventName.includes("role.completed"))) {
          const current = byMessage.get(messageId);
          if (current?.text) finished.set(messageId, { speakerId: current.speakerId, text: current.text });
        }

        if (
          eventName.includes("reply_run.completed") ||
          eventName.includes("reply-run.completed") ||
          eventName === "run.completed" ||
          eventName === "reply.completed"
        ) {
          byMessage.forEach((current, messageIdKey) => {
            if (current.text && !finished.has(messageIdKey)) {
              finished.set(messageIdKey, { speakerId: current.speakerId, text: current.text });
            }
          });
          return Array.from(finished.values());
        }
      }
      if (done) break;
    }
    return Array.from(finished.values());
  } finally {
    clearTimeout(timeout);
    controller.abort();
    reader.releaseLock();
  }
}

export interface ChatCtx {
  transcript: string;
  cast: Persona[];
  history?: DialogueTurn[];
  userName?: string;
  sessionId?: string;
  userPersonaId?: string;
  userMessage?: string;
}

export type TurnMode = "opening" | "continue" | "invite" | "answer";

export async function runTurn(mode: TurnMode, speakers: string[], ctx: ChatCtx): Promise<SpeakerTurn[]> {
  if (USE_BACKEND && ctx.sessionId && ctx.userPersonaId) {
    return collectReplyRun(ctx.sessionId, () =>
      mode === "answer" && ctx.userMessage
        ? sendSessionMessage(ctx.sessionId!, ctx.userPersonaId!, ctx.userMessage)
        : startReplyRun(ctx.sessionId!, ctx.userPersonaId!)
    );
  }

  const result = await localLlm<{ turns: SpeakerTurn[] }>("/api/llm/turn", {
    transcript: ctx.transcript,
    personas: ctx.cast,
    speakers,
    mode,
    history: ctx.history ?? [],
    userName: ctx.userName,
    // 必须转发:answer 轮发起时用户这句通常还没进 history(客户端 setMessages 未重渲染),
    // 不带上服务端就看不到用户说了什么。真后端分支走 sendSessionMessage 已另行携带。
    userMessage: ctx.userMessage,
  });
  return result.turns;
}

/* ── 阶段一 · 旁观者(godfather):说完故事、等 AIGC 视频期间的单人对话 ──
   与阶段二群聊是两套逻辑:一个声音、站在故事外、由视频就绪事件结束。
   详见 app/api/llm/godfather/route.ts 与 docs/product-flow.md。 */

export type GodfatherMode = "open" | "respond" | "linger" | "handoff";

export async function runGodfather(
  mode: GodfatherMode,
  ctx: { transcript: string; history?: DialogueTurn[]; userMessage?: string }
): Promise<string> {
  const result = await localLlm<{ text: string }>("/api/llm/godfather", {
    transcript: ctx.transcript,
    mode,
    history: (ctx.history ?? []).map((h) => ({ speakerId: h.speakerId, text: h.text })),
    userMessage: ctx.userMessage,
  });
  return result.text;
}

/* ── 视频与辅助功能 ── */

export interface VideoPlaybackSource {
  id: string;
  video: {
    id: string;
    status: string;
    object_key: string;
  };
}

/** The business backend returns an OSS object key after the video is ready. */
export const getVideoPlaybackSource = (videoId: string) =>
  requestEnvelope<VideoPlaybackSource>(
    `/videos/${encodeURIComponent(videoId)}/playback`
  );

/** The Next.js server turns an OSS object key into a short-lived playback URL. */
export async function getOssPlaybackUrl(objectKey?: string): Promise<string> {
  const query = objectKey ? `?object_key=${encodeURIComponent(objectKey)}` : "";
  const response = await fetch(`/api/oss/playback${query}`, { cache: "no-store" });
  if (!response.ok) throw new Error("Unable to load the OSS playback URL.");
  const data = (await response.json()) as { playback_url?: string };
  if (!data.playback_url) throw new Error("The OSS playback URL is missing.");
  return data.playback_url;
}

/** 新版后端没有 title 接口，标题建议继续使用稳定的本地池。 */
export async function suggestTitle(transcript: string): Promise<string> {
  await delay(500);
  return pickMockTitle(transcript);
}

/** @deprecated 真后端以 session 作为故事容器，保留此函数只为兼容旧调用。 */
export async function createStory(input: {
  title: string;
  transcript: string;
  cover: string;
  reflection?: string;
}): Promise<Pick<Story, "id">> {
  void input;
  return { id: `story-${Date.now()}` };
}

export async function health(): Promise<{ status: string }> {
  const res = await fetch("/api/health", { cache: "no-store" });
  if (!res.ok) throw await readError(res);
  return (await res.json()) as { status: string };
}
