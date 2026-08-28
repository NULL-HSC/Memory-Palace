"use client";

import React, { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { MountedPrint, BlankMount } from "../ui";
import { Companion } from "../characters";

/**
 * F1 — My Space（v3 · 手机手感 + 温馨化修订）
 * - 拖拽丝滑化：滑动期间直接写 DOM transform（rAF 节流，不走 React 渲染），
 *   松手才吸附并提交状态；卡片 will-change: transform
 * - 温馨化：卡片圆角、扇形后方暖色氛围光、层级重排（标题/CTA 加大）
 * - 交互不变：拖/滑翻牌，点侧卡到最前，点前置卡进沙盘，Create / Pico 开新故事
 */

const STEP = 96;
const FAN_TRANSITION = "transform 380ms cubic-bezier(0.32, 0.72, 0.32, 1), opacity 380ms cubic-bezier(0.32, 0.72, 0.32, 1)";

function fan(d: number) {
  const ad = Math.abs(d);
  const scale = d === 0 ? 1.16 : 0.88 - Math.min(ad * 0.05, 0.26);
  return {
    transform: `translate(-50%, -50%) translateX(${d * STEP}px) translateY(${ad * 13}px) rotate(${d * 5.5}deg) scale(${scale})`,
    opacity: Math.max(1 - ad * 0.15, 0),
    zIndex: 100 - Math.round(ad * 10),
    visible: ad <= 3.4,
  };
}

export default function F1Home({
  onOpenSandplay,
  onNewStory,
  onVisitSpaces,
  onLogout,
  enterClass = "frame-enter-left",
}: {
  onOpenSandplay: (storyId: string) => void;
  onNewStory: () => void;
  onVisitSpaces: () => void;
  onLogout?: () => void;
  enterClass?: string;
}) {
  const { stories } = useStore();
  const [front, setFront] = useState(0); // 只在吸附/点按时变化 → 标题联动
  const story = stories[front];
  const maxOffset = Math.max(stories.length - 1, 0);

  const offsetRef = useRef(0);
  const dragRef = useRef({ startX: 0, startOffset: 0, moved: 0, active: false, tapIdx: null as number | null });
  const rafRef = useRef(0);
  const cardRefs = useRef(new Map<string, HTMLDivElement>());
  const blankRef = useRef<HTMLDivElement>(null);

  /* 直接写 DOM：滑动帧不经过 React */
  const applyFan = (off: number, animate: boolean) => {
    stories.forEach((s, i) => {
      const el = cardRefs.current.get(s.id);
      if (!el) return;
      const t = fan(i - off);
      el.style.transition = animate ? FAN_TRANSITION : "none";
      el.style.transform = t.transform;
      el.style.opacity = String(t.opacity);
      el.style.zIndex = String(t.zIndex);
      el.style.visibility = t.visible ? "visible" : "hidden";
    });
    const blank = blankRef.current;
    if (blank) {
      const t = fan(stories.length - off);
      blank.style.transition = animate ? FAN_TRANSITION : "none";
      blank.style.transform = t.transform;
      blank.style.opacity = String(t.opacity);
      blank.style.zIndex = String(t.zIndex);
      blank.style.visibility = t.visible ? "visible" : "hidden";
    }
  };

  /* stories 变化（新故事飞入）后重排一次 */
  useEffect(() => {
    offsetRef.current = Math.min(offsetRef.current, maxOffset);
    applyFan(offsetRef.current, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stories.length]);

  const scheduleApply = () => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => applyFan(offsetRef.current, false));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    // 记录按下的卡:容器 setPointerCapture 会把 click 重定向到容器,
    // 卡片 onClick 永远收不到 → 点按改在 pointerUp 里按 tapIdx 分发
    const cardEl = (e.target as HTMLElement).closest("[data-card-idx]");
    dragRef.current = {
      startX: e.clientX,
      startOffset: offsetRef.current,
      moved: 0,
      active: true,
      tapIdx: cardEl ? Number(cardEl.getAttribute("data-card-idx")) : null,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.startX;
    dragRef.current.moved = Math.abs(dx);
    offsetRef.current = Math.min(Math.max(dragRef.current.startOffset - dx / STEP, 0), maxOffset);
    scheduleApply();
  };
  const snapTo = (idx: number) => {
    const clamped = Math.min(Math.max(idx, 0), maxOffset);
    offsetRef.current = clamped;
    applyFan(clamped, true);
    setFront(clamped);
  };
  const onPointerUp = () => {
    if (!dragRef.current.active) return;
    dragRef.current.active = false;
    if (dragRef.current.moved <= 8 && dragRef.current.tapIdx != null) {
      handleCardTap(dragRef.current.tapIdx); // 点按:侧卡吸附 / 前置卡进沙盘
      return;
    }
    snapTo(Math.round(offsetRef.current));
  };

  const handleCardTap = (idx: number) => {
    if (dragRef.current.moved > 8) return; // 拖拽后的抬手不算点按
    if (idx === front && story) onOpenSandplay(story.id);
    else snapTo(idx);
  };

  return (
    <div className={`frame ${enterClass}`} style={{ padding: 0, overflow: "hidden" }}>
      {/* ══ 顶部:雾蓝扇贝波浪布带 + 虚线车缝(示意图结构) ══ */}
      <svg aria-hidden viewBox="0 0 390 106" preserveAspectRatio="none" style={{ position: "absolute", top: 0, left: 0, width: "100%", height: 106, pointerEvents: "none" }}>
        <path d="M0 0 H390 V52 Q365.6 76 341.25 52 Q316.9 76 292.5 52 Q268.1 76 243.75 52 Q219.4 76 195 52 Q170.6 76 146.25 52 Q121.9 76 97.5 52 Q73.1 76 48.75 52 Q24.4 76 0 52 Z" fill="#D9EEF4" />
        <path d="M390 44 Q365.6 68 341.25 44 Q316.9 68 292.5 44 Q268.1 68 243.75 44 Q219.4 68 195 44 Q170.6 68 146.25 44 Q121.9 68 97.5 44 Q73.1 68 48.75 44 Q24.4 68 0 44" fill="none" stroke="#2F9FC8" strokeOpacity="0.4" strokeWidth="1.3" strokeDasharray="5 6" strokeLinecap="round" />
      </svg>

      {/* header:布标签上的标题(示意图:My stories 挂在标签牌上) */}
      <div style={{ position: "relative", zIndex: 10, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "var(--screen-top) var(--screen-x) 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <span
            style={{
              display: "inline-block",
              background: "#2F9FC8",
              color: "#FFFFFF",
              fontSize: 17,
              fontWeight: 500,
              padding: "5px 16px 6px",
              borderRadius: 9,
              transform: "rotate(-2deg)",
              boxShadow: "0 3px 8px rgba(23,60,84,0.16)",
            }}
          >
            My Stories
          </span>
          <span className="count-pill" style={{ fontSize: 13, padding: "2px 10px" }}>
            {stories.length}
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, marginRight: -12 }}>
          <button onClick={onVisitSpaces} className="nav-side" style={{ justifyContent: "flex-end" }}>
            <span style={{ fontSize: 14.5, fontStyle: "italic", color: "var(--readable)", borderBottom: "1px solid #A9D4E2", paddingBottom: 2 }}>
              Visit other spaces
            </span>
          </button>
          {onLogout && (
            <button
              onClick={onLogout}
              style={{ padding: "2px 12px 4px 12px", fontSize: 11.5, fontStyle: "italic", color: "var(--placeholder)" }}
            >
              sign out
            </button>
          )}
        </div>
      </div>

      {/* ══ Gallery：纵深扇形 + 暖色氛围光 ══ */}
      <div
        style={{ position: "relative", flex: 1, minHeight: 0, touchAction: "pan-y", cursor: "grab" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* 氛围光：温暖、极低对比，永不抢注意力 */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: "8% -20%",
            background: "radial-gradient(ellipse at 50% 42%, rgba(142,212,232,0.30) 0%, rgba(217,238,244,0.20) 45%, transparent 70%)",
            pointerEvents: "none",
          }}
        />
        {stories.length === 0 ? (
          /* 空态:格子布纹内芯的拍立得槽 + 奶油黄大圆 +(示意图手法) */
          <button
            onClick={onNewStory}
            style={{
              position: "absolute",
              left: "50%",
              top: "38%",
              transform: "translate(-50%, -50%) rotate(-1.5deg)",
              width: 198,
              height: 255,
              background: "#FFFFFF",
              border: "1px solid #D9EEF4",
              borderRadius: 12,
              padding: "10px 10px 34px",
              boxShadow: "0 6px 16px rgba(23,60,84,0.10)",
            }}
          >
            <span
              style={{
                display: "grid",
                placeItems: "center",
                width: "100%",
                height: "100%",
                borderRadius: 6,
                border: "1.5px dashed var(--slot-border)",
                background:
                  "repeating-linear-gradient(0deg, rgba(142,212,232,0.22) 0 8px, transparent 8px 16px), repeating-linear-gradient(90deg, rgba(142,212,232,0.22) 0 8px, transparent 8px 16px), #EDF7FA",
              }}
            >
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  background: "#FFD86A",
                  boxShadow: "0 6px 14px rgba(23,60,84,0.18)",
                }}
              >
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#2F9FC8" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </span>
            </span>
            <span style={{ position: "absolute", left: 0, right: 0, bottom: 9, textAlign: "center", fontSize: 12.5, fontStyle: "italic", color: "var(--muted)" }}>
              your first story
            </span>
          </button>
        ) : (
          stories.map((s, i) => {
            const t = fan(i - offsetRef.current);
            return (
              <div
                key={s.id}
                data-card-idx={i}
                ref={(el) => {
                  if (el) cardRefs.current.set(s.id, el);
                  else cardRefs.current.delete(s.id);
                }}
                onClick={() => handleCardTap(i)}
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "38%",
                  transform: t.transform,
                  opacity: t.opacity,
                  zIndex: t.zIndex,
                  visibility: t.visible ? "visible" : "hidden",
                  willChange: "transform",
                }}
              >
                {/* 前置卡:挂绳小夹子(示意图手法)+ 缓慢浮动 + 更深投影 */}
                {i === front && (
                  <>
                    {[72, 158].map((x) => (
                      <span key={x} aria-hidden style={{ position: "absolute", left: x, top: -46, width: 0, zIndex: 2, pointerEvents: "none" }}>
                        <span style={{ display: "block", width: 1.5, height: 34, margin: "0 auto", background: "linear-gradient(#A9D4E2, #7FA9BE)" }} />
                        <span
                          style={{
                            display: "block",
                            width: 13,
                            height: 19,
                            margin: "0 auto",
                            borderRadius: 4,
                            background: "#FFD86A",
                            boxShadow: "0 2px 4px rgba(23,60,84,0.20)",
                            position: "relative",
                          }}
                        >
                          <span style={{ position: "absolute", left: 5.2, top: 2, bottom: 2, width: 1.6, background: "rgba(23,60,84,0.22)", borderRadius: 1 }} />
                        </span>
                      </span>
                    ))}
                  </>
                )}
                <div
                  className={i === front ? "anim-float" : undefined}
                  style={i === front ? { filter: "drop-shadow(0 22px 32px rgba(23,60,84,0.20))" } : undefined}
                >
                  <MountedPrint variant="focused" cover={s.cover} checked={i === front} />
                </div>
              </div>
            );
          })
        )}
        {stories.length > 0 && (
          <div
            ref={blankRef}
            aria-hidden
            style={{
              position: "absolute",
              left: "50%",
              top: "38%",
              ...(() => {
                const t = fan(stories.length - offsetRef.current);
                return { transform: t.transform, opacity: t.opacity, zIndex: t.zIndex, visibility: t.visible ? ("visible" as const) : ("hidden" as const) };
              })(),
            }}
          >
            <BlankMount />
          </div>
        )}

        {/* 标题 + 日期：前置卡正下方，与卡一体 */}
        {story && (
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "calc(38% + 205px)",
              transform: "translateX(-50%)",
              width: 330,
              textAlign: "center",
              pointerEvents: "none",
            }}
          >
            {/* 动画放内层：bubbleIn 会覆写 transform，不能和定位 translate 同层 */}
            <div key={story.id} style={{ animation: "bubbleIn 360ms var(--ease-fan) both" }}>
              <div style={{ fontSize: 25, fontWeight: 400, lineHeight: 1.2 }}>{story.title}</div>
              <div className="meta-italic" style={{ fontSize: 13, marginTop: 6 }}>
                {story.date}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ══ 底部:波浪地面(示意图)—— companion 脚踩地面,Create 是奶油黄大圆 + ══ */}
      <svg aria-hidden viewBox="0 0 390 96" preserveAspectRatio="none" style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: 96, pointerEvents: "none" }}>
        <path d="M0 96 V44 Q48 24 97 40 T195 38 T293 42 T390 34 V96 Z" fill="#D9EEF4" />
        <path d="M0 53 Q48 33 97 49 T195 47 T293 51 T390 43" fill="none" stroke="#FFFFFF" strokeOpacity="0.85" strokeWidth="1.4" strokeDasharray="5 6" strokeLinecap="round" />
      </svg>

      {/* Create:奶油黄圆 + 号(示意图 CTA) */}
      <div style={{ position: "absolute", left: "var(--screen-x)", bottom: 26, zIndex: 110, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        <button
          onClick={onNewStory}
          aria-label="Create the sandplay"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 58,
            height: 58,
            borderRadius: "50%",
            background: "#FFD86A",
            boxShadow: "0 6px 16px rgba(23,60,84,0.20), inset 0 2px 0 rgba(255,255,255,0.5)",
            transition: "transform 160ms var(--ease-soft)",
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2F9FC8" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
        <span style={{ fontSize: 12, fontStyle: "italic", color: "var(--readable)" }}>new sandplay</span>
      </div>

      {/* companion:脚踩波浪地面,站在右下角 */}
      <button
        onClick={onNewStory}
        aria-label="Talk to Pico"
        style={{ position: "absolute", right: 8, bottom: 16, lineHeight: 0, zIndex: 120 }}
      >
        <span
          aria-hidden
          style={{
            position: "absolute",
            left: "50%",
            bottom: 0,
            transform: "translateX(-50%)",
            width: 116,
            height: 20,
            borderRadius: "50%",
            background: "rgba(23,60,84,0.12)",
            filter: "blur(4px)",
          }}
        />
        <Companion size={138} className="anim-bob" />
      </button>
    </div>
  );
}
