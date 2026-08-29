# Paper Companion — design guideline

**Audience: a coding agent implementing screens.** Read this file top to bottom before
writing UI code. It is prescriptive. Where it says MUST or NEVER, treat it as a
constraint, not advice.

**Status:** art direction agreed. Colour is the signed-off **My Stories Color System**
— seven values, reproduced exactly in `tokens.css`. One structural shade is added on top
of them (`--ink`, see §4); nothing else may be.

**Revised 2026-08-29** against a new five-screen mock set. The palette did not
change — the swatch sheet in that set matches `tokens.css` value for value. What
changed is how the materials are used:

- **Gingham is promoted.** It was described here as an empty-state fill; it is
  actually the signature surface of the product and recurs on nearly every
  screen. See §3.1 — the old rule is withdrawn.
- The identity is stated as a **primary triad** (deep blue / light blue / cream)
  in §2.1, so the seven-value table is read as roles rather than a flat list.
- New materials and components: letter paper, envelope, video player, named
  speaker rows, character-picker grid, ribbon-as-back. §3, §5, §6.5–6.7.
- One thing in the new mock must **not** ship as drawn — the speaker names are
  lettered in a blue that fails contrast on cream. §12.10.

If you find yourself typing a hex literal outside `tokens.css`, stop. Every colour
decision belongs in that file.

```
style-kit/
  tokens.css              ← the only place colour, type, spacing and motion are defined
  components.css          ← component recipes. Class names are the contract.
  example/my-space.html   ← reference implementation. Match this quality bar.
  assets/ip-*.png         ← 6 character stickers, transparent, keyline baked in
  DESIGN-GUIDELINE.md     ← this file
```

Start every screen with:

```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Shantell+Sans:ital,wght@0,400;0,600;0,700&family=Quicksand:wght@500;600;700&display=swap">
<link rel="stylesheet" href="tokens.css">
<link rel="stylesheet" href="components.css">
...
<div class="screen grain"> ... </div>
```

---

## 1. The thesis

**A quiet paper world where a small animal keeps you company.**

Every surface is paper: cream stock, soft grain, things pinned and taped and hung.
Every control is a physical object you could press with a thumb — it has a lit face
and a shadowed underside. The character is a vinyl sticker laid on top of that paper.

Three consequences that decide most questions:

1. **Things hang, rest, or are stuck down. Nothing floats in abstract space.** A card
   is clipped to a string or taped at a corner. A button sits on its own edge. If you
   are about to place an element with nothing holding it, you are off-style.
2. **Depth comes from a real light source, always top-left.** Shadows fall down and
   slightly right, and they are blue-tinted, never grey or black.
3. **The screen is calm; the character is the energy.** Ambient motion belongs to the
   character and the hanging photos. Chrome does not wiggle.

Emotional register: **gentle, unhurried, slightly handmade.** This app is where someone
brings a bad afternoon. It must never feel loud, clinical, or gamified into a chore.

---

## 2. Foundations

### 2.1 Colour

The identity is a **primary triad — a deep blue, a light blue, and a warm off-white.**
Read a finished screen and it should resolve to those three; everything else is
support. Deep blue is `--ink-blue` (with `--ink` for small text), light blue is
`--sky` and its paler sibling `--mist`, and the off-white is `--cream`. Butter
Yellow is the single "press me" colour, and Coral is a spot mark — neither is
part of the identity, and a screen that leads with either is off-system.

The seven signed-off colours, with the share of screen each should occupy. The ratio is
a real constraint, not a description: **a screen that is mostly Clear Sky is off-system.**

| Swatch | Token | Value | Share | Use for |
|---|---|---|---|---|
| Cream Paper | `--cream` | `#FFF9EE` | 45% | The ground. Also cards — see below. |
| Mist Blue | `--mist` | `#D9EEF4` | 20% | Cloud band, wells, empty photo areas |
| Clear Sky | `--sky` | `#8ED4E8` | 15% | Tab bar, own chat bubble, large fills |
| Story Blue | `--story` | `#2F9FC8` | 10% | Strings, clips, icon strokes, illustration |
| Butter Yellow | `--butter` | `#FFD86A` | 7% | Primary buttons, discs, washi tape |
| Ink Blue | `--ink-blue` | `#176A91` | 3% | Hand-lettered titles, ribbon fill |
| Coral | `--coral` | `#F2674F` | spot | Tiny graphic marks only |

Plus exactly one derived value:

| `--ink` | `#125571` | Deep Ink | **All text under 19px.** A darker step of Ink Blue. Required — see §4. |

**Cards are separated by shadow, not by fill.** Nothing in this system is lighter than
Cream Paper, so a polaroid on the cream ground is *the same cream*, lifted by
`--lift-2`. Do not invent a lighter white to make cards pop; use elevation.

**Coral is never a text background** and never a fill larger than about 24px. It is a
scarf, a heart, a dot.

### 2.2 Type

Two families, loaded from Google Fonts.

| Role | Family | Size token | Weight | Notes |
|---|---|---|---|---|
| Story titles, screen titles | Shantell Sans | `--t-display` 30 / `--t-title` 22 | 600 | The handwritten voice. Colour `--ink-blue`. |
| Everything else | Quicksand | `--t-lead` 19 → `--t-micro` 11 | 500–700 | Rounded, soft. Never below 11px. |

`--t-lead` is **19px, not 18** — deliberately. Button labels sit on Butter Yellow, which
only clears contrast at the WCAG large-text threshold (≥18.66px bold). 18px bold misses
it; 19px bold clears it. Do not reduce this value.

- Shantell Sans is my substitute for whatever the designer lettered the mock in.
  **Confirm the real face before build** — if it is licensed, swap it in `tokens.css`
  only.
- CJK: the product owner confirmed **Xiaolai SC (小赖字体)** as the CJK hand face
  (2026-08-29, self-hosted like the Latin faces — never a CDN at demo time). Stack:
  Latin hand → XiaolaiSC → PingFang SC. Latin body → XiaolaiSC → PingFang SC.
  Chinese titles SHOULD use XiaolaiSC at weight 400–600 (the file ships Regular only;
  600 is synthetic — confirmed acceptable by product).
- Hand-lettered text is for **names of things**: a story title, a screen title. Never
  for instructions, errors, dates, or numbers.

### 2.3 Space, radius, elevation

- Gutter is `--screen-x` (20px), both sides, every screen, no exceptions.
- Content MUST clear `--tabbar-h` (96px) plus the 30px wave above it. Bottom-anchored
  elements sit at `bottom: 150px` or higher.
- Radii come from tokens. **The only near-square corner in the system is a printed
  photo inside a frame** (`--r-photo`, 6px). Everything else is 16px or rounder.
- Three blur levels (`--lift-1/2/3`). 2026-08-29 product calibration: shadow colour moved
  from saturated Ink Blue to **near-black navy `rgba(15,45,66,α)` at low alpha with tight
  blur** — saturated blue shadows read as a glow; navy at 5–10% reads as a natural drop
  shadow. Still never grey.
- Pressable things use a hard underside (`--press-butter`, `--press-sky`) *instead of*
  a blur, and translate down onto it when active. This is the single most
  identity-carrying detail in the system; do not replace it with an opacity change.

### 2.4 Motion

| Class | What | When |
|---|---|---|
| `.is-bob` | 3.6s vertical float | The character, always |
| `.is-sway` | 4.4s rotation about the top edge | Anything hung from a string |
| `.is-pop` | 320ms scale-in with overshoot | Something arriving: a new card, a chat bubble |

Use `--ease-bounce` for taps and arrivals, `--ease-soft` for everything else.
Every ambient animation MUST be disabled under `prefers-reduced-motion` —
`components.css` already does this; do not add animations outside it without the guard.

---

## 3. Materials

These are the vocabulary. Use them; do not invent new ones.

| Material | What it is | Rules |
|---|---|---|
| **Gingham** `.gingham` | Blue check weave on cream | **The signature surface of the product** — see §3.1. Use it widely. Never behind running text. |
| **Washi tape** `.tape` / `.tape--gingham` | Translucent butter strip, or the gingham weave | Max **one per screen**. Always rotated 5–10°. Always on a corner. |
| **Binder clip + string** | Blue clip, 2px string to the top edge | Used in **pairs**. Anything clipped MUST also carry `.is-sway`. |
| **Cloud band** | Scalloped `--mist` shape at the top | The shelf things hang from. One per screen, top only. |
| **Wave** | Scalloped edge above the tab bar | Mirrors the cloud band. Tab bar only. |
| **Letter paper** `.letter` | Cream stock ruled in `--mist` | The "tell me about it" surface. `line-height` MUST equal the rule period. |
| **Envelope** `.envelope` | Cream body, gingham flap lining | Closes a letter. The lining is where gingham belongs, not the body. |
| **Paper grain** `.grain` | Noise overlay | On `.screen`, always, always `pointer-events: none`. |
| **Sparkle ticks** | 2–3 short blue strokes | Marks something interactive or new. Max 2 clusters per screen. |

> **Landed since this table was signed off (2026-08-29, product-confirmed):**
>
> | Material | What it is | Rules |
> |---|---|---|
> | **Wave band (2.5D)** | Top fabric awning with gradient | Near-white top → Mist body → **Sky only at the scalloped edge**; scallops must be irregular; outer shadow black 5%, x+1/y+2, 2px blur |
> | **Envelope wings** | Bottom decoration: two overlapping gingham triangles | Hypotenuses run past centre so flaps overlap at the bottom edge; centre stays open cream — never under text |
> | **Card clips** | One clip per polaroid, colours rotate (story/butter/ink-blue/sky) | The clip belongs to the CARD — it travels with the card through the fan. Supersedes the same-day “wall clips” call (2026-08-29, product reversal). |
> | **Cinema** | Premiere scene: side curtains + valance + spotlight + Ink-Blue screen bezel | The one place a large dark frame is allowed (the cinema screen) |
> | **Floor** | Straight warm strip at screen bottom, `--floor` | Replaces the scalloped wave floor; walls stay cream |

### 3.1 Gingham — the signature surface

This is the pattern people will recognise the product by, and the previous
revision of this guideline got it wrong: it called gingham an empty-state fill
and told you to keep it on the empty story slot. **That rule is withdrawn.**
Gingham is a material you reach for often, not a placeholder.

Woven from `--story` at 26% on `--cream`, at one of two scales — the tokens are
`--gingham-field` (13px, large areas) and `--gingham-strip` (7px, narrow bands).
Below roughly 40px the field scale reads as coarse mush; step down to the strip
scale rather than shrinking the field one.

**Use it for:** the photo field of a polaroid (empty *or* holding a character);
the ground behind a featured character; the inside of an envelope flap; tape;
decorative edge bands; the field behind a swatch or a card.

**Never:**
- Behind running text. The weave and 15px body text fight, and the contrast
  figure stops being meaningful once the ground alternates.
- At more than one scale in the same element.
- Recoloured. It is blue-on-cream. A butter or coral gingham is a different
  product.
- As the whole screen ground. Cream still has to dominate (§2.1) — gingham is
  a field *inside* the layout, and a screen tiled edge to edge in it breaks
  the ratio.

---

## 4. Contrast — read this before styling any text

I measured every pairing in the signed-off palette. **Three combinations that look
natural in the swatch sheet cannot carry text**, and one is in the art-direction mock.

### The problem

No colour in the seven is dark enough to carry small text on Clear Sky or Butter Yellow.
Ink Blue — the darkest — reaches only 3.63:1 on Clear Sky and 4.36:1 on Butter, both
short of the 4.5:1 that body text needs.

### The fix

**One derived shade: `--ink` `#125571`.** It is Ink Blue darkened along its own hue,
so it reads as the same colour family. It clears everything:

| `--ink` #125571 on | Ratio | |
|---|---|---|
| Cream Paper | 7.82:1 | AAA |
| Mist Blue | 6.82:1 | AAA |
| Clear Sky | 4.97:1 | AA |
| Butter Yellow | 5.96:1 | AA |

Ink Blue `#176A91` stays exactly as issued, for hand-lettered titles and ribbon fills
where the text is large.

### Approved pairings

| Foreground | Background | Ratio | Verdict |
|---|---|---|---|
| `--ink` | `--cream` | 7.82:1 | AAA — default body |
| `--ink` | `--mist` | 6.82:1 | AAA |
| `--ink` | `--butter` | 5.96:1 | AA — button labels |
| `--ink` | `--sky` | 4.97:1 | AA — tab labels |
| `--cream` | `--ink-blue` | 5.71:1 | AA — ribbon, solid blue buttons |
| `--ink-blue` | `--cream` | 5.71:1 | AA |
| `--ink-blue` | `--mist` | 4.99:1 | AA |

### Never

| Foreground | Background | Ratio | |
|---|---|---|---|
| `--cream` | `--sky` | 1.57:1 | **The mock does this** in the tab bar. It must not ship. |
| `--story` | `--mist` | 2.53:1 | Story Blue is a fill, not a text colour |
| `--story` | `--cream` | 2.90:1 | Same |
| `--cream` | `--story` | 2.90:1 | Story Blue cannot be a text ground either |
| `--cream` | `--coral` | 2.93:1 | Coral cannot be a text ground |

**Story Blue and Coral carry no text in either direction.** They are for strokes, fills
and illustration. If you need a solid blue button with cream text, use Ink Blue.

### Also required, and absent from the mock

- Every interactive target ≥44×44 CSS px. `components.css` sets `min-height` on `.btn`
  and `.tab`; you MUST pad icon-only controls yourself.
- A visible `:focus-visible` state — already defined; do not remove the outline.
- Real `alt` text on character images that identify a person, empty `alt` when decorative.

---

## 5. Components

All defined in `components.css`. Class names are the contract.

| Class | Replaces (old design) | Notes |
|---|---|---|
| `.polaroid` | mounted print | Cream frame, deep bottom mat, photo inside at `--r-photo`. `.polaroid--sm` for secondary, `--focus` for the centre one. |
| `.polaroid__caption` | title below the fan | Hand-lettered, sits *inside* the mat. |
| `.disc` | `+` badge | 92px butter circle with a 5px underside. The add-a-story affordance. |
| `.btn` / `.btn--sky` | primary button | Puffy. `--butter` face by default. |
| `.ribbon` | screen title | Notched right end. Never a plain rectangle. |
| `.tabbar` / `.tab` | *(new)* | Three tabs: Stories, Discover, Me. Wave sits above as a sibling SVG. |
| `.bubble` / `.bubble--mine` | chat bubble | Own message is `--sky` with `--ink` text. |
| `.bubble--action` | *(new)* | Butter bubble offering an action ("Play it again?"). Never for speech. |
| `.speaker` / `.speaker__name` | *(new)* | Named speaker row. The name is REQUIRED in group scenes. `--ink-blue`, never `--story`. |
| `.ip-chip` | speaker avatar | 40px, `object-position: 50% 20%` to crop to the face. |
| `.gingham` / `--strip` / `--field` | dashed empty slot | Now the signature surface, not an empty state — see §3.1. |
| `.letter` / `.envelope` | *(new)* | Ruled writing surface and its envelope. |
| `.player` | *(new)* | The reenactment video: Clear Sky frame, Mist screen, Ink Blue controls. |
| `.picker` | *(new)* | Character-selection grid. Selection is a butter ring, never a colour swap. |
| `.ribbon--back` | *(new)* | The ribbon doubling as the back control on inner screens. |

**A row of `.polaroid` at the same `top` produces one continuous cream band across the
screen** — their bottom mats line up. Stagger their vertical positions by ≥20px, or use
`.polaroid--sm` on the outer ones. `example/my-space.html` shows this.

---

## 6. Screen recipes

The information architecture is unchanged from the previous handoff — only the skin
moves. Five screens:

### 6.1 My Space — `example/my-space.html` is the reference

Cloud band + ribbon → a line of polaroids hanging from clips, centre one focused →
hand-lettered story title with a butter rule → primary button → the character perched
bottom-right → tab bar.

The character MUST sit on the same horizontal line as the title and the button — this
was an explicit review decision, not an accident of layout.

### 6.2 Speak It

Voice is the default way to start a story; typing is the fallback, never the reverse.
- Transcript in Quicksand 19/1.6, committed text in `--ink`, in-flight tail in
  `--ink-blue` at 4.99:1 (**not** a pale tint — the old design used a 1.78:1 grey for
  live text, which was unreadable).
- The character listens inside expanding `--mist` halo rings.
- Mic is a `.disc` scaled to 84px, `--sky` face.
- 8-bar waveform in `--story`, driven by real amplitude.

### 6.3 Title & Cover

The title and cover both **arrive generated**. The user edits **only the title**.
No cover picker. No regenerate button. The date is not editable.
- Cover shown as one `.polaroid--focus`, centred.
- Title on an editable line with a pencil affordance, hand font, `--ink-blue`.
- Transcript recap in a `--mist` well.

### 6.4 Sandplay / Story room

- The reenactment video sits at the top in a `.player` — Clear Sky frame, Mist screen.
  While it generates, the screen holds the frame and shows a waiting state inside it;
  do not collapse the frame and reflow the page when the video arrives.
- Below it, a **group chat**: several characters, one voice each, arguing different
  perspectives on the same event. Not a list of options.
- Every speaker carries `.ip-chip` **and** `.speaker__name`. With three characters
  talking, a 40px sticker alone does not identify who is speaking.
- A `.bubble--action` may offer to replay the scene. One at a time, and never
  mixed into the middle of the transcript — it belongs at the current end.
- One character may show a typing indicator while others have spoken — the transport
  must support per-character streaming and out-of-order arrival.
- Mic-first input bar: `--sky` mic disc, cream input field, butter send.

### 6.5 Write a letter

A letter to a future self — the slow, written counterpart to Speak It.
- Title in the hand font, centred. **If the title is CJK, set it in the UI font at
  700 instead** (§2.2) — the hand font has no CJK coverage and will fall back
  mid-heading.
- Body on `.letter`. The `line-height` must equal the rule period or the text
  drifts off the lines as it wraps.
- The salutation ("Dear future me,") uses `.letter__open` — Latin only, same reason.
- An `.envelope` closes the composition, gingham inside the flap.
- Two ways out, and they are not equal: a `--sky` mic disc to dictate, and the
  butter `.btn` to send. Sending is the primary action; dictating is an input mode.

### 6.6 Choose a friend

- The current companion sits large on a `.gingham--field`, name beneath in the
  hand font, with a check badge marking it as current.
- `.picker` grid below, 4 across. Selection is a butter ring plus a check —
  never a background colour swap, which would fight the character art.
- Primary `.btn` commits the choice. Nothing changes until it is pressed.

### 6.7 Other Spaces

Two-column grid of `.polaroid--sm`, each holding a character sticker on a tinted field,
with a name and story count beneath. Field tint alternates `--mist` / `--sky`, assigned
per user, not per grid position.

---

## 7. The character system

Six stickers ship in `assets/`: `ip-cat-dj`, `ip-bunny-scout`, `ip-dog-captain`,
`ip-pom-scarf`, `ip-shiba-tee`, `ip-bear-crown`.

- Each PNG has the **white sticker keyline baked in**. Do not add a border, outline,
  drop shadow, or filter — the keyline *is* the treatment.
- Transparent background. Always bottom-aligned in its container.
- Ground the character with a soft `--butter` ellipse beneath it (see `.companion__shadow`
  in the example). A character with no shadow floats and looks pasted on.
- The user's own character always carries `.is-bob`.
- **One art style only.** An earlier painterly set exists in the old handoff; it is
  superseded. Do not mix the two — they read as two different products.

---

## 8. Illustration and icons

- **Icons:** 2.2px stroke in `--story` or `currentColor`, round caps and joins, 22–24px box.
  Never filled glyphs, never emoji.
- **Story covers:** soft flat shapes — a sun, a hill, a horizon. Two to three colours,
  no gradients, no outlines. Delivered at **206×244 minimum**, centre-weighted, always
  cropped `object-fit: cover`.
- **Everything in the current build is a placeholder**, both covers and the earlier
  avatars. The six stickers above are real.

---

## 9. Copy

- Sentence case. No title case, no ALL CAPS.
- Buttons name the action: "Keep this story", "Open the sandplay". Never "Submit",
  "OK", "Confirm".
- Dates read naturally — "12 June 2024".
- Errors say what happened and what to do. No apologies, no blame.
- The app never congratulates the user for having feelings.

---

## 10. Hard rules

**NEVER**
- Put a hex literal outside `tokens.css`.
- Put cream or white text on `--sky`, `--story`, or `--coral`.
- Use `--story` or `--coral` as a text colour or a text background.
- Use a grey shadow. Shadows are `rgba(15,45,66,α)` (near-black navy, low alpha, tight blur).
- Use gradients, glassmorphism, or blur backdrops.
- Use emoji as an icon.
- Set CJK in the hand font.
- Put more than one washi tape or two sparkle clusters on a screen.
- Animate chrome.

- Break the usage ratio in §2.1 — cream dominates every screen.

**ALWAYS**
- Compose from `components.css` classes before writing new CSS.
- Give every hung element a clip, a string, and `.is-sway`.
- Give every pressable thing an underside and a press state.
- Keep 44px minimum touch targets.
- Guard animation with `prefers-reduced-motion`.
- Ground characters with a shadow.

---

## 11. Migration from the previous design

The old skin was warm cream, a serif (Newsreader), and a moss-green accent. Mapping:

| Old | New |
|---|---|
| `#FAF8F3` paper | `--cream` |
| `#F6F3EA` panel | `--mist` |
| `#5C6B4A` moss accent | `--butter` (buttons) / `--sky` (fills) |
| `#1F1C17` ink | `--ink` |
| Newsreader serif | Shantell Sans (titles) + Quicksand (UI) |
| Mounted print, square corners | `.polaroid`, rounded, hung from clips |
| Dashed empty mount | `.gingham` photo area + `.disc` |
| Flat filled pill button | `.btn` with an underside |
| Avatar medallion with progress ring | Sticker + butter shadow + `.lv` chip |
| *(none)* | Tab bar — the new design adds bottom navigation, which changes the IA: My Space is now one of three roots, not the only one. |

**That last row is a product change, not a skin change.** "Discover" and "Me" are new
destinations with no designs. Flag them rather than inventing them.

---

## 12. Not signed off

Do not treat these as decided. Ask before building on them.

1. **The `--ink` addition.** The palette needs one darker shade to be usable for
   small text (§4). Confirm `#125571`, or supply your own darker step of Ink Blue.
2. **The hand-lettered face.** Shantell Sans is a stand-in.
3. **Tab bar contents.** Three tabs are in the mock; only "Stories" has screens.
4. **"Discover" and "Me".** Still no designs.
5. **Story cover art.** Placeholder.
6. **Whether the level system survives** the redesign, and what it measures.
   The 2026-08-29 mocks show no Lv chip anywhere — that may be an answer, or an
   omission. Confirm before deleting the component.
7. **Empty state.** Still undesigned, and now the most important gap — the art
   direction mock is arguably an empty state, but the zero-story case is unconfirmed.
8. **Story detail view.** Tapping a polaroid still has no destination.
9. **Where "Write a letter" (§6.5) lives.** It arrived as a screen with no
   route: it is not the Speak It flow, and no tab or button in any mock opens
   it. Needs a home in the IA before it can be built.
10. **Speaker-name colour in the Story room mock.** Drawn in a light blue that
    measures ≈2.9:1 on cream. `components.css` sets `--ink-blue` instead. If the
    intent was genuinely the lighter blue, the palette needs a new value — it
    cannot ship as drawn.
11. **Whether the video frame stays Clear Sky.** It is the largest saturated
    blue field in the system and sits right at the §2.1 ratio ceiling.
