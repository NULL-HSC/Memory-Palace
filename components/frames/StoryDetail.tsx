"use client";

import React, { useState } from "react";
import type { CharacterId, StoryComment } from "@/lib/types";
import { CharacterFace, Companion, type FaceId } from "../characters";
import { characterById } from "@/lib/mock/characters";
import { CoverArt } from "../ui";
import ChatInput from "../ui/ChatInput";

/**
 * 故事详情 · 只读(2026-08-29 产品确认)
 * - 自己的历史故事(Home 点卡进入):纯回看,无任何编辑/群聊交互;下方展示别人留下的留言
 * - 别人的故事(Community / Friends 进入):同样只读,但可以写一条留言
 * 数据全部经 props 传入(mock),组件本身不取数;后端就绪后只换上层数据源。
 */

const VISIBILITY_LABEL: Record<string, string> = {
  private: "仅自己可见",
  friends: "朋友可见",
  community: "已公开",
};

/** 留言者头像:自己的留言用 companion,其他人用角色脸(同 ChatAvatar 的圆形裁脸) */
function CommentAvatar({ id }: { id: CharacterId }) {
  const bg = id === "user" ? "var(--mist)" : characterById(id).color;
  return (
    <span
      style={{
        width: 34,
        height: 34,
        borderRadius: "50%",
        background: bg,
        flexShrink: 0,
        overflow: "hidden",
        display: "block",
      }}
    >
      {id === "user" ? (
        <Companion size={30} style={{ width: 34, height: 34, objectFit: "cover", objectPosition: "50% 12%" }} />
      ) : (
        <CharacterFace id={id as FaceId} size={30} style={{ width: 34, height: 34, objectFit: "cover", objectPosition: "50% 12%" }} />
      )}
    </span>
  );
}

export default function StoryDetail({
  title,
  date,
  cover,
  transcript,
  reflection,
  visibility,
  ownerName,
  initialComments,
  canComment,
  onBack,
}: {
  title: string;
  date: string;
  cover: string;
  transcript: string;
  reflection?: string;
  visibility?: "private" | "friends" | "community"; // 仅自己的故事展示
  ownerName?: string; // 别人的故事:顶部显示「xx 的故事」
  initialComments: StoryComment[];
  canComment: boolean; // 别人的故事 = true;自己的历史 = false
  onBack: () => void;
}) {
  const [comments, setComments] = useState<StoryComment[]>(initialComments);
  const [draft, setDraft] = useState("");
  const [composing, setComposing] = useState(false); // 先「写留言」按钮,点了才展开输入条

  const leaveComment = () => {
    const text = draft.trim();
    if (!text) return;
    // mock 提交:本地追加;后端就绪后换成发帖接口
    setComments((prev) => [
      ...prev,
      { id: `local-${Date.now()}`, authorName: "我", authorCharacterId: "user", relation: "visitor", text, date: "刚刚" },
    ]);
    setDraft("");
  };

  return (
    <div className="frame frame-enter">
      <div className="nav-bar">
        <button className="nav-side back-chevron" onClick={onBack} aria-label="返回">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <span className="nav-title">{ownerName ? `${ownerName} 的故事` : "故事详情"}</span>
        <span style={{ width: 44 }} />
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", marginTop: 18, paddingBottom: 12 }}>
        {/* 封面卡(裱卡手法,同长廊) */}
        <div
          style={{
            background: "var(--raised)",
            borderRadius: "var(--r-panel)",
            padding: "12px 12px 16px",
            boxShadow: "var(--lift-2)",
          }}
        >
          <div style={{ position: "relative", height: 170, borderRadius: "var(--r-photo)", overflow: "hidden" }}>
            <CoverArt cover={cover} />
            {/* 凹槽内阴影:封面读作裱进框里的照片(同社区卡配方) */}
            <span aria-hidden style={{ position: "absolute", inset: 0, boxShadow: "inset 0 3px 10px rgba(15,45,66,0.16), inset 0 -2px 4px rgba(15,45,66,0.06)", pointerEvents: "none" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 12, padding: "0 2px" }}>
            <span style={{ fontFamily: "var(--font-hand)", fontSize: 21, color: "var(--ink-blue)" }}>{title}</span>
            {visibility && (
              <span className="meta-italic" style={{ fontSize: 11.5 }}>{VISIBILITY_LABEL[visibility]}</span>
            )}
          </div>
          <div className="meta-italic" style={{ fontSize: 12, marginTop: 2, padding: "0 2px" }}>{date}</div>
        </div>

        {/* 故事原文(信纸手法) */}
        <div
          style={{
            marginTop: 16,
            background: "var(--raised)",
            borderRadius: "var(--r-panel)",
            padding: "18px 16px",
            boxShadow: "var(--lift-1)",
          }}
        >
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.9 }}>{transcript}</p>
          {reflection && (
            <p className="meta-italic" style={{ margin: "14px 0 0", fontSize: 13, lineHeight: 1.8, borderTop: "1px dashed var(--line-strong)", paddingTop: 12 }}>
              写给自己的话:{reflection}
            </p>
          )}
        </div>

        {/* 留言区:与上半区用一条虚线车缝浅浅分开(不上颜色,同首页布带的车缝语言) */}
        <div style={{ marginTop: 24 }}>
          <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg aria-hidden viewBox="0 0 340 8" preserveAspectRatio="none" style={{ position: "absolute", left: 0, width: "100%", height: 8 }}>
              <path d="M0 4 H340" stroke="var(--ink-blue)" strokeOpacity="0.35" strokeWidth="1.3" strokeDasharray="5 6" strokeLinecap="round" fill="none" />
            </svg>
            <span
              className="meta-italic"
              style={{ position: "relative", fontSize: 13, background: "var(--ground)", padding: "0 10px" }}
            >
              留言 · {comments.length}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 12 }}>
            {comments.length === 0 && (
              <span className="meta-italic" style={{ fontSize: 12.5, color: "var(--placeholder)" }}>
                还没有留言,这间屋子安安静静。
              </span>
            )}
            {comments.map((cm) => (
              <div key={cm.id} style={{ display: "flex", gap: 10 }}>
                <CommentAvatar id={cm.authorCharacterId} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700 }}>{cm.authorName}</span>
                    <span className="meta-italic" style={{ fontSize: 11, color: "var(--faint)" }}>
                      {cm.relation === "friend" ? "朋友" : "路过"} · {cm.date}
                    </span>
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      display: "inline-block",
                      padding: "10px 14px",
                      borderRadius: "4px 16px 16px 16px",
                      background: "var(--raised)",
                      boxShadow: "var(--lift-1)",
                      fontSize: 14,
                      lineHeight: 1.7,
                    }}
                  >
                    {cm.text}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 别人的故事:先一个「写留言」按钮,点开才是输入条(与群聊同款 ChatInput);自己的历史纯只读 */}
      {canComment && (
        <div style={{ flexShrink: 0, paddingTop: 10 }}>
          {composing ? (
            <ChatInput
              value={draft}
              onChange={setDraft}
              onSend={leaveComment}
              placeholder="留一句话吧…"
              autoFocus
              ariaLabel="写留言"
            />
          ) : (
            <button
              onClick={() => setComposing(true)}
              style={{
                width: "100%",
                minHeight: 46,
                borderRadius: 23,
                border: "1.5px dashed var(--slot-border)",
                background: "var(--raised)",
                fontSize: 14,
                fontStyle: "italic",
                color: "var(--faint)",
              }}
            >
              写一句留言…
            </button>
          )}
        </div>
      )}
    </div>
  );
}
