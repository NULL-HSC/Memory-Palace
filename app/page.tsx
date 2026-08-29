"use client";

import React, { useEffect, useState } from "react";
import { StoreProvider, useStore } from "@/lib/store";
import type { Persona, Story } from "@/lib/types";
import F1Home from "@/components/frames/F1Home";
import F2Listening from "@/components/frames/F2Listening";
import F3Draft from "@/components/frames/F3Draft";
import F4Sandplay from "@/components/frames/F4Sandplay";
import F5Spaces from "@/components/frames/F5Spaces";
import PickRole from "@/components/frames/PickRole";
import Reflect from "@/components/frames/Reflect";
import Auth from "@/components/frames/Auth";
import Profile from "@/components/frames/Profile";
import StoryDetail from "@/components/frames/StoryDetail";
import { MOCK_TRANSCRIPT } from "@/lib/mock/transcript";
import { CurtainVeil } from "@/components/scene/Curtain";
import { OWN_STORY_COMMENTS, communityStoryById, memberById } from "@/lib/mock/community";
import { USE_BACKEND, hasAccessToken, logout as apiLogout, setAccessToken, updateSessionVisibility, type PreparedSandplay } from "@/lib/api";

/**
 * 单页帧状态机（理理理.md §2 主循环 + §7 转场规格）
 * 新故事:F1 Home → F2 Listening → **Reflect 阶段一(旁观者陪聊)** → Pick 选带入角色
 *        → F4 Sandplay 阶段二(草稿先行)→ F3 Keep 页 → 入长廊回 Home;F1 ↔ F5
 * 阶段一同时并行做解构(建 session / 触发视频任务 / 提取人设),结果经 handleReflected
 * 传给 PickRole —— 不要在 PickRole 里再请求一次,那会另起一个视频任务。
 * Home → Listening 为直接跳帧(2026-08-29:移除 T1 小人飞行过场,产品确认纯跳转)
 */

type Frame = "auth" | "home" | "listening" | "reflect" | "pick" | "draft" | "sandplay" | "spaces" | "profile" | "storyDetail";

/** mock 模式下 auth 帧“一键跳过”的演示标记(demo only,真后端下不生效) */
const DEMO_SKIP_KEY = "lilili.demo.skip";

function Shell() {
  const { stories, addStory } = useStore();
  const [frame, setFrame] = useState<Frame | null>(null); // null = 启动中(等待 token 探测)
  const [transcript, setTranscript] = useState("");
  const [activeStoryId, setActiveStoryId] = useState<string | null>(null);
  const [pending, setPending] = useState<Story | null>(null); // 未 Keep 的草稿故事
  const [persona, setPersona] = useState<Persona | null>(null); // 用户选择带入的角色
  const [castPersonas, setCastPersonas] = useState<Persona[] | null>(null); // 故事 Top 3 完整阵容
  const [prepared, setPrepared] = useState<PreparedSandplay | null>(null); // 阶段一并行准备好的解构结果
  const [homeEnter, setHomeEnter] = useState<"frame-enter-left" | "frame-enter">("frame-enter-left");
  /** storyDetail 的数据来源:自己的历史(store)/ 社区故事(mock) */
  const [detailSource, setDetailSource] = useState<"mine" | "community">("mine");
  /** 幕布拉开转场:等候室就绪 → 进场那一刻挂起,动画结束自卸 */
  const [curtain, setCurtain] = useState(false);

  /* 启动:无 token → auth 帧;已登录 → home。
     调试/演示捷径 ?frame=listening|pick|draft|sandplay|spaces 优先于登录态,直达任意帧 */
  useEffect(() => {
    const f = new URLSearchParams(window.location.search).get("frame");
    if (f && f !== "home") {
      if (f === "draft" || f === "pick" || f === "reflect") setTranscript(MOCK_TRANSCRIPT);
      setFrame(f as Frame);
      return;
    }
    const skipped = !USE_BACKEND && localStorage.getItem(DEMO_SKIP_KEY) === "1";
    setFrame(hasAccessToken() || skipped ? "home" : "auth");
  }, []);

  /* 登录/注册成功(token 已由 api 层写入 localStorage)→ home */
  const handleAuthed = () => {
    setHomeEnter("frame-enter");
    setFrame("home");
  };

  /* mock 模式演示跳过(demo only):写本地标记,刷新保持 */
  const handleSkipDemo = () => {
    try {
      localStorage.setItem(DEMO_SKIP_KEY, "1");
    } catch {
      /* 本地存储不可用时仅本次会话生效 */
    }
    handleAuthed();
  };

  /* Home → Listening：点 Create,直接跳帧(无过场) */
  const startNewStory = () => {
    setPersona(null);
    setCastPersonas(null);
    setPrepared(null);
    setFrame("listening");
  };

  /* T2 收尾:F2 Done → 阶段一(旁观者陪聊,同时并行做解构/建 session)→ 选角 → 直播间 */
  const handleListened = (text: string) => {
    setTranscript(text);
    setPrepared(null);
    setPending({
      id: "pending",
      title: "",
      date: "",
      cover: "sage",
      transcript: text,
      createdAt: Date.now(),
    });
    setFrame("reflect");
  };

  /* 阶段一结束(场景就绪):把解构结果带进选角,session 信息落到草稿上 */
  const handleReflected = (result: PreparedSandplay) => {
    setPrepared(result);
    if (result.session) {
      setPending((current) =>
        current
          ? {
              ...current,
              backendSessionId: result.session!.session_id,
              backendVideoTaskId: result.session!.video_task_id,
            }
          : current
      );
    }
    setCurtain(true); // 舞台幕布向两侧拉开,露出幕后的角色阵容
    setFrame("pick");
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
    if (pending?.backendSessionId) {
      // 后端当前只支持 private/public；friends 安全降级为 private，避免误公开。
      void updateSessionVisibility(
        pending.backendSessionId,
        draft.visibility === "community" ? "public" : "private"
      ).catch((error) => console.error("[session] 更新可见性失败:", error));
    }
    addStory({
      ...draft,
      backendSessionId: pending?.backendSessionId,
      backendVideoTaskId: pending?.backendVideoTaskId,
    });
    setPending(null);
    setPersona(null);
    setCastPersonas(null);
    setPrepared(null);
    backHome();
  };

  /** Keep 页/选角页放弃 → 丢弃草稿回 Home */
  const discardPending = () => {
    setPending(null);
    setPersona(null);
    setCastPersonas(null);
    setPrepared(null);
    backHome();
  };

  const backHome = () => {
    setHomeEnter("frame-enter-left");
    setFrame("home");
  };

  /* 退出登录:真后端调 /auth/logout;mock 模式清掉演示标记与本地 token → 回 auth 帧 */
  const handleLogout = () => {
    if (USE_BACKEND) void apiLogout().catch((error) => console.error("[auth] 退出登录失败:", error));
    else {
      try {
        localStorage.removeItem(DEMO_SKIP_KEY);
      } catch {
        /* ignore */
      }
      setAccessToken(null);
    }
    setFrame("auth");
  };

  const activeStory = stories.find((s) => s.id === activeStoryId) ?? stories[0];

  return (
    <div className="app-shell grain">
      {frame === "auth" && <Auth onAuthed={handleAuthed} onSkipDemo={handleSkipDemo} />}
      {frame === "home" && (
        <F1Home
          enterClass={homeEnter}
          /* 已保存的故事 → 只读详情(含留言);新建故事只走 Create 按钮 */
          onOpenStory={(id) => {
            setActiveStoryId(id);
            setDetailSource("mine");
            setFrame("storyDetail");
          }}
          onNewStory={startNewStory}
          onVisitSpaces={() => setFrame("spaces")}
          onOpenProfile={() => setFrame("profile")}
        />
      )}
      {frame === "listening" && <F2Listening onBack={backHome} onDone={handleListened} />}
      {frame === "reflect" && (
        <Reflect
          transcript={pending?.transcript ?? transcript}
          onReady={handleReflected}
          onBack={discardPending}
        />
      )}
      {frame === "pick" && <PickRole transcript={pending?.transcript ?? transcript} prepared={prepared} onBack={discardPending} onPick={(p, all, session) => {
        setPersona(p);
        setCastPersonas(all);
        if (session) {
          setPending((current) => current ? {
            ...current,
            backendSessionId: session.session_id,
            backendVideoTaskId: session.video_task_id,
          } : current);
        }
        setFrame("sandplay");
      }} />}
      {frame === "draft" && <F3Draft transcript={transcript} onBack={discardPending} onKeep={handleKeep} />}
      {frame === "sandplay" && (pending || activeStory) && (
        <F4Sandplay
          story={(pending ?? activeStory)!}
          persona={pending ? persona : null}
          cast={pending ? (castPersonas ?? undefined) : undefined}
          /* 草稿:返回键在组件内弹二次确认(Keep it → onKeep / Let it go → onDiscard),onBack 仅作兜底;老故事:onBack 直接回主页 */
          onBack={pending ? discardPending : backHome}
          onKeep={pending ? () => setFrame("draft") : undefined}
          onDiscard={pending ? discardPending : undefined}
        />
      )}
      {frame === "spaces" && (
        <F5Spaces
          onBack={backHome}
          onOpenStory={(id) => {
            setActiveStoryId(id);
            setDetailSource("community");
            setFrame("storyDetail");
          }}
        />
      )}

      {/* 幕布拉开转场:挂在所有帧之上,就绪进场那一刻把选角页「亮出来」 */}
      {curtain && <CurtainVeil onDone={() => setCurtain(false)} />}
      {frame === "profile" && <Profile onBack={backHome} onLogout={handleLogout} />}
      {frame === "storyDetail" &&
        (detailSource === "community" ? (
          /* 别人的故事:只读 + 可写留言 */
          (() => {
            const cs = communityStoryById(activeStoryId ?? "");
            if (!cs) return null;
            const owner = memberById(cs.ownerId);
            return (
              <StoryDetail
                title={cs.title}
                date={cs.date}
                cover={cs.cover}
                transcript={cs.transcript}
                ownerName={owner.name}
                initialComments={cs.comments}
                canComment
                onBack={() => setFrame("spaces")}
              />
            );
          })()
        ) : (
          /* 自己的历史故事:纯只读,展示别人的留言 */
          activeStory && (
            <StoryDetail
              title={activeStory.title}
              date={activeStory.date}
              cover={activeStory.cover}
              transcript={activeStory.transcript}
              reflection={activeStory.reflection}
              visibility={activeStory.visibility}
              initialComments={OWN_STORY_COMMENTS[activeStory.id] ?? []}
              canComment={false}
              onBack={backHome}
            />
          )
        ))}

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
