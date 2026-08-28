"use client";

import React, { useEffect, useState } from "react";
import { suggestTitle } from "@/lib/api";
import { longDate } from "@/lib/mock/titles";
import { MountedPrint } from "../ui";

/**
 * F3 — Keep this story（沙盘对话结束之后）
 * 确认标题/封面（系统生成，标题可改）+ 选择可见性：Private / Friends / Community。
 * 零必填，只有确认。无 companion 在场 —— 整理是用户自己的时刻（理理理.md §5）。
 */

const COVERS = ["sage", "blush", "lavender"];

const VISIBILITY_OPTIONS = [
  { id: "private" as const, label: "Private", hint: "only you can see it" },
  { id: "friends" as const, label: "Friends", hint: "people you let in" },
  { id: "community" as const, label: "Community", hint: "open for anyone" },
];

export default function F3Draft({
  transcript,
  onBack,
  onKeep,
}: {
  transcript: string;
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
  const [title, setTitle] = useState("");
  const [titleLoading, setTitleLoading] = useState(true);
  const [cover] = useState(() => COVERS[transcript.length % COVERS.length]); // 系统生成，不可选
  const [visibility, setVisibility] = useState<"private" | "friends" | "community">("private");

  // 进入即发起标题建议（理理理.md §8.2）；失败/超时 → placeholder，不阻塞
  useEffect(() => {
    let alive = true;
    const timeout = setTimeout(() => alive && setTitleLoading(false), 3200);
    suggestTitle(transcript)
      .then((t) => {
        if (!alive) return;
        setTitle(t);
        setTitleLoading(false);
      })
      .catch(() => alive && setTitleLoading(false))
      .finally(() => clearTimeout(timeout));
    return () => {
      alive = false;
      clearTimeout(timeout);
    };
  }, [transcript]);

  return (
    <div className="frame frame-enter">
      {/* nav */}
      <div className="nav-bar">
        <button className="nav-side back-chevron" onClick={onBack} aria-label="Back">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <span className="nav-title">A new story</span>
        <span style={{ minWidth: 44, textAlign: "right", fontSize: 14, fontStyle: "italic", color: "var(--placeholder)" }}>Draft</span>
      </div>

      {/* 封面：Review 裱卡，居中 */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 26, flexShrink: 0 }}>
        <MountedPrint variant="review" cover={cover} />
        <span className="meta-italic" style={{ marginTop: 12 }}>
          Made from what you said
        </span>
      </div>

      {/* 标题：系统建议，下划线可编辑 */}
      <div style={{ marginTop: 26, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 10, borderBottom: "1px solid var(--line-strong)", paddingBottom: 10 }}>
          {titleLoading ? (
            <div className="shimmer" style={{ height: 32, flex: 1, background: "rgba(159,195,212,0.25)" }} />
          ) : (
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Give it a title"
              maxLength={60}
              aria-label="Story title"
              style={{
                flex: 1,
                minWidth: 0,
                border: "none",
                background: "transparent",
                fontSize: 26,
                fontWeight: 400,
                lineHeight: 1.2,
                color: "var(--ink)",
                padding: 0,
              }}
            />
          )}
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#7FA9BE" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 7, flexShrink: 0 }} aria-hidden>
            <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3z" />
          </svg>
        </div>
        <div className="meta-italic" style={{ fontSize: 13, marginTop: 9 }}>
          {longDate(new Date())}
        </div>
      </div>

      {/* 可见性：想怎么 keep 这个故事 */}
      <div style={{ marginTop: 22, flexShrink: 0 }}>
        <span className="meta-italic">Who can walk through this room?</span>
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
                  border: selected ? "1.5px solid var(--accent)" : "1px solid var(--line)",
                  background: selected ? "rgba(37,137,176,0.08)" : "#FFFFFF",
                  boxShadow: selected ? "none" : "var(--shadow-card)",
                  transition: "all 250ms var(--ease-soft)",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 500, color: selected ? "var(--accent)" : "var(--ink)" }}>
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

      {/* In your words：转写回顾 */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          marginTop: 20,
          background: "var(--sunken)",
          borderRadius: 18,
          padding: "18px 20px",
          overflowY: "auto",
        }}
      >
        <span style={{ fontSize: 12, fontStyle: "italic", color: "var(--faint)" }}>In your words</span>
        <p style={{ margin: "9px 0 0", fontSize: 15.5, fontWeight: 300, lineHeight: 1.65, color: "var(--ink-2)" }}>
          {transcript}
        </p>
      </div>

      {/* Keep —— 零必填，始终可点（理理理.md §6 F3） */}
      <button
        onClick={() =>
          onKeep({
            title: title.trim() || "An Untitled Day",
            cover,
            reflection: "",
            transcript,
            date: longDate(new Date()),
            visibility,
          })
        }
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: 54,
          borderRadius: 27,
          background: "var(--accent)",
          boxShadow: "var(--shadow-button)",
          marginTop: 22,
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 17, fontWeight: 500, color: "var(--paper)" }}>Keep this story</span>
      </button>
    </div>
  );
}
