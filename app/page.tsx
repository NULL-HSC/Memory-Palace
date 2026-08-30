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
import Premiere from "@/components/frames/Premiere";
import Reflect, { waitForVideoPlayback } from "@/components/frames/Reflect";
import Auth from "@/components/frames/Auth";
import Profile from "@/components/frames/Profile";
import StoryDetail from "@/components/frames/StoryDetail";
import { MOCK_TRANSCRIPT } from "@/lib/mock/transcript";
import { CurtainVeil } from "@/components/scene/Curtain";
import { OWN_STORY_COMMENTS, communityStoryById, memberById } from "@/lib/mock/community";
import {
  USE_BACKEND,
  hasAccessToken,
  listSessions,
  logout as apiLogout,
  prepareSandplay,
  sessionSummaryToStory,
  setAccessToken,
  updateSessionVisibility,
  type PreparedSandplay,
} from "@/lib/api";

/**
 * 单页帧状态机（product-flow.md §2 主循环 + §7 转场规格）
 * 新故事:F1 Home → F2 Listening → Reflect 等候室(等 VLM 回信,占位符区)→ 幕布拉开
 *        → Premiere 首映(先看演绎视频)→ Pick 选带入角色 → F4 Sandplay 群聊
 *        → F3 Keep 页 → 入长廊回 Home;F1 ↔ F5
 * 阶段一同时并行做解构(建 session / 触发视频任务 / 提取人设),结果经 handleReflected
 * 传给 PickRole —— 不要在 PickRole 里再请求一次,那会另起一个视频任务。
 * Home → Listening 为直接跳帧(2026-08-29:移除 T1 小人飞行过场,产品确认纯跳转)
 */

type Frame = "auth" | "home" | "listening" | "reflect" | "premiere" | "pick" | "draft" | "sandplay" | "spaces" | "profile" | "storyDetail";

/** mock 模式下 auth 帧“一键跳过”的演示标记(demo only,真后端下不生效) */
const DEMO_SKIP_KEY = "answerland.demo.skip";

function Shell() {
  const { stories, addStory, replaceStories } = useStore();
  const [frame, setFrame] = useState<Frame | null>(null); // null = 启动中(等待 token 探测)
  const [transcript, setTranscript] = useState("");
  const [activeStoryId, setActiveStoryId] = useState<string | null>(null);
  const [pending, setPending] = useState<Story | null>(null); // 未 Keep 的草稿故事
  const [persona, setPersona] = useState<Persona | null>(null); // 用户选择带入的角色
  const [castPersonas, setCastPersonas] = useState<Persona[] | null>(null); // 故事 Top 3 完整阵容
  const [prepared, setPrepared] = useState<PreparedSandplay | null>(null); // 阶段一并行准备好的解构结果
  /** 后台生成中的故事:用户在等候室提前离开时挂上;生成完成 → 首页出「未读」卡,点了续进首映 */
  const [genTask, setGenTask] = useState<{
    id: string;
    transcript: string;
    prepared: PreparedSandplay | null;
    playbackUrl: string | null;
    ready: boolean;
    unread: boolean;
  } | null>(null);
  const [homeEnter, setHomeEnter] = useState<"frame-enter-left" | "frame-enter">("frame-enter-left");
  /** storyDetail 的数据来源:自己的历史(store)/ 社区故事(mock) */
  const [detailSource, setDetailSource] = useState<"mine" | "community">("mine");
  /** 幕布拉开转场:等候室拆回信那一刻挂起,动画结束自卸 */
  const [curtain, setCurtain] = useState(false);
  /** 首映页要播的演绎视频地址(等候室等 VLM 拿到;mock/失败为 null) */
  const [premiereUrl, setPremiereUrl] = useState<string | null>(null);

  /* 启动:无 token → auth 帧;已登录 → home。
     调试/演示捷径 ?frame=listening|pick|draft|sandplay|spaces 优先于登录态,直达任意帧 */
  useEffect(() => {
    const f = new URLSearchParams(window.location.search).get("frame");
    if (f && f !== "home") {
      if (f === "draft" || f === "pick" || f === "reflect" || f === "premiere") setTranscript(MOCK_TRANSCRIPT);
      setFrame(f as Frame);
      return;
    }
    const skipped = !USE_BACKEND && localStorage.getItem(DEMO_SKIP_KEY) === "1";
    setFrame(hasAccessToken() || skipped ? "home" : "auth");
  }, []);

  useEffect(() => {
    if (frame !== "home" || !USE_BACKEND) return;
    let cancelled = false;

    listSessions()
      .then((result) => {
        if (!cancelled) replaceStories(result.items.map(sessionSummaryToStory));
      })
      .catch((error) => console.error("[sessions] 获取故事集失败:", error));

    return () => {
      cancelled = true;
    };
  }, [frame, replaceStories]);

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
    setPremiereUrl(null);
    setFrame("listening");
  };

  /* T2 收尾:F2 Done → 阶段一(旁观者陪聊,同时并行做解构/建 session)→ 选角 → 直播间 */
  const handleListened = (text: string) => {
    console.log("[flow] handleListened", { textLength: text.length, useBackend: USE_BACKEND });
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

  /* 阶段一结束(回信抵达、用户拆开):幕布拉开 → 首映页先看演绎视频,看完进选角 */
  const handleReflected = (result: PreparedSandplay, playbackUrl: string | null) => {
    console.log("[flow] Reflect ready -> Premiere", {
      hasSession: Boolean(result.session),
      sessionId: result.session?.session_id,
      personaCount: result.personas.length,
      hasPlaybackUrl: Boolean(playbackUrl),
    });
    setPrepared(result);
    setPremiereUrl(playbackUrl);
    if (result.session) {
      setPending((current) =>
        current
          ? {
              ...current,
              title: result.session!.title?.trim() || current.title,
              backendSessionId: result.session!.session_id,
              backendVideoTaskId: result.session!.video_task_id,
            }
          : current
      );
    }
    setCurtain(true); // 舞台幕布向两侧拉开,露出首映银幕
    setFrame("premiere");
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
    setGenTask(null); // Keep 完成,后台任务闭环
    backHome();
  };

  /** Keep 页/选角页放弃 → 丢弃草稿回 Home */
  const discardPending = () => {
    setPending(null);
    setPersona(null);
    setCastPersonas(null);
    setPrepared(null);
    setPremiereUrl(null);
    setGenTask(null); // "Let it go" = 连后台生成中的也不要了
    backHome();
  };

  /** 等候室提前退出 → 故事转后台继续生成;首页挂「生成中」卡,好了变「未读」 */
  const handleReflectLeave = () => {
    const text = pending?.transcript ?? transcript;
    if (!text) {
      discardPending();
      return;
    }
    const taskId = `gen-${Date.now()}`;
    setGenTask({ id: taskId, transcript: text, prepared: null, playbackUrl: null, ready: false, unread: false });
    void (async () => {
      try {
        const p = await prepareSandplay(text);
        let url: string | null = null;
        if (p.session) {
          try {
            url = await waitForVideoPlayback(p.session.session_id);
          } catch (error) {
            console.error("[genTask] 视频等待失败,首映走兜底:", error);
          }
        } else {
          await new Promise((r) => setTimeout(r, 4200)); // 本地演示:与等候室同款模拟耗时
        }
        setGenTask((cur) => (cur && cur.id === taskId ? { ...cur, prepared: p, playbackUrl: url, ready: true, unread: true } : cur));
      } catch (error) {
        console.error("[genTask] 后台生成失败:", error);
        setGenTask((cur) => (cur && cur.id === taskId ? { ...cur, ready: true, unread: true } : cur));
      }
    })();
    setPending(null);
    setPersona(null);
    setCastPersonas(null);
    backHome();
  };

  /** 点「未读」卡 → 从首映接着走(和正常链路一致:首映 → 选角 → 群聊) */
  const openGenTask = () => {
    if (!genTask || !genTask.ready) return;
    setPending({
      id: "pending",
      title: genTask.prepared?.session?.title?.trim() || "未命名故事",
      date: "",
      cover: "sage",
      transcript: genTask.transcript,
      createdAt: Date.now(),
      backendSessionId: genTask.prepared?.session?.session_id,
      backendVideoTaskId: genTask.prepared?.session?.video_task_id,
    });
    setPrepared(genTask.prepared);
    setPremiereUrl(genTask.playbackUrl);
    setGenTask((cur) => (cur ? { ...cur, unread: false } : cur));
    setCurtain(true); // 同样幕布拉开进首映
    setFrame("premiere");
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
          generating={genTask ? { ready: genTask.ready, unread: genTask.unread } : null}
          onOpenGenerating={openGenTask}
        />
      )}
      {frame === "listening" && <F2Listening onBack={backHome} onDone={handleListened} />}
      {frame === "reflect" && (
        <Reflect
          transcript={pending?.transcript ?? transcript}
          onReady={handleReflected}
          onBack={handleReflectLeave}
        />
      )}
      {frame === "premiere" && (
        <Premiere playbackUrl={premiereUrl} onBack={discardPending} onDone={() => setFrame("pick")} />
      )}
      {frame === "pick" && <PickRole transcript={pending?.transcript ?? transcript} prepared={prepared} onBack={discardPending} onPick={(p, all, session) => {
        console.log("[flow] PickRole -> Sandplay", { personaId: p.id, castCount: all.length, sessionId: session?.session_id, hasSession: Boolean(session) });
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
      {frame === "draft" && (
        <F3Draft
          transcript={transcript}
          title={pending?.title?.trim() || "未命名故事"}
          onBack={discardPending}
          onKeep={handleKeep}
        />
      )}
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
                video={cs.video}
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
              video={activeStory.video}
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
