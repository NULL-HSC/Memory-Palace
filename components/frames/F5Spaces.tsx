"use client";

import React, { useState } from "react";
import { COMMUNITY_MEMBERS, COMMUNITY_STORIES, memberById, storiesByMember } from "@/lib/mock/community";
import { characterById } from "@/lib/mock/characters";
import type { CommunityMember, CommunityStory } from "@/lib/types";
import { CharacterFace } from "../characters";
import { CoverArt } from "../ui";

/**
 * F5 — 别人的空间(2026-08-29 改版:Community + Friends)
 * - Community 信息流:卡片 = 对方的角色 + TA 公开的故事(封面/标题/摘录/留言数)
 * - Friends:朋友列表 → 点进朋友的空间(角色 + TA 的故事列表)
 * - 两个 tab 下点故事卡片都进只读详情(onOpenStory 交给帧状态机)
 * 数据全部来自 lib/mock/community.ts;后端就绪后只换数据源,组件结构不变。
 */

type Tab = "community" | "friends";

/** 角色圆头像:奶白钥匙圈描边,读作「贴在纸上的乙烯贴纸」(guideline §2) */
function MemberAvatar({ member, size = 40 }: { member: CommunityMember; size?: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: characterById(member.characterId).color,
        flexShrink: 0,
        overflow: "hidden",
        display: "block",
        border: "2px solid var(--cream)",
        boxShadow: "var(--lift-1)",
      }}
    >
      <CharacterFace
        id={member.characterId}
        size={size - 4}
        style={{ width: size, height: size, objectFit: "cover", objectPosition: "50% 12%" }}
      />
    </span>
  );
}

/** 闪耀小笔触(材料表:2–3 根蓝色短划,标记「新的/可点的」,每屏最多 2 簇) */
function Sparkles({ style }: { style?: React.CSSProperties }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" style={style} aria-hidden>
      <path d="M12 2.5v5M12 16.5v5M2.5 12h5M16.5 12h5" stroke="var(--story)" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M18.5 4.5v3M17 6h3" stroke="var(--story)" strokeWidth="1.6" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

/** 和纸胶带(材料表:奶油黄油半透明条 62×22,永远斜 5–10°、永远在角上,每屏最多一条) */
function WashiTape({ style }: { style?: React.CSSProperties }) {
  return (
    <span
      aria-hidden
      style={{
        position: "absolute",
        width: 62,
        height: 22,
        background: "rgba(255,216,106,0.85)",
        boxShadow: "0 1px 3px rgba(15,45,66,0.14)",
        transform: "rotate(-7deg)",
        ...style,
      }}
    />
  );
}

/** 照片凹槽内阴影(kit polaroid__photo::after 同款:让封面读作「裱进框里的真照片」) */
const PHOTO_INSET = "inset 0 3px 10px rgba(15,45,66,0.16), inset 0 -2px 4px rgba(15,45,66,0.06)";

/** 社区信息流里的一张故事卡 —— 按主视觉 polaroid 配方:r-panel 圆角 + lift-2 投影 + 照片凹槽 + 微斜钉上墙 */
function StoryCard({ story, index, onOpen }: { story: CommunityStory; index: number; onOpen: () => void }) {
  const owner = memberById(story.ownerId);
  return (
    <button
      onClick={onOpen}
      style={{
        position: "relative",
        background: "var(--raised)",
        borderRadius: "var(--r-panel)",
        padding: "12px 12px 14px",
        boxShadow: "var(--lift-2)",
        textAlign: "left",
        transform: `rotate(${index % 2 === 0 ? -1.1 : 1}deg)`,
      }}
    >
      {/* 第一张卡贴一条和纸胶带(每屏一条,贴在左上角) */}
      {index === 0 && <WashiTape style={{ top: -10, left: 20 }} />}
      <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <MemberAvatar member={owner} />
        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={{ display: "block", fontSize: 14, fontWeight: 700 }}>{owner.name}</span>
          <span className="meta-italic" style={{ display: "block", fontSize: 11.5, marginTop: 1 }}>
            和 TA 的{characterById(owner.characterId).name} · {story.date}
          </span>
        </span>
        {/* 前两张卡的角上来一簇小笔触(每屏 ≤2 簇) */}
        {index < 2 && story.comments.length > 0 && <Sparkles style={{ flexShrink: 0, opacity: 0.8 }} />}
      </span>
      <span
        style={{
          position: "relative",
          display: "block",
          height: 108,
          borderRadius: "var(--r-photo)",
          overflow: "hidden",
          marginTop: 10,
        }}
      >
        <CoverArt cover={story.cover} />
        <span aria-hidden style={{ position: "absolute", inset: 0, boxShadow: PHOTO_INSET, pointerEvents: "none" }} />
      </span>
      <span style={{ display: "block", fontFamily: "var(--font-hand)", fontSize: 18, fontWeight: 600, color: "var(--ink-blue)", marginTop: 10 }}>
        {story.title}
      </span>
      <span
        style={{
          display: "-webkit-box",
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: 2,
          overflow: "hidden",
          fontSize: 13.5,
          lineHeight: 1.7,
          marginTop: 4,
        }}
      >
        {story.excerpt}
      </span>
      <span className="meta-italic" style={{ display: "block", fontSize: 11.5, marginTop: 8, color: "var(--faint)" }}>
        留言 · {story.comments.length}
      </span>
    </button>
  );
}

export default function F5Spaces({
  onBack,
  onOpenStory,
}: {
  onBack: () => void;
  onOpenStory: (storyId: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("community");
  const [friendId, setFriendId] = useState<string | null>(null); // 非空 = 正在看某位朋友的空间

  const friends = COMMUNITY_MEMBERS.filter((m) => m.isFriend);

  /* ── 朋友的空间(内部视图,不经过帧状态机) ── */
  if (friendId) {
    const friend = memberById(friendId);
    const friendStories = storiesByMember(friendId);
    return (
      <div className="frame frame-enter">
        <div className="nav-bar">
          <button className="nav-side back-chevron" onClick={() => setFriendId(null)} aria-label="返回朋友列表">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
          <span className="nav-title">{friend.name} 的空间</span>
          <span style={{ width: 44 }} />
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", marginTop: 16, paddingBottom: 12 }}>
          {/* 朋友角色卡 */}
          <div
            style={{
              background: "var(--raised)",
              borderRadius: "var(--r-panel)",
              padding: "14px 16px",
              boxShadow: "var(--shadow-card)",
              display: "flex",
              alignItems: "center",
              gap: 14,
            }}
          >
            <span
              style={{
                width: 72,
                height: 72,
                borderRadius: 20,
                background: characterById(friend.characterId).color,
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "center",
                overflow: "hidden",
                flexShrink: 0,
              }}
            >
              <CharacterFace id={friend.characterId} size={56} style={{ height: 64 }} />
            </span>
            <span>
              <span style={{ display: "block", fontSize: 17, fontWeight: 700 }}>{friend.name}</span>
              <span className="meta-italic" style={{ display: "block", fontSize: 12, marginTop: 3 }}>{friend.bio}</span>
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 18 }}>
            {friendStories.length === 0 && (
              <span className="meta-italic" style={{ fontSize: 12.5, color: "var(--placeholder)" }}>
                TA 还没有公开的故事。
              </span>
            )}
            {friendStories.map((s, i) => (
              <StoryCard key={s.id} story={s} index={i} onOpen={() => onOpenStory(s.id)} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ── 主视图:Community / Friends 双 tab ── */
  return (
    <div className="frame frame-enter">
      <div className="nav-bar">
        <button className="nav-side back-chevron" onClick={onBack} aria-label="返回">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <span className="nav-title">别人的空间</span>
        <span style={{ width: 44 }} />
      </div>

      {/* tab 切换:下划线手法,与 Auth 的切换链接同源 */}
      <div style={{ display: "flex", gap: 22, marginTop: 14, flexShrink: 0 }}>
        {(
          [
            ["community", "社区"],
            ["friends", "朋友"],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              fontSize: 15,
              fontWeight: tab === key ? 700 : 500,
              color: tab === key ? "var(--ink)" : "var(--faint)",
              borderBottom: tab === key ? "2px solid var(--story)" : "2px solid transparent",
              paddingBottom: 4,
              transition: "color 200ms var(--ease-soft)",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <span className="meta-italic" style={{ fontSize: 13, marginTop: 10, flexShrink: 0 }}>
        {tab === "community" ? "也许有你感兴趣的灵魂,路过就进去坐坐。" : "常来的朋友,和他们的房间。"}
      </span>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", marginTop: 14, paddingBottom: 12 }}>
        {tab === "community" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {COMMUNITY_STORIES.map((s, i) => (
              <StoryCard key={s.id} story={s} index={i} onOpen={() => onOpenStory(s.id)} />
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {friends.map((m) => (
              <button
                key={m.id}
                onClick={() => setFriendId(m.id)}
                style={{
                  background: "var(--raised)",
                  borderRadius: "var(--r-panel)",
                  padding: "12px 14px",
                  boxShadow: "var(--shadow-card)",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  textAlign: "left",
                }}
              >
                <MemberAvatar member={m} size={46} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 15, fontWeight: 700 }}>{m.name}</span>
                  <span className="meta-italic" style={{ display: "block", fontSize: 12, marginTop: 2 }}>{m.bio}</span>
                </span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--chevron)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
