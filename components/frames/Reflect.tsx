"use client";

import React, { useEffect, useRef, useState } from "react";
import { getPlaybackUrl, getSessionStatus, prepareSandplay, type PreparedSandplay } from "@/lib/api";
import { Companion } from "../characters";
import { ClosedCurtainBackdrop } from "../scene/Curtain";

/**
 * 等候室(2026-08-29 产品确认改版)
 *
 * 寄出故事之后、场景还在准备的等待环节:
 * - 中部是**占位符区**:等待时的冥想/小游戏尚未定方向,先留空(gingham 虚线槽位)
 * - 不再有旁观者陪聊 LLM;只安静等待「VLM 视频返回」这个外部事件
 * - 视频就绪 → 幕前出现一封**回信**;用户拆开 → 幕布拉开(CurtainVeil)→ 首映页
 *
 * 这一帧同时承担真正的等待:挂载即并行 prepareSandplay(建 session → 触发视频任务
 * → 提取人设),随后等视频生成完成。结果经 onReady 向上传,避免后续帧重复请求。
 */

const MOCK_VIDEO_MS = 4200; // 本地演示:模拟 VLM 生成耗时

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 轮询后端 session 直到视频就绪,返回播放地址;失败/超时抛错(与 SandplayStage 同一套状态约定) */
async function waitForVideoPlayback(sessionId: string): Promise<string> {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const session = await getSessionStatus(sessionId);
    const status = session.video.status.toLowerCase();
    if (["succeeded", "completed", "ready", "success"].includes(status)) {
      return getPlaybackUrl(session.video.id);
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

  /** 完整的「等回信」流程:解构 → 等视频 → 回信抵达 */
  const waitForLetter = () => {
    if (inflightRef.current === transcript) return;
    inflightRef.current = transcript;
    setPrepError(null);
    setLetterReady(false);
    prepareSandplay(transcript)
      .then(async (p) => {
        if (!aliveRef.current) return;
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

      {/* 舞台口:背后是一直闭着的幕布 + 台前光,companion 站在幕前陪你等 */}
      <div style={{ position: "relative", marginTop: 18, flexShrink: 0, height: 170 }}>
        <ClosedCurtainBackdrop height={132} />
        <div style={{ position: "absolute", left: "50%", bottom: 0, transform: "translateX(-50%)" }}>
          <Companion size={92} className="anim-bob" />
        </div>
      </div>

      {/* 中部:等待占位符区 / 回信抵达 */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", marginTop: 18 }}>
        {prepError ? (
          /* 准备失败:这条路走不下去,给真实原因 + 重试 */
          <div style={{ textAlign: "center", margin: "auto 0" }}>
            <div className="meta-italic" style={{ fontSize: 13.5 }}>这会儿没能把景搭起来。</div>
            <div style={{ marginTop: 8, fontSize: 11.5, lineHeight: 1.5, color: "var(--placeholder)", wordBreak: "break-word" }}>
              {prepError}
            </div>
            <button
              onClick={waitForLetter}
              style={{
                marginTop: 14,
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
        ) : letterReady ? (
          /* 回信抵达:整页压暗,一封信弹在遮罩之上,等用户拆开 */
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
        ) : (
          /* 占位符:等待时的冥想/小游戏方向未定,先留空(gingham = 空白待填,kit §3) */
          <div
            className="gingham"
            style={{
              flex: 1,
              borderRadius: "var(--r-panel)",
              border: "1.5px dashed var(--slot-border)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: 24,
            }}
          >
            <span className="meta-italic" style={{ fontSize: 13.5 }}>正在等回信…</span>
            <span className="meta-italic" style={{ fontSize: 12, color: "var(--faint)", textAlign: "center", lineHeight: 1.7 }}>
              (等待时的小游戏 / 冥想,这里先留空)
            </span>
          </div>
        )}
      </div>

      {/* 底部状态 */}
      <div className="meta-italic" style={{ textAlign: "center", marginTop: 14, flexShrink: 0 }}>
        {prepError ? "" : letterReady ? "布景好了" : "幕布后面正在布景…"}
      </div>
    </div>
  );
}
