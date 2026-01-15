type InvokeArgs = Record<string, unknown> | undefined;

const now = () => Date.now();

export async function invoke<T>(command: string, args?: InvokeArgs): Promise<T> {
  switch (command) {
    case "get_public_highlight_retry_jobs":
      return [] as T;
    case "get_notes":
    case "get_book_notes":
    case "get_tags":
    case "get_skills":
    case "get_books":
    case "get_books_with_status":
    case "get_threads_by_book_id":
    case "get_all_threads":
    case "get_all_reading_sessions":
    case "get_reading_sessions_by_book":
      return [] as T;
    case "get_note_by_id":
    case "get_tag_by_id":
    case "get_tag_by_name":
    case "get_skill_by_id":
    case "get_book_by_id":
    case "get_book_with_status_by_id":
    case "get_book_status":
    case "get_latest_thread_by_book_id":
    case "get_thread_by_id":
    case "get_reading_session":
    case "get_active_reading_session":
      return null as T;
    case "get_app_data_dir":
      return "/tmp" as T;
    case "create_note": {
      const data = (args as { data?: Record<string, unknown> } | undefined)?.data ?? {};
      return { id: `note-${now()}`, createdAt: now(), updatedAt: now(), ...data } as T;
    }
    case "update_note": {
      const data = (args as { data?: Record<string, unknown> } | undefined)?.data ?? {};
      return { createdAt: now(), updatedAt: now(), ...data } as T;
    }
    case "create_thread":
    case "edit_thread": {
      const payload = (args as { payload?: Record<string, unknown> } | undefined)?.payload ?? {};
      return { id: `thread-${now()}`, createdAt: now(), updatedAt: now(), ...payload } as T;
    }
    default:
      return undefined as T;
  }
}

export function convertFileSrc(path: string): string {
  return path;
}

export async function isTauri(): Promise<boolean> {
  return false;
}
