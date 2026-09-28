package com.voxflow.todo;

import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewConfiguration;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

/**
 * A small, persistent "desktop pet" that lives in an accessibility overlay. It stays
 * idle as a draggable face in the corner, then expands into a message card when the
 * accessibility service detects a relevant reminder (a matching contact, a pending
 * todo for the foreground app, or a finished phone call). The card auto-collapses back
 * to the idle face after a short pause.
 */
public class DesktopPetOverlay {

    private static final String OWN_PACKAGE = "com.voxflow.todo";
    private static final int BUBBLE_WIDTH_DP = 280;
    private static final int PET_SIZE_DP = 54;
    private static final long AUTO_COLLAPSE_MS = 9000L;

    private final Context context;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final Runnable autoCollapse = new Runnable() {
        @Override
        public void run() {
            showIdle();
        }
    };

    private WindowManager windowManager;
    private LinearLayout container;
    private LinearLayout bubbleView;
    private TextView bubbleTitle;
    private TextView bubbleMessage;
    private FrameLayout petView;
    private TextView petFace;
    private TextView petBadge;
    private boolean enabled;
    private boolean bubbleVisible;
    private String lastTitle = "";
    private String lastMessage = "";
    private String shownTitle = "";
    private String shownMessage = "";
    private boolean shownVisible = false;

    private int dragStartRawX;
    private int dragStartRawY;
    private int dragStartParamX;
    private int dragStartParamY;
    private int touchSlop;

    public DesktopPetOverlay(Context context) {
        this.context = context;
    }

    public void attach(boolean enabled) {
        this.enabled = enabled;
        mainHandler.post(() -> {
            if (windowManager == null) {
                windowManager = (WindowManager) context.getSystemService(Context.WINDOW_SERVICE);
                if (windowManager == null) return;
                touchSlop = ViewConfiguration.get(context).getScaledTouchSlop();
                buildViews();
            }
            if (enabled) showIdleInternal();
        });
    }

    public void detach() {
        mainHandler.post(this::removeWindow);
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
        mainHandler.post(() -> {
            if (enabled) {
                if (windowManager == null) attach(enabled);
                else showIdleInternal();
            } else {
                removeWindow();
            }
        });
    }

    public void showMessage(String title, String message) {
        if (!enabled) return;
        lastTitle = title == null ? "" : title.trim();
        lastMessage = message == null ? "" : message.trim();
        mainHandler.post(() -> {
            if (windowManager == null || container == null) {
                attach(enabled);
                mainHandler.postDelayed(this::showMessageInternal, 80);
                return;
            }
            showMessageInternal();
        });
    }

    public void showIdle() {
        mainHandler.post(this::showIdleInternal);
    }

    private void showMessageInternal() {
        if (!enabled || windowManager == null || container == null || lastMessage.isEmpty()) return;
        if (container.getParent() == null) {
            addWindow();
        }
        String title = lastTitle.isEmpty() ? "记言提醒" : lastTitle;
        boolean sameContent = shownVisible && title.equals(shownTitle) && lastMessage.equals(shownMessage);
        if (!sameContent) {
            bubbleTitle.setText(title);
            bubbleMessage.setText(lastMessage);
            bubbleView.setVisibility(View.VISIBLE);
            petBadge.setVisibility(View.VISIBLE);
            petBadge.setText("!");
            shownTitle = title;
            shownMessage = lastMessage;
            shownVisible = true;
            bubbleVisible = true;
        }
        mainHandler.removeCallbacks(autoCollapse);
        mainHandler.postDelayed(autoCollapse, AUTO_COLLAPSE_MS);
    }

    private void showIdleInternal() {
        if (windowManager == null || container == null) return;
        if (!enabled) {
            removeWindow();
            return;
        }
        if (container.getParent() == null) {
            addWindow();
        }
        if (bubbleView != null) bubbleView.setVisibility(View.GONE);
        if (petBadge != null) petBadge.setVisibility(View.GONE);
        bubbleVisible = false;
        shownVisible = false;
        mainHandler.removeCallbacks(autoCollapse);
    }

    private void buildViews() {
        container = new LinearLayout(context);
        container.setOrientation(LinearLayout.VERTICAL);
        container.setGravity(Gravity.END);

        bubbleView = new LinearLayout(context);
        bubbleView.setOrientation(LinearLayout.VERTICAL);
        bubbleView.setPadding(dp(14), dp(12), dp(14), dp(12));
        bubbleView.setBackground(rounded(dp(16), Color.argb(248, 15, 23, 42)));
        bubbleView.setElevation(dp(6));
        bubbleView.setVisibility(View.GONE);
        LinearLayout.LayoutParams bubbleParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        bubbleParams.bottomMargin = dp(8);
        container.addView(bubbleView, bubbleParams);

        bubbleTitle = new TextView(context);
        bubbleTitle.setTextColor(Color.WHITE);
        bubbleTitle.setTextSize(15);
        bubbleTitle.setTypeface(null, android.graphics.Typeface.BOLD);
        bubbleTitle.setGravity(Gravity.START);
        bubbleView.addView(bubbleTitle);

        bubbleMessage = new TextView(context);
        bubbleMessage.setTextColor(Color.rgb(203, 213, 225));
        bubbleMessage.setTextSize(13);
        bubbleMessage.setLineSpacing(0, 1.08f);
        bubbleMessage.setMaxLines(6);
        bubbleMessage.setGravity(Gravity.START);
        LinearLayout.LayoutParams messageParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        messageParams.topMargin = dp(6);
        bubbleView.addView(bubbleMessage, messageParams);

        LinearLayout actions = new LinearLayout(context);
        actions.setOrientation(LinearLayout.HORIZONTAL);
        actions.setGravity(Gravity.END);
        LinearLayout.LayoutParams actionParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        actionParams.topMargin = dp(12);
        bubbleView.addView(actions, actionParams);

        TextView openAction = pillButton("查看", Color.rgb(16, 185, 129), Color.WHITE);
        openAction.setOnClickListener(v -> {
            showIdle();
            openOwnApp();
        });
        actions.addView(openAction);

        TextView dismissAction = pillButton("稍后", Color.rgb(51, 65, 85), Color.WHITE);
        dismissAction.setOnClickListener(v -> showIdle());
        LinearLayout.LayoutParams dismissParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        dismissParams.leftMargin = dp(8);
        actions.addView(dismissAction, dismissParams);

        petView = new FrameLayout(context);
        petView.setBackground(rounded(dp(27), Color.rgb(245, 158, 11)));
        petView.setElevation(dp(5));
        LinearLayout.LayoutParams petParams = new LinearLayout.LayoutParams(dp(PET_SIZE_DP), dp(PET_SIZE_DP));
        container.addView(petView, petParams);

        petFace = new TextView(context);
        petFace.setText("\uD83D\uDC31");
        petFace.setTextSize(24);
        petFace.setGravity(Gravity.CENTER);
        petFace.setIncludeFontPadding(false);
        petView.addView(petFace, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ));

        petBadge = new TextView(context);
        petBadge.setText("!");
        petBadge.setTextColor(Color.WHITE);
        petBadge.setTextSize(10);
        petBadge.setTypeface(null, android.graphics.Typeface.BOLD);
        petBadge.setGravity(Gravity.CENTER);
        petBadge.setBackground(rounded(dp(9), Color.rgb(239, 68, 68)));
        petBadge.setVisibility(View.GONE);
        FrameLayout.LayoutParams badgeParams = new FrameLayout.LayoutParams(dp(18), dp(18));
        badgeParams.gravity = Gravity.TOP | Gravity.END;
        badgeParams.topMargin = dp(-2);
        badgeParams.rightMargin = dp(-2);
        petView.addView(petBadge, badgeParams);

        petView.setOnTouchListener(this::handlePetTouch);
    }

    private boolean handlePetTouch(View view, MotionEvent event) {
        switch (event.getActionMasked()) {
            case MotionEvent.ACTION_DOWN:
                dragStartRawX = (int) event.getRawX();
                dragStartRawY = (int) event.getRawY();
                WindowManager.LayoutParams params = currentParams();
                if (params != null) {
                    dragStartParamX = params.x;
                    dragStartParamY = params.y;
                }
                return true;
            case MotionEvent.ACTION_MOVE:
                WindowManager.LayoutParams moveParams = currentParams();
                if (moveParams == null) return true;
                int dx = (int) event.getRawX() - dragStartRawX;
                int dy = (int) event.getRawY() - dragStartRawY;
                moveParams.x = dragStartParamX + dx;
                moveParams.y = dragStartParamY + dy;
                try {
                    windowManager.updateViewLayout(container, moveParams);
                } catch (Exception ignored) {
                }
                return true;
            case MotionEvent.ACTION_UP:
                int totalDx = (int) event.getRawX() - dragStartRawX;
                int totalDy = (int) event.getRawY() - dragStartRawY;
                boolean wasTap = Math.abs(totalDx) < touchSlop && Math.abs(totalDy) < touchSlop;
                if (wasTap) {
                    if (bubbleVisible) {
                        showIdle();
                    } else {
                        openOwnApp();
                    }
                }
                return true;
            default:
                return false;
        }
    }

    private WindowManager.LayoutParams currentParams() {
        if (windowManager == null || container == null) return null;
        try {
            return (WindowManager.LayoutParams) container.getLayoutParams();
        } catch (Exception ignored) {
            return null;
        }
    }

    private void addWindow() {
        if (windowManager == null || container == null) return;
        try {
            if (container.getParent() != null) windowManager.removeView(container);
        } catch (Exception ignored) {
        }

        WindowManager.LayoutParams params = new WindowManager.LayoutParams(
            dp(BUBBLE_WIDTH_DP),
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE |
                WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL |
                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        );
        params.gravity = Gravity.TOP | Gravity.START;
        params.x = Math.max(dp(12), context.getResources().getDisplayMetrics().widthPixels - dp(BUBBLE_WIDTH_DP) - dp(12));
        params.y = Math.max(dp(80), context.getResources().getDisplayMetrics().heightPixels - dp(132));
        try {
            windowManager.addView(container, params);
        } catch (Exception ignored) {
        }
    }

    private void removeWindow() {
        if (windowManager == null || container == null) return;
        mainHandler.removeCallbacks(autoCollapse);
        try {
            if (container.getParent() != null) windowManager.removeView(container);
        } catch (Exception ignored) {
        }
        container = null;
        bubbleView = null;
        bubbleTitle = null;
        bubbleMessage = null;
        petView = null;
        petFace = null;
        petBadge = null;
        windowManager = null;
        bubbleVisible = false;
    }

    private void openOwnApp() {
        try {
            Intent intent = context.getPackageManager().getLaunchIntentForPackage(OWN_PACKAGE);
            if (intent == null) return;
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED);
            context.startActivity(intent);
        } catch (Exception ignored) {
        }
    }

    private TextView pillButton(String text, int background, int foreground) {
        TextView button = new TextView(context);
        button.setText(text);
        button.setTextColor(foreground);
        button.setTextSize(12);
        button.setTypeface(null, android.graphics.Typeface.BOLD);
        button.setGravity(Gravity.CENTER);
        button.setPadding(dp(14), dp(7), dp(14), dp(7));
        button.setBackground(rounded(dp(14), background));
        return button;
    }

    private GradientDrawable rounded(int radius, int color) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setShape(GradientDrawable.RECTANGLE);
        drawable.setCornerRadius(radius);
        drawable.setColor(color);
        return drawable;
    }

    private int dp(int value) {
        return Math.round(value * context.getResources().getDisplayMetrics().density);
    }
}
