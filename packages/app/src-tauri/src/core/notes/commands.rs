use super::models::*;
use sqlx::SqlitePool;
use tauri::{AppHandle, Manager};
use uuid::Uuid;

#[tauri::command]
pub async fn create_note(app_handle: AppHandle, data: CreateNoteData) -> Result<Note, String> {
    // 验证输入数据
    data.validate()?;

    let db_pool = get_db_pool(&app_handle).await?;
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp_millis();

    // 将book_meta序列化为JSON字符串
    let book_meta_json = if let Some(ref meta) = data.book_meta {
        Some(serde_json::to_string(meta).map_err(|e| format!("序列化书籍信息失败: {}", e))?)
    } else {
        None
    };

    sqlx::query(
        r#"
        INSERT INTO notes (
            id, book_id, book_meta, title, content, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&id)
    .bind(&data.book_id)
    .bind(&book_meta_json)
    .bind(&data.title)
    .bind(&data.content)
    .bind(now)
    .bind(now)
    .execute(&db_pool)
    .await
    .map_err(|e| format!("创建笔记失败: {}", e))?;

    Ok(Note::new(
        id,
        data.book_id,
        data.book_meta,
        data.title,
        data.content,
        now,
        now,
    ))
}

#[tauri::command]
pub async fn update_note(app_handle: AppHandle, data: UpdateNoteData) -> Result<Note, String> {
    // 验证输入数据
    data.validate()?;

    let db_pool = get_db_pool(&app_handle).await?;
    let now = chrono::Utc::now().timestamp_millis();

    // 先取当前值，未提供的字段沿用旧值
    let current = sqlx::query(
        r#"
        SELECT book_id, book_meta, title, content
        FROM notes
        WHERE id = ?
        "#,
    )
    .bind(&data.id)
    .fetch_optional(&db_pool)
    .await
    .map_err(|e| format!("查询笔记失败: {}", e))?;

    if current.is_none() {
        return Err("笔记不存在".to_string());
    }

    use sqlx::Row;
    let row = current.unwrap();
    let current_book_id: Option<String> = row.try_get("book_id").unwrap_or(None);
    let current_book_meta_str: Option<String> = row.try_get("book_meta").unwrap_or(None);
    let current_book_meta: Option<BookMeta> =
        current_book_meta_str.and_then(|s| serde_json::from_str(&s).ok());
    let current_title: Option<String> = row.try_get("title").unwrap_or(None);
    let current_content: Option<String> = row.try_get("content").unwrap_or(None);

    let final_book_id = data.book_id.clone().flatten().or(current_book_id);
    let final_book_meta = if let Some(ref meta_opt) = data.book_meta {
        meta_opt.clone()
    } else {
        current_book_meta
    };

    let book_meta_json = final_book_meta
        .as_ref()
        .map(|meta| serde_json::to_string(meta).map_err(|e| format!("序列化书籍信息失败: {}", e)))
        .transpose()?;

    let final_title = data.title.clone().flatten().or(current_title);
    let final_content = data.content.clone().flatten().or(current_content);

    let result = sqlx::query(
        r#"
        UPDATE notes
        SET
            book_id = ?,
            book_meta = ?,
            title = ?,
            content = ?,
            updated_at = ?
        WHERE id = ?
        "#,
    )
    .bind(final_book_id)
    .bind(book_meta_json)
    .bind(final_title)
    .bind(final_content)
    .bind(now)
    .bind(&data.id)
    .execute(&db_pool)
    .await
    .map_err(|e| format!("更新笔记失败: {}", e))?;

    if result.rows_affected() == 0 {
        return Err("笔记不存在".to_string());
    }

    // 获取更新后的笔记
    get_note_by_id(app_handle, data.id.clone())
        .await?
        .ok_or("更新后获取笔记失败".to_string())
}

#[tauri::command]
pub async fn delete_note(app_handle: AppHandle, id: String) -> Result<(), String> {
    let db_pool = get_db_pool(&app_handle).await?;

    let result = sqlx::query("DELETE FROM notes WHERE id = ?")
        .bind(&id)
        .execute(&db_pool)
        .await
        .map_err(|e| format!("删除笔记失败: {}", e))?;

    if result.rows_affected() == 0 {
        return Err("笔记不存在".to_string());
    }

    Ok(())
}

#[tauri::command]
pub async fn get_note_by_id(app_handle: AppHandle, id: String) -> Result<Option<Note>, String> {
    let db_pool = get_db_pool(&app_handle).await?;

    let row = sqlx::query("SELECT * FROM notes WHERE id = ?")
        .bind(&id)
        .fetch_optional(&db_pool)
        .await
        .map_err(|e| format!("查询笔记失败: {}", e))?;

    match row {
        Some(row) => {
            let note = Note::from_db_row(&row).map_err(|e| format!("转换查询结果失败: {}", e))?;
            Ok(Some(note))
        }
        None => Ok(None),
    }
}

#[tauri::command]
pub async fn get_notes(
    app_handle: AppHandle,
    options: Option<NoteQueryOptions>,
) -> Result<Vec<Note>, String> {
    let db_pool = get_db_pool(&app_handle).await?;
    let opts = options.unwrap_or_default();

    // 排序
    let sort_by = opts.sort_by.as_deref().unwrap_or("updated_at");
    let sort_order = opts.sort_order.as_deref().unwrap_or("desc");

    let valid_sort_fields = ["updated_at", "created_at", "title"];
    let sort_field = if valid_sort_fields.contains(&sort_by) {
        sort_by
    } else {
        "updated_at"
    };

    let order = if sort_order.to_lowercase() == "asc" {
        "ASC"
    } else {
        "DESC"
    };

    // 分页
    let limit = opts.limit.unwrap_or(50);
    let offset = opts.offset.unwrap_or(0);

    let rows = execute_normal_query(&db_pool, &opts, sort_field, order, limit, offset).await;

    let rows = rows.map_err(|e| format!("查询笔记失败: {}", e))?;

    let notes: Result<Vec<Note>, sqlx::Error> = rows.iter().map(Note::from_db_row).collect();

    notes.map_err(|e| format!("转换查询结果失败: {}", e))
}

async fn execute_normal_query(
    db_pool: &SqlitePool,
    opts: &NoteQueryOptions,
    sort_field: &str,
    order: &str,
    limit: i64,
    offset: i64,
) -> Result<Vec<sqlx::sqlite::SqliteRow>, sqlx::Error> {
    let mut query_builder = sqlx::QueryBuilder::new("SELECT * FROM notes");

    if let Some(ref book_id) = opts.book_id {
        query_builder.push(" WHERE book_id = ").push_bind(book_id);
    }

    query_builder.push(&format!(" ORDER BY {} {}", sort_field, order));
    query_builder.push(&format!(" LIMIT {} OFFSET {}", limit, offset));

    query_builder.build().fetch_all(db_pool).await
}

async fn get_db_pool(app_handle: &AppHandle) -> Result<SqlitePool, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("获取应用目录失败: {}", e))?;

    let db_path = app_data_dir.join("database").join("app.db");
    let db_url = format!("sqlite:{}", db_path.display());

    SqlitePool::connect(&db_url)
        .await
        .map_err(|e| format!("数据库连接失败: {}", e))
}
