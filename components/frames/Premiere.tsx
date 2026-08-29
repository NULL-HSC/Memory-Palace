"use client";

import React, { useState } from "react";
import { CoverArt } from "../ui";

/**
 * 首映页(2026-08-29 产品确认):拆开回信、幕布拉开之后,先完整看一遍生成的演绎视频,
 * 看完再进选角(PickRole)→ 群聊(阶段二)。
 * - 真后端:播放 waitForVideoPlayback 拿到的 playbackUrl,播完自动高亮 CTA
 * - 本地演示(无后端/视频失败):占位画面 + 说明,不挡流程
 */
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
    <div className="frame frame-enter">
      {/* nav */}
      <div className="nav-bar">
        <button className="nav-side back-chevron" onClick={onBack} aria-label="返回">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <span className="nav-title">回信</span>
        <span className="nav-side" />
      </div>

      <span className="meta-italic" style={{ marginTop: 16, flexShrink: 0 }}>
        先静静看一遍,你的故事被演出来了。
      </span>

      {/* 放映区:信纸卡上的 16:9 银幕 */}
      <div
        style={{
          marginTop: 14,
          background: "var(--raised)",
          borderRadius: "var(--r-panel)",
          padding: 12,
          boxShadow: "var(--shadow-print-review)",
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
        <div className="meta-italic" style={{ fontSize: 12, marginTop: 10, textAlign: "center" }}>
          {playbackUrl ? (ended ? "看完了" : "放映中…") : "视频接口接好后自动换成真放映"}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0 }} />

      {/* CTA:看完进选角(不强制看完,随时可继续) */}
      <button className="btn" onClick={onDone} style={{ width: "100%", flexShrink: 0 }}>
        <span>{ended || !playbackUrl ? "看完了,去选角色" : "去选角色"}</span>
      </button>
    </div>
  );
}
