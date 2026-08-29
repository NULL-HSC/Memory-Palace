"use client";

import React, { useState } from "react";
import { CoverArt } from "../ui";

/**
 * 首映页(2026-08-29 产品确认):拆开回信、幕布拉开之后,先完整看一遍生成的演绎视频,
 * 看完再进选角(PickRole)→ 群聊(阶段二)。
 * 视觉:小型影院 —— 顶部帷幔 + 两侧刚拉开的幕布 + 居中银幕(视频即播)+ 暖光 spotlight,
 * 背景是插画感的舞台墙。配色只用签署色板。
 * - 真后端:播放 waitForVideoPlayback 拿到的 playbackUrl,播完自动高亮 CTA
 * - 本地演示(无后端/视频失败):占位画面 + 说明,不挡流程
 */

const FOLDS =
  "repeating-linear-gradient(90deg, var(--ink-blue) 0 14px, var(--ink) 14px 22px, var(--ink-blue) 22px 40px, rgba(142,212,232,0.35) 40px 44px)";

export default function Premiere({
  playbackUrl,
  onDone,
  onBack,
}: {
  playbackUrl: string | null;
  onDone: () => void; // 看完 → 选角色
  onBack: () => void; // 放弃这个故事
}) {
  const [ended, setEnded] = useState(false);

  return (
    <div className="frame frame-enter" style={{ padding: 0, overflow: "hidden" }}>
      {/* ══ 影院背景层(插画感) ══ */}
      {/* 顶部帷幔(短幕 + 扇贝幕脚) */}
      <div aria-hidden style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 2 }}>
        <div style={{ height: 34, background: FOLDS, boxShadow: "0 4px 10px rgba(18,85,113,0.25)" }} />
        <div
          style={{
            height: 13,
            backgroundImage: "radial-gradient(circle at 13px 0, var(--ink-blue) 12px, transparent 13px)",
            backgroundSize: "26px 13px",
            backgroundRepeat: "repeat-x",
          }}
        />
      </div>
      {/* 银幕上方:淡淡的花草点缀(左右各一簇,低位不抢戏) */}
      <svg aria-hidden viewBox="0 0 390 60" style={{ position: "absolute", top: 118, left: 0, width: "100%", height: 60, zIndex: 1, pointerEvents: "none" }}>
        {/* 左簇 */}
        <path d="M52 56 Q50 40 56 30" fill="none" stroke="var(--story)" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="56" cy="27" r="5" fill="var(--butter)" />
        <circle cx="50" cy="31" r="4" fill="var(--butter)" opacity="0.75" />
        <circle cx="62" cy="31" r="4" fill="var(--butter)" opacity="0.75" />
        <path d="M52 46 Q44 42 42 36" fill="none" stroke="var(--story)" strokeWidth="1.4" strokeLinecap="round" />
        {/* 右簇 */}
        <path d="M338 56 Q340 42 334 32" fill="none" stroke="var(--story)" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="334" cy="29" r="5" fill="var(--sky)" />
        <circle cx="328" cy="33" r="4" fill="var(--sky)" opacity="0.75" />
        <circle cx="340" cy="33" r="4" fill="var(--sky)" opacity="0.75" />
        <path d="M338 46 Q346 42 348 36" fill="none" stroke="var(--story)" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
      {/* 底部:剧院座位排(后排观众的椅背剪影,雾蓝低饱和) */}
      <svg aria-hidden viewBox="0 0 390 88" preserveAspectRatio="xMidYMax slice" style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: 88, zIndex: 1, pointerEvents: "none" }}>
        {[30, 108, 186, 264, 342].map((x) => (
          <g key={x}>
            <rect x={x - 32} y={26} width="64" height="62" rx="20" fill="var(--mist)" />
            <rect x={x - 32} y={26} width="64" height="16" rx="8" fill="rgba(47,159,200,0.18)" />
          </g>
        ))}
      </svg>
      {/* 背景墙插画:暖光 spotlight 从顶部打到银幕 + 墙面暗角 */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 70% 46% at 50% 30%, rgba(255,216,106,0.28) 0%, rgba(255,216,106,0.10) 46%, transparent 74%), radial-gradient(ellipse 120% 90% at 50% 110%, rgba(217,238,244,0.55) 0%, transparent 60%)",
          zIndex: 0,
        }}
      />

      {/* ══ 内容层 ══ */}
      <div style={{ position: "relative", zIndex: 3, display: "flex", flexDirection: "column", height: "100%", padding: "var(--screen-top) var(--screen-x) max(var(--screen-bottom), env(safe-area-inset-bottom))" }}>
        {/* nav:标题用 ribbon,像剧院门楣 */}
        <div className="nav-bar" style={{ position: "relative" }}>
          <button className="nav-side back-chevron" onClick={onBack} aria-label="返回">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
          <span className="ribbon" style={{ position: "absolute", left: "50%", transform: "translateX(-50%)" }}>
            首映
          </span>
          <span className="nav-side" />
        </div>

        <span className="meta-italic" style={{ marginTop: 18, flexShrink: 0, textAlign: "center" }}>
          先静静看一遍,你的故事被演出来了。
        </span>

        {/* 银幕:墨蓝边框 + 投影,视频居中即播 */}
        <div
          style={{
            marginTop: 20,
            background: "linear-gradient(180deg, #2185AC 0%, var(--ink-blue) 78%)",
            borderRadius: "var(--r-panel)",
            padding: 10,
            boxShadow: "var(--lift-3), inset 0 2px 0 rgba(255,249,238,0.28)",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              position: "relative",
              width: "100%",
              aspectRatio: "16 / 9",
              borderRadius: "var(--r-photo)",
              overflow: "hidden",
              background: "var(--mist)",
              boxShadow: "inset 0 3px 10px rgba(15,45,66,0.28)",
            }}
          >
            {playbackUrl ? (
              <video
                src={playbackUrl}
                autoPlay
                controls
                playsInline
                onEnded={() => setEnded(true)}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              /* 演示模式 / 视频失败兜底:占位静帧 + 说明 */
              <>
                <CoverArt cover="sage" />
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    background: "rgba(18,85,113,0.18)",
                  }}
                >
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 56,
                      height: 56,
                      borderRadius: "50%",
                      background: "var(--butter)",
                      boxShadow: "0 4px 0 var(--butter-under)",
                    }}
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="var(--ink-blue)" aria-hidden>
                      <path d="M8 5.5v13l11-6.5z" />
                    </svg>
                  </span>
                  <span className="meta-italic" style={{ fontSize: 12, color: "var(--cream)", textShadow: "0 1px 6px rgba(18,85,113,0.6)" }}>
                    演示模式:这里会播放生成的演绎视频
                  </span>
                </div>
              </>
            )}
          </div>
          <div className="meta-italic" style={{ fontSize: 12, marginTop: 8, textAlign: "center", color: "var(--text-on-ink)" }}>
            {playbackUrl ? (ended ? "看完了" : "放映中…") : "视频接口接好后自动换成真放映"}
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0 }} />

        {/* CTA:看完进选角(不强制看完,随时可继续) */}
        <button className="btn" onClick={onDone} style={{ width: "100%", flexShrink: 0 }}>
          <span>{ended || !playbackUrl ? "看完了,去选角色" : "去选角色"}</span>
        </button>
      </div>
    </div>
  );
}
