use std::sync::{Arc, Mutex};
use std::sync::atomic::{AtomicUsize, Ordering};
use tokio::net::TcpListener;
use tokio_tungstenite::accept_async;
use futures_util::StreamExt;
use serde::Deserialize;
use rusqlite::Connection;
use tauri::{AppHandle, Emitter};
use std::time::Duration;

use crate::db;

pub static BROWSER_CLIENT_COUNT: AtomicUsize = AtomicUsize::new(0);

#[derive(Deserialize, Debug)]
struct WsPayload {
    source:           Option<String>,
    app_name:         Option<String>,
    action:           Option<String>,
    platform:         Option<String>,
    duration_seconds: Option<i64>,
}

/// Returns true if `name` is a known browser process name.
fn is_browser(name: &str) -> bool {
    let n = name.to_lowercase();
    ["chrome", "chromium", "firefox", "brave", "edge", "opera"]
        .iter()
        .any(|b| n.contains(b))
}

/// Normalizes any browser process name to the canonical string `"Browser"`.
/// All other app names are returned unchanged.
/// This keeps Chrome / Firefox / Brave merged as a single entry in the DB.
fn normalize_app(name: &str) -> &str {
    if is_browser(name) { "Browser" } else { name }
}

pub async fn start(db_conn: Arc<Mutex<Connection>>, app_handle: AppHandle) {
    let active_app: Arc<Mutex<Option<String>>> = Arc::new(Mutex::new(None));

    // Background ticker: records 1 second for the currently focused desktop app.
    // Desktop apps are always top-level (parent_app = None).
    let ticker_db     = Arc::clone(&db_conn);
    let ticker_app    = active_app.clone();
    let ticker_handle = app_handle.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(1));
        let mut ticks = 0u64;
        loop {
            interval.tick().await;

            let current_app = {
                let lock = ticker_app.lock().unwrap();
                lock.clone()
            };

            if let Some(app_name) = current_app {
                // Normalize browser names → "Browser" so all browser flavours
                // merge into one entry instead of creating separate rows.
                let name = normalize_app(&app_name);
                if let Ok(conn) = ticker_db.lock() {
                    let _ = db::accumulate_time(&conn, name, 1, None);
                    let _ = db::accumulate_time_hourly(&conn, name, 1, None);
                }
            }

            ticks += 1;
            if ticks % 5 == 0 {
                let _ = ticker_handle.emit("stats-updated", ());
            }
        }
    });

    let listener = TcpListener::bind("127.0.0.1:8080").await
        .expect("Failed to bind WebSocket on port 8080");

    loop {
        let Ok((stream, _)) = listener.accept().await else { continue };
        let db_conn    = Arc::clone(&db_conn);
        let app_handle = app_handle.clone();
        let active_app = active_app.clone();

        tokio::spawn(async move {
            let ws = match accept_async(stream).await {
                Ok(w)  => w,
                Err(e) => { println!("Handshake error: {:?}", e); return; }
            };
            let (mut _write, mut read) = ws.split();

            BROWSER_CLIENT_COUNT.fetch_add(1, Ordering::Relaxed);
            app_handle.emit("ws-client-changed", ()).ok();

            while let Some(Ok(msg)) = read.next().await {
                if let Ok(text) = msg.to_text() {
                    if let Ok(payload) = serde_json::from_str::<WsPayload>(text) {
                        handle_payload(payload, &db_conn, &app_handle, &active_app);
                    }
                }
            }

            BROWSER_CLIENT_COUNT.fetch_sub(1, Ordering::Relaxed);
            app_handle.emit("ws-client-changed", ()).ok();
        });
    }
}

fn handle_payload(
    payload:    WsPayload,
    db_conn:    &Arc<Mutex<Connection>>,
    app_handle: &AppHandle,
    active_app: &Arc<Mutex<Option<String>>>,
) {
    match payload.source.as_deref() {
        Some("desktop") => {
            // GNOME extension telling us which window is in focus.
            if let Some(app_name) = payload.app_name {
                println!("📌 [FocusTracker] GNOME focus -> {}", app_name);
                let mut lock = active_app.lock().unwrap();
                *lock = Some(app_name);
            }
        }
        _ => {
            if payload.action.as_deref() == Some("log_time") {
                if let (Some(platform), Some(duration)) =
                    (payload.platform, payload.duration_seconds)
                {
                    // If a browser is in focus, record it as parent_app using
                    // the normalized "Browser" name (not the specific flavour).
                    let parent: Option<&str> = {
                        let lock = active_app.lock().unwrap();
                        if lock.as_deref().map(is_browser).unwrap_or(false) {
                            Some("Browser")
                        } else {
                            None
                        }
                    };

                    println!(
                        "🌐 [FocusTracker] Browser report -> platform={}, duration={}s, parent={:?}",
                        platform, duration, parent
                    );

                    let Ok(conn) = db_conn.lock() else { return };
                    db::accumulate_time(&conn, &platform, duration, parent).ok();
                    db::accumulate_time_hourly(&conn, &platform, duration, parent).ok();
                    app_handle.emit("stats-updated", ()).ok();
                }
            }
        }
    }
}
