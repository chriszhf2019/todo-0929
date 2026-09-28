package com.voxflow.todo;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONException;

/**
 * Small native copy of pending todos so the accessibility overlay can show
 * contextual reminders even when the WebView is in the background.
 */
final class TodoHintStore {

    private static final String PREFERENCES_NAME = "voxflow_todo_hints";
    private static final String TODOS_KEY = "todos";
    private static final Object LOCK = new Object();

    private TodoHintStore() {}

    static void save(Context context, String todosJson) {
        synchronized (LOCK) {
            preferences(context).edit().putString(TODOS_KEY, todosJson == null ? "[]" : todosJson).apply();
        }
    }

    static JSONArray get(Context context) {
        synchronized (LOCK) {
            String raw = preferences(context).getString(TODOS_KEY, "[]");
            try {
                return new JSONArray(raw);
            } catch (JSONException ignored) {
                return new JSONArray();
            }
        }
    }

    private static SharedPreferences preferences(Context context) {
        return context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE);
    }
}
