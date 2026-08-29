"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  getOssPlaybackUrl,
  getSessionStatus,
  getVideoPlaybackSource,
  prepareSandplay,
  type PreparedSandplay,
} from "@/lib/api";
import { Companion } from "../characters";
import HeadMatch, { type ClearInfo } from "../game/HeadMatch";
import { createQuoteDeck, type MindfulQuote } from "@/lib/mindful-quotes";

/**
 * 等候室(2026-08-29 产品确认改版 → 2026-08-29 二改:占位符换成小游戏)
 *
 * 寄出故事之后、场景还在准备的等待环节:
 * - 中部是**头像消消乐**(HeadMatch):用五位角色的头做棋子,没有倒计时/失败态,
 *   死局自动洗牌 —— 目的是把人留在这一步、别觉得干等,不是让人玩到上头
 * - 顶上是**一句话**:每消掉一组,从预置的正念短句 / 名人名言里随机换一句
 *   (lib/mindful-quotes.ts),用来卸掉一点内耗;不陪聊、不调 LLM
 * - 视频就绪 → 幕前出现一封**回信**;用户拆开 → 幕布拉开(CurtainVeil)→ 首映页
 *
 * 这一帧同时承担真正的等待:挂载即并行 prepareSandplay(建 session → 触发视频任务
 * → 提取人设),随后等视频生成完成。结果经 onReady 向上传,避免后续帧重复请求。
 * 游戏只是等待期的陪伴,**不影响也不阻塞**这条链路:回信一到就 paused,幕布照拉。
 */

const MOCK_VIDEO_MS = 4200; // 本地演示:模拟 VLM 生成耗时

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 轮询后端 session 直到视频就绪,返回播放地址;失败/超时抛错(与 SandplayStage 同一套状态约定) */
export async function waitForVideoPlayback(sessionId: string): Promise<string> {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const session = await getSessionStatus(sessionId);
    const status = session.video.status.toLowerCase();
    if (["succeeded", "completed", "ready", "success"].includes(status)) {
      const playbackSource = await getVideoPlaybackSource(session.video.id);
      return getOssPlaybackUrl(playbackSource.video.object_key);
    }
    if (["failed", "error", "cancelled", "canceled"].includes(status)) {
      throw new Error(session.video.message || session.video.error_code || "视频生成失败");
    }
    await delay(2500);
  }
  throw new Error("等待视频生成超时");
}

export default function Reflect({
  transcript,
  onReady,
  onBack,
}: {
  transcript: string;
  /** 就绪拆开回信:解构结果 + 视频播放地址(无真后端/视频失败时为 null,首映页有兜底) */
  onReady: (prepared: PreparedSandplay, playbackUrl: string | null) => void;
  onBack: () => void;
}) {
  const [prepError, setPrepError] = useState<string | null>(null);
  const [letterReady, setLetterReady] = useState(false); // 视频就绪 → 回信抵达

  const preparedRef = useRef<PreparedSandplay | null>(null);
  const playbackRef = useRef<string | null>(null);
  const aliveRef = useRef(true);
  const inflightRef = useRef<string | null>(null); // StrictMode 双挂去重

  /* ---- 顶上的一句话:预置文案,每消一组随机抽一张,一轮之内不重复 ---- */
  const drawQuote = useMemo(() => createQuoteDeck(), []);
  const [quote, setQuote] = useState<MindfulQuote>(() => drawQuote());
  const [quoteSeq, setQuoteSeq] = useState(0); // 换句时重放入场动画
  const [cleared, setCleared] = useState(0);

  /** 玩家这一步消掉了(连锁续消不抢词,只累加计数,免得一句话没看清就被换掉) */
  const handleClear = (info: ClearInfo) => {
    setCleared(info.total);
    if (info.combo > 1) return;
    setQuote(drawQuote());
    setQuoteSeq((n) => n + 1);
  };

  /** 完整的「等回信」流程:解构 → 等视频 → 回信抵达 */
  const waitForLetter = () => {
    if (inflightRef.current === transcript) {
      console.log("[flow] Reflect prepare skipped: already in flight", { textLength: transcript.length });
      return;
    }
    console.log("[flow] Reflect prepare start", { textLength: transcript.length });
    inflightRef.current = transcript;
    setPrepError(null);
    setLetterReady(false);
    prepareSandplay(transcript)
      .then(async (p) => {
        if (!aliveRef.current) return;
        console.log("[flow] Reflect prepare success", { hasSession: Boolean(p.session), sessionId: p.session?.session_id, personaCount: p.personas.length });
        preparedRef.current = p;
        if (p.session) {
          // 真后端:等 VLM 视频;视频失败不挡路,首映页用兜底画面
          try {
            playbackRef.current = await waitForVideoPlayback(p.session.session_id);
          } catch (error) {
            console.error("[reflect] 视频等待失败,首映页走兜底:", error);
            playbackRef.current = null;
          }
        } else {
          // 本地演示:模拟 VLM 生成耗时
          await delay(MOCK_VIDEO_MS);
        }
        if (aliveRef.current) setLetterReady(true);
      })
      .catch((e) => {
        if (!aliveRef.current) return;
        console.error("[flow] Reflect prepare failed", e);
        setPrepError(e instanceof Error ? e.message : String(e));
        inflightRef.current = null;
      });
  };

  useEffect(() => {
    aliveRef.current = true;
    waitForLetter();
    return () => {
      aliveRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript]);

  const openLetter = () => {
    if (!preparedRef.current) return;
    onReady(preparedRef.current, playbackRef.current);
  };

  return (
    <div className="frame frame-enter">
      <style>{REFLECT_CSS}</style>

      {/* nav */}
      <div className="nav-bar">
        <button className="nav-side back-chevron" onClick={onBack} aria-label="返回">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <span className="nav-title">等候室</span>
        <span className="nav-side" />
      </div>

      {/* 顶部:挂在等候室上方的「一句话」牌子(companion 念给你听) */}
      <div style={{ marginTop: 14, flexShrink: 0 }}>
        <div
          className="card-frame"
          style={{
            minHeight: 82,
            borderRadius: "var(--r-panel)",
            boxShadow: "var(--lift-2)",
            padding: "12px 14px 10px",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Companion size={44} className="anim-bob" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }} aria-live="polite">
            <div
              key={quoteSeq}
              className="rf-quote"
              style={{
                fontFamily: "var(--font-hand)",
                fontSize: quote.text.length > 14 ? 16 : 17.5,
                lineHeight: 1.55,
                color: "var(--ink-blue)",
              }}
            >
              {quote.text}
            </div>
            {quote.from && (
              <div key={`from-${quoteSeq}`} className="rf-quote meta-italic" style={{ fontSize: 11.5, marginTop: 3, textAlign: "right" }}>
                —— {quote.from}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 中部:等待期的小游戏 / 准备失败时的重试 */}
      {prepError ? (
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "center", textAlign: "center" }}>
          <div className="meta-italic" style={{ fontSize: 13.5 }}>这会儿没能把景搭起来。</div>
          <div style={{ marginTop: 8, fontSize: 11.5, lineHeight: 1.5, color: "var(--placeholder)", wordBreak: "break-word" }}>
            {prepError}
          </div>
          <button
            onClick={waitForLetter}
            style={{
              margin: "14px auto 0",
              minHeight: 44,
              padding: "0 22px",
              borderRadius: 22,
              border: "1px solid var(--line)",
              background: "var(--raised)",
              fontSize: 14.5,
              color: "var(--ink)",
            }}
          >
            再试一次
          </button>
        </div>
      ) : (
        <HeadMatch onClear={handleClear} paused={letterReady} />
      )}

      {/* 底部状态:左边是等待进度,右边是这局战绩 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          marginTop: 10,
          flexShrink: 0,
        }}
      >
        <span className="meta-italic" style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
          {!prepError && !letterReady && <span className="rf-dot" aria-hidden />}
          {prepError ? "" : letterReady ? "布景好了" : "幕布后面正在布景…"}
        </span>
        {!prepError && (
          <span className="meta-italic" style={{ fontStyle: "normal", color: "var(--faint)", fontSize: 11.5 }}>
            {cleared > 0 ? `已消掉 ${cleared} 组` : "拖动或点两下,把一样的凑成三个"}
          </span>
        )}
      </div>

      {/* 回信抵达:整页压暗,一封信弹在遮罩之上,等用户拆开 */}
      {letterReady && !prepError && (
        <div style={{ position: "absolute", inset: 0, zIndex: 20, background: "var(--scrim)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="is-pop" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <button
              onClick={openLetter}
              aria-label="拆开回信"
              style={{
                width: 240,
                background: "var(--raised)",
                borderRadius: "var(--r-panel)",
                padding: "22px 20px 18px",
                boxShadow: "var(--shadow-print-review)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                transform: "rotate(-1.5deg)",
              }}
            >
              {/* 信封:奶油纸 + 三角封口 + butter 火漆 */}
              <svg width="72" height="52" viewBox="0 0 72 52" aria-hidden>
                <rect x="2" y="6" width="68" height="44" rx="6" fill="var(--cream)" stroke="var(--story)" strokeWidth="1.6" />
                <path d="M4 8 L36 34 L68 8" fill="none" stroke="var(--story)" strokeWidth="1.6" strokeLinejoin="round" />
                <circle cx="36" cy="30" r="7" fill="var(--butter)" stroke="var(--butter-under)" strokeWidth="1.4" />
              </svg>
              <span style={{ fontFamily: "var(--font-hand)", fontSize: 20, color: "var(--ink-blue)", marginTop: 12 }}>
                你的故事回信了
              </span>
              <span className="meta-italic" style={{ fontSize: 12.5, marginTop: 6 }}>
                点开,幕布就拉开
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* 只在这一帧用到的动效,不进 globals.css */
const REFLECT_CSS = `
.rf-quote { animation: rfQuoteIn 420ms var(--ease-soft) both; }
@keyframes rfQuoteIn {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: none; }
}
.rf-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--story);
  animation: rfBreathe 1.8s var(--ease-soft) infinite;
}
@keyframes rfBreathe {
  0%, 100% { opacity: 0.3; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1); }
}
`;
