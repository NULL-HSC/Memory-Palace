"use client";

import React, { useEffect, useState } from "react";
import { CharacterFace, type FaceId } from "../characters";

/**
 * F4 舞台 v2 —— 竖屏全幅 AIGC video 槽位（互动影游形态）
 * 舞台铺满全屏作为对话发生的"世界";对话以直播弹幕式浮层盖在上面(见 F4Sandplay)。
 * 仍是槽位:入场 shimmer 兜底(永不黑屏),真视频就绪后同槽位 crossfade 接入;
 * 说话者焦点联动(RPG staging rule:step-forward + 提亮,其余退后变暗)。
 */

interface Props {
  speakerId: FaceId | null;
  title?: string;
}

/** 角色站位:舞台中部偏上(弹幕浮层之上),中置主角 + 两翼 */
const FIGURES: Array<{ id: FaceId; style: React.CSSProperties; size: number; delay: string }> = [
  { id: "mira", size: 74, delay: "0.9s", style: { left: "14%", bottom: "41%" } },
  { id: "pico", size: 128, delay: "0s", style: { left: "50%", marginLeft: -64, bottom: "38%" } },
  { id: "renn", size: 70, delay: "1.8s", style: { right: "14%", bottom: "41%" } },
];

export default function SandplayStage({ speakerId, title }: Props) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 1400);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "#F1E9D6" }}>
      {/* 场景(占位静帧 · 后续换 AIGC 视频):黄昏暖野,前中远景三层 */}
      <svg
        viewBox="0 0 390 844"
        preserveAspectRatio="xMidYMid slice"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        aria-hidden
      >
        <defs>
          <linearGradient id="skyV" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F6F1E4" />
            <stop offset="45%" stopColor="#F1E8D2" />
            <stop offset="100%" stopColor="#E9DDBE" />
          </linearGradient>
          <radialGradient id="sunGlow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="#EFDFB4" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#EFDFB4" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="390" height="844" fill="url(#skyV)" />
        {/* 低垂暖阳 */}
        <circle cx="312" cy="168" r="86" fill="url(#sunGlow)" />
        <circle cx="312" cy="168" r="34" fill="#F0E3C0" opacity="0.9" />
        {/* 远景山脊 */}
        <path d="M0 420 Q80 372 170 404 T390 388 V844 H0 Z" fill="#E3D8BA" opacity="0.8" />
        <path d="M0 470 Q110 430 220 458 T390 446 V844 H0 Z" fill="#DDD2B2" opacity="0.9" />
        {/* 中景灌木剪影 */}
        <path d="M-20 560 Q30 500 76 548 Q104 520 128 556 Q160 536 168 580 L168 640 L-20 640 Z" fill="#C9CFB0" opacity="0.75" />
        <path d="M410 552 Q356 496 316 550 Q288 524 268 560 Q238 542 232 584 L232 640 L410 640 Z" fill="#C9CFB0" opacity="0.75" />
        {/* 近景地面与沙丘 */}
        <path d="M0 600 Q120 560 230 592 T390 584 V844 H0 Z" fill="var(--sand-2)" />
        <ellipse cx="195" cy="760" rx="230" ry="72" fill="#E7DBBD" opacity="0.85" />
        <ellipse cx="195" cy="700" rx="90" ry="18" fill="#E0D2AF" opacity="0.8" />
      </svg>

      {/* 萤火/光尘:环境微动,低对比不抢注意力 */}
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          aria-hidden
          style={{
            position: "absolute",
            left: `${16 + i * 17}%`,
            top: `${34 + (i % 3) * 12}%`,
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: "#E8D9A8",
            animation: `think ${3.2 + i * 0.7}s ease-in-out ${i * 0.9}s infinite`,
          }}
        />
      ))}

      {/* 角色:sway 常驻;说话者 step-forward + 提亮 */}
      {FIGURES.map(({ id, style, size, delay }) => {
        const focused = speakerId === id;
        return (
          <div
            key={id}
            style={{
              position: "absolute",
              ...style,
              transition: "transform 450ms var(--ease-soft), opacity 450ms, filter 450ms",
              transform: focused ? "translateY(-12px) scale(1.15)" : "none",
              opacity: speakerId && !focused ? 0.68 : id === "pico" ? 1 : 0.94,
              filter: speakerId && !focused ? "saturate(0.75) brightness(0.97)" : "none",
              zIndex: focused ? 3 : 2,
            }}
          >
            <div className="anim-sway" style={{ animationDelay: delay }}>
              <CharacterFace id={id} size={size} />
            </div>
            {focused && (
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  transform: "translate(-50%, -50%)",
                  width: size * 1.6,
                  height: size * 1.6,
                  borderRadius: "50%",
                  background: "radial-gradient(circle, rgba(246,241,228,0.55) 0%, transparent 65%)",
                  zIndex: -1,
                }}
              />
            )}
          </div>
        );
      })}

      {/* 故事名:舞台左上小签 */}
      {title && (
        <span
          style={{
            position: "absolute",
            left: 16,
            top: 100,
            padding: "5px 12px",
            borderRadius: 999,
            background: "rgba(250,248,243,0.72)",
            backdropFilter: "blur(6px)",
            fontSize: 12,
            fontStyle: "italic",
            color: "#8A7B5C",
            zIndex: 4,
          }}
        >
          {title}
        </span>
      )}

      {/* shimmer:场景“生成中”兜底(永不黑屏) */}
      {!ready && (
        <div
          className="shimmer"
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(170deg, #F4EEDA, #EBDFC2)",
            display: "grid",
            placeItems: "center",
            zIndex: 6,
          }}
        >
          <span className="meta-italic" style={{ color: "#A99873" }}>
            laying out the day…
          </span>
        </div>
      )}
    </div>
  );
}
