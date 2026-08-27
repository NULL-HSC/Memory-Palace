"use client";

import React, { useEffect, useRef, useState } from "react";
import { Waveform } from "../ui";
import { transcriptBeats } from "@/lib/mock/transcript";

/**
 * F2 — Speak It（handoff §4.2，像素对齐 02-speak-it.html）
 * 语音优先：进入即计时 + 伪实时转写流式上屏（理理理.md §8.1 Demo 降级），默认不弹键盘。
 * 布局：nav → transcript → companion(halo rings, flex:1) → waveform → controls → hint。
 */
export default function F2Listening({
  onBack,
  onDone,
}: {
  onBack: () => void;
  onDone: (transcript: string) => void;
}) {
  const [seconds, setSeconds] = useState(0);
  const [words, setWords] = useState<string[]>([]);
  const [streaming, setStreaming] = useState(true);
  const [typeMode, setTypeMode] = useState(false);
  const [typed, setTyped] = useState("");
  const [settling, setSettling] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const list = timers.current;
    const beats = transcriptBeats();
    let acc = 600;
    beats.forEach(({ word, delay }, i) => {
      acc += delay;
      list.push(
        setTimeout(() => {
          setWords((w) => [...w, word]);
          if (i === beats.length - 1) setStreaming(false);
        }, acc)
      );
    });
    const tick = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => {
      list.forEach(clearTimeout);
      clearInterval(tick);
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [words]);

  const canDone = typeMode ? typed.trim().length > 0 : seconds >= 3;

  const handleDone = () => {
    if (!canDone || settling) return;
    setSettling(true); // T2 沉淀态：文字落定、companion 点头（理理理.md §7）
    setStreaming(false);
    timers.current.forEach(clearTimeout);
    setWords(transcriptBeats().map((b) => b.word));
    setTimeout(() => onDone(typeMode ? typed : transcriptBeats().map((b) => b.word).join(" ")), 800);
  };

  const mm = Math.floor(seconds / 60);
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div className="frame frame-enter">
      {/* nav */}
      <div className="nav-bar">
        <button className="nav-side back-chevron" onClick={onBack} aria-label="Back">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <span className="nav-title">A new story</span>
        <span style={{ minWidth: 44, textAlign: "right", fontSize: 13.5, fontStyle: "italic", color: "var(--faint)", fontVariantNumeric: "tabular-nums" }}>
          {mm}:{ss}
        </span>
      </div>

      {/* 转写区：纯输入界面的主角；落定 ink / in-flight #C3BCAA */}
      <div style={{ marginTop: 34, flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <span className="meta-italic">{typeMode ? "Typing" : "Listening"}</span>
        {typeMode ? (
          <textarea
            autoFocus
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="Type it however it comes out…"
            style={{
              marginTop: 12,
              flex: 1,
              resize: "none",
              border: "none",
              background: "transparent",
              fontSize: 21,
              fontWeight: 300,
              lineHeight: 1.55,
              color: "var(--ink)",
            }}
          />
        ) : (
          <div ref={scrollRef} style={{ marginTop: 12, flex: 1, overflowY: "auto" }}>
            <p style={{ margin: 0, fontSize: 21, fontWeight: 300, lineHeight: 1.55 }}>
              {words.map((w, i) => (
                <span key={i} className={i >= words.length - 3 && streaming ? "word-partial" : "word-final"}>
                  {w}{" "}
                </span>
              ))}
              {words.length === 0 && <span className="word-partial">…</span>}
            </p>
          </div>
        )}
      </div>

      {/* 声浪 */}
      <Waveform active={streaming && !typeMode} />

      {/* controls：84px mic 居中，两翼 62px 定宽保持视觉居中 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 26, marginTop: 24 }}>
        <button
          onClick={() => setTypeMode((v) => !v)}
          style={{ width: 62, minHeight: 44, textAlign: "right", fontSize: 14, fontStyle: "italic", color: "var(--faint)" }}
        >
          {typeMode ? "Speak" : "Type it"}
        </button>
        <span
          aria-hidden
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 84,
            height: 84,
            borderRadius: "50%",
            background: "var(--accent)",
            boxShadow: "0 8px 22px rgba(60,54,40,0.24)",
          }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#FAF8F3" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="2.5" width="6" height="11.5" rx="3" />
            <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3.5" />
          </svg>
        </span>
        <button
          onClick={handleDone}
          disabled={!canDone}
          style={{
            width: 62,
            minHeight: 44,
            textAlign: "left",
            fontSize: 14,
            fontStyle: "italic",
            color: "#5C5648",
            opacity: canDone ? 1 : 0.35,
            transition: "opacity 300ms",
          }}
        >
          Done
        </button>
      </div>

      <div style={{ textAlign: "center", marginTop: 16 }}>
        <span style={{ fontSize: 13, fontWeight: 300, fontStyle: "italic", color: "var(--placeholder)" }}>
          Tell it however it comes out.
        </span>
      </div>
    </div>
  );
}
