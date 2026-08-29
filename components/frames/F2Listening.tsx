"use client";

import React, { useEffect, useRef, useState } from "react";
import { Waveform } from "../ui";
import { transcriptBeats } from "@/lib/mock/transcript";

/**
 * F2 — 输入页(2026-08-29 交互改版)
 * - 进入为空闲态:只有点底部麦克风才开始语音输入,再点暂停(文字保留)
 * - 点空白区域 → 直接弹起系统键盘打字;再点麦克风可切回语音(两种内容各自保留)
 * - 底部不再有 Type it / Done;确认入口改为右上角「寄出」图标(send letter)→ 直接进下一页
 * startRecording / stopRecording 仍是未来真 ASR 的接入点(见函数内注释)。
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
  const [started, setStarted] = useState(false); // 曾经开始过录制(纯空闲态不渲染 …)
  const [streamDone, setStreamDone] = useState(false); // mock 语流播完(录制仍可继续计时)
  const [typeMode, setTypeMode] = useState(false);
  const [typed, setTyped] = useState("");
  const [settling, setSettling] = useState(false);
  const beatsRef = useRef<Array<{ word: string; delay: number }> | null>(null);
  const beatIdxRef = useRef(0);
  const beatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  /* 卸载清理:录制语流 / 秒表 / 沉淀态延迟,任何定时器都不许泄漏 */
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

  /** 依次上屏下一个词(mock ASR 语流;真 ASR 换成识别结果回调) */
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
   * 开始/恢复录制:启动秒表 + 语流上屏 + 波形激活。
   * 【真 ASR 接入点】换成 ASR.start(),识别结果回调里 setWords((w) => [...w, word]),
   * mock 语流(transcriptBeats / scheduleNextBeat)届时整体删除。
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
   * 暂停录制:停字、停表、波形静止,已上屏文字保留。
   * 【真 ASR 接入点】换成 ASR.stop()(或停止推流)。
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

  /* 点空白区域 → 打字:停录(文字保留)并切到键盘输入 */
  const startTyping = () => {
    if (typeMode || settling) return;
    stopRecording();
    setTypeMode(true);
  };

  /* 点麦克风 → 语音:离开打字模式(已打文字保留)并开/停录 */
  const toggleRecording = () => {
    if (settling) return;
    if (typeMode) setTypeMode(false);
    if (recording) stopRecording();
    else startRecording();
  };

  /* 语流进行中(控制末 3 词的 in-flight 样式);波形只看录制开关 */
  const streaming = recording && !streamDone;

  // 寄出门槛:≥50 字(防过短文本进人设提取);不足时提示用户把故事说完整
  const MIN_SEND_LEN = 50;
  const fullText = typeMode ? typed.trim() : words.join(" ");
  const canSend = fullText.length >= MIN_SEND_LEN;

  const handleSend = () => {
    if (!canSend || settling) return;
    setSettling(true); // 寄出沉淀态:文字落定后提交(理理理.md §7)
    stopRecording();
    // 提交用户实际输入的内容,而不是完整 mock
    settleTimerRef.current = setTimeout(() => onDone(typeMode ? typed : words.join(" ")), 800);
  };

  const mm = Math.floor(seconds / 60);
  const ss = String(seconds % 60).padStart(2, "0");

  const statusText = settling
    ? "寄出中…"
    : typeMode
      ? "打字中…"
      : recording
        ? `正在听 · ${mm}:${ss}`
        : started
          ? "暂停了 · 点麦克风继续"
          : "点麦克风开始讲,或点空白处打字";

  return (
    <div className="frame frame-enter">
      {/* nav:右上角「寄出」= 确认,直接进下一页;标题绝对居中 */}
      <div className="nav-bar" style={{ position: "relative" }}>
        <button className="nav-side back-chevron" onClick={onBack} aria-label="返回">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <span className="nav-title" style={{ position: "absolute", left: "50%", transform: "translateX(-50%)" }}>新故事</span>
        <button
          className="btn"
          onClick={handleSend}
          disabled={!canSend || settling}
          aria-label="寄出这封信"
          style={{ minHeight: 40, padding: "0 14px", fontSize: 14, gap: 6, flexShrink: 0 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M22 2L11 13" />
            <path d="M22 2l-7 20-4-9-9-4 20-7z" />
          </svg>
          寄出
        </button>
      </div>

      {/* 状态行 */}
      <span className="meta-italic" style={{ marginTop: 34, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
        {statusText}
      </span>

      {/* 输入区(信纸):打字模式铺满 textarea;否则展示转写,点空白处弹键盘 */}
      {typeMode ? (
        <textarea
          autoFocus
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="想到哪儿写到哪儿…"
          aria-label="把故事打出来"
          style={{
            marginTop: 12,
            flex: 1,
            minHeight: 0,
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
        <div
          ref={scrollRef}
          onClick={startTyping}
          role="button"
          tabIndex={0}
          aria-label="点这里打字"
          style={{ marginTop: 12, flex: 1, minHeight: 0, overflowY: "auto", cursor: "text" }}
        >
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

      {/* 声浪:录制中激活,空闲/暂停/打字静止(抬升到信封上方) */}
      <div style={{ position: "relative", zIndex: 1 }}>
        <Waveform active={recording && !typeMode} />
      </div>

      {/* 唯一的控制:底部居中麦克风,点了才开始语音输入(骑在信封上沿) */}
      <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 16 }}>
        <button
          onClick={toggleRecording}
          aria-label={recording ? "暂停录音" : "开始录音"}
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
          {/* 录音中视觉态:外圈双涟漪(复用 listen keyframes) */}
          {recording && !typeMode && (
            <>
              <span aria-hidden style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "1.5px solid rgba(47,159,200,0.55)", animation: "listen 1.8s ease-out infinite", pointerEvents: "none" }} />
              <span aria-hidden style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "1.5px solid rgba(47,159,200,0.55)", animation: "listen 1.8s ease-out 0.9s infinite", pointerEvents: "none" }} />
            </>
          )}
          {recording && !typeMode ? (
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
      </div>

      <div style={{ position: "relative", zIndex: 1, textAlign: "center", marginTop: 16, marginBottom: 46 }}>
        <span style={{ fontSize: 13, fontWeight: 300, fontStyle: "italic", color: "var(--ink)" }}>
          {canSend
            ? typeMode
              ? "写完点右上角寄出。"
              : recording
                ? "想到哪儿说到哪儿。"
                : "说完点右上角寄出。"
            : `把故事说完整一些 · 50 字以上才能寄出(${fullText.length}/50)`}
        </span>
      </div>

      {/* ══ 底部装饰:格纹信封侧翼(左右两片三角,中间留空不压文字) ══ */}
      <svg
        aria-hidden
        viewBox="0 0 390 120"
        preserveAspectRatio="none"
        style={{
          position: "absolute",
          left: "calc(-1 * var(--screen-x))",
          right: "calc(-1 * var(--screen-x))",
          bottom: "calc(-1 * max(var(--screen-bottom), env(safe-area-inset-bottom)))",
          width: "calc(100% + 2 * var(--screen-x))",
          height: 120,
          zIndex: 0,
          pointerEvents: "none",
        }}
      >
        <defs>
          <pattern id="envGingham" width="26" height="26" patternUnits="userSpaceOnUse">
            <rect width="26" height="26" fill="#EAF6FA" />
            <rect width="13" height="26" fill="rgba(47,159,200,0.2)" />
            <rect width="26" height="13" fill="rgba(47,159,200,0.2)" />
          </pattern>
        </defs>
        {/* 左翻盖三角(斜边延过中线,与右翼交叠) */}
        <path d="M0 0 L0 120 L310 120 Z" fill="url(#envGingham)" />
        {/* 右翻盖三角(压在上层) */}
        <path d="M390 0 L390 120 L80 120 Z" fill="url(#envGingham)" />
        {/* 交叠区:底部两片相交处略加深,读出层叠感 */}
        <path d="M80 120 L195 75 L310 120 Z" fill="rgba(47,159,200,0.14)" />
        {/* 翻盖车缝线 */}
        <path d="M0 0 L310 120" fill="none" stroke="var(--ink-blue)" strokeOpacity="0.25" strokeWidth="1.3" strokeDasharray="5 6" strokeLinecap="round" />
        <path d="M390 0 L80 120" fill="none" stroke="var(--ink-blue)" strokeOpacity="0.25" strokeWidth="1.3" strokeDasharray="5 6" strokeLinecap="round" />
      </svg>
    </div>
  );
}
