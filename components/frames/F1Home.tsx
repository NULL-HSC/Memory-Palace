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
  enterClass = "frame-enter-left",
}: {
  onOpenSandplay: (storyId: string) => void;
  onNewStory: () => void;
  onVisitSpaces: () => void;
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
    <div className={`frame ${enterClass}`} style={{ padding: "var(--screen-top) 0 0" }}>
      {/* header（加大一号，层级提上来） */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "0 var(--screen-x)" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
          <span style={{ fontSize: 23, fontWeight: 500 }}>My Stories</span>
          <span className="count-pill" style={{ fontSize: 13, padding: "2px 10px" }}>
            {stories.length}
          </span>
        </div>
        <button onClick={onVisitSpaces} className="nav-side" style={{ justifyContent: "flex-end", marginRight: -12 }}>
          <span style={{ fontSize: 14.5, fontStyle: "italic", color: "var(--muted)", borderBottom: "1px solid #A9D4E2", paddingBottom: 2 }}>
            Visit other spaces
          </span>
        </button>
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
          <button
            onClick={onNewStory}
            className="dashed"
            style={{
              position: "absolute",
              left: "50%",
              top: "38%",
              transform: "translate(-50%, -50%)",
              width: 198,
              height: 255,
              background: "var(--slot-fill)",
              display: "grid",
              placeItems: "center",
              color: "var(--muted)",
              fontStyle: "italic",
              fontSize: 13.5,
            }}
          >
            your first story
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
                {/* 前置卡：缓慢浮动 + 更深投影，选中态突出 */}
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

      {/* ══ 底 band：Create 入口（加大），Pico 站在右下角 ══ */}
      <div style={{ position: "relative", padding: "0 var(--screen-x) 34px", display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <button
          onClick={onNewStory}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            height: 56,
            padding: "0 24px",
            borderRadius: 28,
            background: "var(--accent)",
            boxShadow: "var(--shadow-button)",
          }}
        >
          <span style={{ fontSize: 17, fontWeight: 500, color: "var(--paper)" }}>Create the sandplay</span>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 12h13M12 5l7 7-7 7" />
          </svg>
        </button>

      </div>

      {/* companion：站在屏幕最底、身体微微叠进 Gallery（后续换视频/动态人物也用这个悬浮位） */}
      <button
        onClick={onNewStory}
        aria-label="Talk to Pico"
        style={{ position: "absolute", right: 6, bottom: 6, lineHeight: 0, zIndex: 120 }}
      >
        <span
          aria-hidden
          style={{
            position: "absolute",
            left: "50%",
            bottom: -2,
            transform: "translateX(-50%)",
            width: 120,
            height: 22,
            borderRadius: "50%",
            background: "rgba(23,60,84,0.10)",
            filter: "blur(4px)",
          }}
        />
        <Companion size={150} className="anim-bob" />
      </button>
    </div>
  );
}
