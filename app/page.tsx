"use client";

import React, { useEffect, useState } from "react";
import { StoreProvider, useStore } from "@/lib/store";
import type { Story } from "@/lib/types";
import F1Home from "@/components/frames/F1Home";
import F2Listening from "@/components/frames/F2Listening";
import F3Draft from "@/components/frames/F3Draft";
import F4Sandplay from "@/components/frames/F4Sandplay";
import F5Spaces from "@/components/frames/F5Spaces";
import { Companion } from "@/components/characters";
import { MOCK_TRANSCRIPT } from "@/lib/mock/transcript";

/**
 * 单页帧状态机（理理理.md §2 主循环 + §7 转场规格）
 * 新故事：F1 Home → F2 Listening → F4 Sandplay（草稿先行）→ F3 Keep 页 → 入长廊回 Home；F1 ↔ F5
 * T1: companion 从角落跳到画面中央
 */

type Frame = "home" | "listening" | "draft" | "sandplay" | "spaces";
type Overlay = "t1" | null;

function Shell() {
  const { stories, addStory } = useStore();
  const [frame, setFrame] = useState<Frame>("home");
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [overlayGo, setOverlayGo] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [activeStoryId, setActiveStoryId] = useState<string | null>(null);
  const [pending, setPending] = useState<Story | null>(null); // 未 Keep 的草稿故事
  const [homeEnter, setHomeEnter] = useState<"frame-enter-left" | "frame-enter">("frame-enter-left");

  /* 转场两段式：挂载后触发位移，结束后切帧（目前仅 T1 使用） */
  useEffect(() => {
    if (!overlay) return;
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setOverlayGo(true)));
    const t = setTimeout(() => {
      if (overlay === "t1") setFrame("listening");
      setOverlay(null);
      setOverlayGo(false);
    }, 520);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [overlay]);

  /* 调试/演示捷径：?frame=listening|draft|sandplay|spaces 直达任意帧 */
  useEffect(() => {
    const f = new URLSearchParams(window.location.search).get("frame");
    if (!f) return;
    if (f === "draft") setTranscript(MOCK_TRANSCRIPT);
    if (f !== "home") setFrame(f as Frame);
  }, []);

  /* T1 · Home → Listening：点 companion / "+" */
  const startNewStory = () => {
    setOverlay("t1");
    setOverlayGo(false);
  };

  /* T2 收尾：F2 Done → 直接进沙盘对话（Keep 挪到沙盘结束之后） */
  const handleListened = (text: string) => {
    setTranscript(text);
    setPending({
      id: "pending",
      title: "",
      date: "",
      cover: "sage",
      transcript: text,
      createdAt: Date.now(),
    });
    setFrame("sandplay");
  };

  /* 沙盘结束 → Keep 页确认（标题/封面/可见性）→ 入长廊回 Home */
  const handleKeep = (draft: {
    title: string;
    cover: string;
    reflection: string;
    transcript: string;
    date: string;
    visibility: "private" | "friends" | "community";
  }) => {
    addStory(draft);
    setPending(null);
    backHome();
  };

  /** Keep 页放弃 → 丢弃草稿回 Home */
  const discardPending = () => {
    setPending(null);
    backHome();
  };

  const backHome = () => {
    setHomeEnter("frame-enter-left");
    setFrame("home");
  };

  const activeStory = stories.find((s) => s.id === activeStoryId) ?? stories[0];

  return (
    <div className="app-shell">
      {frame === "home" && (
        <F1Home
          enterClass={homeEnter}
          onOpenSandplay={(id) => {
            setActiveStoryId(id);
            setFrame("sandplay");
          }}
          onNewStory={startNewStory}
          onVisitSpaces={() => setFrame("spaces")}
        />
      )}
      {frame === "listening" && <F2Listening onBack={backHome} onDone={handleListened} />}
      {frame === "draft" && <F3Draft transcript={transcript} onBack={discardPending} onKeep={handleKeep} />}
      {frame === "sandplay" && (pending || activeStory) && (
        <F4Sandplay
          story={(pending ?? activeStory)!}
          onBack={pending ? () => setFrame("draft") : backHome}
          onKeep={pending ? () => setFrame("draft") : undefined}
        />
      )}
      {frame === "spaces" && <F5Spaces onBack={backHome} />}

      {/* T1 overlay：companion 跳到画面中央 */}
      {overlay === "t1" && (
        <div style={{ position: "absolute", inset: 0, zIndex: 50, pointerEvents: "none", background: "var(--bg-cream)" }}>
          <div
            style={{
              position: "absolute",
              left: overlayGo ? "50%" : "calc(100% - 120px)",
              top: overlayGo ? "40%" : "calc(100% - 132px)",
              transform: overlayGo ? "translate(-50%, -50%) scale(1.18)" : "translate(0, 0) scale(1)",
              transition: "left 460ms var(--ease-soft), top 460ms var(--ease-soft), transform 460ms var(--ease-soft)",
            }}
          >
            <Companion size={96} />
          </div>
        </div>
      )}

    </div>
  );
}

export default function Page() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
