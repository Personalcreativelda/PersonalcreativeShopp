import { APP_TIMEZONE } from '../utils/dateUtils';
import { ShopVisit, AdminActivityLog } from '../../core/types/types';
import { getApiToken } from './apiClient';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3060/api';

const getDeviceInfo = () => {
  const ua = navigator.userAgent;
  const screen = window.screen;

  let deviceType: 'desktop' | 'mobile' | 'tablet' = 'desktop';
  if (/tablet|ipad|playbook|silk/i.test(ua)) {
    deviceType = 'tablet';
  } else if (/mobile|iphone|ipod|android|blackberry|opera|mini|windows\sce|palm|smartphone|iemobile/i.test(ua)) {
    deviceType = 'mobile';
  }

  let browser = 'Unknown';
  let browserVersion = '';
  if (ua.indexOf('Firefox') > -1) {
    browser = 'Firefox';
    browserVersion = ua.match(/Firefox\/(\d+\.\d+)/)?.[1] || '';
  } else if (ua.indexOf('Chrome') > -1 && ua.indexOf('Edg') === -1) {
    browser = 'Chrome';
    browserVersion = ua.match(/Chrome\/(\d+\.\d+)/)?.[1] || '';
  } else if (ua.indexOf('Safari') > -1 && ua.indexOf('Chrome') === -1) {
    browser = 'Safari';
    browserVersion = ua.match(/Version\/(\d+\.\d+)/)?.[1] || '';
  } else if (ua.indexOf('Edg') > -1) {
    browser = 'Edge';
    browserVersion = ua.match(/Edg\/(\d+\.\d+)/)?.[1] || '';
  }

  let os = 'Unknown';
  let osVersion = '';
  if (ua.indexOf('Windows') > -1) {
    os = 'Windows';
    osVersion = ua.match(/Windows NT (\d+\.\d+)/)?.[1] || '';
  } else if (ua.indexOf('Mac') > -1) {
    os = 'macOS';
    osVersion = ua.match(/Mac OS X (\d+[._]\d+)/)?.[1]?.replace('_', '.') || '';
  } else if (ua.indexOf('Linux') > -1) {
    os = 'Linux';
  } else if (ua.indexOf('Android') > -1) {
    os = 'Android';
    osVersion = ua.match(/Android (\d+\.\d+)/)?.[1] || '';
  } else if (ua.indexOf('iOS') > -1 || ua.indexOf('iPhone') > -1 || ua.indexOf('iPad') > -1) {
    os = 'iOS';
    osVersion = ua.match(/OS (\d+[._]\d+)/)?.[1]?.replace('_', '.') || '';
  }

  return {
    deviceType, browser, browserVersion, os, osVersion,
    screenResolution: `${screen.width}x${screen.height}`,
    language: navigator.language || navigator.languages?.[0] || 'pt',
    timezone: APP_TIMEZONE
  };
};

const getVisitorId = (): string => {
  const storageKey = 'naturerva_visitor_id';
  let visitorId = localStorage.getItem(storageKey);
  if (!visitorId) {
    visitorId = `visitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem(storageKey, visitorId);
  }
  return visitorId;
};

const getSessionId = (): string => {
  const storageKey = 'naturerva_session_id';
  const sessionKey = 'naturerva_session_start';
  let sessionId = sessionStorage.getItem(storageKey);
  const sessionStart = sessionStorage.getItem(sessionKey);
  const now = Date.now();
  if (!sessionId || !sessionStart || (now - parseInt(sessionStart)) > 30 * 60 * 1000) {
    sessionId = `session_${now}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem(storageKey, sessionId);
    sessionStorage.setItem(sessionKey, now.toString());
  } else {
    sessionStorage.setItem(sessionKey, now.toString());
  }
  return sessionId;
};

const getIpAddress = async (): Promise<string | undefined> => {
  try {
    for (const api of ['https://api.ipify.org?format=json', 'https://ipapi.co/json/', 'https://api.myip.com']) {
      try {
        const res = await fetch(api, { signal: AbortSignal.timeout(3000) });
        const data = await res.json();
        return data.ip || data.query || data.ipAddress;
      } catch { continue; }
    }
  } catch { /* silent */ }
  return undefined;
};

async function post(path: string, body: unknown, withAuth = false): Promise<boolean> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (withAuth) {
      const token = getApiToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });
    return res.ok;
  } catch { return false; }
}

async function get<T>(path: string): Promise<T[]> {
  try {
    const token = getApiToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}${path}`, { headers });
    if (!res.ok) return [];
    return await res.json();
  } catch { return []; }
}

export const trackingService = {
  async trackShopVisit(data: {
    pagePath: string;
    pageTitle?: string;
    customerId?: string;
    userId?: string;
    productsViewed?: string[];
    actions?: Array<{ type: string; timestamp: string; data?: any }>;
    visitDuration?: number;
    metadata?: Record<string, any>;
  }): Promise<boolean> {
    try {
      const deviceInfo = getDeviceInfo();
      const ipAddress = await getIpAddress();

      return post('/tracking/shop-visit', {
        visitor_id: getVisitorId(),
        session_id: getSessionId(),
        customer_id: data.customerId || null,
        user_id: data.userId || null,
        page_path: data.pagePath,
        page_title: data.pageTitle || document.title,
        referrer: document.referrer || null,
        ip_address: ipAddress || null,
        user_agent: navigator.userAgent,
        device_type: deviceInfo.deviceType,
        browser: deviceInfo.browser,
        browser_version: deviceInfo.browserVersion,
        os: deviceInfo.os,
        os_version: deviceInfo.osVersion,
        screen_resolution: deviceInfo.screenResolution,
        language: deviceInfo.language,
        timezone: deviceInfo.timezone,
        visit_duration: data.visitDuration || null,
        products_viewed: data.productsViewed || [],
        actions: data.actions || [],
        metadata: data.metadata || {}
      });
    } catch { return false; }
  },

  async trackShopAction(actionType: string, data?: any): Promise<boolean> {
    // No-op — shop actions are bundled into the visit record on the backend
    return true;
  },

  async trackAdminActivity(data: {
    userId: string;
    pagePath: string;
    pageTitle?: string;
    actionType?: string;
    actionDetails?: Record<string, any>;
    duration?: number;
    metadata?: Record<string, any>;
  }): Promise<boolean> {
    try {
      const deviceInfo = getDeviceInfo();
      const ipAddress = await getIpAddress();

      return post('/tracking/admin-activity', {
        user_id: data.userId,
        page_path: data.pagePath,
        page_title: data.pageTitle || document.title,
        action_type: data.actionType || 'view',
        action_details: data.actionDetails || {},
        ip_address: ipAddress || null,
        user_agent: navigator.userAgent,
        device_type: deviceInfo.deviceType,
        browser: deviceInfo.browser,
        browser_version: deviceInfo.browserVersion,
        os: deviceInfo.os,
        os_version: deviceInfo.osVersion,
        session_id: getSessionId(),
        duration: data.duration || null,
        metadata: data.metadata || {}
      }, true);
    } catch { return false; }
  },

  async getShopVisits(filters?: {
    startDate?: string;
    endDate?: string;
    customerId?: string;
    pagePath?: string;
    limit?: number;
  }): Promise<ShopVisit[]> {
    const params = new URLSearchParams();
    if (filters?.startDate) params.set('startDate', filters.startDate);
    if (filters?.endDate)   params.set('endDate',   filters.endDate);
    if (filters?.customerId)params.set('customerId',filters.customerId);
    if (filters?.pagePath)  params.set('pagePath',  filters.pagePath);
    if (filters?.limit)     params.set('limit',     String(filters.limit));
    const qs = params.toString();
    return get<ShopVisit>(`/tracking/shop-visits${qs ? `?${qs}` : ''}`);
  },

  async getAdminActivities(filters?: {
    userId?: string;
    startDate?: string;
    endDate?: string;
    pagePath?: string;
    actionType?: string;
    limit?: number;
  }): Promise<AdminActivityLog[]> {
    const params = new URLSearchParams();
    if (filters?.userId)    params.set('userId',    filters.userId);
    if (filters?.startDate) params.set('startDate', filters.startDate);
    if (filters?.endDate)   params.set('endDate',   filters.endDate);
    if (filters?.pagePath)  params.set('pagePath',  filters.pagePath);
    if (filters?.actionType)params.set('actionType',filters.actionType);
    if (filters?.limit)     params.set('limit',     String(filters.limit));
    const qs = params.toString();
    return get<AdminActivityLog>(`/tracking/admin-activities${qs ? `?${qs}` : ''}`);
  },

  async getShopVisitStats(filters?: { startDate?: string; endDate?: string }) {
    const visits = await this.getShopVisits({ ...filters, limit: 10000 });

    const uniqueVisitors = new Set(visits.map((v: any) => v.visitorId).filter(Boolean)).size;
    const uniqueSessions = new Set(visits.map((v: any) => v.sessionId).filter(Boolean)).size;
    const durations = visits.map((v: any) => v.visitDuration).filter((d: any) => d && d > 0);
    const averageDuration = durations.length > 0
      ? Math.round(durations.reduce((a: number, b: number) => a + b, 0) / durations.length)
      : 0;

    const pageCounts: Record<string, number> = {};
    const productCounts: Record<string, number> = {};
    const deviceTypes: Record<string, number> = {};
    const browsers: Record<string, number> = {};

    visits.forEach((v: any) => {
      const path = v.pagePath || 'unknown';
      pageCounts[path] = (pageCounts[path] || 0) + 1;

      (v.productsViewed || []).forEach((pid: string) => {
        productCounts[pid] = (productCounts[pid] || 0) + 1;
      });
      (v.actions || []).forEach((action: any) => {
        if (action.data?.productId) {
          const pid = action.data.productId;
          productCounts[pid] = (productCounts[pid] || 0) + 1;
        }
      });

      const dt = v.deviceType || 'unknown';
      deviceTypes[dt] = (deviceTypes[dt] || 0) + 1;
      const br = v.browser || 'unknown';
      browsers[br] = (browsers[br] || 0) + 1;
    });

    return {
      totalVisits: visits.length,
      uniqueVisitors,
      uniqueSessions,
      averageDuration,
      topPages: Object.entries(pageCounts).map(([path, count]) => ({ path, count })).sort((a, b) => b.count - a.count).slice(0, 10),
      topProducts: Object.entries(productCounts).map(([productId, count]) => ({ productId, count })).sort((a, b) => b.count - a.count).slice(0, 10),
      deviceTypes,
      browsers
    };
  },

  async getAdminActivityStats(filters?: { userId?: string; startDate?: string; endDate?: string }) {
    const activities = await this.getAdminActivities({ ...filters, limit: 10000 });

    const uniqueUsers = new Set(activities.map((a: any) => a.userId)).size;
    const pageCounts: Record<string, number> = {};
    const actionCounts: Record<string, number> = {};
    const userCounts: Record<string, { count: number; name?: string }> = {};

    activities.forEach((a: any) => {
      const path = a.pagePath || 'unknown';
      pageCounts[path] = (pageCounts[path] || 0) + 1;
      const action = a.actionType || 'view';
      actionCounts[action] = (actionCounts[action] || 0) + 1;
      if (!userCounts[a.userId]) userCounts[a.userId] = { count: 0, name: a.userName };
      userCounts[a.userId].count++;
    });

    return {
      totalActivities: activities.length,
      uniqueUsers,
      topPages: Object.entries(pageCounts).map(([path, count]) => ({ path, count })).sort((a, b) => b.count - a.count).slice(0, 10),
      topActions: actionCounts,
      topUsers: Object.entries(userCounts).map(([userId, d]) => ({ userId, userName: d.name, count: d.count })).sort((a, b) => b.count - a.count).slice(0, 10)
    };
  }
};
