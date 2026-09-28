package com.voxflow.todo;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

final class CapturedNotificationStore {

    private static final String PREFERENCES_NAME = "voxflow_native_capture";
    private static final String NOTIFICATIONS_KEY = "notifications";
    private static final int MAX_RECORDS = 100;
    private static final Object LOCK = new Object();

    private CapturedNotificationStore() {}

    static void add(Context context, JSONObject record) {
        synchronized (LOCK) {
            JSONArray current = readArray(context);
            JSONArray updated = new JSONArray();
            updated.put(record);

            String recordId = record.optString("id");
            for (int index = 0; index < current.length() && updated.length() < MAX_RECORDS; index++) {
                JSONObject existing = current.optJSONObject(index);
                if (existing == null || recordId.equals(existing.optString("id"))) continue;
                updated.put(existing);
            }

            preferences(context).edit().putString(NOTIFICATIONS_KEY, updated.toString()).apply();
        }
    }

    static JSONArray get(Context context) {
        synchronized (LOCK) {
            return readArray(context);
        }
    }

    static void clear(Context context) {
        synchronized (LOCK) {
            preferences(context).edit().remove(NOTIFICATIONS_KEY).apply();
        }
    }

    private static JSONArray readArray(Context context) {
        String raw = preferences(context).getString(NOTIFICATIONS_KEY, "[]");

        try {
            return new JSONArray(raw);
        } catch (JSONException ignored) {
            return new JSONArray();
        }
    }

    private static SharedPreferences preferences(Context context) {
        return context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE);
    }
}
