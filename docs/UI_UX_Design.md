# UI/UX Design Specification

This document details the User Interface (UI) and User Experience (UX) design of FocusTracker, built on the **"Focused Clarity"** philosophy — a clean, distraction-free experience that never sacrifices usability for aesthetics.

## 1. Design Philosophy
- **Focused Clarity:** The interface is uncluttered, but every interactive element must be immediately obvious and easy to use. Minimalism serves the user, not the other way around.
- **Single-View Flow:** No traditional navigation sidebar. All content is organized into three screen states: **Focus View**, **Daily Insight**, and **Settings** — toggled via two small icons in the top-right corner.
- **Negative Space + Context:** Maximizes negative space while providing just enough contextual information (date, task count) so the user always knows where they are.
- **Color & Lighting:** Dark mode (`#0f172a` / `#1e1e2e`) with off-white typography (`#f8fafc`). Subtle glow effects and Glassmorphism for elevation. No hard borders.

## 2. Application Layout
The application operates within a single window (800×600). Content is center-aligned on a single vertical axis with a `max-width` of 560px (expanding to `760px` for the side-by-side insight view). Two small icon buttons live in the top-right corner at all times.

**Screen States:**
| Icon | Action |
|------|--------|
| `⚙`  | Toggle **Settings** overlay |
| `◉ / ◎` | Toggle **Daily Insight** (◉ = open insight, ◎ = close / back to focus) |

Both icons are muted (30% opacity) by default; they brighten and get a glass background on hover, and show an active accent state when their view is open.

---

### 2.1. Focus View (Default Working Screen)

This is the primary screen that appears on launch.

```
┌─────────────────────────────────────────────┐
│  Sun, May 4                  3 tasks pending│  ← header bar
├─────────────────────────────────────────────┤
│                                             │
│        WHAT IS YOUR MAIN FOCUS?             │  ← 11px uppercase muted
│         Write clean auth module             │  ← 36px hero title
│                                             │
│  ○ ● Write clean auth module               │
│       2026-05-06                            │  ← due date (11px cyan)
│  ○ ● Design DB schema                      │
│  ✓ ● Init project structure                │  ← done: strikethrough, 38% opacity
│                                             │
│                         [ + Add Task ]      │  ← footer button, bottom-right
└─────────────────────────────────────────────┘
```

**Header Bar:**
- Left: today's date, e.g. `Sun, May 4` — 12px, muted
- Right: `N tasks pending` — 12px, muted
- Separated from the body by a very faint 1px line (`rgba(255,255,255,0.05)`)

**Hero Area:**
- Small uppercase label: *"What is your main focus right now?"* (11px, letter-spacing 1px)
- Oversized task title (36px, weight 700): the highest-priority pending task, sorted by priority then due date
- When no tasks remain: placeholder at 18px with near-invisible opacity

**Task List:**
- No card borders — each row is just: `[checkbox] [priority dot] [title + due date] [× delete on hover]`
- **Checkbox:** 20px round, 1.5px border, fills with cyan glow when checked
- **Priority dot:** 6px circle, always visible, glows at 33% opacity
  - 🔴 High: `#ff8585`
  - 🟡 Medium: `#fbbf24`
  - 🔵 Low: `#60a5fa`
- **Due date:** shown below the title in 11px cyan when present
- **Completed tasks:** pushed to the bottom, 38% opacity, strikethrough on title
- Row hover: subtle `rgba(255,255,255,0.04)` background, delete button fades in

**Footer:**
- `+ Add Task` button (gradient, right-aligned) opens the Add Task modal
- Separated from task list by a very faint 1px line

---

### 2.2. Add Task Modal

Triggered by the `+ Add Task` button. Appears centered over the app with a blurred backdrop.

```
┌──────────────────────────────────────────┐
│  Task title                              │
│  ┌────────────────────────────────────┐  │
│  │ Write something…                   │  │
│  └────────────────────────────────────┘  │
│                                          │
│  Due date  optional                      │
│  ┌────────────────────────────────────┐  │
│  │ 📅  ____-__-__                     │  │
│  └────────────────────────────────────┘  │
│                                          │
│  Priority                                │
│  ( ●  ●  ● )  Medium   ← colored label  │
│   r   y   b                              │
│                                          │
│  ─────────────────────────────────────── │
│  [Cancel]                 [Add Task →]   │
└──────────────────────────────────────────┘
```

- **Glass card:** `rgba(30,30,46,0.92)` background, `border-radius: 20px`, `backdrop-filter: blur(24px)`
- `autoFocus` on the title input → user can start typing immediately
- **Enter** in title or date input submits the form
- **Escape** closes the modal without saving
- Clicking outside the card closes the modal
- **Priority selector:**
  - Three buttons with a 28×28px transparent hit area, 10px visual dot via `::after` pseudo-element
  - Inactive: 25% opacity; hover: 60%; selected: 100% opacity + scale(1.4) + glow shadow
  - A colored text label (e.g., *"Medium"*) appears to the right of the dots, updating as the user clicks

---

### 2.3. Insights (Daily & Weekly)

Reached by clicking the `◉` icon. This section provides detailed screen time analytics, inspired by the clean, balanced aesthetics of iOS Screen Time.

The view has two main tabs: **Today** and **This Week**, utilizing a **side-by-side two-column layout** to maximize window space (expanding the view container width).

**Layout Structure:**
- **Left Column:** App Usage Ranking list.
- **Right Column:** Screen Time Chart.

#### A. Today (Daily Insight)
- **Left: App Usage Ranking**
  - A list of tracked applications and websites, sorted in descending order by total usage time today.
  - **Hierarchy & Deduplication:** Browser applications (e.g., Google Chrome, Firefox) group their active website usage as sub-items. This prevents double-counting overall screen time (the browser's total time represents the actual time it was focused).
  ```text
  Google Chrome   ················  2h 15m
    ↳ YouTube     ················  1h 05m
    ↳ Facebook    ················  0h 12m
    ↳ Other       ················  0h 58m
  Terminal        ················  0h 45m
  ```
  - Parent Application (e.g., Chrome): 16px, weight 600, dynamically color-hashed.
  - Sub-items (e.g., YouTube): 14px, indented with a branching icon (`↳`).
  - Dot leader: CSS `border-bottom: 2px dotted rgba(255,255,255,0.09)` between name and time.
  - Time: 14px, tabular-nums, muted.
- **Right: Hourly Screen Time Chart**
  - A beautiful, balanced vertical bar chart showing total screen time usage per hour of the current day.
  - The x-axis represents the hours of the day.
  - The y-axis visually represents the duration without strict numerical levels (focusing on visual trends).
  - Bars use a subtle gradient and rounded top corners.

#### B. This Week (Weekly Insight)
- **Left: App Usage Ranking**
  - The list displays the total usage of apps/websites accumulated over the entire week, sorted descending.
- **Right: Daily Screen Time Chart**
  - Similar to the daily chart, but columns represent the days of the week (Mon, Tue, Wed, etc.).
  - Shows the total screen time duration for each day.

#### C. App Details (Drill Down)
- Clicking on any app in the left-hand "App Usage Ranking" list transitions the right-hand column to a detailed view for that specific application.
- The chart updates to show the usage of *only* that application.
  - **From "Today" tab:** The chart shows the app's usage distributed by hour throughout the day.
  - **From "This Week" tab:** The chart shows the app's usage distributed by day across the week.
- A "Back" button returns the right panel to the main chart overview.

- Return to Focus View by clicking `◎`

---

### 2.4. Settings

Reached by clicking `⚙`. A minimal view showing read-only system info.

- Extension status (GNOME tracker, Browser extension)
- WebSocket server address (`ws://127.0.0.1:8080`)
- Database file path
- Glass cards with muted section labels, consistent with Focus View aesthetics

---

## 3. Micro-Animations & Interactions

- **View transitions:** `page-enter` — `fadeSlideUp` 200ms ease-out when any view mounts
- **Modal open:** scales up from 0.97 + fades in over 200ms; backdrop fades in over 180ms
- **Task check:** immediate opacity drop (38%) + strikethrough on the label
- **Hover states:** ghost glass background `rgba(255,255,255,0.04–0.06)`, no hard borders
- **Priority dots (modal):** scale(1.4) + glow shadow on the active dot, smooth 200ms transition
- **Nav icons:** opacity 0.35 → 1 on hover; accent color + glass background when view is active
- **Add Task button:** gradient background, lifts `translateY(-1px)` on hover

## 4. Color & Typography Reference

| Token | Value |
|-------|-------|
| Background | `#0f172a` |
| Surface | `#1e1e2e` |
| Glass bg | `rgba(255,255,255,0.05)` |
| Glass border | `rgba(255,255,255,0.10)` |
| Text | `#f8fafc` |
| Text muted | `#94a3b8` |
| Accent 1 (purple) | `#c084fc` |
| Accent 2 (cyan) | `#22d3ee` |
| Gradient | `135deg, #c084fc → #22d3ee` |
| Priority High | `#ff8585` |
| Priority Medium | `#fbbf24` |
| Priority Low | `#60a5fa` |
| Font | Inter or Outfit, system-ui fallback |
| Base radius | `16px` (cards), `8px` (rows), `20px` (modal) |
| Transition | `200ms ease-out` |
