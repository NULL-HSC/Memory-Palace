"use client";

import React, { useEffect, useRef, useState } from "react";
import { CharacterFace, type FaceId } from "../characters";
import { characterById } from "@/lib/mock/characters";

/* ============ Mounted print —— handoff §3.1 核心物件 ============
   白卡 + 发丝边 + 非对称 padding（底边 ≈ 3× 侧边）→ 裱起来的照片感。
   封面始终 object-fit: cover（交付 ≥206×244，主体居中）。 */

const VARIANTS = {
  focused: { w: 230, h: 296, pad: "12px 12px 56px", shadow: "var(--shadow-print-focus)" },
  mid: { w: 198, h: 255, pad: "10px 10px 44px", shadow: "var(--shadow-print-mid)" },
  edge: { w: 166, h: 214, pad: "8px 8px 32px", shadow: "none" },
  review: { w: 186, h: 240, pad: "10px 10px 44px", shadow: "var(--shadow-print-review)" },
} as const;

export type PrintVariant = keyof typeof VARIANTS;

/** 占位封面（spec §5：hand-drawn stand-in，正式封面交付后替换；像素取自 mockup）
 *  cover 以 "/" 开头时按图片路径渲染（真实封面图），否则用内置 SVG 占位 */
export function CoverArt({ cover }: { cover: string }) {
  if (cover.startsWith("/")) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={cover}
        alt=""
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
    );
  }
  if (cover === "blush")
    return (
      <svg viewBox="0 0 178 211" preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} aria-hidden>
        <rect width="178" height="211" fill="var(--butter)" opacity="0.45" />
        <circle cx="130" cy="50" r="21" fill="var(--butter)" />
        <path d="M0 146 C34 120 68 133 96 146 C120 157 148 139 178 148 L178 211 L0 211 Z" fill="var(--butter)" opacity="0.7" />
        <path d="M0 172 C40 152 80 172 118 166 C146 162 162 176 178 172 L178 211 L0 211 Z" fill="var(--butter-under)" />
      </svg>
    );
  if (cover === "lavender")
    return (
      <svg viewBox="0 0 150 178" preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} aria-hidden>
        <rect width="150" height="178" fill="var(--mist)" />
        <circle cx="112" cy="42" r="15" fill="var(--cream)" />
        <path d="M0 122 C30 100 58 111 82 122 C101 131 126 116 150 124 L150 178 L0 178 Z" fill="var(--sky)" opacity="0.5" />
        <path d="M0 145 C35 128 68 145 100 140 C124 136 138 148 150 145 L150 178 L0 178 Z" fill="var(--sky)" />
      </svg>
    );
  return (
    <svg viewBox="0 0 206 244" preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} aria-hidden>
      <rect width="206" height="244" fill="var(--mist)" />
      <circle cx="50" cy="50" r="20" fill="var(--butter)" opacity="0.45" />
      <path d="M0 160 C41 128 82 144 118 160 C143 171 172 152 206 163 L206 244 L0 244 Z" fill="var(--sky)" opacity="0.5" />
      <path d="M130 210 L130 178" stroke="var(--story)" strokeWidth="3.6" strokeLinecap="round" />
      <circle cx="130" cy="170" r="16" fill="var(--sky)" />
      <circle cx="115" cy="182" r="11" fill="var(--sky)" opacity="0.35" />
      <circle cx="146" cy="183" r="10" fill="var(--sky)" opacity="0.35" />
      <path d="M0 199 C47 176 93 199 137 192 C169 187 187 202 206 199 L206 244 L0 244 Z" fill="var(--sky)" opacity="0.65" />
    </svg>
  );
}

export function MountedPrint({
  variant = "mid",
  cover,
  caption,
  date,
  style,
  onClick,
}: {
  variant?: PrintVariant;
  cover?: string;
  caption?: string; // 标题写在底 mat 上,手写字(kit polaroid__caption)
  date?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}) {
  const v = VARIANTS[variant];
  return (
    <button
      onClick={onClick}
      style={{
        width: v.w,
        height: v.h,
        background: "var(--raised)",
        border: "none",
        borderRadius: "var(--r-panel)",
        padding: v.pad,
        boxShadow: v.shadow,
        position: "relative",
        ...style,
      }}
    >
      <span
        style={{
          position: "relative",
          display: "block",
          width: "100%",
          height: "100%",
          overflow: "hidden",
          borderRadius: 6,
        }}
      >
        <CoverArt cover={cover ?? "sage"} />
        {/* 内框内阴影:照片区微微凹陷,卡片更立体 */}
        <span
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 6,
            boxShadow: "inset 0 3px 10px rgba(15,45,66,0.16), inset 0 -2px 4px rgba(15,45,66,0.06)",
            pointerEvents: "none",
          }}
        />
      </span>
      {caption && (
        <span
          style={{
            position: "absolute",
            left: 10,
            right: 10,
            bottom: 8,
            textAlign: "center",
            fontFamily: "var(--font-hand)",
            color: "var(--ink-blue)",
          }}
        >
          <span
            style={{
              display: "block",
              fontSize: variant === "edge" ? 15 : 21,
              fontWeight: 600,
              lineHeight: 1.2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {caption}
          </span>
          {date && (
            <span style={{ display: "block", fontSize: 11, marginTop: 2, color: "rgba(15,45,66,0.7)" }}>
              {date}
            </span>
          )}
        </span>
      )}
    </button>
  );
}

/** 空白拍立得（扇形末尾的「+」槽位）:和其他卡同款裱框,照片区是格子纹,表示待添加 */
export function BlankMount({ style }: { style?: React.CSSProperties }) {
  return (
    <div
      style={{
        width: VARIANTS.focused.w,
        height: VARIANTS.focused.h,
        background: "var(--raised)",
        border: "none",
        borderRadius: "var(--r-panel)",
        padding: VARIANTS.focused.pad,
        boxShadow: "var(--shadow-print-mid)",
        ...style,
      }}
    >
      <span
        className="gingham"
        style={{
          position: "relative",
          display: "block",
          width: "100%",
          height: "100%",
          overflow: "hidden",
          borderRadius: 6,
        }}
      >
        {/* 内框内阴影:与其他拍立得对齐 */}
        <span
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 6,
            boxShadow: "inset 0 3px 10px rgba(15,45,66,0.16), inset 0 -2px 4px rgba(15,45,66,0.06)",
            pointerEvents: "none",
          }}
        />
      </span>
    </div>
  );
}

/** New-story 槽位（§3.3）：mid mount + 虚线内芯 + 右对齐 accent 圆加号 + 底 mat caption */
export function NewStorySlot({ style, onClick }: { style?: React.CSSProperties; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="新故事"
      style={{
        width: VARIANTS.mid.w,
        height: VARIANTS.mid.h,
        background: "var(--raised)",
        border: "none",
        padding: "10px 10px 34px",
        boxShadow: "var(--lift-2)",
        position: "relative",
        ...style,
      }}
    >
      <span
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          width: "100%",
          height: "100%",
          background: "var(--slot-fill)",
          border: "1.5px dashed var(--slot-border)",
          paddingRight: 22,
        }}
      >
        <span
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: "var(--butter)",
            boxShadow: "0 3px 0 var(--butter-under)",
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--ink-blue)" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
            <path d="M12 5v14M5 12h14" />
          </svg>
        </span>
      </span>
      <span style={{ position: "absolute", right: 18, bottom: 10, fontSize: 12.5, fontStyle: "italic", color: "var(--muted)" }}>
        新故事
      </span>
    </button>
  );
}

/* ================= Waveform —— §4.2：8 bars · 4px · talk(scaleY) ================= */

const BARS = [
  { h: 16, c: "var(--story)" },
  { h: 30, c: "var(--story)" },
  { h: 42, c: "var(--story)" },
  { h: 26, c: "var(--story)" },
  { h: 38, c: "var(--story)" },
  { h: 20, c: "var(--story)" },
  { h: 34, c: "var(--story)" },
  { h: 14, c: "var(--story)" },
];

export function Waveform({ active }: { active: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, height: 46 }} aria-hidden>
      {BARS.map((b, i) => (
        <span
          key={i}
          style={{
            display: "block",
            width: 4,
            height: b.h,
            borderRadius: 2,
            background: b.c,
            opacity: active ? 1 : 0.45,
            transformOrigin: "50% 50%",
            animation: active ? `talk 1.1s ease-in-out ${i * 0.12}s infinite` : "none",
            transition: "opacity 500ms ease",
          }}
        />
      ))}
    </div>
  );
}

/* ================= TypeText —— 逐字流出（理理理.md §4：20–40ms/字） ================= */

export function TypeText({
  text,
  speed = 28,
  onDone,
}: {
  text: string;
  speed?: number;
  onDone?: () => void;
}) {
  const [n, setN] = useState(0);
  const doneRef = useRef(false);

  useEffect(() => {
    setN(0);
    doneRef.current = false;
  }, [text]);

  useEffect(() => {
    if (n >= text.length) {
      if (!doneRef.current) {
        doneRef.current = true;
        onDone?.();
      }
      return;
    }
    const t = setTimeout(() => setN((v) => v + 1), speed);
    return () => clearTimeout(t);
  }, [n, text, speed, onDone]);

  return (
    <span>
      {text.slice(0, n)}
      {n < text.length && <span className="anim-blink" style={{ color: "var(--ink-blue)", fontWeight: 300 }}>|</span>}
    </span>
  );
}

/* ================= TypingIndicator —— §3.5：3×5px dots · think 1.3s ================= */

export function TypingIndicator({ speakerId }: { speakerId: FaceId }) {
  const c = characterById(speakerId);
  return (
    <div style={{ display: "flex", gap: 10, animation: "bubbleIn 300ms var(--ease-soft) both" }}>
      <ChatAvatar speakerId={speakerId} />
      <div>
        <span style={{ fontSize: 12, fontStyle: "italic", color: "var(--readable)" }}>{c.name}</span>
        <div
          style={{
            marginTop: 4,
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "14px 16px",
            borderRadius: "4px 16px 16px 16px",
            background: "var(--raised)",
            border: "none",
          }}
        >
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              style={{
                display: "block",
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: "var(--story)",
                animation: `think 1.3s ease-in-out ${i * 0.18}s infinite`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/** 聊天头像：34px 圆，field tint 底，裁脸（§3.5） */
export function ChatAvatar({ speakerId }: { speakerId: FaceId }) {
  const c = characterById(speakerId);
  return (
    <span
      style={{
        width: 34,
        height: 34,
        borderRadius: "50%",
        background: c.color,
        flexShrink: 0,
        overflow: "hidden",
        display: "block",
      }}
    >
      <CharacterFace id={speakerId} size={30} style={{ width: 34, height: 34, objectFit: "cover", objectPosition: "50% 12%" }} />
    </span>
  );
}

/* ================= Toast —— F5 占位提示 ================= */

export function Toast({ text, onDone }: { text: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2200);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div
      style={{
        position: "absolute",
        bottom: 44,
        left: "50%",
        transform: "translateX(-50%)",
        background: "var(--ink)",
        color: "var(--paper)",
        borderRadius: 26,
        padding: "11px 20px",
        fontSize: 13.5,
        fontStyle: "italic",
        boxShadow: "var(--shadow-print-review)",
        animation: "toastIn 300ms var(--ease-soft) both",
        whiteSpace: "nowrap",
        zIndex: 60,
      }}
    >
      {text}
    </div>
  );
}
