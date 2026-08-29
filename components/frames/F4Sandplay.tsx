"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DialogueTurn, Persona, SpeakerTurn, Story } from "@/lib/types";
import { runTurn, type TurnMode } from "@/lib/api";
import { MOCK_PERSONAS } from "@/lib/mock/personas";
import { TypeText } from "../ui";
import SandplayStage from "../scene/SandplayStage";
import ChatInput from "../ui/ChatInput";

/**
 * F4 — The sandplay · 板块二（直播间形态,全真实 LLM,无 mock）
 * 群聊节奏(docs/product-flow.md F4):
 *   opening  暖场几句 → 停下来等用户(WAIT_AFTER_OPENING)
 *   continue 用户沉默 → AI 之间续聊一轮 → 再等(WAIT_AFTER_CONTINUE)
 *   invite   仍沉默 → 一位 AI 点名邀请用户带入的角色 → 再等(WAIT_AFTER_INVITE)
 *   end      三轮仍无互动 → 弹窗问用户要不要结束(Keep / 再待会儿)
 *   用户开口 → answer:所有 AI 直接回应用户 → 节奏重置回 opening 后的等待
 * 防打架/防卡死:AI 自聊每轮最多 2 位开口、每段沉默期只续一轮;prompt 禁争论禁复读;
 * 轮内串行可见(后者读得到前者本轮发言)。
 */

const WAIT_AFTER_OPENING = 18000;
const WAIT_AFTER_CONTINUE = 18000;
const WAIT_AFTER_INVITE = 20000;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const toTurn = (storyId: string, t: SpeakerTurn): DialogueTurn => ({
  storyId,
  speakerId: t.speakerId,
  text: t.text,
  ts: Date.now(),
});

export default function F4Sandplay({
  story,
  persona,
  cast,
  onBack,
  onKeep,
  onDiscard,
}: {
  story: Story;
  persona?: Persona | null; // 用户带入的角色：发言以该角色身份出现在群聊里
  cast?: Persona[]; // 故事 Top 3；老故事没有时回退到 mock 阵容(仅元数据,发言仍是真 LLM)
  onBack: () => void;
  onKeep?: () => void; // 草稿故事:结束弹窗/End 按钮/返回确认里给 Keep 入口
  onDiscard?: () => void; // 草稿故事:返回确认弹窗里"不要了"丢弃草稿
}) {
  const castList = useMemo(() => (cast && cast.length > 0 ? cast : MOCK_PERSONAS), [cast]);
  /** AI 发言者 = Top 3 中除用户带入者之外的人设(各自独立 LLM session) */
  const aiSpeakers = useMemo(
    () => castList.filter((p) => p.id !== persona?.id).map((p) => p.id),
    [castList, persona]
  );
  const personaById = useCallback((id: string) => castList.find((p) => p.id === id), [castList]);

  const [messages, setMessages] = useState<DialogueTurn[]>([]);
  const [typingId, setTypingId] = useState<string | null>(null);
  const [streaming, setStreaming] = useState<SpeakerTurn | null>(null);
  const [input, setInput] = useState("");
  const [showEnd, setShowEnd] = useState(false); // 三轮无互动 → 结束弹窗
  const [showLeave, setShowLeave] = useState(false); // 草稿流程返回键 → 二次确认弹窗
  const [llmError, setLlmError] = useState<{ mode: TurnMode; speakers: string[]; after: () => void; userMessage?: string } | null>(null); // 最近失败的一轮,给弹幕区重试入口

  const queueRef = useRef<SpeakerTurn[]>([]);
  const runningRef = useRef(false);
  const resolverRef = useRef<(() => void) | null>(null);
  const aliveRef = useRef(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const aiSpeakersRef = useRef(aiSpeakers);
  aiSpeakersRef.current = aiSpeakers;
  const castRef = useRef(castList);
  castRef.current = castList;
  const personaRef = useRef(persona);
  personaRef.current = persona;
  const messagesRef = useRef<DialogueTurn[]>([]);
  messagesRef.current = messages;
  const storyRef = useRef(story);
  storyRef.current = story;

  /* ── 节奏原语 ── */

  const armTimer = (ms: number, fn: () => void) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (aliveRef.current) fn();
    }, ms);
  };

  /** 依次播出队列里的发言:typing 预告 → 逐字流出 → 落定 */
  async function pump() {
    if (runningRef.current) return;
    runningRef.current = true;
    while (queueRef.current.length > 0 && aliveRef.current) {
      const turn = queueRef.current.shift()!;
      setTypingId(turn.speakerId);
      await wait(1000);
      if (!aliveRef.current) break;
      setTypingId(null);
      setStreaming(turn);
      await new Promise<void>((resolve) => {
        resolverRef.current = resolve;
      });
      setStreaming(null);
      await wait(420);
    }
    runningRef.current = false;
  }

  /** 跑一轮 LLM 发言;失败在弹幕区给重试入口、节奏继续(全真实模式,不塞假数据) */
  async function runRound(mode: TurnMode, speakers: string[], after: () => void, userMessage?: string) {
    // 无人可发言(如短转写只提取到"我")→ 直接跳过本轮,不打 422、不挂重试 chip
    if (speakers.length === 0) {
      if (aliveRef.current) after();
      return;
    }
    // 即时反馈:请求期间就先亮出"对方正在输入"(3-6s 的 LLM 等待不再像没人搭理);
    // 返回后若首位发言人相同,pump 接管 typingId 无闪烁
    if (aliveRef.current) setTypingId(speakers[0]);
    try {
      const turns = await runTurn(mode, speakers, {
        transcript: storyRef.current.transcript,
        cast: castRef.current,
        history: messagesRef.current,
        userName: personaRef.current?.name ?? "the narrator",
        sessionId: storyRef.current.backendSessionId,
        userPersonaId: personaRef.current?.id,
        userMessage,
      });
      if (!aliveRef.current) return;
      setLlmError(null);
      if (turns.length > 0) {
        queueRef.current.push(...turns);
        await pump();
      } else {
        setTypingId(null); // 全员沉默 → 收起 typing 预告
      }
    } catch (e) {
      console.error(`[sandplay] ${mode} 轮 LLM 调用失败:`, e);
      if (aliveRef.current) {
        setTypingId(null); // 失败 → 收起 typing,弹幕区给重试入口
        setLlmError({ mode, speakers, after, userMessage });
      }
    }
    if (aliveRef.current) after();
  }

  /** 重试最近失败的一轮(after 闭包原样带上,节奏计时会被 armTimer 去重) */
  const retryRound = () => {
    const r = llmError;
    if (!r) return;
    setLlmError(null);
    void runRound(r.mode, r.speakers, r.after, r.userMessage);
  };

  /* 沉默期推进:continue → invite → 结束弹窗 */
  function stepContinue() {
    void runRound("continue", aiSpeakersRef.current, () => armTimer(WAIT_AFTER_CONTINUE, stepInvite));
  }
  function stepInvite() {
    const inviter = aiSpeakersRef.current[0];
    void runRound("invite", inviter ? [inviter] : [], () => armTimer(WAIT_AFTER_INVITE, () => setShowEnd(true)));
  }
  /** 一轮活动结束后:等用户 WAIT_AFTER_OPENING,不应则进入沉默期推进 */
  function waitForUser() {
    armTimer(WAIT_AFTER_OPENING, stepContinue);
  }

  useEffect(() => {
    aliveRef.current = true;
    queueRef.current = [];
    setMessages([]);
    setStreaming(null);
    setTypingId(null);
    setShowEnd(false);
    setShowLeave(false);
    setLlmError(null);
    void runRound("opening", aiSpeakersRef.current, waitForUser);
    return () => {
      aliveRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      resolverRef.current?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, streaming, typingId]);

  const send = () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    if (timerRef.current) clearTimeout(timerRef.current);
    setShowEnd(false); // 用户回来了 → 收起结束弹窗
    const userTurn = toTurn(story.id, { speakerId: "user", text });
    // ref 平时靠重渲染赋值,但 runRound 是在 setMessages 之后同步调用的 —— 那时还没重渲染。
    // 不手动同步这一句,发出去的 history 就少了用户刚说的话(下一行 setMessages 会以相同内容覆盖回来)。
    messagesRef.current = [...messagesRef.current, userTurn];
    setMessages((m) => [...m, userTurn]);
    // 用户开口:所有 AI 都要思考如何回应用户,然后节奏重置
    void runRound("answer", aiSpeakersRef.current, waitForUser, text);
  };

  const stageSpeaker = streaming?.speakerId ?? typingId ?? null;
  const [micNote, setMicNote] = useState(false);

  return (
    <div className="frame frame-enter" style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      {/* ══ 顶部:雾蓝波浪布条(短版,同 Home 的手法) ══ */}
      <svg aria-hidden viewBox="0 0 390 76" preserveAspectRatio="none" style={{ position: "absolute", top: 0, left: 0, width: "100%", height: 76, pointerEvents: "none", zIndex: 102, filter: "drop-shadow(1px 2px 2px rgba(0,0,0,0.05))" }}>
        <defs>
          <linearGradient id="roomBandG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#EAF6FB" />
            <stop offset="72%" stopColor="var(--mist)" />
            <stop offset="100%" stopColor="var(--sky)" />
          </linearGradient>
        </defs>
        <path d="M0 0 H390 V40 Q370 62 348 46 Q326 32 306 44 Q286 56 262 42 Q238 28 216 42 Q194 54 168 40 Q142 26 118 42 Q94 54 70 42 Q46 30 22 44 Q10 52 0 40 Z" fill="url(#roomBandG)" />
        <path d="M390 34 Q370 56 348 40 Q326 26 306 38 Q286 50 262 36 Q238 22 216 36 Q194 48 168 34 Q142 20 118 36 Q94 48 70 36 Q46 24 22 38 Q10 46 0 34" fill="none" stroke="var(--ink-blue)" strokeOpacity="0.4" strokeWidth="1.3" strokeDasharray="5 6" strokeLinecap="round" />
      </svg>

      {/* ══ 内容层 ══ */}
      <div style={{ position: "relative", zIndex: 103, display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        {/* nav:ribbon 返回(故事房间)+ 右侧 End(草稿才有) */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px var(--screen-x) 0", flexShrink: 0 }}>
          <button
            className="ribbon"
            onClick={() => (onKeep ? setShowLeave(true) : onBack())}
            aria-label="返回"
            style={{ border: "none", cursor: "pointer", gap: 7 }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--cream)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M15 5l-7 7 7 7" />
            </svg>
            故事房间
          </button>
          {onKeep && (
            <button onClick={onKeep} style={{ minHeight: 44, fontSize: 14, fontStyle: "italic", color: "var(--ink-blue)" }}>
              结束
            </button>
          )}
        </div>

        {/* ══ 放映框:sky 立体外框(硬底边)+ 内嵌舞台 + 进度条 ══ */}
        <div
          style={{
            margin: "14px var(--screen-x) 0",
            background: "var(--sky)",
            borderRadius: "var(--r-panel)",
            padding: 10,
            boxShadow: "0 5px 0 var(--sky-under), var(--lift-2)",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              position: "relative",
              width: "100%",
              aspectRatio: "16 / 9",
              borderRadius: "var(--r-chip)",
              overflow: "hidden",
              background: "var(--mist)",
            }}
          >
            <div style={{ position: "absolute", inset: 0 }}>
              <SandplayStage cast={castList} speakerId={stageSpeaker} title={story.title} sessionId={story.backendSessionId} />
            </div>
          </div>
          {/* 进度条(装饰,真视频接入后联动) */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 9, padding: "0 2px" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--ink-blue)", flexShrink: 0 }} />
            <span style={{ flex: 1, height: 3, borderRadius: 2, background: "rgba(18,85,113,0.25)" }} />
            <span style={{ fontSize: 11, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>0:00 / 0:00</span>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ink-blue)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M11 5L6 9H2v6h4l5 4V5z" />
              <path d="M15.5 8.5a5 5 0 0 1 0 7" />
            </svg>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ink-blue)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            </svg>
          </div>
        </div>

        {/* ══ 群聊列表 ══ */}
        <div
          ref={scrollRef}
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: "14px var(--screen-x) 10px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {messages.map((m) =>
            m.speakerId === "user" ? (
              <div key={m.ts + m.text} style={{ display: "flex", justifyContent: "flex-end", alignItems: "flex-end", gap: 8, animation: "bubbleIn 300ms var(--ease-soft) both" }}>
                <div
                  style={{
                    maxWidth: "76%",
                    padding: "9px 14px",
                    borderRadius: "16px 4px 16px 16px",
                    background: "var(--butter)",
                    boxShadow: "var(--lift-1)",
                  }}
                >
                  <span style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.5, color: "var(--ink)" }}>{m.text}</span>
                </div>
                {persona && <ChatAvatar speaker={persona} />}
              </div>
            ) : (
              <ChatMessage key={m.ts + m.text} speaker={personaById(m.speakerId)} text={m.text} />
            )
          )}
          {streaming && (
            <ChatMessage
              speaker={personaById(streaming.speakerId)}
              streamingText={streaming.text}
              onStreamDone={() => {
                const done = streaming;
                setMessages((m) => [...m, toTurn(story.id, done)]);
                resolverRef.current?.();
              }}
            />
          )}
          {typingId && <ChatTyping speaker={personaById(typingId)} />}
          {llmError && (
            <button
              onClick={retryRound}
              style={{
                alignSelf: "center",
                padding: "8px 16px",
                borderRadius: 999,
                background: "var(--raised)",
                border: "none",
                boxShadow: "var(--lift-1)",
                fontSize: 12.5,
                fontStyle: "italic",
                color: "var(--readable)",
                animation: "bubbleIn 300ms var(--ease-soft) both",
              }}
            >
              房间突然安静了 · 点我重试
            </button>
          )}
        </div>

        {/* ══ 底部输入带:sky 带 + 车缝;左 mic / 中输入 / 右发送 ══ */}
        <div
          style={{
            position: "relative",
            flexShrink: 0,
            background: "var(--sky)",
            borderRadius: "22px 22px 0 0",
            padding: "14px var(--screen-x) max(14px, env(safe-area-inset-bottom))",
          }}
        >
          <svg aria-hidden viewBox="0 0 390 10" preserveAspectRatio="none" style={{ position: "absolute", top: -1, left: 0, width: "100%", height: 10 }}>
            <path d="M0 5 Q24 0 48 5 T97 5 T146 5 T195 5 T244 5 T293 5 T342 5 T390 5" fill="none" stroke="var(--ink-blue)" strokeOpacity="0.4" strokeWidth="1.3" strokeDasharray="5 6" strokeLinecap="round" />
          </svg>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={() => {
                setMicNote(true);
                setTimeout(() => setMicNote(false), 1800);
              }}
              aria-label="语音发言"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 46,
                height: 46,
                borderRadius: "50%",
                background: "var(--cream)",
                boxShadow: "var(--lift-1)",
                flexShrink: 0,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--story)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="9" y="2.5" width="6" height="11.5" rx="3" />
                <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3.5" />
              </svg>
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <ChatInput
                value={input}
                onChange={setInput}
                onSend={send}
                placeholder={persona ? `以${persona.name}的身份说…` : "写点什么…"}
              />
            </div>
          </div>
          {/* mic 占位提示 */}
          {micNote && (
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: -34,
                transform: "translateX(-50%)",
                padding: "6px 14px",
                borderRadius: 999,
                background: "var(--ink)",
                color: "var(--cream)",
                fontSize: 12,
                boxShadow: "var(--lift-2)",
                animation: "bubbleIn 300ms var(--ease-soft) both",
                whiteSpace: "nowrap",
              }}
            >
              语音发言稍后开放
            </div>
          )}
        </div>
      </div>

      {/* ══ 三轮无互动 → 结束弹窗 ══ */}
      {showEnd && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(255,249,238,0.88)",
            zIndex: 120,
          }}
        >
          <div
            style={{
              width: 300,
              background: "var(--raised)",
              borderRadius: 20,
              padding: "26px 22px 18px",
              textAlign: "center",
              boxShadow: "var(--shadow-button)",
              animation: "bubbleIn 400ms var(--ease-soft) both",
            }}
          >
            <div style={{ fontSize: 17, fontWeight: 500, color: "var(--ink)" }}>房间安静下来了</div>
            <div className="meta-italic" style={{ marginTop: 8, fontSize: 13 }}>
              要把这个故事收起来吗?
            </div>
            <button
              onClick={() => (onKeep ? onKeep() : onBack())}
              className="btn"
              style={{ width: "100%", marginTop: 18 }}
            >
              <span>{onKeep ? "存下这个故事" : "离开房间"}</span>
            </button>
            <button
              onClick={() => {
                setShowEnd(false);
                waitForUser(); // 再待一会儿:重新进入等待节奏
              }}
              style={{ width: "100%", minHeight: 44, marginTop: 6, fontSize: 14, fontStyle: "italic", color: "var(--muted)" }}
            >
              再待一会儿
            </button>
          </div>
        </div>
      )}

      {/* ══ 草稿流程返回键 → 二次确认:Keep 存档 / 丢弃草稿 ══ */}
      {showLeave && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(255,249,238,0.88)",
            zIndex: 120,
          }}
        >
          <div
            style={{
              width: 300,
              background: "var(--raised)",
              borderRadius: 20,
              padding: "26px 22px 18px",
              textAlign: "center",
              boxShadow: "var(--shadow-button)",
              animation: "bubbleIn 400ms var(--ease-soft) both",
            }}
          >
            <div style={{ fontSize: 17, fontWeight: 500, color: "var(--ink)" }}>走之前,要存下这个故事吗?</div>
            <div className="meta-italic" style={{ marginTop: 8, fontSize: 13 }}>
              它可以留下来陪你,也可以就这么散去。
            </div>
            <button
              onClick={() => {
                setShowLeave(false);
                onKeep?.();
              }}
              className="btn"
              style={{ width: "100%", marginTop: 18 }}
            >
              <span>存下</span>
            </button>
            <button
              onClick={() => {
                setShowLeave(false);
                (onDiscard ?? onBack)();
              }}
              style={{ width: "100%", minHeight: 44, marginTop: 6, fontSize: 14, fontStyle: "italic", color: "var(--muted)" }}
            >
              不要了
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* 他人的一条消息:头像 + 名字(在气泡上方)+ 白底气泡带阴影 */
function ChatMessage({
  speaker,
  text,
  streamingText,
  onStreamDone,
}: {
  speaker?: Persona;
  text?: string;
  streamingText?: string;
  onStreamDone?: () => void;
}) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start", animation: "bubbleIn 300ms var(--ease-soft) both" }}>
      <ChatAvatar speaker={speaker} />
      <div style={{ minWidth: 0, maxWidth: "76%" }}>
        <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-blue)", margin: "0 0 3px 4px" }}>
          {speaker?.name ?? "…"}
        </span>
        <div
          style={{
            padding: "9px 14px",
            borderRadius: "4px 16px 16px 16px",
            background: "var(--raised)",
            boxShadow: "var(--lift-1)",
          }}
        >
          <span aria-live={streamingText != null ? "polite" : undefined} style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.5, color: "var(--ink)" }}>
            {streamingText != null ? <TypeText text={streamingText} speed={26} onDone={onStreamDone} /> : text}
          </span>
        </div>
      </div>
    </div>
  );
}

/* typing 预告:头像 + 白底气泡三点 */
function ChatTyping({ speaker }: { speaker?: Persona }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start", animation: "bubbleIn 300ms var(--ease-soft) both" }}>
      <ChatAvatar speaker={speaker} />
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          marginTop: 18,
          padding: "12px 15px",
          borderRadius: "4px 16px 16px 16px",
          background: "var(--raised)",
          boxShadow: "var(--lift-1)",
        }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              display: "block",
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: "var(--story)",
              animation: `think 1.3s ease-in-out ${i * 0.18}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

/* 群聊头像:40px 圆,裁脸 */
function ChatAvatar({ speaker }: { speaker?: Persona }) {
  return (
    <span
      style={{
        width: 40,
        height: 40,
        borderRadius: "50%",
        background: "var(--mist)",
        flexShrink: 0,
        overflow: "hidden",
        display: "block",
      }}
    >
      {speaker && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={speaker.avatar} alt={speaker.name} style={{ width: 40, height: 40, objectFit: "cover", objectPosition: "50% 12%" }} />
      )}
    </span>
  );
}
