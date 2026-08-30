"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Story, UserState } from "./types";
import { SEED_STORIES } from "./mock/stories";

/**
 * 轻量全局状态：stories + UserState（Lv/progress）
 * 持久化到 localStorage；后端就绪后由 lib/api.ts 的真接口替换数据源。
 */

const STORAGE_KEY = "answerland.stories.v3";
const USER_KEY = "answerland.user.v1";

const PROGRESS_PER_STORY = 1 / 6; // 每 Keep 一个故事推进一格

interface StoreShape {
  stories: Story[];
  user: UserState;
  hydrated: boolean;
  addStory: (s: Omit<Story, "id" | "createdAt">) => Story;
}

const StoreCtx = createContext<StoreShape | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [stories, setStories] = useState<Story[]>(SEED_STORIES);
  const [user, setUser] = useState<UserState>({ level: 1, progress: 0.2, companionId: "pico" });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const rawStories = localStorage.getItem(STORAGE_KEY);
      if (rawStories) setStories(JSON.parse(rawStories));
      const rawUser = localStorage.getItem(USER_KEY);
      if (rawUser) setUser(JSON.parse(rawUser));
    } catch {
      /* 本地存储不可用时用种子数据 */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stories));
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch {
      /* ignore */
    }
  }, [stories, user, hydrated]);

  const addStory = useCallback<StoreShape["addStory"]>((input) => {
    const story: Story = { ...input, id: `story-${Date.now()}`, createdAt: Date.now() };
    setStories((prev) => [story, ...prev]);
    setUser((prev) => {
      const progress = prev.progress + PROGRESS_PER_STORY;
      return progress >= 1
        ? { ...prev, level: prev.level + 1, progress: progress - 1 }
        : { ...prev, progress };
    });
    return story;
  }, []);

  const value = useMemo(
    () => ({ stories, user, hydrated, addStory }),
    [stories, user, hydrated, addStory]
  );
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore(): StoreShape {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
