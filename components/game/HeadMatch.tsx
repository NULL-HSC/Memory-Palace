"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

/**
 * 等候室小游戏 · 头像消消乐(2026-08-29)
 *
 * 定位:等 VLM 视频返回的这段时间,给用户一件**不费脑、不会输**的事做。
 * 因此这里的规则和市面上的消消乐有意不同:
 * - 没有倒计时、没有步数上限、没有失败态 —— 等多久就玩多久,视频一到就收
 * - 走投无路(没有可交换的一步)时**自动洗牌**,不弹「game over」
 * - 唯一的正反馈是消除本身:每消掉一组,向上抛一次 onClear,由等候室在顶上换一句话
 *
 * 美术:直接用 public/avatars/ 的黏土风全身图,按 HEAD_ART 里的归一化矩形只取**头部**
 * (含耳朵),在方形格子里等比放大居中 —— 换美术只需重算这几个数,组件不动。
 * 配色严格守签署色板:格子是 cream + 渐变描边(复用 .card-frame),托盘是 mist,
 * 五种棋子靠角色本身的颜色区分,不引入新品牌色。
 */

/* ============================================================
   头像:只取头部
   ============================================================ */

type Face = "tola" | "pico" | "mira" | "renn" | "sena";

interface HeadArt {
  src: string;
  /** 源图宽高比 height / width */
  ar: number;
  /** 头部(含耳朵)在源图里的归一化矩形:左 / 上 / 宽 / 高 */
  fx: number;
  fy: number;
  fw: number;
  fh: number;
  /** 无障碍名 */
  label: string;
}

/** 矩形由脚本扫 alpha 行宽得到:头最宽处往下第一个「脖子」收窄处即头底 */
const HEAD_ART: Record<Face, HeadArt> = {
  tola: { src: "/avatars/av-bear.png", ar: 655 / 512, fx: 0, fy: 0, fw: 1, fh: 0.734, label: "紫猫" },
  pico: { src: "/avatars/av-dog.png", ar: 536 / 512, fx: 0, fy: 0, fw: 1, fh: 0.653, label: "小狗" },
  mira: { src: "/avatars/av-cat.png", ar: 538 / 512, fx: 0.15, fy: 0.026, fw: 0.747, fh: 0.608, label: "暹罗猫" },
  renn: { src: "/avatars/av-fox.png", ar: 524 / 512, fx: 0.201, fy: 0.021, fw: 0.631, fh: 0.609, label: "眼镜猫" },
  sena: { src: "/avatars/av-bunny.png", ar: 535 / 512, fx: 0.219, fy: 0.009, fw: 0.599, fh: 0.675, label: "粉兔" },
};

const FACES = Object.keys(HEAD_ART) as Face[];

/**
 * 把头部矩形「contain」进一个正方形格子:全部用百分比,格子多大都不用重算。
 * 格子是正方形,所以 top/height 的 % 和 left/width 的 % 是同一把尺。
 */
function headStyle(face: Face, pad = 0.94): React.CSSProperties {
  const { ar, fx, fy, fw, fh } = HEAD_ART[face];
  const w = (pad * 100) / Math.max(fw, fh * ar); // 整张图相对格子的宽度 %
  const h = w * ar;
  return {
    position: "absolute",
    width: `${w}%`,
    height: `${h}%`,
    left: `${(100 - fw * w) / 2 - fx * w}%`,
    top: `${(100 - fh * h) / 2 - fy * h}%`,
    objectFit: "fill",
    pointerEvents: "none",
    userSelect: "none",
  };
}

/* ============================================================
   棋盘
   ============================================================ */

const COLS = 6;
const ROWS = 8;

const SWAP_MS = 190; // 交换 / 弹回
const CLEAR_MS = 250; // 消除
const FALL_MS = 290; // 下落
const DROP_STAGGER = 45; // 每列新块的错峰

interface Cell {
  id: number;
  face: Face;
  /** 正在消失 */
  clearing?: boolean;
  /** 刚从顶上补进来(播一次下落动画),值是错峰序号 */
  fresh?: number;
}

type Grid = (Cell | null)[][];

let nextId = 1;
const makeCell = (face: Face, fresh?: number): Cell => ({ id: nextId++, face, fresh });
const randFace = () => FACES[Math.floor(Math.random() * FACES.length)];
const key = (r: number, c: number) => `${r},${c}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 横竖任意 ≥3 连;返回要消掉的坐标集合 */
function findMatches(g: Grid): Set<string> {
  const hit = new Set<string>();
  const scan = (line: { r: number; c: number }[]) => {
    let run = 1;
    for (let i = 1; i <= line.length; i += 1) {
      const prev = line[i - 1];
      const cur = line[i];
      const same =
        cur && g[cur.r][cur.c] && g[prev.r][prev.c] && g[cur.r][cur.c]!.face === g[prev.r][prev.c]!.face;
      if (same) {
        run += 1;
      } else {
        if (run >= 3) for (let k = i - run; k < i; k += 1) hit.add(key(line[k].r, line[k].c));
        run = 1;
      }
    }
  };
  for (let r = 0; r < ROWS; r += 1) scan(Array.from({ length: COLS }, (_, c) => ({ r, c })));
  for (let c = 0; c < COLS; c += 1) scan(Array.from({ length: ROWS }, (_, r) => ({ r, c })));
  return hit;
}

const cloneGrid = (g: Grid): Grid => g.map((row) => row.slice());

function swapped(g: Grid, a: { r: number; c: number }, b: { r: number; c: number }): Grid {
  const n = cloneGrid(g);
  [n[a.r][a.c], n[b.r][b.c]] = [n[b.r][b.c], n[a.r][a.c]];
  return n;
}

/** 还有没有可走的一步(只需试右邻和下邻,左/上是别人的右/下) */
function hasMove(g: Grid): boolean {
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      if (c + 1 < COLS && findMatches(swapped(g, { r, c }, { r, c: c + 1 })).size) return true;
      if (r + 1 < ROWS && findMatches(swapped(g, { r, c }, { r: r + 1, c })).size) return true;
    }
  }
  return false;
}

/** 开局:边填边躲开三连;万一填出死局就整盘重来 */
function makeGrid(): Grid {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const g: Grid = Array.from({ length: ROWS }, () => Array<Cell | null>(COLS).fill(null));
    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < COLS; c += 1) {
        const banned = new Set<Face>();
        if (c >= 2 && g[r][c - 1]!.face === g[r][c - 2]!.face) banned.add(g[r][c - 1]!.face);
        if (r >= 2 && g[r - 1][c]!.face === g[r - 2][c]!.face) banned.add(g[r - 1][c]!.face);
        const pool = FACES.filter((f) => !banned.has(f));
        g[r][c] = makeCell(pool[Math.floor(Math.random() * pool.length)]);
      }
    }
    if (hasMove(g)) return g;
  }
  // 理论上到不了这里(5 色 6×7 几乎必有解),兜底给一盘不做校验的
  return Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => makeCell(randFace())));
}

/** 死局时把现有棋子打乱重排(不换棋子,只换位置),直到无三连且有解 */
function reshuffle(g: Grid): Grid {
  const bag: Cell[] = [];
  for (let r = 0; r < ROWS; r += 1) for (let c = 0; c < COLS; c += 1) if (g[r][c]) bag.push(g[r][c]!);
  for (let attempt = 0; attempt < 60; attempt += 1) {
    for (let i = bag.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    const n: Grid = Array.from({ length: ROWS }, (_, r) =>
      Array.from({ length: COLS }, (_, c) => bag[r * COLS + c])
    );
    if (findMatches(n).size === 0 && hasMove(n)) return n;
  }
  return makeGrid();
}

/** 消除后落下:每列把活着的压到底,空缺从顶上补新的 */
function collapse(g: Grid): Grid {
  const n: Grid = Array.from({ length: ROWS }, () => Array<Cell | null>(COLS).fill(null));
  for (let c = 0; c < COLS; c += 1) {
    const kept: Cell[] = [];
    for (let r = ROWS - 1; r >= 0; r -= 1) {
      const cell = g[r][c];
      if (cell && !cell.clearing) kept.push({ ...cell, fresh: undefined });
    }
    for (let i = 0; i < ROWS; i += 1) {
      const r = ROWS - 1 - i;
      n[r][c] = kept[i] ?? makeCell(randFace(), i - kept.length);
    }
  }
  return n;
}

const stripFresh = (g: Grid): Grid =>
  g.map((row) => row.map((cell) => (cell?.fresh === undefined ? cell : { ...cell, fresh: undefined })));

/* ============================================================
   组件
   ============================================================ */

export interface ClearInfo {
  /** 这一次消掉几块 */
  cleared: number;
  /** 连锁第几段:1 = 玩家这一步直接消掉的,≥2 = 掉落后续消 */
  combo: number;
  /** 本局累计消掉的组数 */
  total: number;
}

export default function HeadMatch({
  onClear,
  paused = false,
}: {
  /** 每消掉一组回调一次 —— 等候室据此在顶上换一句正念/名言 */
  onClear?: (info: ClearInfo) => void;
  /** 回信抵达后暂停,不再接受操作 */
  paused?: boolean;
}) {
  const [grid, setGrid] = useState<Grid>(() => makeGrid());
  const [selected, setSelected] = useState<{ r: number; c: number } | null>(null);
  const [tile, setTile] = useState(0); // 一格的边长(px),由容器实测
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);

  const boxRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef(grid);
  const busyRef = useRef(false);
  const aliveRef = useRef(true);
  const totalRef = useRef(0);
  const onClearRef = useRef(onClear);
  onClearRef.current = onClear;

  const selectedRef = useRef<{ r: number; c: number } | null>(null);
  const pick = useCallback((next: { r: number; c: number } | null) => {
    selectedRef.current = next;
    setSelected(next);
  }, []);

  const commit = useCallback((g: Grid) => {
    gridRef.current = g;
    setGrid(g);
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  /* 格子边长:装得下就取整数 px,避免半像素把描边糊掉 */
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width && height) setTile(Math.max(28, Math.floor(Math.min(width / COLS, height / ROWS))));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const flash = (text: string) => setToast({ id: Date.now(), text });

  /** 消除 → 下落 → 连锁,一直滚到盘面安静;结束后确认还有下一步 */
  const settle = useCallback(
    async (start: Grid) => {
      let g = start;
      let combo = 0;
      for (;;) {
        const hits = findMatches(g);
        if (hits.size === 0) break;
        combo += 1;
        totalRef.current += 1;

        g = g.map((row, r) => row.map((cell, c) => (cell && hits.has(key(r, c)) ? { ...cell, clearing: true } : cell)));
        commit(g);
        onClearRef.current?.({ cleared: hits.size, combo, total: totalRef.current });
        if (combo >= 2) flash(`连消 ×${combo}`);
        await sleep(CLEAR_MS);
        if (!aliveRef.current) return;

        g = collapse(g);
        commit(g);
        await sleep(FALL_MS + DROP_STAGGER * 2);
        if (!aliveRef.current) return;

        g = stripFresh(g);
        commit(g);
      }

      if (!hasMove(g)) {
        flash("没有可走的一步了,给你换一盘");
        await sleep(420);
        if (!aliveRef.current) return;
        commit(reshuffle(g));
        await sleep(FALL_MS);
      }
      busyRef.current = false;
    },
    [commit]
  );

  /** 试着交换两块:能消就消,不能消原样弹回(不惩罚、不扣步) */
  const trySwap = useCallback(
    async (a: { r: number; c: number }, b: { r: number; c: number }) => {
      if (busyRef.current || paused) return;
      const before = gridRef.current;
      if (!before[a.r][a.c] || !before[b.r][b.c]) return;
      busyRef.current = true;
      pick(null);

      const after = swapped(before, a, b);
      commit(after);
      await sleep(SWAP_MS);
      if (!aliveRef.current) return;

      if (findMatches(after).size === 0) {
        commit(before); // 弹回
        await sleep(SWAP_MS);
        busyRef.current = false;
        return;
      }
      await settle(after);
    },
    [commit, paused, pick, settle]
  );

  const adjacent = (a: { r: number; c: number }, b: { r: number; c: number }) =>
    Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;

  /* ---- 输入:拖一下换位,或点两下换位,两种都行 ---- */
  const dragRef = useRef<{ r: number; c: number; x: number; y: number; fired: boolean } | null>(null);

  const onPointerDown = (r: number, c: number) => (e: React.PointerEvent) => {
    if (busyRef.current || paused) return;
    dragRef.current = { r, c, x: e.clientX, y: e.clientY, fired: false };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || d.fired) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < Math.max(12, tile * 0.28)) return;
    d.fired = true;
    const target =
      Math.abs(dx) > Math.abs(dy)
        ? { r: d.r, c: d.c + (dx > 0 ? 1 : -1) }
        : { r: d.r + (dy > 0 ? 1 : -1), c: d.c };
    if (target.r < 0 || target.r >= ROWS || target.c < 0 || target.c >= COLS) return;
    void trySwap({ r: d.r, c: d.c }, target);
  };

  const onPointerUp = () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d || d.fired || busyRef.current || paused) return;
    const here = { r: d.r, c: d.c };
    const cur = selectedRef.current;
    if (!cur) return pick(here);
    if (cur.r === here.r && cur.c === here.c) return pick(null); // 再点一次 = 取消
    if (adjacent(cur, here)) {
      pick(null);
      void trySwap(cur, here);
      return;
    }
    pick(here); // 隔太远:直接改选这一块
  };

  /* 回信抵达:收手,别让动画和幕布转场抢戏 */
  useEffect(() => {
    if (paused) pick(null);
  }, [paused, pick]);

  const boardW = tile * COLS;
  const boardH = tile * ROWS;

  /** 棋子之间的呼吸缝:格子边长的 12%,布局松一点 */
  const GAP = tile ? Math.max(4, Math.round(tile * 0.12)) : 0;

  return (
    <div
      ref={boxRef}
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
      }}
    >
      <style>{HEAD_MATCH_CSS}</style>

      <div
        role="group"
        aria-label="等候小游戏:头像消消乐,把三个一样的凑到一起"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          position: "relative",
          width: boardW,
          height: boardH,
          borderRadius: "var(--r-panel)",
          background: "var(--sunken)",
          boxShadow: "var(--shadow-tray)",
          touchAction: "none",
          opacity: tile ? 1 : 0,
          transition: "opacity 240ms ease",
          filter: paused ? "saturate(0.6)" : undefined,
        }}
      >
        {grid.map((row, r) =>
          row.map((cell, c) => {
            if (!cell) return null;
            const isSel = selected?.r === r && selected?.c === c;
            return (
              <div
                key={cell.id}
                className={`hm-tile card-frame${isSel ? " card-frame--active" : ""}`}
                role="img"
                aria-label={HEAD_ART[cell.face].label}
                onPointerDown={onPointerDown(r, c)}
                style={{
                  left: c * tile + GAP / 2,
                  top: r * tile + GAP / 2,
                  width: tile - GAP,
                  height: tile - GAP,
                  zIndex: cell.clearing ? 3 : isSel ? 4 : 2,
                  transform: cell.clearing ? "scale(0.26) rotate(10deg)" : isSel ? "scale(1.07)" : "none",
                  opacity: cell.clearing ? 0 : 1,
                  boxShadow: isSel ? "var(--lift-3)" : "var(--lift-1)",
                  animation:
                    cell.fresh !== undefined
                      ? `hmDrop ${FALL_MS}ms var(--ease-soft) ${Math.min(cell.fresh, 4) * DROP_STAGGER}ms both`
                      : undefined,
                }}
              >
                {cell.clearing && <span className="hm-burst" aria-hidden />}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={HEAD_ART[cell.face].src} alt="" style={headStyle(cell.face)} draggable={false} />
              </div>
            );
          })
        )}
      </div>

      {/* 连消 / 洗牌提示:一闪而过,不挡棋盘 */}
      {toast && (
        <div key={toast.id} className="hm-toast" onAnimationEnd={() => setToast(null)}>
          {toast.text}
        </div>
      )}
    </div>
  );
}

/* 只在这一帧生效的动效;不进 globals.css,避免和其他人改的样式打架 */
const HEAD_MATCH_CSS = `
.hm-tile {
  position: absolute;
  border-radius: 16px;
  padding: 2px;
  overflow: hidden;
  cursor: pointer;
  transition:
    left ${FALL_MS}ms var(--ease-soft),
    top ${FALL_MS}ms var(--ease-soft),
    transform ${CLEAR_MS}ms var(--ease-bounce),
    opacity ${CLEAR_MS}ms ease,
    box-shadow 160ms ease;
}
.hm-burst {
  position: absolute;
  inset: 6%;
  border-radius: 50%;
  border: 3px solid var(--butter);
  animation: hmBurst ${CLEAR_MS}ms ease-out both;
}
@keyframes hmDrop {
  from { transform: translateY(-160%); }
  to { transform: none; }
}
@keyframes hmBurst {
  from { transform: scale(0.45); opacity: 0.75; }
  to { transform: scale(1.7); opacity: 0; }
}
.hm-toast {
  position: absolute;
  top: 8px;
  left: 50%;
  padding: 5px 14px;
  border-radius: var(--r-pill);
  background: var(--ink-blue);
  color: var(--text-on-ink);
  font-family: var(--font-hand);
  font-size: 14px;
  white-space: nowrap;
  pointer-events: none;
  z-index: 6;
  animation: hmToast 1500ms var(--ease-soft) both;
}
@keyframes hmToast {
  0% { opacity: 0; transform: translate(-50%, 8px) scale(0.9); }
  16%, 74% { opacity: 1; transform: translate(-50%, 0) scale(1); }
  100% { opacity: 0; transform: translate(-50%, -8px) scale(1); }
}
`;
