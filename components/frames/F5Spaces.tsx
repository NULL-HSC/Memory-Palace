"use client";

import React, { useState } from "react";
import { CHARACTERS } from "@/lib/mock/characters";
import { CharacterFace, type FaceId } from "../characters";
import { Toast } from "../ui";

/**
 * F5 — Other spaces（handoff §4.5，像素对齐 05-other-spaces.html）
 * 2 列 white mount 卡片：128px tinted field + 底对齐角色 + 名字。
 * 计数徽标按 理理理.md v3 决策移除（低保真占位，不属于产品概念）。
 * 进入房间本期不做 —— toast 占位。
 */

const HANDOFF_ORDER: FaceId[] = ["mira", "renn", "tola", "sena", "ivo", "pico"];

export default function F5Spaces({ onBack }: { onBack: () => void }) {
  const [toast, setToast] = useState<string | null>(null);

  return (
    <div className="frame frame-enter">
      <div className="nav-bar">
        <button className="nav-side back-chevron" onClick={onBack} aria-label="Back">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <span className="nav-title">Other spaces</span>
        <span style={{ width: 44 }} />
      </div>

      <span className="meta-italic" style={{ fontSize: 14, marginTop: 14 }}>
        Rooms left open for anyone to walk through.
      </span>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 14,
          marginTop: 22,
          overflowY: "auto",
          paddingBottom: 8,
        }}
      >
        {HANDOFF_ORDER.map((id) => {
          const c = CHARACTERS.find((x) => x.id === id)!;
          return (
            <button
              key={id}
              onClick={() => setToast(`${c.name}'s room is still being tidied — check back soon.`)}
              style={{
                background: "var(--raised)",
                border: "1px solid var(--line)",
                padding: "8px 8px 14px",
                boxShadow: "var(--shadow-card)",
                textAlign: "left",
              }}
            >
              <span
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "center",
                  height: 128,
                  background: c.color,
                  overflow: "hidden",
                }}
              >
                <CharacterFace id={id} size={104} style={{ height: 118 }} />
              </span>
              <span style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 9, padding: "0 3px" }}>
                <span style={{ fontSize: 14.5, fontWeight: 400 }}>{c.name}</span>
                <span style={{ fontSize: 11.5, fontStyle: "italic", color: "var(--faint)" }}>the {c.species}</span>
              </span>
            </button>
          );
        })}
      </div>

      {toast && <Toast text={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
