use serde::Serialize;
use sqlx::{Row, SqlitePool};
use tauri::{AppHandle, Manager};

#[derive(Serialize)]
pub struct PublicHighlightRetryJob {
    pub id: i64,
    pub job_type: String,
    pub payload_json: String,
    pub attempts: i64,
    pub created_at: i64,
    pub next_retry_at: i64,
}

async fn get_db_pool(app_handle: &AppHandle) -> Result<SqlitePool, String> {
    let state = app_handle.state::<crate::core::state::AppState>();
    let db_guard = state.db_pool.lock().await;
    db_guard
        .clone()
        .ok_or_else(|| "Database not initialized".to_string())
}

#[tauri::command]
pub async fn enqueue_public_highlight_job(
    app_handle: AppHandle,
    job_type: String,
    payload_json: String,
) -> Result<i64, String> {
    let db_pool = get_db_pool(&app_handle).await?;
    let now = chrono::Utc::now().timestamp_millis();

    let result = sqlx::query(
        r#"
        INSERT INTO public_highlight_retry_queue (job_type, payload_json, attempts, created_at, next_retry_at)
        VALUES (?1, ?2, 0, ?3, ?3)
        "#,
    )
    .bind(&job_type)
    .bind(&payload_json)
    .bind(now)
    .execute(&db_pool)
    .await
    .map_err(|e| format!("Failed to enqueue public highlight job: {}", e))?;

    Ok(result.last_insert_rowid())
}

#[tauri::command]
pub async fn get_public_highlight_retry_jobs(
    app_handle: AppHandle,
    limit: i64,
    now: i64,
    cutoff: i64,
) -> Result<Vec<PublicHighlightRetryJob>, String> {
    let db_pool = get_db_pool(&app_handle).await?;

    sqlx::query(
        r#"
        DELETE FROM public_highlight_retry_queue
        WHERE created_at < ?1
        "#,
    )
    .bind(cutoff)
    .execute(&db_pool)
    .await
    .map_err(|e| format!("Failed to purge public highlight jobs: {}", e))?;

    let rows = sqlx::query(
        r#"
        SELECT id, job_type, payload_json, attempts, created_at, next_retry_at
        FROM public_highlight_retry_queue
        WHERE created_at >= ?1 AND next_retry_at <= ?2
        ORDER BY next_retry_at ASC
        LIMIT ?3
        "#,
    )
    .bind(cutoff)
    .bind(now)
    .bind(limit)
    .fetch_all(&db_pool)
    .await
    .map_err(|e| format!("Failed to fetch public highlight jobs: {}", e))?;

    let mut jobs = Vec::with_capacity(rows.len());
    for row in rows {
        jobs.push(PublicHighlightRetryJob {
            id: row.try_get("id").map_err(|e| e.to_string())?,
            job_type: row.try_get("job_type").map_err(|e| e.to_string())?,
            payload_json: row.try_get("payload_json").map_err(|e| e.to_string())?,
            attempts: row.try_get("attempts").map_err(|e| e.to_string())?,
            created_at: row.try_get("created_at").map_err(|e| e.to_string())?,
            next_retry_at: row.try_get("next_retry_at").map_err(|e| e.to_string())?,
        });
    }

    Ok(jobs)
}

#[tauri::command]
pub async fn mark_public_highlight_job_success(
    app_handle: AppHandle,
    id: i64,
) -> Result<(), String> {
    let db_pool = get_db_pool(&app_handle).await?;
    sqlx::query("DELETE FROM public_highlight_retry_queue WHERE id = ?1")
        .bind(id)
        .execute(&db_pool)
        .await
        .map_err(|e| format!("Failed to delete public highlight job: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn update_public_highlight_job_failure(
    app_handle: AppHandle,
    id: i64,
    attempts: i64,
    next_retry_at: i64,
    last_error: Option<String>,
) -> Result<(), String> {
    let db_pool = get_db_pool(&app_handle).await?;
    sqlx::query(
        r#"
        UPDATE public_highlight_retry_queue
        SET attempts = ?1, next_retry_at = ?2, last_error = ?3
        WHERE id = ?4
        "#,
    )
    .bind(attempts)
    .bind(next_retry_at)
    .bind(last_error)
    .bind(id)
    .execute(&db_pool)
    .await
    .map_err(|e| format!("Failed to update public highlight job: {}", e))?;
    Ok(())
}
