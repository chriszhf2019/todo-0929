package com.voxflow.todo;

import android.accessibilityservice.AccessibilityService;
import android.graphics.Bitmap;
import android.graphics.ColorSpace;
import android.hardware.HardwareBuffer;
import android.os.Build;
import android.util.Log;
import android.view.Display;

/**
 * Screenshot via the accessibility service's takeScreenshot (no MediaProjection,
 * no root, no cast dialog). Requires android:canTakeScreenshot="true" — which
 * only takes effect after the user toggles the accessibility service OFF and ON
 * again. API 30+ only; older devices fall back to node-tree reads.
 */
final class ScreenCapture {

    private static final String TAG = "ScreenCapture";
    private static final long MIN_INTERVAL_MS = 2000;

    private long lastAttemptAt = 0;

    void capture(AccessibilityService service, ResultCallback callback) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            callback.onResult(null);
            return;
        }

        long now = System.currentTimeMillis();
        if (now - lastAttemptAt < MIN_INTERVAL_MS) {
            callback.onResult(null);
            return;
        }
        lastAttemptAt = now;

        service.takeScreenshot(
            Display.DEFAULT_DISPLAY,
            service.getMainExecutor(),
            new AccessibilityService.TakeScreenshotCallback() {
                @Override
                public void onSuccess(AccessibilityService.ScreenshotResult screenshotResult) {
                    Bitmap copy = null;
                    try {
                        HardwareBuffer buffer = screenshotResult.getHardwareBuffer();
                        ColorSpace colorSpace = screenshotResult.getColorSpace();
                        Bitmap wrapped = Bitmap.wrapHardwareBuffer(buffer, colorSpace);
                        if (wrapped != null) {
                            copy = wrapped.copy(Bitmap.Config.ARGB_8888, false);
                        }
                        buffer.close();
                    } catch (Exception e) {
                        Log.w(TAG, "screenshot copy failed: " + e.getMessage());
                    }
                    callback.onResult(copy);
                }

                @Override
                public void onFailure(int errorCode) {
                    Log.w(TAG, "takeScreenshot failed, code=" + errorCode);
                    callback.onResult(null);
                }
            });
    }

    interface ResultCallback {
        void onResult(Bitmap bitmap);
    }
}
