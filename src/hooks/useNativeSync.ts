import { useCallback, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import queue from '../lib/queue';
import { App as CapacitorApp } from '@capacitor/app';
import {
  getNativeCaptureStatus,
  getOnDeviceModelStatus,
  isNativeAndroid,
  NativeCaptureStatus,
  NativeCallLogRecord,
  NativeNotificationRecord,
  NativeVisualTextRecord,
  NativeAppUsageSession,
  VoxFlowNative,
} from '../lib/nativeBridge';
import { IngestItem, ChannelType } from '../types';

const formatNativeTimestamp = (timestamp: number) =>
  new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(timestamp));

const VISUAL_UI_LABELS = new Set([
  '微信',
  'QQ',
  '聊天',
  '通讯录',
  '发现',
  '我',
  '搜索',
  '消息',
  '联系人',
  '动态',
  '设置',
  '返回',
  '更多',
  '发送',
]);

const channelFromPackage = (packageName: string): ChannelType => {
  const pkg = packageName.toLowerCase();
  if (pkg.includes('messaging') || pkg.includes('mms') || pkg.includes('sms')) return 'sms';
  if (pkg.includes('dialer') || pkg.includes('incallui')) return 'phone';
  return 'wechat';
};

const senderFromVisualText = (record: NativeVisualTextRecord) => {
  const lines = record.text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const contact = lines.find(
    (line) => line.length >= 2 && line.length <= 16 && !VISUAL_UI_LABELS.has(line) && !/^\d+$/.test(line)
  );
  return contact || record.appName || '屏幕对话';
};

export function useNativeSync(params: {
  setItems: (updater: (prev: IngestItem[]) => IngestItem[]) => void;
  itemsRef: { current: IngestItem[] };
  onProcessItem?: (item: IngestItem) => void;
  onSetCallReviewItem?: (item: IngestItem | null) => void;
  showToast?: (message: string, type?: 'success' | 'info') => void;
}) {
  const { setItems, itemsRef, onProcessItem, onSetCallReviewItem, showToast } = params;

  const [nativeStatus, setNativeStatus] = useState<NativeCaptureStatus | null>(null);
  const [isNativeSyncing, setIsNativeSyncing] = useState(false);
  const [appUsageSessions, setAppUsageSessions] = useState<NativeAppUsageSession[]>([]);
  const [currentForegroundPackage, setCurrentForegroundPackage] = useState('');
  const [usageAccessibilityBound, setUsageAccessibilityBound] = useState(false);

  const refreshNativeCaptureStatus = useCallback(async () => {
    try {
      setNativeStatus(await getNativeCaptureStatus());
    } catch {
      setNativeStatus(null);
    }
  }, []);

  const refreshOnDeviceModelStatus = useCallback(async (setOnDeviceModel?: (s: any) => void) => {
    if (!isNativeAndroid) return;
    try {
      const status = await getOnDeviceModelStatus();
      if (setOnDeviceModel) setOnDeviceModel(status);
    } catch {
      // noop
    }
  }, []);

  const refreshAppUsage = useCallback(async () => {
    if (!isNativeAndroid) {
      setAppUsageSessions([]);
      setCurrentForegroundPackage('');
      setUsageAccessibilityBound(false);
      return;
    }
    try {
      const monitor = await VoxFlowNative.getAppUsageMonitor();
      setAppUsageSessions(monitor.sessions ?? []);
      setCurrentForegroundPackage(monitor.currentPackageName ?? '');
      setUsageAccessibilityBound(Boolean(monitor.accessibilityBound));
    } catch {
      // keep previous
    }
  }, []);

  const clearAppUsage = useCallback(async () => {
    if (!isNativeAndroid) {
      setAppUsageSessions([]);
      return;
    }
    try {
      await VoxFlowNative.clearAppUsageMonitor();
      setAppUsageSessions([]);
      showToast?.('应用使用记录已清空', 'info');
    } catch {
      showToast?.('无法清空应用使用记录', 'info');
    }
  }, [showToast]);

  const performAccessibilityAction = useCallback(
    async (
      action: string,
      options?: { x?: number; y?: number; packageName?: string; target?: string; delayMs?: number }
    ): Promise<boolean> => {
      if (!isNativeAndroid) {
        showToast?.('系统操作仅在实际安装的安卓应用中可用', 'info');
        return false;
      }
      try {
        const result = await VoxFlowNative.performAccessibilityAction({
          action,
          x: options?.x,
          y: options?.y,
          packageName: options?.packageName,
          target: options?.target,
          delayMs: options?.delayMs,
        });
        await refreshAppUsage();
        return Boolean(result.success);
      } catch {
        showToast?.('系统操作执行失败', 'info');
        return false;
      }
    },
    [refreshAppUsage, showToast]
  );

  const handleRequestNativePermissions = useCallback(async () => {
    if (!isNativeAndroid) {
      showToast?.('系统权限只在实际安装的安卓应用中可用', 'info');
      return;
    }
    try {
      setNativeStatus(await VoxFlowNative.requestRuntimePermissions());
      showToast?.('系统权限状态已更新');
    } catch {
      showToast?.('未能获取系统权限，请在系统设置中手动授权', 'info');
    }
  }, [showToast]);

  const handleOpenNotificationSettings = useCallback(async () => {
    if (!isNativeAndroid) {
      showToast?.('通知使用权只在实际安装的安卓应用中可用', 'info');
      return;
    }
    try {
      await VoxFlowNative.openNotificationListenerSettings();
      showToast?.('请在系统页面中允许“记言 Todo 系统信息捕获”', 'info');
    } catch {
      showToast?.('无法打开通知使用权设置', 'info');
    }
  }, [showToast]);

  const handleOpenAccessibilitySettings = useCallback(async () => {
    if (!isNativeAndroid) {
      showToast?.('无障碍权限只在实际安装的安卓应用中可用', 'info');
      return;
    }
    try {
      await VoxFlowNative.openAccessibilitySettings();
      showToast?.('请开启“记言 Todo 微信已打开内容读取”', 'info');
    } catch {
      showToast?.('无法打开无障碍设置', 'info');
    }
  }, [showToast]);

  const handleSetDesktopPetEnabled = useCallback(
    async (enabled: boolean) => {
      if (!isNativeAndroid) {
        showToast?.('桌宠浮窗只在实际安装的安卓应用中可用', 'info');
        return;
      }
      try {
        await VoxFlowNative.setDesktopPetEnabled({ enabled });
        await refreshNativeCaptureStatus();
        showToast?.(enabled ? '已开启常驻桌宠浮窗' : '已关闭常驻桌宠浮窗', 'info');
      } catch {
        showToast?.('无法切换桌宠浮窗状态', 'info');
      }
    },
    [showToast, refreshNativeCaptureStatus]
  );

  const handleImportCallRecording = useCallback(async () => {
    if (!isNativeAndroid) {
      showToast?.('通话录音导入只在实际安装的安卓应用中可用', 'info');
      return;
    }

    try {
      const picked = await VoxFlowNative.pickAudioFile();
      const newItem: IngestItem = {
        id: `call-recording-${Date.now()}`,
        channel: 'phone',
        sender: picked.fileName || '通话录音',
        timestamp: '刚刚',
        rawContent: `[系统通话录音]\n文件：${picked.fileName}\n\n尚未补充转写文本。请播放录音并填写内容后再提取待办。`,
        language: 'zh',
        status: 'raw',
        callRecordingUrl: isNativeAndroid ? Capacitor.convertFileSrc(picked.path) : undefined,
      } as IngestItem;
      setItems((previous) => [newItem, ...previous]);
      // enqueue for background processing
      await queue.enqueue({ id: crypto.randomUUID(), payload: newItem, attempts: 0, createdAt: Date.now() });
      showToast?.('通话录音已导入并入队，稍后会自动处理');
    } catch (error) {
      showToast?.('未导入通话录音', 'info');
    }
  }, [setItems, showToast]);

  const handleSyncNativeData = useCallback(
    async (options?: { requestPermissions?: boolean; silent?: boolean }) => {
      if (!isNativeAndroid) {
        if (!(options?.silent)) showToast?.('请在安装后的安卓应用中使用系统同步', 'info');
        return;
      }

      const shouldRequestPermissions = options?.requestPermissions ?? true;
      const silent = options?.silent ?? false;
      setIsNativeSyncing(true);
      try {
        const status = shouldRequestPermissions
          ? await VoxFlowNative.requestRuntimePermissions()
          : await VoxFlowNative.getCaptureStatus();
        setNativeStatus(status);

        let notifications: NativeNotificationRecord[] = [];
        let calls: NativeCallLogRecord[] = [];
        let visualContent: NativeVisualTextRecord[] = [];

        if (status.notificationAccess) {
          const notificationResult = await VoxFlowNative.getCapturedNotifications();
          notifications = notificationResult.notifications || [];
        }

        if (status.callLogPermission) {
          const callResult = await VoxFlowNative.syncRecentCallLogs();
          calls = callResult.calls || [];
        }

        if (status.accessibilityAccess) {
          const visualResult = await VoxFlowNative.getCapturedVisualContent();
          visualContent = visualResult.content || [];
        }

        const existingIds = new Set(itemsRef.current.map((item) => item.id));
        const notificationItems: IngestItem[] = notifications.map((notification) => {
          const contentParts = [notification.title, notification.text].filter(Boolean);
          return {
            id: `native-notification-${notification.id}`,
            channel: notification.channel as any,
            sender: notification.title || notification.appName || '系统通知',
            sourcePackage: notification.packageName,
            timestamp: formatNativeTimestamp(notification.timestamp),
            rawContent: contentParts.join('\n'),
            language: 'zh',
            status: 'raw',
          } as IngestItem;
        });

        const callItems: IngestItem[] = calls.map((call) => {
          const contact = call.name || call.number || '未知号码';
          const typeLabels: Record<NativeCallLogRecord['type'], string> = {
            incoming: '呼入',
            outgoing: '呼出',
            missed: '未接',
            rejected: '已拒接',
            unknown: '未知类型',
          };

          return {
            id: `native-calllog-${call.id}`,
            channel: 'phone',
            sender: contact,
            senderPhone: call.number || undefined,
            sourcePackage: 'com.google.android.dialer',
            timestamp: formatNativeTimestamp(call.timestamp),
            audioDuration: call.durationSeconds > 0 ? `${Math.floor(call.durationSeconds/60).toString().padStart(2,'0')}:${Math.floor(call.durationSeconds%60).toString().padStart(2,'0')}` : undefined,
            rawContent: `[系统通话记录]\n类型：${typeLabels[call.type]}\n联系人：${contact}\n号码：${call.number || '未知'}\n通话时长：${Math.floor(call.durationSeconds/60).toString().padStart(2,'0')}:${Math.floor(call.durationSeconds%60).toString().padStart(2,'0')}\n\n安卓系统未提供双方通话音频，反诈与隐私安全限制下也无法由普通应用读取。需要整理内容时，请手动补充转写文本。`,
            language: 'zh',
            status: 'raw',
          } as IngestItem;
        });

        const visualItems: IngestItem[] = visualContent.map((record) => ({
          id: `native-visual-${record.id}`,
          channel: channelFromPackage(record.packageName),
          sender: senderFromVisualText(record),
          sourcePackage: record.packageName,
          timestamp: formatNativeTimestamp(record.timestamp),
          rawContent: record.text,
          language: 'zh',
          status: 'raw',
        } as IngestItem));

        const newItems = [...notificationItems, ...visualItems, ...callItems].filter(
          (item) => item.rawContent && !existingIds.has(item.id)
        );
        const newCallItems = callItems.filter((item) => !existingIds.has(item.id));

        if (newItems.length === 0) {
          if (!status.notificationAccess && !silent) {
            await VoxFlowNative.openNotificationListenerSettings();
            showToast?.('请先授权通知使用权，再同步短信和微信通知', 'info');
          } else if (!silent) {
            showToast?.('没有发现新的系统记录', 'info');
          }
          setIsNativeSyncing(false);
          return;
        }

        setItems((previous) => [...newItems, ...previous]);

        if (newCallItems.length > 0 && onSetCallReviewItem) {
          onSetCallReviewItem(newCallItems[newCallItems.length - 1]);
        }

        if (status.notificationAccess && notifications.length > 0) {
          await VoxFlowNative.clearCapturedNotifications();
        }
        if (status.accessibilityAccess && visualContent.length > 0) {
          await VoxFlowNative.clearCapturedVisualContent();
        }

        notificationItems
          .filter((item) => !existingIds.has(item.id))
          .forEach((item) => {
            onProcessItem?.(item);
          });
        visualItems
          .filter((item) => !existingIds.has(item.id))
          .forEach((item) => {
            onProcessItem?.(item);
          });

        if (!silent) showToast?.(`已同步 ${newItems.length} 条真实系统记录`);
      } catch (error) {
        console.warn('Native system sync failed:', error);
        if (!options?.silent) showToast?.('系统同步失败，请检查权限后重试', 'info');
      } finally {
        setIsNativeSyncing(false);
      }
    },
    [itemsRef, onProcessItem, onSetCallReviewItem, setItems, showToast]
  );

  useEffect(() => {
    void refreshNativeCaptureStatus();
    void refreshAppUsage();
    void handleSyncNativeData({ silent: true, requestPermissions: false });

    if (!isNativeAndroid) return;

    let listener: { remove: () => Promise<void> } | undefined;
    const syncWhenActive = async () => {
      await refreshNativeCaptureStatus();
      await refreshAppUsage();
      await handleSyncNativeData({ requestPermissions: false, silent: true });
    };

    void CapacitorApp?.addListener?.('appStateChange', ({ isActive }: any) => {
      if (isActive) void syncWhenActive();
    }).then((handle) => {
      listener = handle;
    }).catch(() => undefined);

    return () => {
      void listener?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    nativeStatus,
    isNativeSyncing,
    appUsageSessions,
    currentForegroundPackage,
    usageAccessibilityBound,
    refreshNativeCaptureStatus,
    refreshAppUsage,
    clearAppUsage,
    performAccessibilityAction,
    handleRequestNativePermissions,
    handleOpenNotificationSettings,
    handleOpenAccessibilitySettings,
    handleSetDesktopPetEnabled,
    handleImportCallRecording,
    handleSyncNativeData,
    refreshOnDeviceModelStatus,
  };
}
