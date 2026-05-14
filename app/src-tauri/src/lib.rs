mod db;
mod ws_server;

use std::sync::{Arc, Mutex};
use rusqlite::Connection;
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Emitter, Manager, WindowEvent, State,
};

type DbState = Arc<Mutex<Connection>>;

#[tauri::command]
fn get_tasks(state: State<DbState>) -> Result<Vec<db::Task>, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    db::get_tasks(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn add_task(state: State<DbState>, task: db::Task) -> Result<i64, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    db::add_task(&conn, &task).map_err(|e| e.to_string())
}

#[tauri::command]
fn toggle_task(state: State<DbState>, id: i64) -> Result<(), String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    db::toggle_task_status(&conn, id).map_err(|e| e.to_string())
}

#[tauri::command]
fn update_task(state: State<DbState>, task: db::Task) -> Result<(), String> {
    if task.id.is_none() {
        return Err("Task id is required for update".to_string());
    }
    let conn = state.lock().map_err(|e| e.to_string())?;
    db::update_task(&conn, &task).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_task(state: State<DbState>, id: i64) -> Result<(), String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    db::delete_task(&conn, id).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_today_stats(state: State<DbState>) -> Result<Vec<db::SocialStat>, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    db::get_today_stats(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_yesterday_stats(state: State<DbState>) -> Result<Vec<db::SocialStat>, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    db::get_yesterday_stats(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_today_hourly_stats(state: State<DbState>) -> Result<Vec<db::HourlyStat>, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    db::get_today_hourly_stats(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_yesterday_hourly_stats(state: State<DbState>) -> Result<Vec<db::HourlyStat>, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    db::get_yesterday_hourly_stats(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_stats_history(state: State<DbState>, start_date: String, end_date: String) -> Result<Vec<db::SocialStat>, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    db::get_stats_history(&conn, &start_date, &end_date).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_hourly_stats_for_date(state: State<DbState>, date: String) -> Result<Vec<db::HourlyStat>, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    db::get_hourly_stats(&conn, &date).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_all_platforms(state: State<DbState>) -> Result<Vec<db::PlatformEntry>, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    db::get_all_platforms(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_app_categories(state: State<DbState>) -> Result<Vec<db::AppCategory>, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    db::get_app_categories(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn update_app_category(state: State<DbState>, app: tauri::AppHandle, id: i64, name: String, color: String) -> Result<(), String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    db::update_app_category(&conn, id, &name, &color).map_err(|e| e.to_string())?;
    app.emit("categories-updated", ()).ok();
    Ok(())
}

#[tauri::command]
fn add_app_category(state: State<DbState>, app: tauri::AppHandle, name: String, color: String) -> Result<i64, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    let id = db::add_app_category(&conn, &name, &color).map_err(|e| e.to_string())?;
    app.emit("categories-updated", ()).ok();
    Ok(id)
}

#[tauri::command]
fn set_platform_category(state: State<DbState>, app: tauri::AppHandle, platform: String, category_id: Option<i64>) -> Result<(), String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    db::set_platform_category(&conn, &platform, category_id).map_err(|e| e.to_string())?;
    app.emit("categories-updated", ()).ok();
    Ok(())
}

#[tauri::command]
fn get_ws_status() -> usize {
    ws_server::BROWSER_CLIENT_COUNT.load(std::sync::atomic::Ordering::Relaxed)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let db_path = db::get_db_path();
    let conn = Connection::open(&db_path).expect("Failed to open SQLite database");
    db::init_db(&conn).expect("Failed to initialize database");
    let db_state: DbState = Arc::new(Mutex::new(conn));

    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .manage(db_state.clone())
        .invoke_handler(tauri::generate_handler![
            get_tasks,
            add_task,
            update_task,
            toggle_task,
            delete_task,
            get_today_stats,
            get_today_hourly_stats,
            get_yesterday_stats,
            get_yesterday_hourly_stats,
            get_stats_history,
            get_hourly_stats_for_date,
            get_all_platforms,
            get_app_categories,
            add_app_category,
            update_app_category,
            set_platform_category,
            get_ws_status,
        ])
        .on_window_event(|window, event| match event {
            WindowEvent::CloseRequested { api, .. } => {
                api.prevent_close();
                window.hide().unwrap();
            }
            _ => {}
        })
        .setup(move |app| {
            let quit_i = MenuItem::with_id(app, "quit", "Quit FocusTracker", true, None::<&str>)?;
            let show_i = MenuItem::with_id(app, "show", "Show Dashboard", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .tooltip("FocusTracker")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => std::process::exit(0),
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::Click {
                        button: tauri::tray::MouseButton::Left,
                        button_state: tauri::tray::MouseButtonState::Up,
                        ..
                    } = event {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            let app_handle = app.handle().clone();
            let db_for_ws = Arc::clone(&db_state);
            tauri::async_runtime::spawn(async move {
                ws_server::start(db_for_ws, app_handle).await;
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
