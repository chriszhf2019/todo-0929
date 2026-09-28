package com.voxflow.todo;

import android.Manifest;
import android.app.Activity;
import android.app.NotificationManager;
import android.content.ComponentName;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.provider.CallLog;
import android.provider.Settings;
import android.speech.RecognizerIntent;
import android.view.accessibility.AccessibilityManager;
import androidx.activity.result.ActivityResult;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

@CapacitorPlugin(
    name = "VoxFlowNative",
    permissions = {
        @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO }),
        @Permission(
            alias = "callLog",
            strings = { Manifest.permission.READ_CALL_LOG, Manifest.permission.READ_PHONE_STATE }
        )
    }
)
public class VoxFlowNativePlugin extends Plugin {

    @PluginMethod
    public void getCaptureStatus(PluginCall call) {
        call.resolve(buildStatus());
    }

    @PluginMethod
    public void requestRuntimePermissions(PluginCall call) {
        requestPermissionForAliases(new String[] { "microphone", "callLog" }, call, "runtimePermissionsCallback");
    }

    @PermissionCallback
    private void runtimePermissionsCallback(PluginCall call) {
        call.resolve(buildStatus());
    }

    @PluginMethod
    public void openNotificationListenerSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void openAccessibilitySettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void getCapturedVisualContent(PluginCall call) {
        JSObject result = new JSObject();
        JSONArray content = CapturedVisualTextStore.get(getContext());
        try {
            result.put("content", new JSArray(content.toString()));
        } catch (JSONException ignored) {
            result.put("content", new JSArray());
        }
        call.resolve(result);
    }

    @PluginMethod
    public void clearCapturedVisualContent(PluginCall call) {
        CapturedVisualTextStore.clear(getContext());
        call.resolve();
    }

    @PluginMethod
    public void getAppUsageMonitor(PluginCall call) {
        JSObject result = new JSObject();
        JSONArray sessions = AppUsageMonitorStore.get(getContext());
        try {
            result.put("sessions", new JSArray(sessions.toString()));
        } catch (JSONException ignored) {
            result.put("sessions", new JSArray());
        }
        result.put("currentPackageName", WeChatAccessibilityService.getCurrentForegroundPackageName());
        result.put("accessibilityBound", WeChatAccessibilityService.getInstance() != null);
        call.resolve(result);
    }

    @PluginMethod
    public void clearAppUsageMonitor(PluginCall call) {
        AppUsageMonitorStore.clear(getContext());
        call.resolve();
    }

    @PluginMethod
    public void getCurrentScreenText(PluginCall call) {
        JSONArray lines = WeChatAccessibilityService.getCurrentScreenLines();
        JSObject result = new JSObject();
        try {
            result.put("lines", new JSArray(lines.toString()));
        } catch (JSONException ignored) {
            result.put("lines", new JSArray());
        }
        call.resolve(result);
    }

    @PluginMethod
    public void syncTodos(PluginCall call) {
        String todos = call.getString("todos", "[]");
        TodoHintStore.save(getContext(), todos);
        call.resolve();
    }

    @PluginMethod
    public void setDesktopPetEnabled(PluginCall call) {
        boolean enabled = call.getBoolean("enabled", true);
        WeChatAccessibilityService.setDesktopPetEnabled(getContext(), enabled);
        call.resolve();
    }

    @PluginMethod
    public void performAccessibilityAction(PluginCall call) {
        String action = call.getString("action", "");
        float x = call.getDouble("x", -1.0).floatValue();
        float y = call.getDouble("y", -1.0).floatValue();
        String packageName = call.getString("packageName", "");
        String target = call.getString("target", "");
        int delayMs = call.getInt("delayMs", 0);

        WeChatAccessibilityService service = WeChatAccessibilityService.getInstance();
        boolean success =
            service != null && service.performTask(action, target, x, y, packageName, delayMs);

        JSObject result = new JSObject();
        result.put("success", success);
        result.put("bound", service != null);
        call.resolve(result);
    }

    @PluginMethod
    public void getCapturedNotifications(PluginCall call) {
        JSObject result = new JSObject();
        JSONArray notifications = CapturedNotificationStore.get(getContext());
        JSArray array;
        try {
            array = new JSArray(notifications.toString());
        } catch (JSONException ignored) {
            array = new JSArray();
        }
        result.put("notifications", array == null ? new JSArray() : array);
        call.resolve(result);
    }

    @PluginMethod
    public void clearCapturedNotifications(PluginCall call) {
        CapturedNotificationStore.clear(getContext());
        call.resolve();
    }

    @PluginMethod
    public void syncRecentCallLogs(PluginCall call) {
        if (!hasCallLogPermission()) {
            requestPermissionForAlias("callLog", call, "callLogPermissionCallback");
            return;
        }
        resolveCallLogs(call);
    }

    @PermissionCallback
    private void callLogPermissionCallback(PluginCall call) {
        if (!hasCallLogPermission()) {
            call.reject("需要通话记录权限才能同步真实来电与去电信息", "permission_denied");
            return;
        }
        resolveCallLogs(call);
    }

    @PluginMethod
    public void startSpeechRecognition(PluginCall call) {
        if (!hasMicrophonePermission()) {
            requestPermissionForAlias("microphone", call, "microphonePermissionCallback");
            return;
        }
        launchSpeechRecognizer(call);
    }

    @PermissionCallback
    private void microphonePermissionCallback(PluginCall call) {
        if (!hasMicrophonePermission()) {
            call.reject("需要麦克风权限才能识别语音", "permission_denied");
            return;
        }
        launchSpeechRecognizer(call);
    }

    @PluginMethod
    public void openExternalUrl(PluginCall call) {
        String url = call.getString("url", "");
        if (url.isEmpty()) {
            call.reject("缺少目标 URL");
            return;
        }

        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception error) {
            call.reject("没有应用可以打开该链接", error);
        }
    }

    @PluginMethod
    public void saveTextFile(PluginCall call) {
        String fileName = call.getString("fileName", "");
        String content = call.getString("content", "");
        String mimeType = call.getString("mimeType", "text/markdown");

        if (fileName.isEmpty()) {
            call.reject("缺少文件名");
            return;
        }

        try {
            Context context = getContext();
            Uri fileUri;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues values = new ContentValues();
                values.put(MediaStore.MediaColumns.DISPLAY_NAME, fileName);
                values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
                values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/VoxFlow");

                fileUri = context.getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (fileUri == null) throw new IllegalStateException("无法创建下载文件");

                try (OutputStream output = context.getContentResolver().openOutputStream(fileUri, "w")) {
                    if (output == null) throw new IllegalStateException("无法写入下载文件");
                    output.write(content.getBytes(StandardCharsets.UTF_8));
                }
            } else {
                File directory = context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                if (directory == null) throw new IllegalStateException("无法访问下载目录");
                if (!directory.exists() && !directory.mkdirs()) {
                    throw new IllegalStateException("无法创建下载目录");
                }

                File target = new File(directory, fileName);
                try (FileOutputStream output = new FileOutputStream(target)) {
                    output.write(content.getBytes(StandardCharsets.UTF_8));
                }
                fileUri = Uri.fromFile(target);
            }

            JSObject result = new JSObject();
            result.put("uri", fileUri.toString());
            result.put("location", "Download/VoxFlow/" + fileName);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("保存文件失败", error);
        }
    }

    @PluginMethod
    public void pickTextFile(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/json");
        intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[] { "application/json", "text/plain" });
        startActivityForResult(call, intent, "filePickerResult");
    }

    @PluginMethod
    public void pickAudioFile(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("audio/*");
        startActivityForResult(call, intent, "audioPickerResult");
    }

    @ActivityCallback
    private void audioPickerResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            call.reject("未选择通话录音", "cancelled");
            return;
        }

        Uri sourceUri = result.getData().getData();
        if (sourceUri == null) {
            call.reject("无法读取所选录音");
            return;
        }

        try {
            String displayName = resolveDisplayName(sourceUri);
            String safeName = displayName.replaceAll("[\\\\/:*?\"<>|]", "_");
            File directory = new File(
                getContext().getExternalFilesDir(Environment.DIRECTORY_MUSIC),
                "VoxFlowRecordings"
            );
            if (!directory.exists() && !directory.mkdirs()) {
                throw new IllegalStateException("无法创建录音目录");
            }

            File target = new File(directory, System.currentTimeMillis() + "-" + safeName);
            try (
                InputStream input = getContext().getContentResolver().openInputStream(sourceUri);
                FileOutputStream output = new FileOutputStream(target)
            ) {
                if (input == null) throw new IllegalStateException("无法打开录音文件");
                byte[] buffer = new byte[8192];
                int length;
                while ((length = input.read(buffer)) != -1) {
                    output.write(buffer, 0, length);
                }
            }

            JSObject response = new JSObject();
            response.put("fileName", displayName);
            response.put("path", target.getAbsolutePath());
            response.put("uri", Uri.fromFile(target).toString());
            response.put("size", target.length());
            call.resolve(response);
        } catch (Exception error) {
            call.reject("导入录音失败", error);
        }
    }

    @ActivityCallback
    private void filePickerResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            call.reject("未选择备份文件", "cancelled");
            return;
        }

        Uri uri = result.getData().getData();
        if (uri == null) {
            call.reject("无法读取所选文件");
            return;
        }

        try (
            BufferedReader reader = new BufferedReader(
                new InputStreamReader(getContext().getContentResolver().openInputStream(uri), StandardCharsets.UTF_8)
            )
        ) {
            StringBuilder content = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                content.append(line).append('\n');
            }

            JSObject response = new JSObject();
            response.put("content", content.toString());
            response.put("fileName", resolveDisplayName(uri));
            call.resolve(response);
        } catch (Exception error) {
            call.reject("读取备份文件失败", error);
        }
    }

    @ActivityCallback
    private void speechActivityResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            call.reject("语音识别已取消", "cancelled");
            return;
        }

        ArrayList<String> matches = result
            .getData()
            .getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
        if (matches == null || matches.isEmpty()) {
            call.reject("没有识别到语音内容", "empty_result");
            return;
        }

        JSObject response = new JSObject();
        response.put("text", matches.get(0));
        call.resolve(response);
    }

    private void launchSpeechRecognizer(PluginCall call) {
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, call.getString("language", "en-US"));
        intent.putExtra(RecognizerIntent.EXTRA_PROMPT, "请说出要记录的通话内容");
        intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        startActivityForResult(call, intent, "speechActivityResult");
    }

    private void resolveCallLogs(PluginCall call) {
        List<JSObject> records = new ArrayList<>();
        String[] projection = {
            CallLog.Calls._ID,
            CallLog.Calls.CACHED_NAME,
            CallLog.Calls.NUMBER,
            CallLog.Calls.TYPE,
            CallLog.Calls.DURATION,
            CallLog.Calls.DATE
        };

        try (
            Cursor cursor = getContext()
                .getContentResolver()
                .query(
                    CallLog.Calls.CONTENT_URI,
                    projection,
                    null,
                    null,
                    CallLog.Calls.DATE + " DESC"
                )
        ) {
            if (cursor == null) {
                call.reject("无法读取通话记录");
                return;
            }

            int count = 0;
            while (cursor.moveToNext() && count < 30) {
                long id = cursor.getLong(cursor.getColumnIndexOrThrow(CallLog.Calls._ID));
                String name = cursor.getString(cursor.getColumnIndexOrThrow(CallLog.Calls.CACHED_NAME));
                String number = cursor.getString(cursor.getColumnIndexOrThrow(CallLog.Calls.NUMBER));
                int type = cursor.getInt(cursor.getColumnIndexOrThrow(CallLog.Calls.TYPE));
                long duration = cursor.getLong(cursor.getColumnIndexOrThrow(CallLog.Calls.DURATION));
                long timestamp = cursor.getLong(cursor.getColumnIndexOrThrow(CallLog.Calls.DATE));

                JSObject record = new JSObject();
                record.put("id", "calllog-" + id);
                record.put("name", name == null ? "" : name);
                record.put("number", number == null ? "" : number);
                record.put("type", resolveCallType(type));
                record.put("durationSeconds", duration);
                record.put("timestamp", timestamp);
                records.add(record);
                count++;
            }

            JSObject response = new JSObject();
            response.put("calls", new JSArray(records));
            call.resolve(response);
        } catch (Exception error) {
            call.reject("读取通话记录失败", error);
        }
    }

    private JSObject buildStatus() {
        JSObject status = new JSObject();
        status.put("isNativeAndroid", true);
        status.put("notificationAccess", hasNotificationAccess());
        status.put("accessibilityAccess", hasAccessibilityAccess());
        status.put("microphonePermission", hasMicrophonePermission());
        status.put("callLogPermission", hasCallLogPermission());
        status.put("desktopPetEnabled", WeChatAccessibilityService.isDesktopPetEnabled(getContext()));
        return status;
    }

    private String resolveDisplayName(Uri uri) {
        try (
            Cursor cursor = getContext()
                .getContentResolver()
                .query(uri, new String[] { android.provider.OpenableColumns.DISPLAY_NAME }, null, null, null)
        ) {
            if (cursor != null && cursor.moveToFirst()) {
                int index = cursor.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME);
                if (index >= 0) return cursor.getString(index);
            }
        } catch (Exception ignored) {
            // The provider can omit display metadata; the content itself is still valid.
        }
        return "VoxFlow-backup.json";
    }

    private boolean hasNotificationAccess() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return NotificationManagerCompat
                .getEnabledListenerPackages(getContext())
                .contains(getContext().getPackageName());
        }

        NotificationManager manager =
            (NotificationManager) getContext().getSystemService(NotificationManager.class);
        ComponentName listener = new ComponentName(getContext(), VoxFlowNotificationListenerService.class);
        return manager != null && manager.isNotificationListenerAccessGranted(listener);
    }

    private boolean hasAccessibilityAccess() {
        AccessibilityManager manager =
            (AccessibilityManager) getContext().getSystemService(Context.ACCESSIBILITY_SERVICE);
        ComponentName expected = new ComponentName(getContext(), WeChatAccessibilityService.class);
        if (manager != null) {
            for (AccessibilityServiceInfo info : manager.getEnabledAccessibilityServiceList(
                AccessibilityServiceInfo.FEEDBACK_ALL_MASK
            )) {
                if (info.getResolveInfo() == null || info.getResolveInfo().serviceInfo == null) continue;
                ComponentName enabled = new ComponentName(
                    info.getResolveInfo().serviceInfo.packageName,
                    info.getResolveInfo().serviceInfo.name
                );
                if (expected.equals(enabled)) return true;
            }
        }

        String enabledServices = Settings.Secure.getString(
            getContext().getContentResolver(),
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        );
        if (enabledServices == null) return false;

        String expectedName = expected.flattenToString();
        for (String service : enabledServices.split(":")) {
            if (expectedName.equalsIgnoreCase(service)) return true;
        }
        return false;
    }

    private boolean hasMicrophonePermission() {
        return ContextCompat.checkSelfPermission(getContext(), Manifest.permission.RECORD_AUDIO) ==
            PackageManager.PERMISSION_GRANTED;
    }

    private boolean hasCallLogPermission() {
        return (
            ContextCompat.checkSelfPermission(getContext(), Manifest.permission.READ_CALL_LOG) ==
                PackageManager.PERMISSION_GRANTED &&
            ContextCompat.checkSelfPermission(getContext(), Manifest.permission.READ_PHONE_STATE) ==
                PackageManager.PERMISSION_GRANTED
        );
    }

    private String resolveCallType(int type) {
        switch (type) {
            case CallLog.Calls.INCOMING_TYPE:
                return "incoming";
            case CallLog.Calls.OUTGOING_TYPE:
                return "outgoing";
            case CallLog.Calls.MISSED_TYPE:
                return "missed";
            case CallLog.Calls.REJECTED_TYPE:
                return "rejected";
            default:
                return "unknown";
        }
    }

    @PluginMethod
    public void getOnDeviceModelStatus(PluginCall call) {
        try {
            call.resolve(new JSObject(OnDeviceLlmEngine.getInstance(getContext()).status().toString()));
        } catch (JSONException e) {
            call.reject("无法读取端侧模型状态", e);
        }
    }

    @PluginMethod
    public void downloadOnDeviceModel(PluginCall call) {
        String url = call.getString("url", "");
        if (url.isEmpty()) {
            call.reject("缺少模型下载地址");
            return;
        }
        OnDeviceLlmEngine.getInstance(getContext()).download(url, (downloaded, total) -> {
            // Progress is polled via getOnDeviceModelStatus.
        });
        call.resolve();
    }

    @PluginMethod
    public void runOnDeviceInference(PluginCall call) {
        String prompt = call.getString("prompt", "");
        int maxTokens = call.getInt("maxTokens", 512);
        if (prompt.isEmpty()) {
            call.reject("缺少推理输入");
            return;
        }
        OnDeviceLlmEngine.getInstance(getContext()).generate(prompt, new OnDeviceLlmEngine.GenerateCallback() {
            @Override
            public void onResult(String text) {
                JSObject result = new JSObject();
                result.put("text", text);
                call.resolve(result);
            }

            @Override
            public void onError(String message) {
                call.reject(message);
            }
        });
    }
}
