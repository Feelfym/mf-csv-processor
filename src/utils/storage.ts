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

export const saveSettings = (settings: AppSettings): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save settings to localStorage:', e);
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

export const saveRules = (rules: AutoRule[]): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.RULES, JSON.stringify(rules));
  } catch (e) {
    console.error('Failed to save rules to localStorage:', e);
  }
};

export interface StoredSessionData {
  records: MoneyForwardRecord[];
  fileName: string | null;
  rawCsvContent: string;
  selectedPeriod?: string;
  updatedAt: string;
}

/**
 * 明細データ・ファイル名・編集状態をローカルストレージに自動保存
 */
export const saveStoredData = (data: Omit<StoredSessionData, 'updatedAt'>): void => {
  try {
    if (!data.records || data.records.length === 0) {
      localStorage.removeItem(STORAGE_KEYS.SAVED_DATA);
      return;
    }
    const payload: StoredSessionData = {
      ...data,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEYS.SAVED_DATA, JSON.stringify(payload));
  } catch (e) {
    console.warn('Failed to save session data to localStorage (storage quota might be exceeded):', e);
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
