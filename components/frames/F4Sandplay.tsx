"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DialogueTurn, Persona, SpeakerTurn, Story } from "@/lib/types";
import { runTurn, type TurnMode } from "@/lib/api";
import { MOCK_PERSONAS } from "@/lib/mock/personas";
import { TypeText } from "../ui";
import SandplayStage from "../scene/SandplayStage";

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
  onDiscard?: () => void; // 草稿故事:返回确认弹窗里"Let it go"丢弃草稿
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

  return (
    <div className="frame frame-enter" style={{ padding: 0 }}>
      {/* ══ 全幅竖屏舞台(AIGC video 槽位,未就绪时"演绎中"加载态) ══ */}
      <SandplayStage cast={castList} speakerId={stageSpeaker} title={story.title} sessionId={story.backendSessionId} />

      {/* ══ 顶部 nav:浮在画面上,带柔光衬底保证可读 ══ */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          padding: "var(--screen-top) var(--screen-x) 26px",
          background: "linear-gradient(180deg, rgba(255,249,238,0.85) 0%, rgba(255,249,238,0) 100%)",
          zIndex: 10,
        }}
      >
        <div className="nav-bar">
          {/* 草稿流程(onKeep 存在):返回先弹二次确认;老故事直接回主页 */}
          <button className="nav-side back-chevron" onClick={() => (onKeep ? setShowLeave(true) : onBack())} aria-label="Back">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
          <span className="nav-title">The sandplay</span>
          {onKeep ? (
            <button
              className="nav-side"
              onClick={onKeep}
              style={{ justifyContent: "flex-end", marginRight: -12, minHeight: 44, fontSize: 14, fontStyle: "italic", color: "var(--readable)" }}
            >
              End
            </button>
          ) : (
            <span className="nav-side" style={{ justifyContent: "flex-end", marginRight: -12 }} aria-hidden>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.7" strokeLinecap="round" aria-hidden>
                <circle cx="12" cy="5" r="1.4" />
                <circle cx="12" cy="12" r="1.4" />
                <circle cx="12" cy="19" r="1.4" />
              </svg>
            </span>
          )}
        </div>
      </div>

      {/* ══ 弹幕式对话浮层:底部流入,向上渐隐进场景 ══ */}
      <div
        ref={scrollRef}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 84,
          maxHeight: "36%",
          overflowY: "auto",
          padding: "56px 16px 0",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          zIndex: 10,
          WebkitMaskImage: "linear-gradient(180deg, transparent 0, black 72px)",
          maskImage: "linear-gradient(180deg, transparent 0, black 72px)",
        }}
      >
        {messages.map((m) =>
          m.speakerId === "user" ? (
            <div key={m.ts + m.text} style={{ display: "flex", justifyContent: "flex-end", alignItems: "flex-end", gap: 8, animation: "bubbleIn 300ms var(--ease-soft) both" }}>
              <div
                style={{
                  maxWidth: "76%",
                  padding: "9px 14px",
                  borderRadius: "20px 20px 6px 20px",
                  background: "var(--sky)",
                }}
              >
                {persona && (
                  <span style={{ fontSize: 11.5, fontStyle: "italic", color: "rgba(18,85,113,0.65)", marginRight: 6 }}>{persona.name}</span>
                )}
                <span style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.5, color: "var(--ink)" }}>{m.text}</span>
              </div>
              {persona && (
                <span
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    background: "var(--mist)",
                    overflow: "hidden",
                    flexShrink: 0,
                    display: "block",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={persona.avatar} alt={persona.name} style={{ width: 30, height: 30, objectFit: "cover", objectPosition: "50% 12%" }} />
                </span>
              )}
            </div>
          ) : (
            <DanmakuBubble key={m.ts + m.text} speaker={personaById(m.speakerId)} text={m.text} />
          )
        )}
        {streaming && (
          <DanmakuBubble
            speaker={personaById(streaming.speakerId)}
            streamingText={streaming.text}
            onStreamDone={() => {
              const done = streaming;
              setMessages((m) => [...m, toTurn(story.id, done)]);
              resolverRef.current?.();
            }}
          />
        )}
        {typingId && <PersonaTyping speaker={personaById(typingId)} />}
        {/* LLM 轮失败:不再是"死一样的安静",给一条可点重试的轻提示 */}
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
            the room lost its voice · tap to retry
          </button>
        )}
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
            zIndex: 20,
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
            <div style={{ fontSize: 17, fontWeight: 500, color: "var(--ink)" }}>The room has gone quiet</div>
            <div className="meta-italic" style={{ marginTop: 8, fontSize: 13 }}>
              Want to wrap up this story?
            </div>
            <button
              onClick={() => (onKeep ? onKeep() : onBack())}
              className="btn"
              style={{ width: "100%", marginTop: 18 }}
            >
              <span>
                {onKeep ? "Keep this story" : "Leave the room"}
              </span>
            </button>
            <button
              onClick={() => {
                setShowEnd(false);
                waitForUser(); // 再待一会儿:重新进入等待节奏
              }}
              style={{ width: "100%", minHeight: 44, marginTop: 6, fontSize: 14, fontStyle: "italic", color: "var(--muted)" }}
            >
              Stay a little longer
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
            zIndex: 30,
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
            <div style={{ fontSize: 17, fontWeight: 500, color: "var(--ink)" }}>Keep this story before you go?</div>
            <div className="meta-italic" style={{ marginTop: 8, fontSize: 13 }}>
              It can stay with you — or drift away, unkept.
            </div>
            <button
              onClick={() => {
                setShowLeave(false);
                onKeep?.();
              }}
              className="btn"
              style={{ width: "100%", marginTop: 18 }}
            >
              <span>Keep it</span>
            </button>
            <button
              onClick={() => {
                setShowLeave(false);
                (onDiscard ?? onBack)();
              }}
              style={{ width: "100%", minHeight: 44, marginTop: 6, fontSize: 14, fontStyle: "italic", color: "var(--muted)" }}
            >
              Let it go
            </button>
          </div>
        </div>
      )}

      {/* ══ 悬浮输入栏:以带入角色的视角发言 ══ */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          padding: "26px 16px max(26px, env(safe-area-inset-bottom))",
          background: "linear-gradient(0deg, rgba(255,249,238,0.9) 30%, rgba(255,249,238,0) 100%)",
          zIndex: 11,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            height: 52,
            padding: "0 8px 0 20px",
            borderRadius: 26,
            background: "var(--raised)",
            border: "1px solid var(--line)",
            boxShadow: "var(--shadow-input)",
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder={persona ? `Speak as ${persona.name}…` : "Say something back…"}
            style={{
              flex: 1,
              minWidth: 0,
              border: "none",
              background: "transparent",
              fontSize: 15,
              fontWeight: 300,
              color: "var(--ink)",
              padding: 0,
            }}
          />
          <button onClick={send} aria-label="Send" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, flexShrink: 0 }}>
            <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 38, height: 38, borderRadius: "50%", background: "var(--butter)", boxShadow: "0 3px 0 var(--butter-under)" }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--ink-blue)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M4.5 12h14M13 6.5l5.5 5.5-5.5 5.5" />
              </svg>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* 弹幕气泡:半透明磨砂 chip,盖在画面上;发言人 = 故事人设 */
function DanmakuBubble({
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
      <PersonaAvatar speaker={speaker} size={34} />
      <div
        style={{
          maxWidth: "80%",
          padding: "8px 13px",
          borderRadius: "20px 20px 20px 6px",
          background: "var(--raised)",
          boxShadow: "var(--lift-1)",
        }}
      >
        <span style={{ fontSize: 11.5, fontStyle: "italic", color: "var(--readable)", marginRight: 6 }}>
          {speaker?.name ?? "…"}
        </span>
        <span aria-live="polite" style={{ fontSize: 14.5, fontWeight: 300, lineHeight: 1.5 }}>
          {streamingText != null ? <TypeText text={streamingText} speed={26} onDone={onStreamDone} /> : text}
        </span>
      </div>
    </div>
  );
}

/* typing 预告:头像 + 三点律动 */
function PersonaTyping({ speaker }: { speaker?: Persona }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start", animation: "bubbleIn 300ms var(--ease-soft) both" }}>
      <PersonaAvatar speaker={speaker} size={34} />
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: "13px 15px",
          borderRadius: "20px 20px 20px 6px",
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
              background: "rgba(47,159,200,0.5)",
              animation: `think 1.3s ease-in-out ${i * 0.18}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

/* 人设圆形头像(裁脸) */
function PersonaAvatar({ speaker, size }: { speaker?: Persona; size: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "var(--mist)",
        flexShrink: 0,
        overflow: "hidden",
        display: "block",
      }}
    >
      {speaker && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={speaker.avatar} alt={speaker.name} style={{ width: size, height: size, objectFit: "cover", objectPosition: "50% 12%" }} />
      )}
    </span>
  );
}
