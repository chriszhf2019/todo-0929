package com.voxflow.todo;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Keeps a small, local ledger of foreground apps observed by the accessibility
 * service. The frontend uses this to show per-app usage hints and to decide what
 * follow-up actions to offer. No data leaves the device.
 */
final class AppUsageMonitorStore {

    private static final String PREFERENCES_NAME = "voxflow_usage_monitor";
    private static final String SESSIONS_KEY = "sessions";
    private static final int MAX_RECORDS = 30;
    private static final long SESSION_GAP_MS = 10 * 60 * 1000L;
    private static final Object LOCK = new Object();

    private AppUsageMonitorStore() {}

    static void record(
        Context context,
        String packageName,
        String appName,
        int lineCount,
        String lastTextSnippet
    ) {
        synchronized (LOCK) {
            JSONArray current = read(context);
            JSONObject record = null;
            int existingIndex = -1;

            for (int index = 0; index < current.length(); index++) {
                JSONObject candidate = current.optJSONObject(index);
                if (candidate != null && packageName.equals(candidate.optString("packageName"))) {
                    record = candidate;
                    existingIndex = index;
                    break;
                }
            }

            long now = System.currentTimeMillis();
            if (record == null) {
                record = new JSONObject();
                try {
                    record.put("packageName", packageName);
                    record.put("appName", appName);
                    record.put("sessionStartAt", now);
                    record.put("lastSeenAt", now);
                    record.put("eventCount", 1);
                    record.put("lineCount", lineCount);
                    record.put("lastTextSnippet", lastTextSnippet == null ? "" : lastTextSnippet);
                    record.put("totalForegroundMs", 0);
                    record.put("lastSessionDurationMs", 0);
                } catch (JSONException ignored) {
                }
            } else {
                try {
                    long lastSeenAt = record.optLong("lastSeenAt", now);
                    long total = record.optLong(
                        "totalForegroundMs",
                        record.optLong("sessionDurationMs", 0)
                    );
                    long gap = now - lastSeenAt;
                    boolean sameSession = gap >= 0 && gap <= SESSION_GAP_MS;
                    long sessionStartAt = sameSession ? record.optLong("sessionStartAt", now) : now;
                    long lastSessionDuration = sameSession ? Math.max(0, now - sessionStartAt) : 0;

                    record.put("appName", appName);
                    record.put("eventCount", record.optInt("eventCount", 0) + 1);
                    record.put("lineCount", lineCount);
                    record.put("lastTextSnippet", lastTextSnippet == null ? "" : lastTextSnippet);
                    record.put("lastSeenAt", now);
                    record.put("sessionStartAt", sessionStartAt);
                    record.put("lastSessionDurationMs", lastSessionDuration);
                    record.put("totalForegroundMs", total + (sameSession ? Math.max(0, gap) : 0));
                } catch (JSONException ignored) {
                }
            }

            JSONArray updated = new JSONArray();
            updated.put(record);
            for (int index = 0; index < current.length() && updated.length() < MAX_RECORDS; index++) {
                if (index == existingIndex) continue;
                JSONObject other = current.optJSONObject(index);
                if (other != null) updated.put(other);
            }

            preferences(context).edit().putString(SESSIONS_KEY, updated.toString()).apply();
        }
    }

    static JSONArray get(Context context) {
        synchronized (LOCK) {
            return read(context);
        }
    }

    static void clear(Context context) {
        synchronized (LOCK) {
            preferences(context).edit().remove(SESSIONS_KEY).apply();
        }
    }

    private static JSONArray read(Context context) {
        String raw = preferences(context).getString(SESSIONS_KEY, "[]");
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
