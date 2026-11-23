import {
  doc,
  getDoc,
  collection,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import { AppSettings, AutoRule, MoneyForwardRecord } from '../types';
import { normalizeYearMonth } from './dateUtils';

const DEVICE_ID_KEY = 'mf_processor_device_id';

/** 端末ごとの一意IDを取得（他端末での更新を検知するため） */
export const getDeviceId = (): string => {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return 'dev-ephemeral';
  }
};

export interface CloudMeta {
  fileName: string | null;
  selectedPeriod: string;
  settings: AppSettings;
  rules: AutoRule[];
  months: string[];
  recordCount: number;
  updatedAt: number;
  deviceId: string;
}

export interface CloudSyncPayload {
  records: MoneyForwardRecord[];
  rules: AutoRule[];
  settings: AppSettings;
  fileName: string | null;
  selectedPeriod: string;
}

export interface LoadedCloudData extends CloudSyncPayload {
  updatedAt: number;
  deviceId: string;
}

/** 前回同期した各月のシリアライズ結果キャッシュ（変更があった月だけ差分保存するため） */
const syncedMonthSnapshots = new Map<string, string>();
let syncedMonthsSet = new Set<string>();

export const clearCloudSyncCache = (): void => {
  syncedMonthSnapshots.clear();
  syncedMonthsSet.clear();
};

const groupRecordsByMonth = (
  records: MoneyForwardRecord[]
): Map<string, MoneyForwardRecord[]> => {
  const map = new Map<string, MoneyForwardRecord[]>();
  records.forEach((r) => {
    const ym = normalizeYearMonth(r.date) || 'unknown';
    const list = map.get(ym);
    if (list) {
      list.push(r);
    } else {
      map.set(ym, [r]);
    }
  });
  return map;
};

const sanitizeUrl = (url?: string): string => {
  const trimmed = (url || '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
    return trimmed.slice(0, 2048);
  }
  return '';
};

const sanitizeRule = (rule: AutoRule): AutoRule => ({
  id: String(rule.id || `rule-${Date.now()}`).slice(0, 128),
  name: String(rule.name || '').slice(0, 200),
  targetField: ['content', 'majorCategory', 'mediumCategory', 'institution', 'memo'].includes(
    rule.targetField
  )
    ? rule.targetField
    : 'content',
  matchType: ['contains', 'equals', 'startsWith', 'endsWith'].includes(rule.matchType)
    ? rule.matchType
    : 'contains',
  keyword: String(rule.keyword || '').slice(0, 200),
  applyFlag: String(rule.applyFlag || '未設定').slice(0, 100),
  enabled: Boolean(rule.enabled),
});

/**
 * Firestore の undefined フィールドエラーを防ぐためのクリーンアップ
 */
const sanitizeRecord = (r: MoneyForwardRecord): MoneyForwardRecord => ({
  id: String(r.id || '').slice(0, 128),
  calculationTarget: Boolean(r.calculationTarget),
  date: String(r.date || '').slice(0, 32),
  content: String(r.content || '').slice(0, 500),
  amount: Number(r.amount) || 0,
  rawAmount: Number(r.rawAmount) || 0,
  institution: String(r.institution || '').slice(0, 200),
  majorCategory: String(r.majorCategory || '未分類').slice(0, 100),
  mediumCategory: String(r.mediumCategory || '未分類').slice(0, 100),
  memo: String(r.memo || '').slice(0, 1000),
  transfer: Boolean(r.transfer),
  mfId: String(r.mfId || '').slice(0, 128),
  customFlag: String(r.customFlag || '未設定').slice(0, 100),
  customMemo: String(r.customMemo || '').slice(0, 2000),
});

/**
 * クラウド側のメタデータのみ軽量取得（1 Read）
 */
export const fetchCloudMeta = async (uid: string): Promise<CloudMeta | null> => {
  if (!db) return null;
  const metaRef = doc(db, 'users', uid, 'meta', 'state');
  const snap = await getDoc(metaRef);
  if (!snap.exists()) return null;
  return snap.data() as CloudMeta;
};

/**
 * クラウドから全データ（メタデータ＋全月ドキュメント）を取得
 */
export const loadCloudData = async (uid: string): Promise<LoadedCloudData | null> => {
  if (!db) return null;

  const metaRef = doc(db, 'users', uid, 'meta', 'state');
  const monthsColRef = collection(db, 'users', uid, 'months');

  const [metaSnap, monthsSnap] = await Promise.all([
    getDoc(metaRef),
    getDocs(monthsColRef),
  ]);

  if (!metaSnap.exists()) return null;
  const meta = metaSnap.data() as CloudMeta;

  const allRecords: MoneyForwardRecord[] = [];
  syncedMonthSnapshots.clear();
  syncedMonthsSet = new Set<string>();

  monthsSnap.forEach((docSnap) => {
    const data = docSnap.data() as { month?: string; records?: MoneyForwardRecord[] };
    const monthKey = data.month || docSnap.id;
    const recs = Array.isArray(data.records) ? data.records.map(sanitizeRecord) : [];
    syncedMonthsSet.add(monthKey);
    syncedMonthSnapshots.set(monthKey, JSON.stringify(recs));
    allRecords.push(...recs);
  });

  // 日付降順でソート
  allRecords.sort((a, b) => b.date.localeCompare(a.date));

  return {
    records: allRecords,
    rules: Array.isArray(meta.rules) ? meta.rules : [],
    settings: meta.settings,
    fileName: meta.fileName ?? null,
    selectedPeriod: meta.selectedPeriod || 'ALL',
    updatedAt: meta.updatedAt || Date.now(),
    deviceId: meta.deviceId || '',
  };
};

/**
 * 変更があった月ドキュメントとメタデータだけを差分保存（月別分割により1MB上限を回避）
 */
export const saveCloudData = async (
  uid: string,
  payload: CloudSyncPayload,
  options: { forceAll?: boolean } = {}
): Promise<{ updatedAt: number; writtenMonths: number }> => {
  if (!db) {
    throw new Error('Firebase が初期化されていません。');
  }

  const now = Date.now();
  const deviceId = getDeviceId();
  const sanitizedRecords = payload.records.map(sanitizeRecord);
  const grouped = groupRecordsByMonth(sanitizedRecords);
  const currentMonths = Array.from(grouped.keys()).sort();

  const batch = writeBatch(db);
  let writtenMonths = 0;

  // 追加・更新された月ドキュメントだけ書き込み
  for (const [ym, recs] of grouped.entries()) {
    const serialized = JSON.stringify(recs);
    if (options.forceAll || syncedMonthSnapshots.get(ym) !== serialized) {
      const monthRef = doc(db, 'users', uid, 'months', ym);
      batch.set(monthRef, {
        month: ym,
        records: recs,
        updatedAt: now,
      });
      syncedMonthSnapshots.set(ym, serialized);
      writtenMonths++;
    }
  }

  // 削除された月ドキュメントをクラウドからも削除
  const currentMonthSet = new Set(currentMonths);
  for (const oldYm of syncedMonthsSet) {
    if (!currentMonthSet.has(oldYm)) {
      const oldRef = doc(db, 'users', uid, 'months', oldYm);
      batch.delete(oldRef);
      syncedMonthSnapshots.delete(oldYm);
    }
  }
  syncedMonthsSet = currentMonthSet;

  // メタデータを更新
  const metaRef = doc(db, 'users', uid, 'meta', 'state');
  const metaDoc: CloudMeta = {
    fileName: payload.fileName ? String(payload.fileName).slice(0, 500) : null,
    selectedPeriod: payload.selectedPeriod || 'ALL',
    settings: {
      gasWebAppUrl: sanitizeUrl(payload.settings.gasWebAppUrl),
      googleDriveFolderId: String(payload.settings.googleDriveFolderId || '').slice(0, 256),
      notebookLmUrl: sanitizeUrl(payload.settings.notebookLmUrl),
      customFlags: (payload.settings.customFlags || [])
        .map((f) => String(f || '').trim().slice(0, 100))
        .filter(Boolean)
        .slice(0, 50),
    },
    rules: (payload.rules || []).slice(0, 500).map(sanitizeRule),
    months: currentMonths.slice(0, 240),
    recordCount: sanitizedRecords.length,
    updatedAt: now,
    deviceId: deviceId.slice(0, 128),
  };
  batch.set(metaRef, metaDoc);

  await batch.commit();
  return { updatedAt: now, writtenMonths };
};
