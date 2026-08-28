# Style-kit migration — what to hand the frontend coding agent

> Source of truth is now committed at [`docs/style-kit/`](style-kit/) (`DESIGN-GUIDELINE.md` +
> `tokens.css` + `components.css` + `example/my-space.html` + `assets/ip-*.png`), copied in from
> the signed-off kit at `~/Downloads/my-stories-style-kit/`. Point the coding agent at that folder
> first — read `DESIGN-GUIDELINE.md` top to bottom, it is written for exactly this purpose
> ("Audience: a coding agent implementing screens").

This doc is the delta: concrete places in the current implementation that contradict the
signed-off kit. Fix in this order — CTA first, it's the most visible and touches the most files.

## 1. CTA / primary buttons — wrong fill colour

Every primary button in the app is styled with `background: var(--accent)` (coral `#F2674F`,
[app/globals.css:10](../app/globals.css#L10)). The signed-off kit makes this a **hard rule
violation**: coral "is never a text background and never a fill larger than about 24px"
(`DESIGN-GUIDELINE.md` §2.1, §10). Primary CTAs must be Butter Yellow (`--butter #FFD86A`) per
`.btn` in `components.css`.

Confirmed instances, all `background: "var(--accent)"`, flat `boxShadow: "var(--shadow-button)"`,
paper-colored text — none of them use the puffy "hard underside" press physicality that's the
signed-off system's signature button detail:

| File | Line | Button |
|---|---|---|
| [components/frames/Auth.tsx](../components/frames/Auth.tsx#L290) | 290 | "Enter my room" / "Create my room" |
| [components/frames/F3Draft.tsx](../components/frames/F3Draft.tsx#L186) | 186 | "Keep this story" |
| [components/frames/PickRole.tsx](../components/frames/PickRole.tsx#L175) | 175 | "Step in as {name}" |
| [components/frames/F4Sandplay.tsx](../components/frames/F4Sandplay.tsx#L376) | 376, 436 | send / action buttons |
| [components/ui/index.tsx](../components/ui/index.tsx#L172) | 172 | + badge (new-story slot) |

**Fix**, per `docs/style-kit/components.css` `.btn`:
```css
background: var(--butter);
box-shadow: 0 4px 0 var(--butter-under);   /* hard underside, not a blur */
color: var(--ink);                          /* never cream/paper on butter or sky */
```
and on `:active`, translate down onto the underside (`transform: translateY(4px)`) instead of
just fading opacity. Font size must stay ≥19px/700 — that's the specific threshold the kit's
contrast fix (§4) depends on, not a rounding choice.

Coral should be *removed* as a button/badge fill everywhere in the table above and reserved for
spot marks only (a heart, a dot, ≤24px) per the hard rule.

## 2. Mic button — wrong face colour

[components/frames/F2Listening.tsx:186](../components/frames/F2Listening.tsx#L186): the record
mic is also `background: var(--accent)` (coral). Per kit §6.2, the mic is a `.disc` at 84px with
a **Sky Blue** face (`--sky`), not coral:
```css
background: var(--sky);
box-shadow: 0 5px 0 var(--story), var(--lift-2);  /* --sky-under is --story */
color: var(--ink-blue);
```

## 3. Typography

Current stack: Newsreader (Latin) + XiaolaiSC (CJK) — [app/globals.css:60-68](../app/globals.css#L60).
Signed-off stack: **Shantell Sans** (hand-lettered titles only) + **Quicksand** (everything else),
loaded per the `<link>` snippet at the top of `DESIGN-GUIDELINE.md`. Two rules that matter beyond
just swapping the font-family, both already flagged in the kit itself:

- CJK must **never** render in the hand font (no CJK glyph coverage) — set Chinese titles in
  Quicksand/UI font at weight 700 instead, not XiaolaiSC-in-Shantell's-place.
- Button label size is deliberately **19px**, not 18 — that's `--t-lead`, chosen because 18px
  bold misses the WCAG large-text threshold on Butter Yellow and 19px clears it. Don't round it
  down when porting.

## 4. Card / component vocabulary — mostly already aligned, verify these specifically

The wave bands, gingham weave, washi tape, and dashed-stitch motifs in the current build already
match the kit's §3 Materials vocabulary (both were art-directed from the same reference sheet the
same day), so this is *not* a rebuild — just confirm class-for-class against `components.css`:

- `MountedPrint` ([components/ui/index.tsx](../components/ui/index.tsx)) → should match `.polaroid`
  (cream frame, deep bottom mat, `--r-photo` 6px photo corners, hung from a clip+string pair with
  `.is-sway`, not resting flat).
- Screen titles → should use `.ribbon` (notched right end via `clip-path`), confirmed correct in
  the "Write a letter" reference screen's back-button chip.
- Any bottom navigation (`Stories` / `Discover` / `Me`) → `.tabbar` + `.tab`; per kit §11 this is a
  net-new IA element with no prior design, only "Stories" has real screens — flag `Discover`/`Me`
  rather than inventing them.

## 5. Character art

No action needed — the clay-render stickers already in `public/avatars/` (暹罗猫紫耳机围巾 /
黄猫眼镜背心 / 粉兔黑玫瑰, from `docs/visual-direction.md`) are the same reference set now
confirmed against the pasted images this session. Keep using those; the kit's `assets/ip-*.png`
(a flat vinyl-sticker style) is a **different, earlier exploration** — don't mix the two art
styles per the kit's own §7 rule ("One art style only").

## 6. Engineering gaps the kit doesn't cover

The kit was authored against a single static mockup (`example/my-space.html`, a fixed 390×844
artboard). That's fine as a token/component reference, but four things won't survive contact with
this actual Next.js + Capacitor app if copied literally. None of this is in the signed-off
guideline — flag it the same way the guideline flags its own §12 open questions, don't treat it
as agreed.

- **`.screen` is hardcoded to `width: 390px; height: 844px`.** That's an iPhone-14-shaped artboard,
  not a layout. The real app needs to render at whatever viewport it's actually given — swap the
  fixed box for `width: 100%; min-height: 100dvh` (or `100svh` for iOS Safari's dynamic toolbar)
  and let the wave bands / tab bar pin with `position: sticky`/`fixed` instead of an absolute
  layout inside a fixed frame.
- **Safe-area insets are missing entirely**, and the README's own roadmap has Capacitor iOS
  packaging on the near-term plan. The bottom tab bar (`--tabbar-h: 96px`) and the mic/CTA that
  sit near the bottom edge need `padding-bottom: max(18px, env(safe-area-inset-bottom))` or they
  land under the iPhone home indicator on a notched device. Add this before the Capacitor build,
  not after — it's much cheaper to bake into `.tabbar`/`.disc` positioning now than retrofit once
  it's wrapped.
- **Google Fonts is a live network dependency.** This app already made the opposite call once —
  `XiaolaiSC-Regular.ttf` is self-hosted at `public/fonts/` specifically so the Chinese font
  doesn't depend on a CDN at demo time ([README.md](../README.md), 字体 section). Shantell
  Sans/Quicksand should get the same treatment: download the woff2 files and add local
  `@font-face` rules in `tokens.css`'s consuming stylesheet, with `font-display: swap` and a
  system fallback stack, rather than the `<link>`-to-Google-Fonts snippet in the guideline's
  header. A hackathon demo on venue wifi is exactly the scenario that breaks.
- **No disabled-button recipe.** `components.css`'s `.btn` has a face, a pressed state, and a
  hover — no `:disabled`. The current code improvises one per-file (`opacity: chosen ? 1 : 0.4` in
  [PickRole.tsx:179](../components/frames/PickRole.tsx#L179), `opacity: busy ? 0.72 : 1` in
  [Auth.tsx:293](../components/frames/Auth.tsx#L293)). Fold one rule into `.btn:disabled` in
  `components.css` (opacity + `pointer-events: none`, keep the underside so it doesn't look flat)
  so it isn't reinvented per screen with a different number each time.

## 7. Existing components the kit doesn't mention

`Toast`, `TypingIndicator`, and `Waveform` in [components/ui/index.tsx](../components/ui/index.tsx)
predate the kit and have no equivalent class in `components.css`. Don't leave them on the old
`--shadow-card`/`--accent` tokens while everything around them moves to the new system — that's
how a migration ends up half-done and worse than before it started. Concretely:

- `Toast` currently floats on `--raised` with `--shadow-card` — restyle onto `--lift-2` (Ink-Blue
  shadow) to match every other raised surface in the new system.
- `TypingIndicator` and the SSE-driven chat bubbles are also where a real accessibility gap shows
  up: there is currently **no `aria-live` region anywhere in the app**
  (confirmed — nothing in `components/` or `app/` sets one), despite `role.delta` text streaming
  in continuously per `docs/backend-progress.md`. A screen-reader user gets silence while replies
  stream. Wrap the active bubble's text node in `aria-live="polite"` (not `"assertive"` — that
  would interrupt on every delta) once the streaming bubble is rebuilt on `.bubble`/`.bubble--mine`.

## How to hand this to a coding agent

Give it, in this order:
1. `docs/style-kit/DESIGN-GUIDELINE.md` (full read, it's written for this)
2. `docs/style-kit/tokens.css` + `docs/style-kit/components.css` (drop-in, class names are the contract)
3. This file, as the concrete punch list against the current codebase — sections 1–5 are direct
   contradictions of the signed-off kit; sections 6–7 are gaps the kit doesn't address at all and
   need a decision before an agent just picks something

---

## 迁移执行记录(2026-08-28,agent 完成)

已按 §1–§7 全部落实:

- **§1 CTA**:全部改用 `.btn`(butter 面 + `--butter-under` 硬底边 + 19px/700 + active 下压)——Auth、F3Draft、PickRole(含 `:disabled`)、F4 两个弹窗按钮、F1Home Create、NewStorySlot 加号、F4 发送钮(butter 小圆盘)。coral 仅剩 Auth 错误下划线 1px 描边(斑点用法,合规)。
- **§2 麦克风**:84px disc → sky 面 + story 硬底边 + lift-2,图标 ink-blue。
- **§3 字体**:Shantell Sans(400/600/700)+ Quicksand(500/600/700)拉丁子集 woff2 自托管于 `public/fonts/`,globals.css `@font-face`;移除 next/font 的 Newsreader(XiaolaiSC 文件保留未删,但已从字体栈移除——kit 规定 CJK 不用手写字体)。
- **§4 组件**:MountedPrint → cream 卡面/无描边/lift 阴影/6px 照片角;空槽位 → `.gingham`;Home 标题 → `.ribbon`;**tab bar 未做**(§12 未签署,Discover/Me 无设计,按规则不擅自发明)。
- **§6 工程**:`.btn:disabled` 已补(opacity 0.55 + 保留底边 + pointer-events none);safe-area 落入 `.frame` 底部 padding、F1 Create、F4秋季输入栏;字体已自托管。
- **§7**:Toast 阴影 → `--lift- 2`(经别名);流式气泡 `aria-live="polite"`;F4 气泡/弹窗/输入栏全部去毛玻璃改实色(kit:禁 blur);全库阴影统一墨蓝 `rgba(23,106,145,α)`。

验证:`tsc --noEmit`、`next lint`、`next build` 全过;组件与 lib 中除 `layout.tsx` 的 themeColor 元数据外无 hex 字面量。

**有意偏离(待设计确认)**:F4 直播间顶部/底部的可读性 scrim 仍是渐变(kit 禁渐变,但视频背景上无 scrim 文字不可读);扇形卡堆未加 clip+string(与扇形动效冲突)。
