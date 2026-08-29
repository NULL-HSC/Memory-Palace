"use client";

import React, { useState } from "react";
import { CoverArt } from "../ui";
import { longDate } from "@/lib/mock/titles";

/**
 * 首映页(2026-08-29 产品确认):拆开回信、幕布拉开之后,先完整看一遍生成的演绎视频,
 * 看完再进选角(PickRole)→ 群聊(阶段二)。
 * 视觉:小型影院 —— 顶部帷幔 + 两侧刚拉开的幕布 + 居中银幕(视频即播)+ 暖光 spotlight,
 * 背景是插画感的舞台墙。配色只用签署色板。
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
    <div className="frame frame-enter" style={{ padding: 0, overflow: "hidden" }}>
      {/* ══ 影院背景层(插画感) ══ */}
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
      {/* 底部:剧院座位排(后排观众的椅背剪影,雾蓝低饱和)—— 错位高低 + 微倾斜 + 深浅不一,不规则分布更灵动 */}
      <svg aria-hidden viewBox="0 0 390 88" preserveAspectRatio="xMidYMax slice" style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: 88, zIndex: 1, pointerEvents: "none" }}>
        {[
          { x: 16, w: 54, y: 44, h: 44, rx: 16, r: -4, o: 0.9 },
          { x: 82, w: 78, y: 20, h: 68, rx: 22, r: 2, o: 1 },
          { x: 170, w: 56, y: 50, h: 38, rx: 16, r: -2, o: 0.8 },
          { x: 236, w: 72, y: 26, h: 62, rx: 20, r: 3, o: 1 },
          { x: 316, w: 62, y: 36, h: 52, rx: 18, r: -3, o: 0.9 },
        ].map((seat, i) => (
          <g key={i} transform={`rotate(${seat.r} ${seat.x + seat.w / 2} 88)`} opacity={seat.o}>
            <rect x={seat.x} y={seat.y} width={seat.w} height={seat.h} rx={seat.rx} fill="var(--mist)" />
            <rect x={seat.x} y={seat.y} width={seat.w} height="14" rx="7" fill="rgba(47,159,200,0.18)" />
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

        {/* 放映卡:米白大拍立得(和首页同款裱框 + 内阴影),左上角贴胶带 */}
        <div
          className="card-frame"
          style={{
            position: "relative",
            marginTop: 46,
            borderRadius: "var(--r-panel)",
            padding: "12px 12px 0",
            boxShadow: "var(--lift-3)",
            flexShrink: 0,
          }}
        >
          {/* washi 胶带(一张,斜贴左上角) */}
          <span
            aria-hidden
            style={{
              position: "absolute",
              top: -10,
              left: 18,
              width: 62,
              height: 22,
              background: "rgba(255,216,106,0.85)",
              boxShadow: "0 1px 3px rgba(15,45,66,0.14)",
              transform: "rotate(-8deg)",
              zIndex: 2,
            }}
          />
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
            {/* 内框内阴影:压在画面上,衬出嵌框感(同首页拍立得) */}
            <span
              aria-hidden
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "var(--r-photo)",
                boxShadow: "inset 0 3px 10px rgba(15,45,66,0.16), inset 0 -2px 4px rgba(15,45,66,0.06)",
                pointerEvents: "none",
              }}
            />
            {/* 进度条(装饰,真视频接入后联动) */}
            <div
              style={{
                position: "absolute",
                left: 10,
                right: 10,
                bottom: 8,
                display: "flex",
                alignItems: "center",
                gap: 7,
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--story)", flexShrink: 0 }} />
              <span style={{ flex: 1, height: 3, borderRadius: 2, background: "var(--story)", opacity: 0.55 }} />
              <span style={{ fontSize: 11, color: "var(--story)", fontVariantNumeric: "tabular-nums" }}>0:00 / 0:00</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--story)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M11 5L6 9H2v6h4l5 4V5z" />
                <path d="M15.5 8.5a5 5 0 0 1 0 7" />
              </svg>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--story)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
              </svg>
            </div>
          </div>
          {/* 底 mat:格纹 + 手写标题 + 黄油日期 */}
          <div
            style={{
              margin: "12px -12px 0",
              padding: "12px 12px 13px",
              borderRadius: "0 0 var(--r-panel) var(--r-panel)",
              textAlign: "center",
              backgroundColor: "var(--cream)",
              backgroundImage:
                "repeating-linear-gradient(0deg, rgba(47,159,200,0.12) 0 13px, transparent 13px 26px), repeating-linear-gradient(90deg, rgba(47,159,200,0.12) 0 13px, transparent 13px 26px)",
            }}
          >
            {/* 标题与 Home 拍立得 caption 同款手写栈(--font-hand,中文回落小赖),稍大一号 */}
            <div style={{ fontFamily: "var(--font-hand)", fontSize: 24, fontWeight: 600, color: "var(--ink-blue)", lineHeight: 1.2 }}>
              {playbackUrl ? (ended ? "看完了" : "今天的故事") : "今天的故事"}
            </div>
            <div style={{ fontFamily: "var(--font-hand)", fontSize: 12.5, marginTop: 3, color: "var(--butter)", textShadow: "0 1px 2px rgba(15,45,66,0.15)" }}>
              {longDate(new Date())}
            </div>
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
