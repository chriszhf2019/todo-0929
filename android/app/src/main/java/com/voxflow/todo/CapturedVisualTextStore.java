package com.voxflow.todo;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

final class CapturedVisualTextStore {

    private static final String PREFERENCES_NAME = "voxflow_visual_capture";
    private static final String CONTENT_KEY = "captured_content";
    private static final int MAX_RECORDS = 50;
    private static final Object LOCK = new Object();

    private CapturedVisualTextStore() {}

    static void add(Context context, JSONObject record) {
        synchronized (LOCK) {
            JSONArray current = read(context);
            JSONArray updated = new JSONArray();
            updated.put(record);

            String recordId = record.optString("id");
            for (int index = 0; index < current.length() && updated.length() < MAX_RECORDS; index++) {
                JSONObject existing = current.optJSONObject(index);
                if (existing == null || recordId.equals(existing.optString("id"))) continue;
                updated.put(existing);
            }

            preferences(context).edit().putString(CONTENT_KEY, updated.toString()).apply();
        }
    }

    static JSONArray get(Context context) {
        synchronized (LOCK) {
            return read(context);
        }
    }

    static void clear(Context context) {
        synchronized (LOCK) {
            preferences(context).edit().remove(CONTENT_KEY).apply();
        }
    }

    private static JSONArray read(Context context) {
        try {
            return new JSONArray(preferences(context).getString(CONTENT_KEY, "[]"));
        } catch (JSONException ignored) {
            return new JSONArray();
        }
    }

    private static SharedPreferences preferences(Context context) {
        return context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE);
    }
}
