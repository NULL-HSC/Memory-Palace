"use client";

import React, { useEffect, useRef, useState } from "react";
import { CharacterFace, type FaceId } from "../characters";
import { characterById } from "@/lib/mock/characters";

/* ============ Mounted print —— handoff §3.1 核心物件 ============
   白卡 + 发丝边 + 非对称 padding（底边 ≈ 3× 侧边）→ 裱起来的照片感。
   封面始终 object-fit: cover（交付 ≥206×244，主体居中）。 */

const VARIANTS = {
  focused: { w: 230, h: 296, pad: "12px 12px 40px", shadow: "var(--shadow-print-focus)", border: "#E6E1D4" },
  mid: { w: 198, h: 255, pad: "10px 10px 34px", shadow: "var(--shadow-print-mid)", border: "#E6E1D4" },
  edge: { w: 166, h: 214, pad: "8px 8px 28px", shadow: "none", border: "#E4DFD2" },
  review: { w: 186, h: 240, pad: "10px 10px 34px", shadow: "var(--shadow-print-review)", border: "#E6E1D4" },
} as const;

export type PrintVariant = keyof typeof VARIANTS;

/** 占位封面（spec §5：hand-drawn stand-in，正式封面交付后替换；像素取自 mockup） */
export function CoverArt({ cover }: { cover: string }) {
  if (cover === "blush")
    return (
      <svg viewBox="0 0 178 211" preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} aria-hidden>
        <rect width="178" height="211" fill="#EFD9CB" />
        <circle cx="130" cy="50" r="21" fill="#DFBAA3" />
        <path d="M0 146 C34 120 68 133 96 146 C120 157 148 139 178 148 L178 211 L0 211 Z" fill="#E1C3AF" />
        <path d="M0 172 C40 152 80 172 118 166 C146 162 162 176 178 172 L178 211 L0 211 Z" fill="#D2AC93" />
      </svg>
    );
  if (cover === "lavender")
    return (
      <svg viewBox="0 0 150 178" preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} aria-hidden>
        <rect width="150" height="178" fill="#DCDFEC" />
        <circle cx="112" cy="42" r="15" fill="#EFEDE3" />
        <path d="M0 122 C30 100 58 111 82 122 C101 131 126 116 150 124 L150 178 L0 178 Z" fill="#C3C7D8" />
        <path d="M0 145 C35 128 68 145 100 140 C124 136 138 148 150 145 L150 178 L0 178 Z" fill="#B0B5C8" />
      </svg>
    );
  return (
    <svg viewBox="0 0 206 244" preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} aria-hidden>
      <rect width="206" height="244" fill="#D8E4CA" />
      <circle cx="50" cy="50" r="20" fill="#EFE6BE" />
      <path d="M0 160 C41 128 82 144 118 160 C143 171 172 152 206 163 L206 244 L0 244 Z" fill="#BFD0AE" />
      <path d="M130 210 L130 178" stroke="#8FA37F" strokeWidth="3.6" strokeLinecap="round" />
      <circle cx="130" cy="170" r="16" fill="#9DB389" />
      <circle cx="115" cy="182" r="11" fill="#ADC29A" />
      <circle cx="146" cy="183" r="10" fill="#ADC29A" />
      <path d="M0 199 C47 176 93 199 137 192 C169 187 187 202 206 199 L206 244 L0 244 Z" fill="#A9BF95" />
    </svg>
  );
}

export function MountedPrint({
  variant = "mid",
  cover,
  checked,
  style,
  onClick,
}: {
  variant?: PrintVariant;
  cover?: string;
  checked?: boolean;
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
        background: "#FFFFFF",
        border: `1px solid ${v.border}`,
        borderRadius: 16,
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
          borderRadius: 11,
        }}
      >
        <CoverArt cover={cover ?? "sage"} />
      </span>
      {checked && (
        <span
          style={{
            position: "absolute",
            right: 12,
            bottom: 10,
            width: 24,
            height: 24,
            borderRadius: "50%",
            background: "#EDE7D6",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#A99873" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M4 13l5 5L20 6" />
          </svg>
        </span>
      )}
    </button>
  );
}

/** 空白 mount（扇形 −2 槽位 / 空态占位） */
export function BlankMount({ style }: { style?: React.CSSProperties }) {
  return (
    <div
      style={{
        width: VARIANTS.edge.w,
        height: VARIANTS.edge.h,
        background: "#F1EEE5",
        border: "1px solid #E4DFD2",
        borderRadius: 16,
        ...style,
      }}
    />
  );
}

/** New-story 槽位（§3.3）：mid mount + 虚线内芯 + 右对齐 accent 圆加号 + 底 mat caption */
export function NewStorySlot({ style, onClick }: { style?: React.CSSProperties; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="New story"
      style={{
        width: VARIANTS.mid.w,
        height: VARIANTS.mid.h,
        background: "#FFFFFF",
        border: "1px solid #E6E1D4",
        padding: "10px 10px 34px",
        boxShadow: "0 6px 16px rgba(60,54,40,0.10)",
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
            background: "var(--accent)",
            boxShadow: "0 4px 10px rgba(60,54,40,0.2)",
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FAF8F3" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
            <path d="M12 5v14M5 12h14" />
          </svg>
        </span>
      </span>
      <span style={{ position: "absolute", right: 18, bottom: 10, fontSize: 12.5, fontStyle: "italic", color: "var(--muted)" }}>
        New story
      </span>
    </button>
  );
}

/* ================= Waveform —— §4.2：8 bars · 4px · talk(scaleY) ================= */

const BARS = [
  { h: 16, c: "#C6C0AE" },
  { h: 30, c: "#AEB79E" },
  { h: 42, c: "#8FA37F" },
  { h: 26, c: "#AEB79E" },
  { h: 38, c: "#8FA37F" },
  { h: 20, c: "#C6C0AE" },
  { h: 34, c: "#AEB79E" },
  { h: 14, c: "#C6C0AE" },
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
      {n < text.length && <span className="anim-blink" style={{ color: "#8FA37F", fontWeight: 300 }}>|</span>}
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
            background: "#FFFFFF",
            border: "1px solid #EAE5D8",
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
                background: "#A9A292",
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
