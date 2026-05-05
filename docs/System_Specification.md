# System Requirements Specification (SRS)

This document details the Functional and Non-functional Requirements to be implemented for **FocusTracker** (Task Reminder & Social Media Tracking Application).

## 1. Project Objective
Build a native, offline Desktop application that is highly optimized and lightweight for Ubuntu OS. The app helps users manage daily tasks while tracking their overall screen time, providing insights into their focus and digital habits.

## 2. Functional Requirements

### 2.1. Task Management
- **Create:** Users can create tasks with: Title (required), Description (optional), Due Date (optional), and **Priority Level** (required: High, Medium, Low).
- **Read:** Display lists of Pending and Completed tasks, visually distinct based on priority.
- **Update:** One-click checkbox to toggle task status between pending and completed.
- **Delete:** Permanently remove a task from the system.

### 2.2. Application & Screen Time Tracking
- **Browser Tracking:** Connects to a custom Browser Extension to track active seconds spent on specific domains and websites.
- **Desktop App Tracking:** Uses a custom GNOME Shell Extension to accurately detect which desktop application is currently focused on the screen (e.g., VS Code, Discord, Terminal) under Wayland security protocols.
- **Daily Aggregation:** Automatically accumulates total usage time per app/platform per day (resets at midnight).

### 2.3. OS Integration & Custom Notifications
- **Background Execution:** The app can be minimized and run continuously in the background without keeping the main window open.
- **System Tray:** A persistent icon on the Ubuntu system tray. Left-click to open a quick panel; right-click for a context menu (Open App, Quick View, Quit).
- **Custom Drop-down Notifications:** Used for Task Reminders. Instead of native Ubuntu notifications, the app will spawn a custom, frameless "drop-down" window (similar to mobile push notifications) from the top of the screen to deliver a modern, visually appealing alert experience.

### 2.4. Analytics & Reporting
- Display visual charts illustrating time distribution across different desktop applications and websites for the current day.
- Summarize total "distracted" time vs "focused/working" time daily.

## 3. Non-Functional Requirements

### 3.1. Performance & Lightweight Footprint
- **RAM Memory:** Background memory usage is estimated to be highly optimized, ideally around **50MB - 100MB**, acknowledging that exact hardware consumption may vary slightly in practice depending on the OS state.
- **Installation Size:** The executable binary must be compact, ideally under **20MB**.
- **Startup Speed:** The application must launch almost instantaneously (under 1 second).
- *Solution:* Utilizing the **Rust** core combined with the **Tauri** ecosystem.

### 3.2. UI/UX Experience
- The interface must follow modern design trends (Glassmorphism, Dark mode, vibrant accents).
- Interactions must feature smooth micro-animations and 60fps transitions (rendered via WebKitGTK).

### 3.3. Data & Privacy
- The application operates **100% offline**.
- All task data and browsing history are stored locally using **SQLite**. Absolutely no telemetry or data is sent to external servers.

## 4. System Constraints
- Optimized specifically for Linux environments (**Ubuntu**).
- The Browser Extension requires manual installation via "Developer Mode" in the browser, as it is intended for personal, offline use.
