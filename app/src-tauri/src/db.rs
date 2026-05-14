use rusqlite::{Connection, Result, params};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use chrono::Timelike;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Task {
    pub id:          Option<i64>,
    pub title:       String,
    pub description: Option<String>,
    pub status:      String,
    pub due_date:    Option<String>,
    pub priority:    Option<String>,
    pub created_at:  Option<String>,
}

/// A daily screen-time row.
///
/// `parent_app` is `Some("Google Chrome")` when this platform is a website
/// being tracked inside a browser — meaning this row is a *child* of that
/// browser's own row and must NOT be included in top-level time totals to
/// avoid double-counting.  `None` means this is a top-level desktop app.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SocialStat {
    pub platform:           String,
    pub date:               String,
    pub time_spent_seconds: i64,
    pub parent_app:         Option<String>,
}

/// Same parent-app semantics as `SocialStat`, split by hour-of-day.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HourlyStat {
    pub platform:           String,
    pub date:               String,
    pub hour:               i64,
    pub time_spent_seconds: i64,
    pub parent_app:         Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppCategory {
    pub id:    i64,
    pub name:  String,
    pub color: String,
}

/// A tracked platform (desktop app or website) with its category assignment.
/// `is_website` is true when the platform comes from the browser extension
/// (parent_app = 'Browser'). The "Browser" entry itself is never returned.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PlatformEntry {
    pub platform:       String,
    pub total_seconds:  i64,
    pub category_id:    Option<i64>,
    pub category_name:  Option<String>,
    pub category_color: Option<String>,
    pub is_website:     bool,
}

pub fn get_db_path() -> PathBuf {
    let mut path = dirs::data_local_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("FocusTracker");
    std::fs::create_dir_all(&path).ok();
    path.push("database.sqlite");
    path
}

pub fn init_db(conn: &Connection) -> Result<()> {
    conn.execute_batch("
        CREATE TABLE IF NOT EXISTS tasks (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            title       TEXT NOT NULL,
            description TEXT,
            status      TEXT NOT NULL DEFAULT 'pending',
            due_date    DATETIME,
            priority    TEXT NOT NULL DEFAULT 'medium',
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS social_stats (
            id                 INTEGER PRIMARY KEY AUTOINCREMENT,
            platform           TEXT NOT NULL,
            date               DATE NOT NULL,
            time_spent_seconds INTEGER NOT NULL DEFAULT 0,
            parent_app         TEXT,
            UNIQUE(platform, date)
        );
        CREATE TABLE IF NOT EXISTS social_stats_hourly (
            id                 INTEGER PRIMARY KEY AUTOINCREMENT,
            platform           TEXT NOT NULL,
            date               DATE NOT NULL,
            hour               INTEGER NOT NULL,
            time_spent_seconds INTEGER NOT NULL DEFAULT 0,
            parent_app         TEXT,
            UNIQUE(platform, date, hour)
        );
        CREATE TABLE IF NOT EXISTS settings (
            key   TEXT PRIMARY KEY,
            value TEXT
        );
        CREATE TABLE IF NOT EXISTS app_categories (
            id    INTEGER PRIMARY KEY AUTOINCREMENT,
            name  TEXT NOT NULL UNIQUE,
            color TEXT NOT NULL DEFAULT '#888888'
        );
        CREATE TABLE IF NOT EXISTS platform_category (
            platform    TEXT PRIMARY KEY,
            category_id INTEGER REFERENCES app_categories(id) ON DELETE SET NULL
        );
    ")?;

    // Migrations — each is a no-op if the column already exists
    let _ = conn.execute("ALTER TABLE tasks ADD COLUMN priority TEXT NOT NULL DEFAULT 'medium'", []);
    let _ = conn.execute("ALTER TABLE social_stats ADD COLUMN parent_app TEXT", []);
    let _ = conn.execute("ALTER TABLE social_stats_hourly ADD COLUMN parent_app TEXT", []);

    Ok(())
}

pub fn add_task(conn: &Connection, task: &Task) -> Result<i64> {
    let priority = task.priority.as_deref().unwrap_or("medium");
    conn.execute(
        "INSERT INTO tasks (title, description, status, due_date, priority) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![task.title, task.description, task.status, task.due_date, priority],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn get_tasks(conn: &Connection) -> Result<Vec<Task>> {
    let mut stmt = conn.prepare(
        "SELECT id, title, description, status, due_date, priority, created_at
         FROM tasks ORDER BY created_at DESC"
    )?;
    let tasks = stmt.query_map([], |row| {
        Ok(Task {
            id:          row.get(0)?,
            title:       row.get(1)?,
            description: row.get(2)?,
            status:      row.get(3)?,
            due_date:    row.get(4)?,
            priority:    row.get(5)?,
            created_at:  row.get(6)?,
        })
    })?
    .collect::<Result<Vec<_>>>()?;
    Ok(tasks)
}

pub fn update_task(conn: &Connection, task: &Task) -> Result<()> {
    let priority = task.priority.as_deref().unwrap_or("medium");
    conn.execute(
        "UPDATE tasks SET title=?1, description=?2, due_date=?3, priority=?4 WHERE id=?5",
        params![task.title, task.description, task.due_date, priority, task.id],
    )?;
    Ok(())
}

pub fn toggle_task_status(conn: &Connection, id: i64) -> Result<()> {
    conn.execute(
        "UPDATE tasks SET status = CASE WHEN status = 'pending' THEN 'completed' ELSE 'pending' END WHERE id = ?1",
        params![id],
    )?;
    Ok(())
}

pub fn delete_task(conn: &Connection, id: i64) -> Result<()> {
    conn.execute("DELETE FROM tasks WHERE id = ?1", params![id])?;
    Ok(())
}

/// Accumulate `seconds` for a platform on today's date.
///
/// `parent_app` — pass `Some("Google Chrome")` when this platform is a website
/// being tracked inside a known browser, `None` for desktop-app rows.
///
/// ON CONFLICT: time is always added; parent_app adopts the new value when one
/// is provided (COALESCE keeps the old value only if the new one is NULL, so an
/// existing parent link is never erased by a late desktop-side write).
pub fn accumulate_time(conn: &Connection, platform: &str, seconds: i64, parent_app: Option<&str>) -> Result<()> {
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    conn.execute(
        "INSERT INTO social_stats (platform, date, time_spent_seconds, parent_app)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(platform, date) DO UPDATE SET
           time_spent_seconds = time_spent_seconds + excluded.time_spent_seconds,
           parent_app = COALESCE(excluded.parent_app, parent_app)",
        params![platform, today, seconds, parent_app],
    )?;
    Ok(())
}

/// Hourly variant of `accumulate_time` — records which hour-of-day the time fell in.
pub fn accumulate_time_hourly(conn: &Connection, platform: &str, seconds: i64, parent_app: Option<&str>) -> Result<()> {
    let now   = chrono::Local::now();
    let today = now.format("%Y-%m-%d").to_string();
    let hour  = now.hour() as i64;
    conn.execute(
        "INSERT INTO social_stats_hourly (platform, date, hour, time_spent_seconds, parent_app)
         VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(platform, date, hour) DO UPDATE SET
           time_spent_seconds = time_spent_seconds + excluded.time_spent_seconds,
           parent_app = COALESCE(excluded.parent_app, parent_app)",
        params![platform, today, hour, seconds, parent_app],
    )?;
    Ok(())
}

pub fn get_today_stats(conn: &Connection) -> Result<Vec<SocialStat>> {
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    query_stats_for_date(conn, &today)
}

pub fn get_yesterday_stats(conn: &Connection) -> Result<Vec<SocialStat>> {
    let yesterday = (chrono::Local::now() - chrono::Duration::days(1))
        .format("%Y-%m-%d").to_string();
    query_stats_for_date(conn, &yesterday)
}

fn query_stats_for_date(conn: &Connection, date: &str) -> Result<Vec<SocialStat>> {
    let mut stmt = conn.prepare(
        "SELECT platform, date, time_spent_seconds, parent_app
         FROM social_stats WHERE date = ?1
         ORDER BY parent_app NULLS FIRST, time_spent_seconds DESC"
    )?;
    let rows = stmt.query_map(params![date], map_social_stat)?
        .collect::<Result<Vec<_>>>();
    rows
}

pub fn get_stats_history(conn: &Connection, start_date: &str, end_date: &str) -> Result<Vec<SocialStat>> {
    let mut stmt = conn.prepare(
        "SELECT platform, date, time_spent_seconds, parent_app
         FROM social_stats
         WHERE date >= ?1 AND date <= ?2
         ORDER BY date ASC, parent_app NULLS FIRST, time_spent_seconds DESC"
    )?;
    let rows = stmt.query_map(params![start_date, end_date], map_social_stat)?
        .collect::<Result<Vec<_>>>();
    rows
}

pub fn get_hourly_stats(conn: &Connection, date: &str) -> Result<Vec<HourlyStat>> {
    let mut stmt = conn.prepare(
        "SELECT platform, date, hour, time_spent_seconds, parent_app
         FROM social_stats_hourly WHERE date = ?1
         ORDER BY hour ASC, parent_app NULLS FIRST, time_spent_seconds DESC"
    )?;
    let rows = stmt.query_map(params![date], |row| {
        Ok(HourlyStat {
            platform:           row.get(0)?,
            date:               row.get(1)?,
            hour:               row.get(2)?,
            time_spent_seconds: row.get(3)?,
            parent_app:         row.get(4)?,
        })
    })?
    .collect::<Result<Vec<_>>>();
    rows
}

fn map_social_stat(row: &rusqlite::Row<'_>) -> rusqlite::Result<SocialStat> {
    Ok(SocialStat {
        platform:           row.get(0)?,
        date:               row.get(1)?,
        time_spent_seconds: row.get(2)?,
        parent_app:         row.get(3)?,
    })
}

pub fn get_today_hourly_stats(conn: &Connection) -> Result<Vec<HourlyStat>> {
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    get_hourly_stats(conn, &today)
}

pub fn get_yesterday_hourly_stats(conn: &Connection) -> Result<Vec<HourlyStat>> {
    let yesterday = (chrono::Local::now() - chrono::Duration::days(1))
        .format("%Y-%m-%d").to_string();
    get_hourly_stats(conn, &yesterday)
}

/// Returns all categorizable platforms (desktop apps + websites, excluding "Browser" itself),
/// joined with their category assignment if any.
pub fn get_all_platforms(conn: &Connection) -> Result<Vec<PlatformEntry>> {
    let mut stmt = conn.prepare(
        "SELECT ss.platform,
                SUM(ss.time_spent_seconds)                            AS total_seconds,
                pc.category_id,
                cat.name                                              AS category_name,
                cat.color                                             AS category_color,
                CASE WHEN MAX(ss.parent_app) IS NOT NULL THEN 1 ELSE 0 END AS is_website
         FROM social_stats ss
         LEFT JOIN platform_category pc ON pc.platform = ss.platform
         LEFT JOIN app_categories cat   ON cat.id = pc.category_id
         WHERE (ss.parent_app IS NULL AND ss.platform != 'Browser')
            OR ss.parent_app = 'Browser'
         GROUP BY ss.platform
         ORDER BY SUM(ss.time_spent_seconds) DESC"
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(PlatformEntry {
            platform:       row.get(0)?,
            total_seconds:  row.get(1)?,
            category_id:    row.get(2)?,
            category_name:  row.get(3)?,
            category_color: row.get(4)?,
            is_website:     row.get::<_, i64>(5)? != 0,
        })
    })?
    .collect::<Result<Vec<_>>>()?;
    Ok(rows)
}

pub fn get_app_categories(conn: &Connection) -> Result<Vec<AppCategory>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, color FROM app_categories ORDER BY name"
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(AppCategory { id: row.get(0)?, name: row.get(1)?, color: row.get(2)? })
    })?
    .collect::<Result<Vec<_>>>()?;
    Ok(rows)
}

pub fn update_app_category(conn: &Connection, id: i64, name: &str, color: &str) -> Result<()> {
    conn.execute(
        "UPDATE app_categories SET name = ?1, color = ?2 WHERE id = ?3",
        params![name, color, id],
    )?;
    Ok(())
}

pub fn add_app_category(conn: &Connection, name: &str, color: &str) -> Result<i64> {
    conn.execute(
        "INSERT INTO app_categories (name, color) VALUES (?1, ?2)",
        params![name, color],
    )?;
    Ok(conn.last_insert_rowid())
}

/// Assign or remove a category for a platform.
/// Passing `None` for `category_id` removes the assignment.
pub fn set_platform_category(conn: &Connection, platform: &str, category_id: Option<i64>) -> Result<()> {
    if let Some(cat_id) = category_id {
        conn.execute(
            "INSERT OR REPLACE INTO platform_category (platform, category_id) VALUES (?1, ?2)",
            params![platform, cat_id],
        )?;
    } else {
        conn.execute(
            "DELETE FROM platform_category WHERE platform = ?1",
            params![platform],
        )?;
    }
    Ok(())
}
