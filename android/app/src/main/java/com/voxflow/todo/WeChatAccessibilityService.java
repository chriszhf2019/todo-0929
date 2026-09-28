package com.voxflow.todo;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.GestureDescription;
import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.graphics.Rect;
import android.graphics.Path;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.telephony.PhoneStateListener;
import android.telephony.TelephonyManager;
import android.util.DisplayMetrics;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Reads whatever chat / messaging app is in the foreground, via the accessibility
 * node tree first, then a screenshot + on-device OCR fallback when the tree
 * carries no message text (e.g. apps that self-draw their bubbles). Content is
 * deduped and handed to the frontend through {@link CapturedVisualTextStore}.
 *
 * Never reads system UI, the launcher, or our own package.
 */
public class WeChatAccessibilityService extends AccessibilityService {

    private static final String OWN_PACKAGE = "com.voxflow.todo";
    private static final String LAST_HASH_KEY = "last_screen_content_hash";
    private static final int MIN_NODE_LINES = 4;
    private static final int MIN_OCR_LINES = 2;

    private static volatile WeChatAccessibilityService instance;

    private enum ChatAppRule {
        WECHAT("com.tencent.mm", true),
        QQ("com.tencent.mobileqq", false),
        LARK("com.ss.android.lark", true),
        TWITTER("com.twitter.android", false),
        GENERIC(null, true);

        final String packagePrefix;
        final boolean ocrFallback;

        ChatAppRule(String packagePrefix, boolean ocrFallback) {
            this.packagePrefix = packagePrefix;
            this.ocrFallback = ocrFallback;
        }

        static ChatAppRule resolve(String packageName) {
            for (ChatAppRule rule : values()) {
                if (rule.packagePrefix != null && packageName.startsWith(rule.packagePrefix)) {
                    return rule;
                }
            }
            return GENERIC;
        }
    }

    private final Set<String> ignoredLabels = new HashSet<>(
        Arrays.asList(
            "微信",
            "聊天",
            "通讯录",
            "发现",
            "我",
            "搜索",
            "视频号",
            "朋友圈",
            "返回",
            "更多",
            "发送",
            "表情",
            "相册",
            "拍摄",
            "语音输入",
            "按住 说话",
            "按住说话",
            "消息",
            "联系人",
            "动态",
            "设置",
            "取消",
            "确定",
            "好评",
            "人均",
            "收藏",
            "买单",
            "筛选",
            "推荐"
        )
    );

    private final ScreenCapture screenCapture = new ScreenCapture();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private MlKitOcr ocr;
    private DesktopPetOverlay petOverlay;
    private boolean desktopPetEnabled = true;
    private PhoneStateListener phoneStateListener;
    private int lastCallState = TelephonyManager.CALL_STATE_IDLE;

    @Override
    public void onServiceConnected() {
        super.onServiceConnected();
        instance = this;
        desktopPetEnabled = isDesktopPetEnabled(this);
        petOverlay = new DesktopPetOverlay(this);
        petOverlay.attach(desktopPetEnabled);
        setupCallStateListener();
    }

    @Override
    public void onDestroy() {
        teardownCallStateListener();
        if (petOverlay != null) {
            petOverlay.detach();
            petOverlay = null;
        }
        instance = null;
        super.onDestroy();
    }

    static WeChatAccessibilityService getInstance() {
        return instance;
    }

    static boolean isDesktopPetEnabled(Context context) {
        return context
            .getSharedPreferences("voxflow_accessibility", MODE_PRIVATE)
            .getBoolean("desktop_pet_enabled", true);
    }

    static void setDesktopPetEnabled(Context context, boolean enabled) {
        context
            .getSharedPreferences("voxflow_accessibility", MODE_PRIVATE)
            .edit()
            .putBoolean("desktop_pet_enabled", enabled)
            .apply();
        WeChatAccessibilityService service = instance;
        if (service != null) {
            service.desktopPetEnabled = enabled;
            if (service.petOverlay != null) {
                service.petOverlay.setEnabled(enabled);
            }
        }
    }

    static String getCurrentForegroundPackageName() {
        WeChatAccessibilityService service = instance;
        return service == null ? "" : service.currentPackageName;
    }

    static JSONArray getCurrentScreenLines() {
        WeChatAccessibilityService service = instance;
        return service == null ? new JSONArray() : service.collectCurrentScreenLines();
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event == null) return;

        CharSequence pkgChar = event.getPackageName();
        String packageName = pkgChar == null ? "" : pkgChar.toString();
        if (packageName.isEmpty()) return;
        if (OWN_PACKAGE.equals(packageName)) {
            showPetIdle();
            return;
        }
        if (shouldSkip(packageName)) {
            showPetIdle();
            return;
        }

        if (!packageName.equals(currentPackageName)) {
            currentPackageName = packageName;
            currentSessionStartAt = System.currentTimeMillis();
        }

        int eventType = event.getEventType();
        if (
            eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED &&
            eventType != AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED &&
            eventType != AccessibilityEvent.TYPE_VIEW_SCROLLED
        ) {
            return;
        }

        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) return;

        List<String> lines = new ArrayList<>();
        collectText(root, lines, 0);
        try {
            root.recycle();
        } catch (Exception ignored) {
        }

        recordUsage(packageName, lines);
        if (eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            maybeShowContactHint(packageName, lines);
        }

        if (!shouldCaptureConversation(packageName)) {
            return;
        }

        ChatAppRule rule = ChatAppRule.resolve(packageName);
        if (lines.size() >= MIN_NODE_LINES) {
            saveContent(packageName, lines);
        } else if (rule.ocrFallback) {
            maybeCaptureAndOcr(packageName);
        } else if (!lines.isEmpty()) {
            saveContent(packageName, lines);
        }
    }

    @Override
    public void onInterrupt() {}

    private JSONArray collectCurrentScreenLines() {
        final JSONArray result = new JSONArray();
        final CountDownLatch latch = new CountDownLatch(1);
        mainHandler.post(() -> {
            try {
                AccessibilityNodeInfo root = getRootInActiveWindow();
                if (root != null) {
                    List<String> lines = new ArrayList<>();
                    collectText(root, lines, 0);
                    try {
                        root.recycle();
                    } catch (Exception ignored) {
                    }
                    for (String line : lines) {
                        result.put(line);
                    }
                }
            } catch (Exception ignored) {
            } finally {
                latch.countDown();
            }
        });
        try {
            latch.await(2, TimeUnit.SECONDS);
        } catch (InterruptedException ignored) {
            Thread.currentThread().interrupt();
        }
        return result;
    }

    private void showPetMessage(String title, String message) {
        if (petOverlay != null) petOverlay.showMessage(title, message);
    }

    private void showPetIdle() {
        if (petOverlay != null) petOverlay.showIdle();
    }

    private void maybeShowContactHint(String packageName, List<String> lines) {
        String channel = channelForPackage(packageName);
        if (channel == null) {
            showPetIdle();
            return;
        }

        JSONArray todos = TodoHintStore.get(getApplicationContext());
        int channelPending = 0;
        int contactPending = 0;
        String matchedSender = "";
        for (int index = 0; index < todos.length(); index++) {
            JSONObject todo = todos.optJSONObject(index);
            if (todo == null || todo.optBoolean("completed", false)) continue;
            if (!channel.equals(todo.optString("channel"))) continue;
            channelPending++;

            String sender = todo.optString("sender", "").trim();
            if (sender.isEmpty() || lines == null || lines.isEmpty()) continue;
            for (String line : lines) {
                if (line != null && line.contains(sender)) {
                    contactPending++;
                    if (matchedSender.isEmpty()) matchedSender = sender;
                    break;
                }
            }
        }

        if (contactPending > 0) {
            showPetMessage(
                resolveAppName(packageName),
                "与 " + matchedSender + " 相关的待办 " + contactPending + " 条，点击查看"
            );
            return;
        }
        if (channelPending > 0) {
            showPetMessage(
                resolveAppName(packageName),
                "你有 " + channelPending + " 条关联待办，点击查看"
            );
            return;
        }
        if (channelPending <= 0) {
            showPetIdle();
            return;
        }
    }

    private String channelForPackage(String packageName) {
        if (
            packageName.startsWith("com.tencent.mm") ||
            packageName.startsWith("com.tencent.mobileqq") ||
            packageName.startsWith("com.tencent.wework") ||
            packageName.startsWith("com.ss.android.lark") ||
            packageName.startsWith("org.telegram.messenger") ||
            packageName.startsWith("com.whatsapp")
        ) {
            return "wechat";
        }
        if (
            packageName.startsWith("com.google.android.apps.messaging") ||
            packageName.startsWith("com.android.mms") ||
            packageName.startsWith("com.android.contacts") ||
            packageName.contains("sms")
        ) {
            return "sms";
        }
        if (
            packageName.startsWith("com.google.android.dialer") ||
            packageName.startsWith("com.android.dialer") ||
            packageName.startsWith("com.android.incallui")
        ) {
            return "phone";
        }
        return null;
    }

    private int countPendingTodos(String channel) {
        org.json.JSONArray todos = TodoHintStore.get(getApplicationContext());
        int count = 0;
        for (int index = 0; index < todos.length(); index++) {
            JSONObject todo = todos.optJSONObject(index);
            if (todo == null) continue;
            if (!todo.optBoolean("completed", false) && channel.equals(todo.optString("channel"))) {
                count++;
            }
        }
        return count;
    }

    private void setupCallStateListener() {
        try {
            if (checkSelfPermission(Manifest.permission.READ_PHONE_STATE) != PackageManager.PERMISSION_GRANTED) return;
            TelephonyManager telephonyManager = (TelephonyManager) getSystemService(TELEPHONY_SERVICE);
            if (telephonyManager == null) return;
            lastCallState = telephonyManager.getCallState();
            phoneStateListener = new PhoneStateListener() {
                @Override
                public void onCallStateChanged(int state, String phoneNumber) {
                    if (state == TelephonyManager.CALL_STATE_RINGING) {
                        int pending = countPendingTodos("phone");
                        if (pending > 0) {
                            showPetMessage("来电", "你有 " + pending + " 条电话待办，点击查看");
                        }
                    } else if (state == TelephonyManager.CALL_STATE_OFFHOOK) {
                        showPetIdle();
                    }
                    if (state == TelephonyManager.CALL_STATE_IDLE && lastCallState != TelephonyManager.CALL_STATE_IDLE) {
                        showPetMessage("通话结束", "打开记言查看摘要并勾选待办");
                    }
                    lastCallState = state;
                }
            };
            telephonyManager.listen(phoneStateListener, PhoneStateListener.LISTEN_CALL_STATE);
        } catch (Exception ignored) {
        }
    }

    private void teardownCallStateListener() {
        if (phoneStateListener == null) return;
        try {
            TelephonyManager telephonyManager = (TelephonyManager) getSystemService(TELEPHONY_SERVICE);
            if (telephonyManager != null) {
                telephonyManager.listen(phoneStateListener, PhoneStateListener.LISTEN_NONE);
            }
        } catch (Exception ignored) {
        }
        phoneStateListener = null;
    }

    private boolean shouldSkip(String packageName) {
        if (OWN_PACKAGE.equals(packageName)) return true;
        if (packageName.startsWith("com.android.systemui")) return true;
        if (packageName.startsWith("com.android.settings")) return true;
        if (packageName.contains("launcher")) return true;
        if (packageName.contains("inputmethod") || packageName.contains("keyboard")) return true;
        if (packageName.startsWith("com.google.android.permissioncontroller")) return true;
        return false;
    }

    private boolean shouldCaptureConversation(String packageName) {
        return packageName.startsWith("com.tencent.mm")
            || packageName.startsWith("com.tencent.mobileqq")
            || packageName.startsWith("com.tencent.wework")
            || packageName.startsWith("com.ss.android.lark")
            || packageName.startsWith("com.twitter.android")
            || packageName.startsWith("org.telegram.messenger")
            || packageName.startsWith("com.whatsapp")
            || packageName.startsWith("com.alibaba.android.rimet")
            || packageName.contains("messaging")
            || packageName.contains("mms");
    }

    private void saveContent(String packageName, List<String> lines) {
        String content = String.join("\n", lines).trim();
        if (content.length() < 2) return;

        String hash = sha256(content);
        SharedPreferences preferences = getSharedPreferences("voxflow_accessibility", MODE_PRIVATE);
        if (hash.equals(preferences.getString(LAST_HASH_KEY, ""))) return;
        preferences.edit().putString(LAST_HASH_KEY, hash).apply();

        JSONObject record = new JSONObject();
        try {
            record.put("id", hash);
            record.put("packageName", packageName);
            record.put("appName", resolveAppName(packageName));
            record.put("text", content);
            record.put("timestamp", System.currentTimeMillis());
            CapturedVisualTextStore.add(getApplicationContext(), record);
        } catch (JSONException ignored) {
            // Ignore malformed content instead of interrupting the stream.
        }
    }

    private void maybeCaptureAndOcr(String packageName) {
        screenCapture.capture(this, bitmap -> {
            if (bitmap == null) return;
            getOcr().recognize(bitmap, lines -> {
                try {
                    bitmap.recycle();
                } catch (Exception ignored) {
                }
                if (lines == null || lines.size() < MIN_OCR_LINES) return;
                recordUsage(packageName, lines);
                saveContent(packageName, lines);
            });
        });
    }

    private void recordUsage(String packageName, List<String> lines) {
        String content = String.join("\n", lines).trim();
        String snippet = content.length() > 180 ? content.substring(0, 180) : content;
        AppUsageMonitorStore.record(
            getApplicationContext(),
            packageName,
            resolveAppName(packageName),
            lines == null ? 0 : lines.size(),
            snippet
        );
    }

    private MlKitOcr getOcr() {
        if (ocr == null) {
            synchronized (this) {
                if (ocr == null) ocr = new MlKitOcr();
            }
        }
        return ocr;
    }

    private String resolveAppName(String packageName) {
        try {
            PackageManager pm = getPackageManager();
            return pm.getApplicationLabel(pm.getApplicationInfo(packageName, 0)).toString();
        } catch (PackageManager.NameNotFoundException ignored) {
            return packageName;
        }
    }

    private void collectText(AccessibilityNodeInfo node, List<String> lines, int depth) {
        if (node == null || depth > 30 || lines.size() >= 80) return;

        CharSequence text = node.getText();
        CharSequence description = node.getContentDescription();
        addLine(lines, text == null ? "" : text.toString());
        addLine(lines, description == null ? "" : description.toString());

        for (int index = 0; index < node.getChildCount() && lines.size() < 80; index++) {
            collectText(node.getChild(index), lines, depth + 1);
        }
    }

    private void addLine(List<String> lines, String raw) {
        String line = raw.trim().replaceAll("\\s+", " ");
        if (line.length() < 2 || line.length() > 600) return;
        if (ignoredLabels.contains(line.toLowerCase(Locale.ROOT))) return;
        if (!lines.isEmpty() && lines.get(lines.size() - 1).equals(line)) return;
        if (!new LinkedHashSet<>(lines).contains(line)) lines.add(line);
    }

    private String sha256(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder();
            for (byte item : digest) {
                hex.append(String.format("%02x", item));
            }
            return hex.toString();
        } catch (Exception ignored) {
            return Integer.toHexString(value.hashCode());
        }
    }

    private String currentPackageName = "";
    private long currentSessionStartAt = System.currentTimeMillis();

    /** Executes a small, safe set of system/accessibility actions requested by the frontend. */
    public boolean performAction(String action, float x, float y, String packageName) {
        return runOnMainAndWait(() -> performActionInternal(action, x, y, packageName));
    }

    private boolean performActionInternal(String action, float x, float y, String packageName) {
        if (action == null) return false;

        switch (action) {
            case "home":
                return performGlobalAction(GLOBAL_ACTION_HOME);
            case "back":
                return performGlobalAction(GLOBAL_ACTION_BACK);
            case "recents":
                return performGlobalAction(GLOBAL_ACTION_RECENTS);
            case "openApp":
                return openPackage(packageName);
            case "scrollUp":
                return dispatchSwipe(true);
            case "scrollDown":
                return dispatchSwipe(false);
            case "tap":
                return dispatchTap(x, y);
            default:
                return false;
        }
    }

    private boolean runOnMainAndWait(Callable<Boolean> task) {
        final CountDownLatch latch = new CountDownLatch(1);
        final boolean[] result = { false };
        mainHandler.post(() -> {
            try {
                result[0] = task.call();
            } catch (Exception ignored) {
                result[0] = false;
            } finally {
                latch.countDown();
            }
        });
        try {
            latch.await(3, TimeUnit.SECONDS);
        } catch (InterruptedException ignored) {
            Thread.currentThread().interrupt();
        }
        return result[0];
    }

    /** Executes a richer accessibility task with a text target and optional delay. */
    public boolean performTask(
        String action,
        String target,
        float x,
        float y,
        String packageName,
        int delayMs
    ) {
        if (action == null) return false;

        switch (action) {
            case "findAndTap":
                return findAndTap(target);
            case "typeText":
                return typeText(target);
            case "wait":
                sleep(delayMs);
                return true;
            case "scrollUntilText":
                return scrollUntilText(target);
            case "dial":
                return dialNumber(target);
            case "sendSms":
                return sendSms(target);
            default:
                return performAction(action, x, y, packageName);
        }
    }

    private boolean dialNumber(String number) {
        if (number == null || number.isEmpty()) return false;
        try {
            Intent intent = new Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + number));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
            return true;
        } catch (Exception ignored) {
            return false;
        }
    }

    private boolean sendSms(String number) {
        if (number == null || number.isEmpty()) return false;
        try {
            Intent intent = new Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:" + number));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
            return true;
        } catch (Exception ignored) {
            return false;
        }
    }

    private boolean findAndTap(String text) {
        if (text == null || text.trim().isEmpty()) return false;

        return runOnMainAndWait(() -> findAndTapInternal(text));
    }

    private boolean findAndTapInternal(String text) {
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) return false;
        try {
            for (String alias : tapAliases(text)) {
                AccessibilityNodeInfo targetNode = findClickableNodeByText(root, alias, 0);
                if (targetNode == null) {
                    targetNode = findNodeByText(root, alias, 0);
                }
                if (targetNode == null) continue;

                Rect bounds = new Rect();
                targetNode.getBoundsInScreen(bounds);
                if (targetNode.isClickable()) {
                    return targetNode.performAction(AccessibilityNodeInfo.ACTION_CLICK);
                }
                if (bounds.isEmpty()) {
                    return targetNode.performAction(AccessibilityNodeInfo.ACTION_CLICK);
                }
                return dispatchTap((bounds.left + bounds.right) / 2f, (bounds.top + bounds.bottom) / 2f);
            }
            return false;
        } finally {
            try {
                root.recycle();
            } catch (Exception ignored) {
            }
        }
    }

    private String[] tapAliases(String text) {
        String trimmed = text == null ? "" : text.trim();
        if ("搜索".equals(trimmed) || "search".equalsIgnoreCase(trimmed)) {
            return new String[] { "搜索", "搜一搜", "Search", "查找" };
        }
        return new String[] { trimmed };
    }

    private boolean typeText(String text) {
        if (text == null || text.isEmpty()) return false;

        return runOnMainAndWait(() -> typeTextInternal(text));
    }

    private boolean typeTextInternal(String text) {
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) return false;
        try {
            AccessibilityNodeInfo focused = root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT);
            AccessibilityNodeInfo editable =
                focused != null && focused.isEditable() ? focused : findEditableNode(root, 0);
            if (editable == null) return false;

            Bundle arguments = new Bundle();
            arguments.putCharSequence(
                AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE,
                text
            );
            return editable.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, arguments);
        } finally {
            try {
                root.recycle();
            } catch (Exception ignored) {
            }
        }
    }

    private boolean scrollUntilText(String text) {
        if (text == null || text.trim().isEmpty()) return false;
        for (int attempt = 0; attempt < 8; attempt++) {
            if (findAndTap(text)) return true;
            if (!performAction("scrollUp", -1, -1, null)) return false;
            sleep(500);
        }
        return false;
    }

    private AccessibilityNodeInfo findNodeByText(
        AccessibilityNodeInfo node,
        String text,
        int depth
    ) {
        if (node == null || depth > 30) return null;

        CharSequence nodeText = node.getText();
        CharSequence description = node.getContentDescription();
        String target = text.toLowerCase(Locale.ROOT);
        if (
            (nodeText != null && nodeText.toString().toLowerCase(Locale.ROOT).contains(target)) ||
            (description != null && description.toString().toLowerCase(Locale.ROOT).contains(target))
        ) {
            return node;
        }

        for (int index = 0; index < node.getChildCount(); index++) {
            AccessibilityNodeInfo match = findNodeByText(node.getChild(index), text, depth + 1);
            if (match != null) return match;
        }
        return null;
    }

    private AccessibilityNodeInfo findClickableNodeByText(
        AccessibilityNodeInfo node,
        String text,
        int depth
    ) {
        if (node == null || depth > 30) return null;

        CharSequence nodeText = node.getText();
        CharSequence description = node.getContentDescription();
        String target = text.toLowerCase(Locale.ROOT);
        boolean matches =
            (nodeText != null && nodeText.toString().toLowerCase(Locale.ROOT).contains(target)) ||
            (description != null && description.toString().toLowerCase(Locale.ROOT).contains(target));
        if (matches && node.isClickable()) return node;

        for (int index = 0; index < node.getChildCount(); index++) {
            AccessibilityNodeInfo match = findClickableNodeByText(node.getChild(index), text, depth + 1);
            if (match != null) return match;
        }
        return null;
    }

    private AccessibilityNodeInfo findEditableNode(AccessibilityNodeInfo node, int depth) {
        if (node == null || depth > 30) return null;
        if (node.isEditable()) return node;

        for (int index = 0; index < node.getChildCount(); index++) {
            AccessibilityNodeInfo editable = findEditableNode(node.getChild(index), depth + 1);
            if (editable != null) return editable;
        }
        return null;
    }

    private void sleep(int delayMs) {
        if (delayMs <= 0) return;
        try {
            Thread.sleep(Math.min(delayMs, 3000));
        } catch (InterruptedException ignored) {
            Thread.currentThread().interrupt();
        }
    }

    private boolean openPackage(String packageName) {
        if (packageName == null || packageName.isEmpty()) return false;
        try {
            Intent intent = getPackageManager().getLaunchIntentForPackage(packageName);
            if (intent == null) return false;
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED);
            startActivity(intent);
            return true;
        } catch (Exception ignored) {
            return false;
        }
    }

    private boolean dispatchSwipe(boolean up) {
        DisplayMetrics metrics = getResources().getDisplayMetrics();
        int width = Math.max(1, metrics.widthPixels);
        int height = Math.max(1, metrics.heightPixels);
        int x = width / 2;
        int startY = up ? (int) (height * 0.75f) : (int) (height * 0.25f);
        int endY = up ? (int) (height * 0.25f) : (int) (height * 0.75f);
        return dispatchSwipePath(x, startY, x, endY, 300);
    }

    private boolean dispatchTap(float x, float y) {
        if (x < 0 || y < 0) return false;
        return dispatchSwipePath(x, y, x, y, 50);
    }

    private boolean dispatchSwipePath(float startX, float startY, float endX, float endY, long duration) {
        Path path = new Path();
        path.moveTo(startX, startY);
        path.lineTo(endX, endY);
        GestureDescription gesture = new GestureDescription.Builder()
            .addStroke(new GestureDescription.StrokeDescription(path, 0, duration))
            .build();
        return dispatchGesture(gesture, null, null);
    }
}
