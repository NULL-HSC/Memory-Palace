"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import type { CharacterId, DialogueTurn, Persona, Story } from "@/lib/types";
import { getOpeningTurns, getResponseTurns } from "@/lib/api";
import { QUIET_CLOSING, toTurn } from "@/lib/mock/dialogue";
import { characterById } from "@/lib/mock/characters";
import { type FaceId } from "../characters";
import { TypeText, TypingIndicator, ChatAvatar } from "../ui";
import SandplayStage from "../scene/SandplayStage";

/**
 * F4 — The sandplay · v3（互动影游 / 直播弹幕形态）
 * 竖屏全幅舞台 = 对话发生的世界;对话以弹幕式浮层盖在画面上:
 * 新消息从底部流入,向上漂、渐隐进场景;输入栏悬浮于画面之上。
 * 编排逻辑不变(§8.3):typing 预告 → 逐字流出 → 落定;用户插话 1–2 位回应;
 * 不发言时少量轮次后自然收敛。
 */

type Draft = { speakerId: CharacterId; text: string };
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function F4Sandplay({
  story,
  persona,
  onBack,
  onKeep,
}: {
  story: Story;
  persona?: Persona | null; // 用户带入的角色：发言以该角色身份出现在群聊里
  onBack: () => void;
  onKeep?: () => void; // 草稿故事：对话收敛后出现 Keep 入口
}) {
  const [messages, setMessages] = useState<DialogueTurn[]>([]);
  const [typingId, setTypingId] = useState<FaceId | null>(null);
  const [streaming, setStreaming] = useState<Draft | null>(null);
  const [input, setInput] = useState("");
  const [ended, setEnded] = useState(false); // 对话已自然收敛

  const queueRef = useRef<Draft[]>([]);
  const runningRef = useRef(false);
  const resolverRef = useRef<(() => void) | null>(null);
  const aliveRef = useRef(true);
  const quietTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const quietedRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scheduleQuiet = useCallback(() => {
    if (quietTimerRef.current) clearTimeout(quietTimerRef.current);
    if (quietedRef.current) return;
    quietTimerRef.current = setTimeout(() => {
      quietedRef.current = true;
      queueRef.current.push(...QUIET_CLOSING);
      void pump();
    }, 16000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function pump() {
    if (runningRef.current) return;
    runningRef.current = true;
    while (queueRef.current.length > 0 && aliveRef.current) {
      const turn = queueRef.current.shift()!;
      setTypingId(turn.speakerId as FaceId);
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
    if (quietedRef.current && aliveRef.current) setEnded(true); // 收敛完毕
    scheduleQuiet();
  }

  useEffect(() => {
    aliveRef.current = true;
    quietedRef.current = false;
    queueRef.current = [];
    setMessages([]);
    setStreaming(null);
    setTypingId(null);
    setEnded(false);
    let cancelled = false;
    getOpeningTurns().then((turns) => {
      if (cancelled) return;
      queueRef.current.push(...turns);
      void pump();
    });
    return () => {
      cancelled = true;
      aliveRef.current = false;
      if (quietTimerRef.current) clearTimeout(quietTimerRef.current);
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
    if (quietTimerRef.current) clearTimeout(quietTimerRef.current);
    quietedRef.current = false;
    setEnded(false); // 重新开口 → 收起 Keep 入口
    setMessages((m) => [...m, toTurn(story.id, { speakerId: "user", text })]);
    void getResponseTurns().then((turns) => {
      if (!aliveRef.current) return;
      queueRef.current.push(...turns);
      void pump();
    });
  };

  const stageSpeaker = (streaming?.speakerId ?? typingId ?? null) as FaceId | null;

  return (
    <div className="frame frame-enter" style={{ padding: 0 }}>
      {/* ══ 全幅竖屏舞台(AIGC video 槽位) ══ */}
      <SandplayStage speakerId={stageSpeaker} title={story.title} />

      {/* ══ 顶部 nav:浮在画面上,带柔光衬底保证可读 ══ */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          padding: "var(--screen-top) var(--screen-x) 26px",
          background: "linear-gradient(180deg, rgba(246,241,228,0.85) 0%, rgba(246,241,228,0) 100%)",
          zIndex: 10,
        }}
      >
        <div className="nav-bar">
          <button className="nav-side back-chevron" onClick={onBack} aria-label="Back">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
          <span className="nav-title">The sandplay</span>
          <button className="nav-side" style={{ justifyContent: "flex-end", marginRight: -12 }} aria-label="More options">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.7" strokeLinecap="round" aria-hidden>
              <circle cx="12" cy="5" r="1.4" />
              <circle cx="12" cy="12" r="1.4" />
              <circle cx="12" cy="19" r="1.4" />
            </svg>
          </button>
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
                  borderRadius: "15px 4px 15px 15px",
                  background: "rgba(92,107,74,0.88)",
                  backdropFilter: "blur(8px)",
                }}
              >
                {persona && (
                  <span style={{ fontSize: 11.5, fontStyle: "italic", color: "rgba(250,248,243,0.75)", marginRight: 6 }}>{persona.name}</span>
                )}
                <span style={{ fontSize: 14.5, fontWeight: 300, lineHeight: 1.5, color: "var(--paper)" }}>{m.text}</span>
              </div>
              {persona && (
                <span
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    background: "#F0EBDD",
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
            <DanmakuBubble key={m.ts + m.text} speakerId={m.speakerId as FaceId} text={m.text} />
          )
        )}
        {streaming && (
          <DanmakuBubble
            speakerId={streaming.speakerId as FaceId}
            streamingText={streaming.text}
            onStreamDone={() => {
              const done = streaming;
              setMessages((m) => [...m, toTurn(story.id, done)]);
              resolverRef.current?.();
            }}
          />
        )}
        {typingId && <TypingIndicator speakerId={typingId} />}
      </div>

      {/* ══ 对话收敛后:Keep 入口(草稿故事才有) ══ */}
      {ended && onKeep && (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 148, display: "flex", justifyContent: "center", zIndex: 12 }}>
          <button
            onClick={onKeep}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 9,
              height: 52,
              padding: "0 24px",
              borderRadius: 26,
              background: "var(--accent)",
              boxShadow: "var(--shadow-button)",
              animation: "bubbleIn 500ms var(--ease-soft) both",
            }}
          >
            <span style={{ fontSize: 15.5, fontWeight: 500, color: "var(--paper)" }}>Keep this story</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FAF8F3" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 12h13M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}

      {/* ══ 悬浮输入栏 ══ */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          padding: "26px 16px 26px",
          background: "linear-gradient(0deg, rgba(246,241,228,0.9) 30%, rgba(246,241,228,0) 100%)",
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
            background: "rgba(255,255,255,0.86)",
            backdropFilter: "blur(10px)",
            border: "1px solid rgba(230,225,216,0.8)",
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
            <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 38, height: 38, borderRadius: "50%", background: "var(--accent)" }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#FAF8F3" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M4.5 12h14M13 6.5l5.5 5.5-5.5 5.5" />
              </svg>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* 弹幕气泡:半透明磨砂 chip,盖在画面上 */
function DanmakuBubble({
  speakerId,
  text,
  streamingText,
  onStreamDone,
}: {
  speakerId: FaceId;
  text?: string;
  streamingText?: string;
  onStreamDone?: () => void;
}) {
  const c = characterById(speakerId);
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start", animation: "bubbleIn 300ms var(--ease-soft) both" }}>
      <ChatAvatar speakerId={speakerId} />
      <div
        style={{
          maxWidth: "80%",
          padding: "8px 13px",
          borderRadius: "4px 15px 15px 15px",
          background: "rgba(255,255,255,0.82)",
          backdropFilter: "blur(8px)",
          border: "1px solid rgba(234,229,216,0.7)",
        }}
      >
        <span style={{ fontSize: 11.5, fontStyle: "italic", color: "var(--readable)", marginRight: 6 }}>{c.name}</span>
        <span style={{ fontSize: 14.5, fontWeight: 300, lineHeight: 1.5 }}>
          {streamingText != null ? <TypeText text={streamingText} speed={26} onDone={onStreamDone} /> : text}
        </span>
      </div>
    </div>
  );
}
