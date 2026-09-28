import { Capacitor, registerPlugin } from '@capacitor/core';

export interface NativeCaptureStatus {
  isNativeAndroid: boolean;
  notificationAccess: boolean;
  accessibilityAccess: boolean;
  microphonePermission: boolean;
  callLogPermission: boolean;
  desktopPetEnabled: boolean;
}

export interface OnDeviceModelStatus {
  state: 'not_downloaded' | 'downloading' | 'not_loaded' | 'loading' | 'ready' | 'error';
  downloaded: boolean;
  modelPath: string;
  modelSizeBytes: number;
  downloadedBytes: number;
  totalBytes: number;
  errorMessage: string;
}

// Default download URL for the MediaPipe Gemma .task model.
// The official model lives on Kaggle (login required to download the .task):
//   https://www.kaggle.com/models/google/gemma/tfLite/gemma-2b-it-gpu-int4
// Download the .task file, host it somewhere the phone can reach (e.g. a local
// HTTP server on your computer), then point this URL at it or enter it in Settings.
export const DEFAULT_ON_DEVICE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/llm_inference/gemma-2b-it-gpu-int4/gemma-2b-it-gpu-int4.task';

export interface NativeNotificationRecord {
  id: string;
  packageName: string;
  appName: string;
  title: string;
  text: string;
  timestamp: number;
  channel: 'phone' | 'sms' | 'wechat';
}

export interface NativeCallLogRecord {
  id: string;
  name: string;
  number: string;
  type: 'incoming' | 'outgoing' | 'missed' | 'rejected' | 'unknown';
  durationSeconds: number;
  timestamp: number;
}

export interface NativeVisualTextRecord {
  id: string;
  packageName: string;
  appName: string;
  text: string;
  timestamp: number;
}

export interface NativeAppUsageSession {
  packageName: string;
  appName: string;
  sessionStartAt: number;
  lastSeenAt: number;
  eventCount: number;
  lineCount: number;
  lastTextSnippet: string;
  totalForegroundMs: number;
  lastSessionDurationMs: number;
}

export interface NativeAppUsageMonitor {
  sessions: NativeAppUsageSession[];
  currentPackageName: string;
  accessibilityBound: boolean;
}

export interface NativeAccessibilityActionResult {
  success: boolean;
  bound: boolean;
}

interface VoxFlowNativePlugin {
  getCaptureStatus(): Promise<NativeCaptureStatus>;
  requestRuntimePermissions(): Promise<NativeCaptureStatus>;
  openNotificationListenerSettings(): Promise<void>;
  openAccessibilitySettings(): Promise<void>;
  getCapturedNotifications(): Promise<{ notifications: NativeNotificationRecord[] }>;
  clearCapturedNotifications(): Promise<void>;
  getCapturedVisualContent(): Promise<{ content: NativeVisualTextRecord[] }>;
  clearCapturedVisualContent(): Promise<void>;
  getAppUsageMonitor(): Promise<NativeAppUsageMonitor>;
  clearAppUsageMonitor(): Promise<void>;
  getCurrentScreenText(): Promise<{ lines: string[] }>;
  syncTodos(options: { todos: string }): Promise<void>;
  setDesktopPetEnabled(options: { enabled: boolean }): Promise<void>;
  performAccessibilityAction(options: {
    action: string;
    x?: number;
    y?: number;
    packageName?: string;
    target?: string;
    delayMs?: number;
  }): Promise<NativeAccessibilityActionResult>;
  syncRecentCallLogs(): Promise<{ calls: NativeCallLogRecord[] }>;
  startSpeechRecognition(options?: { language?: string }): Promise<{ text: string }>;
  openExternalUrl(options: { url: string }): Promise<void>;
  saveTextFile(options: {
    fileName: string;
    content: string;
    mimeType?: string;
  }): Promise<{ uri: string; location: string }>;
  pickTextFile(): Promise<{ content: string; fileName: string }>;
  pickAudioFile(): Promise<{
    fileName: string;
    path: string;
    uri: string;
    size: number;
  }>;
  getOnDeviceModelStatus(): Promise<OnDeviceModelStatus>;
  downloadOnDeviceModel(options: { url: string }): Promise<void>;
  runOnDeviceInference(options: {
    prompt: string;
    maxTokens?: number;
  }): Promise<{ text: string }>;
}

// Allow a development/browser mock to simulate native behavior when enabled.
const MOCK_FLAG = (() => {
  try {
    if (typeof window !== 'undefined' && (window as any).__VOXFLOW_MOCK) return true;
    if (typeof localStorage !== 'undefined' && localStorage.getItem('voxflow_mock') === '1') return true;
  } catch {
    // ignore
  }
  return false;
})();

// Mock implementation for browser/dev testing
const MockVoxFlowNative: VoxFlowNativePlugin = {
  async getCaptureStatus() {
    return {
      isNativeAndroid: true,
      notificationAccess: true,
      accessibilityAccess: true,
      microphonePermission: true,
      callLogPermission: true,
      desktopPetEnabled: false,
    };
  },
  async requestRuntimePermissions() {
    return this.getCaptureStatus();
  },
  async openNotificationListenerSettings() {
    return;
  },
  async openAccessibilitySettings() {
    return;
  },
  async getCapturedNotifications() {
    return {
      notifications: [
        {
          id: 'n1',
          packageName: 'com.tencent.mm',
          appName: '微信',
          title: '来自小李的消息',
          text: '我们明天开会，记得准备报告',
          timestamp: Date.now(),
          channel: 'wechat',
        },
      ],
    };
  },
  async clearCapturedNotifications() {
    return;
  },
  async getCapturedVisualContent() {
    return {
      content: [
        {
          id: 'v1',
          packageName: 'com.tencent.mm',
          appName: '微信',
          text: '小张：下周五前把合同发给我\n小李：好的，我会准备',
          timestamp: Date.now(),
        },
      ],
    };
  },
  async clearCapturedVisualContent() {
    return;
  },
  async getAppUsageMonitor() {
    return {
      sessions: [
        {
          packageName: 'com.tencent.mm',
          appName: '微信',
          sessionStartAt: Date.now() - 1000 * 60 * 5,
          lastSeenAt: Date.now(),
          eventCount: 12,
          lineCount: 50,
          lastTextSnippet: '你好的消息内容',
          totalForegroundMs: 1000 * 60 * 5,
          lastSessionDurationMs: 1000 * 60 * 5,
        },
      ],
      currentPackageName: 'com.tencent.mm',
      accessibilityBound: true,
    };
  },
  async clearAppUsageMonitor() {
    return;
  },
  async getCurrentScreenText() {
    return { lines: ['屏幕第一行', '屏幕第二行'] };
  },
  async syncTodos() {
    return;
  },
  async setDesktopPetEnabled() {
    return;
  },
  async performAccessibilityAction() {
    return { success: true, bound: true };
  },
  async syncRecentCallLogs() {
    return {
      calls: [
        {
          id: 'c1',
          name: '王小明',
          number: '+8613712345678',
          type: 'incoming',
          durationSeconds: 120,
          timestamp: Date.now() - 1000 * 60 * 60,
        },
      ],
    };
  },
  async startSpeechRecognition() {
    return { text: '' };
  },
  async openExternalUrl() {
    return;
  },
  async saveTextFile(options: { fileName: string; content: string; mimeType?: string }) {
    // Provide a data URL as uri for dev
    const uri = `data:${options.mimeType || 'text/plain'};base64,${btoa(options.content)}`;
    return { uri, location: uri };
  },
  async pickTextFile() {
    return { content: '示例文本', fileName: 'sample.txt' };
  },
  async pickAudioFile() {
    return { fileName: 'sample.mp3', path: '/fake/path/sample.mp3', uri: '/fake/path/sample.mp3', size: 1024 };
  },
  async getOnDeviceModelStatus() {
    return {
      state: 'ready',
      downloaded: true,
      modelPath: '/models/gemma.task',
      modelSizeBytes: 1024 * 1024,
      downloadedBytes: 1024 * 1024,
      totalBytes: 1024 * 1024,
      errorMessage: '',
    };
  },
  async downloadOnDeviceModel() {
    return;
  },
  async runOnDeviceInference(options: { prompt: string; maxTokens?: number }) {
    // Return a simple JSON extraction compatible string
    const fake = JSON.stringify({
      summary: '自动生成摘要：请准备报告',
      category: '会议',
      todos: [
        { id: 't1', title: '准备报告', dueDate: '下周五', priority: 'high', tags: ['#会议'] },
      ],
      knowledgeBase: { title: '会议笔记', keyTakeaways: ['准备报告'], tags: ['#会议'], obsidianMarkdown: '# 会议笔记' },
    });
    return { text: fake };
  },
};

export const isNativeAndroid = MOCK_FLAG || (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android');

export const VoxFlowNative = MOCK_FLAG ? MockVoxFlowNative : registerPlugin<VoxFlowNativePlugin>('VoxFlowNative');

export const getNativeCaptureStatus = async (): Promise<NativeCaptureStatus> => {
  if (!isNativeAndroid) {
    return {
      isNativeAndroid: false,
      notificationAccess: false,
      accessibilityAccess: false,
      microphonePermission: false,
      callLogPermission: false,
      desktopPetEnabled: false,
    };
  }

  return VoxFlowNative.getCaptureStatus();
};

export const getOnDeviceModelStatus = async (): Promise<OnDeviceModelStatus> => {
  if (!isNativeAndroid) {
    return {
      state: 'not_downloaded',
      downloaded: false,
      modelPath: '',
      modelSizeBytes: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      errorMessage: '',
    };
  }

  return VoxFlowNative.getOnDeviceModelStatus();
};
