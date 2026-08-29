"use client";

import React, { useState } from "react";
import { longDate } from "@/lib/mock/titles";
import { MountedPrint } from "../ui";

/**
 * F3 — 存下这个故事（沙盘对话结束之后）
 * 确认标题/封面（系统生成，标题可改）+ 选择可见性：Private / Friends / Community。
 * 零必填，只有确认。无 companion 在场 —— 整理是用户自己的时刻（理理理.md §5）。
 */

const COVERS = ["sage", "blush", "lavender"];

const VISIBILITY_OPTIONS = [
  { id: "private" as const, label: "仅自己", hint: "只有你能看见" },
  { id: "friends" as const, label: "朋友", hint: "你允许的人" },
  { id: "community" as const, label: "公开", hint: "所有人都能进来" },
];

export default function F3Draft({
  transcript,
  title,
  onBack,
  onKeep,
}: {
  transcript: string;
  title: string;
  onBack: () => void;
  onKeep: (draft: {
    title: string;
    cover: string;
    reflection: string;
    transcript: string;
    date: string;
    visibility: "private" | "friends" | "community";
  }) => void;
}) {
  const [cover] = useState(() => COVERS[transcript.length % COVERS.length]); // 系统生成，不可选
  const [visibility, setVisibility] = useState<"private" | "friends" | "community">("private");

  return (
    <div className="frame frame-enter">
      {/* nav */}
      <div className="nav-bar">
        <button className="nav-side back-chevron" onClick={onBack} aria-label="Back">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <span className="nav-title">新故事</span>
        <span className="nav-side" />
      </div>

      {/* 封面：Review 裱卡，居中 */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 26, flexShrink: 0 }}>
        <MountedPrint variant="review" cover={cover} />
        <span className="meta-italic" style={{ marginTop: 12 }}>
          由你说的话生成
        </span>
      </div>

      {/* 标题由后端生成，只读展示 */}
      <div style={{ marginTop: 26, flexShrink: 0 }}>
        <div style={{ borderBottom: "1px solid var(--line-strong)", paddingBottom: 10 }}>
          <span
            style={{
              display: "block",
              minWidth: 0,
              fontSize: 26,
              fontWeight: 400,
              lineHeight: 1.2,
              color: "var(--ink)",
              overflowWrap: "anywhere",
            }}
          >
            {title}
          </span>
        </div>
        <div className="meta-italic" style={{ fontSize: 13, marginTop: 9 }}>
          {longDate(new Date())}
        </div>
      </div>

      {/* 可见性：想怎么 keep 这个故事 */}
      <div style={{ marginTop: 22, flexShrink: 0 }}>
        <span className="meta-italic">谁能走进这个房间?</span>
        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
          {VISIBILITY_OPTIONS.map((opt) => {
            const selected = visibility === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => setVisibility(opt.id)}
                style={{
                  flex: 1,
                  padding: "12px 6px 10px",
                  borderRadius: 16,
                  border: "none",
                  background: selected ? "var(--butter)" : "var(--raised)",
                  boxShadow: selected ? "0 3px 0 var(--butter-under)" : "var(--shadow-card)",
                  transition: "all 250ms var(--ease-soft)",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 15, fontWeight: selected ? 700 : 500, color: "var(--ink)" }}>
                  {opt.label}
                </div>
                <div style={{ fontSize: 11, fontStyle: "italic", color: "var(--readable)", marginTop: 3 }}>
                  {opt.hint}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* (2026-08-29 产品确认:储存页不再展示「你的原话」转写回顾;transcript 仍随 onKeep 保存) */}
      <div style={{ flex: 1, minHeight: 0 }} />

      {/* Keep —— 零必填，始终可点（理理理.md §6 F3） */}
      <button
        onClick={() =>
          onKeep({
            title,
            cover,
            reflection: "",
            transcript,
            date: longDate(new Date()),
            visibility,
          })
        }
        className="btn"
        style={{ width: "100%", marginTop: 22, flexShrink: 0 }}
      >
        <span>存下这个故事</span>
      </button>
    </div>
  );
}
