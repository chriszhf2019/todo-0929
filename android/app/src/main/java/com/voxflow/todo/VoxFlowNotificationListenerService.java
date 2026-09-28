package com.voxflow.todo;

import android.app.Notification;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.os.Parcelable;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.text.TextUtils;
import java.util.Locale;
import org.json.JSONException;
import org.json.JSONObject;

public class VoxFlowNotificationListenerService extends NotificationListenerService {

    private static final String CHANNEL_PHONE = "phone";
    private static final String CHANNEL_SMS = "sms";
    private static final String CHANNEL_WECHAT = "wechat";

    @Override
    public void onNotificationPosted(StatusBarNotification statusBarNotification) {
        if (statusBarNotification == null) return;

        Notification notification = statusBarNotification.getNotification();
        if (notification == null) return;
        if ((notification.flags & Notification.FLAG_GROUP_SUMMARY) != 0) return;
        if (statusBarNotification.isOngoing()) return;

        String packageName = statusBarNotification.getPackageName();
        if (TextUtils.isEmpty(packageName) || getPackageName().equals(packageName)) return;

        String category = notification.category;
        String channel = resolveChannel(packageName, category, notification);
        if (channel == null) return;

        Bundle extras = notification.extras;
        String title = textFromExtra(extras, Notification.EXTRA_TITLE);
        if (TextUtils.isEmpty(title)) {
            title = extras == null ? "" : extras.getString(Notification.EXTRA_CONVERSATION_TITLE, "");
        }
        String text = textFromMessagingExtras(extras);
        if (TextUtils.isEmpty(text)) {
            text = textFromExtra(extras, Notification.EXTRA_BIG_TEXT);
        }
        if (TextUtils.isEmpty(text)) {
            text = textFromExtra(extras, Notification.EXTRA_TEXT);
        }
        if (TextUtils.isEmpty(title) && TextUtils.isEmpty(text)) return;

        JSONObject record = new JSONObject();
        try {
            record.put("id", statusBarNotification.getKey());
            record.put("packageName", packageName);
            record.put("appName", resolveAppName(packageName));
            record.put("title", title);
            record.put("text", text);
            record.put("timestamp", statusBarNotification.getPostTime());
            record.put("channel", channel);
            CapturedNotificationStore.add(getApplicationContext(), record);
        } catch (JSONException ignored) {
            // A malformed notification is not worth crashing the listener over.
        }
    }

    private String resolveChannel(String packageName, String category, Notification notification) {
        String normalizedPackage = packageName.toLowerCase(Locale.ROOT);
        String template = notification.extras == null
            ? ""
            : notification.extras.getString(Notification.EXTRA_TEMPLATE, "");
        boolean isMessagingStyle = template.endsWith("MessagingStyle");

        if (
            "com.tencent.mm".equals(normalizedPackage) ||
            "com.tencent.mobileqq".equals(normalizedPackage) ||
            "com.tencent.wework".equals(normalizedPackage) ||
            "com.ss.android.lark".equals(normalizedPackage)
        ) {
            return CHANNEL_WECHAT;
        }

        if (
            normalizedPackage.contains("messaging") ||
            normalizedPackage.contains("mms") ||
            normalizedPackage.contains("sms") ||
            Notification.CATEGORY_MESSAGE.equals(category) ||
            isMessagingStyle
        ) {
            return CHANNEL_SMS;
        }

        if (
            normalizedPackage.contains("dialer") ||
            normalizedPackage.contains("incallui") ||
            Notification.CATEGORY_CALL.equals(category)
        ) {
            return CHANNEL_PHONE;
        }

        return null;
    }

    private String resolveAppName(String packageName) {
        try {
            PackageManager packageManager = getPackageManager();
            return packageManager.getApplicationLabel(packageManager.getApplicationInfo(packageName, 0)).toString();
        } catch (PackageManager.NameNotFoundException ignored) {
            return packageName;
        }
    }

    private String textFromExtra(Bundle extras, String key) {
        if (extras == null) return "";
        CharSequence value = extras.getCharSequence(key);
        return value == null ? "" : value.toString().trim();
    }

    private String textFromMessagingExtras(Bundle extras) {
        if (extras == null) return "";
        Parcelable[] messages = extras.getParcelableArray(Notification.EXTRA_MESSAGES);
        if (messages == null || messages.length == 0) return "";

        StringBuilder builder = new StringBuilder();
        for (Parcelable message : messages) {
            if (!(message instanceof Bundle)) continue;
            CharSequence text = ((Bundle) message).getCharSequence(Notification.EXTRA_TEXT);
            if (TextUtils.isEmpty(text)) continue;

            String line = text.toString().trim();
            if (line.isEmpty()) continue;
            if (builder.length() > 0) builder.append('\n');
            builder.append(line);
        }
        return builder.toString();
    }
}
