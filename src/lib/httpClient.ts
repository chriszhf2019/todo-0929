import { Capacitor, CapacitorHttp } from '@capacitor/core';

export interface HttpJsonResponse {
  status: number;
  data: unknown;
}

const isNative = () => Capacitor.isNativePlatform();

const nativeGet = async (url: string, timeoutMs: number): Promise<HttpJsonResponse> => {
  const response = await CapacitorHttp.get({
    url,
    connectTimeout: timeoutMs,
    readTimeout: timeoutMs,
  });
  return { status: response.status, data: response.data };
};

const nativePost = async (
  url: string,
  body: unknown,
  headers: Record<string, string>,
  timeoutMs: number
): Promise<HttpJsonResponse> => {
  const response = await CapacitorHttp.post({
    url,
    headers,
    data: body,
    connectTimeout: timeoutMs,
    readTimeout: timeoutMs,
  });
  return { status: response.status, data: response.data };
};

const webGet = async (url: string, timeoutMs: number): Promise<HttpJsonResponse> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const data = await response.json().catch(() => null);
    return { status: response.status, data };
  } finally {
    clearTimeout(timer);
  }
};

const webPost = async (
  url: string,
  body: unknown,
  headers: Record<string, string>,
  timeoutMs: number
): Promise<HttpJsonResponse> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => null);
    return { status: response.status, data };
  } finally {
    clearTimeout(timer);
  }
};

export const httpGetJson = (url: string, timeoutMs = 10000): Promise<HttpJsonResponse> =>
  isNative() ? nativeGet(url, timeoutMs) : webGet(url, timeoutMs);

export const httpPostJson = (
  url: string,
  body: unknown,
  timeoutMs = 120000
): Promise<HttpJsonResponse> => {
  const headers = { 'Content-Type': 'application/json' };
  return isNative() ? nativePost(url, body, headers, timeoutMs) : webPost(url, body, headers, timeoutMs);
};
