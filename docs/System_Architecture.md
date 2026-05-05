# System Architecture (Tauri - Rust + React)

This document describes the overall architecture, technologies, and database schema for the FocusTracker application, designed to perfectly balance a **stunning interface** with **maximum, lightweight performance**.

## 1. Architecture Overview

To meet the requirement for a highly optimized, low-level footprint while maintaining a beautiful "stunning" interface, we utilize the **Tauri** framework.

- **Backend / Core:** Written in **Rust** (a low-level language compiled to native machine code, extremely fast, minimal RAM usage, and memory-safe).
  - Manages OS interactions (System Tray, Custom Frameless Notification Windows).
  - Handles high-speed SQLite database read/writes.
  - Runs a lightweight background asynchronous WebSocket Server.
- **Frontend (UI):** **ReactJS (Vite) + Vanilla CSS**.
  - Rendered via **WebKitGTK** (Ubuntu's built-in lightweight web engine, completely avoiding heavy Chromium binaries).
  - Enables complex CSS like Glassmorphism and fluid animations.

## 2. Data Flow

### 2.1. React (UI) <--> Rust (Core)
Uses **Tauri IPC (Inter-Process Communication)**.
- **UI Commands:** JS calls Rust functions via `invoke('add_task', { taskData })`.
- **Rust Execution:** Executes at machine-code speed, saves to SQLite, and returns the result instantly.
- **Events:** Rust emits events back to the UI for real-time updates (e.g., live social media statistics).

### 2.2. Tracking Extensions <--> Rust (Core)
Uses **Rust Async WebSocket (`tokio-tungstenite`)**.
- Rust opens a local port `ws://127.0.0.1:8080`.
- **Browser Extension:** Sends lightweight payloads: `{ source: 'browser', platform: 'facebook', duration: 5 }`.
- **GNOME Shell Extension:** Monitors the Wayland window manager. When the active window changes, it sends a payload: `{ source: 'desktop', app_name: 'Code', duration: 5 }`.
- Rust processes these payloads with near-zero overhead and updates SQLite.

## 3. Custom Notification System
Instead of relying on the native `notify-send` (which can look unappealing on Ubuntu), Rust will programmatically spawn a secondary Tauri window when an alert is needed.
- **Window Properties:** Frameless, transparent background, always on top, unresizable.
- **Behavior:** Rust injects the warning message into this window, plays a CSS slide-down animation from the top edge of the screen (similar to mobile drop-down notifications), waits a few seconds, and then closes the window.

## 4. Database Schema (SQLite)
Uses **SQLite3** via the Rust `rusqlite` library. The database file is stored at `~/.local/share/FocusTracker/database.sqlite`.

### `tasks` Table
- `id` (INTEGER PRIMARY KEY)
- `title` (TEXT) - Task name
- `description` (TEXT) - Optional details
- `status` (TEXT) - 'pending' | 'completed'
- `due_date` (DATETIME)
- `created_at` (DATETIME)

### `social_stats` Table
- `id` (INTEGER PRIMARY KEY)
- `platform` (TEXT) - (e.g., 'facebook')
- `date` (DATE) - (YYYY-MM-DD)
- `time_spent_seconds` (INTEGER)

### `settings` Table
- `key` (TEXT PRIMARY KEY)
- `value` (TEXT)
