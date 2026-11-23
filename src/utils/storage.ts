import { AppSettings, AutoRule, MoneyForwardRecord } from '../types';

const STORAGE_KEYS = {
  SETTINGS: 'mf_processor_settings',
  RULES: 'mf_processor_rules',
  SAVED_DATA: 'mf_processor_saved_data',
};

// 独自フラグは「未設定」「清算対象」「清算済み」「除外」の4種類
export const DEFAULT_FLAGS = [
  '未設定',
  '清算対象',
  '清算済み',
  '除外',
];

export const DEFAULT_SETTINGS: AppSettings = {
  gasWebAppUrl: '',
  googleDriveFolderId: '',
  notebookLmUrl: '',
  customFlags: DEFAULT_FLAGS,
};

export const DEFAULT_RULES: AutoRule[] = [
  {
    id: 'default-rule-1',
    name: 'JR・交通費を清算対象',
    targetField: 'content',
    matchType: 'contains',
    keyword: 'JR',
    applyFlag: '清算対象',
    enabled: true,
  },
  {
    id: 'default-rule-2',
    name: 'タクシー代を清算対象',
    targetField: 'content',
    matchType: 'contains',
    keyword: 'タクシー',
    applyFlag: '清算対象',
    enabled: true,
  },
];

export const loadSettings = (): AppSettings => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);

    // 既存設定に「清算済み」がなければ自動で追加
    let flags: string[] = parsed.customFlags && parsed.customFlags.length > 0 ? parsed.customFlags : DEFAULT_FLAGS;
    if (!flags.includes('清算済み') && !flags.includes('精算済み')) {
      const idx = flags.indexOf('清算対象');
      if (idx !== -1) {
        flags = [...flags.slice(0, idx + 1), '清算済み', ...flags.slice(idx + 1)];
      } else {
        flags = [...flags, '清算済み'];
      }
    }

    return {
      gasWebAppUrl: parsed.gasWebAppUrl || '',
      googleDriveFolderId: parsed.googleDriveFolderId || '',
      notebookLmUrl: parsed.notebookLmUrl || '',
      customFlags: flags,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
};

export const saveSettings = (settings: AppSettings): boolean => {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    return true;
  } catch (e) {
    console.error('Failed to save settings to localStorage:', e);
    return false;
  }
};

export const loadRules = (): AutoRule[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.RULES);
    if (!raw) return DEFAULT_RULES;
    return JSON.parse(raw);
  } catch {
    return DEFAULT_RULES;
  }
};

export const saveRules = (rules: AutoRule[]): boolean => {
  try {
    localStorage.setItem(STORAGE_KEYS.RULES, JSON.stringify(rules));
    return true;
  } catch (e) {
    console.error('Failed to save rules to localStorage:', e);
    return false;
  }
};

export interface StoredSessionData {
  records: MoneyForwardRecord[];
  fileName: string | null;
  selectedPeriod?: string;
  updatedAt: string;
}

export type StorageSaveResult =
  | { ok: true; bytes: number }
  | { ok: false; reason: 'quota' | 'unknown'; message: string };

const isQuotaError = (err: unknown): boolean => {
  if (!err || typeof err !== 'object') return false;
  const e = err as { name?: string; code?: number };
  return (
    e.name === 'QuotaExceededError' ||
    e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    e.code === 22 ||
    e.code === 1014
  );
};

/**
 * 明細データ・ファイル名・編集状態をローカルストレージに自動保存
 * ※容量圧迫を防ぐため、生CSVテキスト（rawCsvContent）は保存対象から除外する
 */
export const saveStoredData = (data: Omit<StoredSessionData, 'updatedAt'>): StorageSaveResult => {
  try {
    if (!data.records || data.records.length === 0) {
      localStorage.removeItem(STORAGE_KEYS.SAVED_DATA);
      return { ok: true, bytes: 0 };
    }
    const payload: StoredSessionData = {
      records: data.records,
      fileName: data.fileName,
      selectedPeriod: data.selectedPeriod,
      updatedAt: new Date().toISOString(),
    };
    const serialized = JSON.stringify(payload);
    localStorage.setItem(STORAGE_KEYS.SAVED_DATA, serialized);
    // localStorage は UTF-16 で格納されるため、概算バイト数として文字数×2を返す
    return { ok: true, bytes: serialized.length * 2 };
  } catch (e) {
    const quota = isQuotaError(e);
    console.warn('Failed to save session data to localStorage:', e);
    return {
      ok: false,
      reason: quota ? 'quota' : 'unknown',
      message: quota
        ? 'ブラウザの保存容量上限（約5MB）に達したため、自動保存できませんでした。設定画面からJSONバックアップをダウンロードするか、古い月のデータを削除してください。'
        : 'ブラウザへの自動保存に失敗しました。設定画面からJSONバックアップをダウンロードしてください。',
    };
  }
};

/**
 * 本アプリが localStorage で使用している概算容量（バイト）を取得
 */
export const getStorageUsageBytes = (): { totalBytes: number; sessionBytes: number } => {
  try {
    const sessionRaw = localStorage.getItem(STORAGE_KEYS.SAVED_DATA) || '';
    const settingsRaw = localStorage.getItem(STORAGE_KEYS.SETTINGS) || '';
    const rulesRaw = localStorage.getItem(STORAGE_KEYS.RULES) || '';
    const sessionBytes = sessionRaw.length * 2;
    const totalBytes = (sessionRaw.length + settingsRaw.length + rulesRaw.length) * 2;
    return { totalBytes, sessionBytes };
  } catch {
    return { totalBytes: 0, sessionBytes: 0 };
  }
};

/**
 * ローカルストレージから前回の明細データを復元
 */
export const loadStoredData = (): StoredSessionData | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SAVED_DATA);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load session data from localStorage:', e);
    return null;
  }
};

/**
 * ローカルストレージの明細データをクリア
 */
export const clearStoredData = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEYS.SAVED_DATA);
  } catch (e) {
    console.error('Failed to clear session data from localStorage:', e);
  }
};
