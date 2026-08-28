"use client";

import React, { useEffect, useRef, useState } from "react";
import { Waveform } from "../ui";
import { transcriptBeats } from "@/lib/mock/transcript";

/**
 * F2 — Speak It（handoff §4.2，像素对齐 02-speak-it.html）
 * 手动录制：进入为空闲态（不计时/不出字/波形静止），点麦克风开始 → 再点暂停（保留已有文字）→ 再点继续。
 * startRecording / stopRecording 是未来真 ASR 的接入点（见函数内注释）。
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
  const [recording, setRecording] = useState(false);
  const [started, setStarted] = useState(false); // 曾经开始过录制（纯空闲态不渲染 …）
  const [streamDone, setStreamDone] = useState(false); // mock 语流播完（录制仍可继续计时）
  const [typeMode, setTypeMode] = useState(false);
  const [typed, setTyped] = useState("");
  const [settling, setSettling] = useState(false);
  const beatsRef = useRef<Array<{ word: string; delay: number }> | null>(null);
  const beatIdxRef = useRef(0);
  const beatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  /* 卸载清理：录制语流 / 秒表 / 沉淀态延迟，任何定时器都不许泄漏 */
  useEffect(() => {
    return () => {
      if (beatTimerRef.current) clearTimeout(beatTimerRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [words]);

  /** 依次上屏下一个词（mock ASR 语流；真 ASR 换成识别结果回调） */
  const scheduleNextBeat = () => {
    const beats = beatsRef.current;
    if (!beats || beatIdxRef.current >= beats.length) return;
    const i = beatIdxRef.current;
    beatTimerRef.current = setTimeout(
      () => {
        setWords((w) => [...w, beats[i].word]);
        beatIdxRef.current = i + 1;
        if (beatIdxRef.current >= beats.length) setStreamDone(true);
        else scheduleNextBeat();
      },
      (i === 0 ? 600 : 0) + beats[i].delay // 首拍保留 600ms lead-in
    );
  };

  /**
   * 开始/恢复录制：启动秒表 + 语流上屏 + 波形激活。
   * 【真 ASR 接入点】换成 ASR.start()，识别结果回调里 setWords((w) => [...w, word])，
   * mock 语流（transcriptBeats / scheduleNextBeat）届时整体删除。
   */
  const startRecording = () => {
    if (recording || settling) return;
    if (!beatsRef.current) beatsRef.current = transcriptBeats();
    setStarted(true);
    setRecording(true);
    scheduleNextBeat();
    tickRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  };

  /**
   * 暂停录制：停字、停表、波形静止，已上屏文字保留。
   * 【真 ASR 接入点】换成 ASR.stop()（或停止推流）。
   */
  const stopRecording = () => {
    setRecording(false);
    if (beatTimerRef.current) {
      clearTimeout(beatTimerRef.current);
      beatTimerRef.current = null;
    }
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  };

  /* 语流进行中（控制末 3 词的 in-flight 样式）；波形只看录制开关 */
  const streaming = recording && !streamDone;

  // 语音模式至少 5 个词才可 Done（防过短文本进人设提取）；打字模式有字即可
  const canDone = typeMode ? typed.trim().length > 0 : words.length >= 5;

  const handleDone = () => {
    if (!canDone || settling) return;
    setSettling(true); // T2 沉淀态：文字落定、companion 点头（理理理.md §7）
    stopRecording(); // 录音暂停/进行中点 Done 都先停录
    // 提交用户实际说出的内容，而不是完整 mock
    settleTimerRef.current = setTimeout(() => onDone(typeMode ? typed : words.join(" ")), 800);
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

      {/* 转写区：纯输入界面的主角；落定 ink / in-flight var(--ink-blue) */}
      <div style={{ marginTop: 34, flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <span className="meta-italic">{typeMode ? "Typing" : recording ? "Listening" : "Ready"}</span>
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
              {words.length === 0 && started && <span className="word-partial">…</span>}
            </p>
          </div>
        )}
      </div>

      {/* 声浪：录制中激活，空闲/暂停静止 */}
      <Waveform active={recording && !typeMode} />

      {/* controls：84px mic 居中，两翼 62px 定宽保持视觉居中 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 26, marginTop: 24 }}>
        <button
          onClick={() => {
            if (!typeMode) stopRecording(); // 切去打字 → 停录（文字保留）
            setTypeMode((v) => !v);
          }}
          style={{ width: 62, minHeight: 44, textAlign: "right", fontSize: 14, fontStyle: "italic", color: "var(--faint)" }}
        >
          {typeMode ? "Speak" : "Type it"}
        </button>
        <button
          onClick={() => (recording ? stopRecording() : startRecording())}
          aria-label={recording ? "Pause recording" : "Start recording"}
          aria-pressed={recording}
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 84,
            height: 84,
            borderRadius: "50%",
            background: "var(--sky)",
            boxShadow: "0 5px 0 var(--sky-under), var(--lift-2)",
          }}
        >
          {/* 录音中视觉态：外圈双涟漪（复用 listen keyframes） */}
          {recording && !typeMode && (
            <>
              <span aria-hidden style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "1.5px solid var(--coral)", animation: "listen 1.8s ease-out infinite", pointerEvents: "none" }} />
              <span aria-hidden style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "1.5px solid var(--coral)", animation: "listen 1.8s ease-out 0.9s infinite", pointerEvents: "none" }} />
            </>
          )}
          {recording ? (
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--ink-blue)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M9.5 5.5v13M14.5 5.5v13" />
            </svg>
          ) : (
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--ink-blue)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="9" y="2.5" width="6" height="11.5" rx="3" />
              <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3.5" />
            </svg>
          )}
        </button>
        <button
          onClick={handleDone}
          disabled={!canDone}
          style={{
            width: 62,
            minHeight: 44,
            textAlign: "left",
            fontSize: 14,
            fontStyle: "italic",
            color: "var(--ink)",
            opacity: canDone ? 1 : 0.35,
            transition: "opacity 300ms",
          }}
        >
          Done
        </button>
      </div>

      <div style={{ textAlign: "center", marginTop: 16 }}>
        <span style={{ fontSize: 13, fontWeight: 300, fontStyle: "italic", color: "var(--placeholder)" }}>
          {typeMode || recording
            ? "Tell it however it comes out."
            : started
              ? "Paused — tap the mic to keep going."
              : "Tap the mic to begin."}
        </span>
      </div>
    </div>
  );
}
