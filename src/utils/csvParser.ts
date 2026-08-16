import Papa from 'papaparse';
import Encoding from 'encoding-japanese';
import { MoneyForwardRecord } from '../types';

/**
 * ArrayBufferからテキストをデコード（Shift-JIS / UTF-8 自動判別）
 */
export const decodeCsvBuffer = (buffer: ArrayBuffer): string => {
  const uint8Array = new Uint8Array(buffer);
  const detected = Encoding.detect(uint8Array);
  const unicodeArray = Encoding.convert(uint8Array, {
    to: 'UNICODE',
    from: detected || 'SJIS',
  });
  return Encoding.codeToString(unicodeArray);
};

/**
 * Money ForwardのCSVテキストをパースしてMoneyForwardRecordの配列に変換
 */
export const parseMoneyForwardCsv = (csvText: string): MoneyForwardRecord[] => {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (header) => header.trim(),
  });

  if (result.errors && result.errors.length > 0) {
    console.warn('CSV Parse Warnings/Errors:', result.errors);
  }

  const rows: MoneyForwardRecord[] = [];

  result.data.forEach((row, index) => {
    // ヘッダー名揺れに対応
    const calcTargetRaw = row['計算対象'] ?? row['計算対象外'] ?? '1';
    const date = (row['日付'] ?? row['取引日'] ?? row['日時'] ?? '').trim();
    const content = (row['内容'] ?? row['摘要'] ?? row['利用店名・商品名'] ?? '').trim();
    const amountStr = (row['金額（円）'] ?? row['金額'] ?? row['Amount'] ?? '0').replace(/,/g, '').trim();
    const institution = (row['保有金融機関'] ?? row['金融機関'] ?? row['口座'] ?? '').trim();
    const majorCat = (row['大項目'] ?? row['カテゴリ'] ?? '未分類').trim();
    const mediumCat = (row['中項目'] ?? row['サブカテゴリ'] ?? '未分類').trim();
    const memo = (row['メモ'] ?? '').trim();
    const transferRaw = row['振替'] ?? '0';
    const mfId = (row['ID'] ?? row['取引ID'] ?? '').trim();

    // 独自フラグ・独自メモ（エクスポート済みCSVを取り込む場合）
    const customFlag = (row['独自フラグ'] ?? '未設定').trim() || '未設定';
    const customMemo = (row['独自メモ'] ?? '').trim();

    // 日付も内容も空の行はスキップ
    if (!date && !content && !amountStr) {
      return;
    }

    const rawAmount = parseFloat(amountStr) || 0;

    const record: MoneyForwardRecord = {
      id: mfId ? `mf-${mfId}` : `row-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 7)}`,
      calculationTarget: calcTargetRaw === '1' || calcTargetRaw === 'true' || calcTargetRaw === '○',
      date,
      content,
      amount: rawAmount,
      rawAmount,
      institution,
      majorCategory: majorCat || '未分類',
      mediumCategory: mediumCat || '未分類',
      memo,
      transfer: transferRaw === '1' || transferRaw === 'true' || transferRaw === '○',
      mfId,
      customFlag,
      customMemo,
      selected: false,
    };

    rows.push(record);
  });

  return rows;
};

/**
 * レコードの一意キーを生成（重複排除用）
 */
export const getRecordUniqueKey = (r: MoneyForwardRecord): string => {
  if (r.mfId && r.mfId.trim()) {
    return `mf_id:${r.mfId.trim()}`;
  }
  // IDがない場合は主要フィールドのハッシュ的結合
  return `data:${r.date}_${r.amount}_${r.content}_${r.institution}_${r.majorCategory}_${r.transfer ? 1 : 0}`;
};

/**
 * 既存レコードと新規取り込みレコードをマージし、重複を自動排除する
 * @param existing 既存のレコード
 * @param incoming 新しく取り込むレコード
 * @returns { mergedRecords, addedCount, duplicateCount }
 */
export const mergeAndDeduplicateRecords = (
  existing: MoneyForwardRecord[],
  incoming: MoneyForwardRecord[]
): {
  mergedRecords: MoneyForwardRecord[];
  addedCount: number;
  duplicateCount: number;
} => {
  const existingKeyMap = new Map<string, MoneyForwardRecord>();
  existing.forEach((r) => {
    existingKeyMap.set(getRecordUniqueKey(r), r);
  });

  let duplicateCount = 0;
  const newRecordsToAdd: MoneyForwardRecord[] = [];

  incoming.forEach((r) => {
    const key = getRecordUniqueKey(r);
    if (existingKeyMap.has(key)) {
      duplicateCount++;
      // 既存レコード（フラグや独自メモが付いている可能性がある）を優先保持
    } else {
      existingKeyMap.set(key, r);
      newRecordsToAdd.push(r);
    }
  });

  // 日付順（降順）でマージ
  const mergedRecords = [...existing, ...newRecordsToAdd].sort((a, b) => b.date.localeCompare(a.date));

  return {
    mergedRecords,
    addedCount: newRecordsToAdd.length,
    duplicateCount,
  };
};

/**
 * レコード群から含まれる年月（YYYY-MM）ごとの件数リストを取得
 */
export const getMonthsBreakdown = (
  records: MoneyForwardRecord[]
): { month: string; label: string; count: number; totalExpense: number }[] => {
  const monthMap = new Map<string, { count: number; totalExpense: number }>();

  records.forEach((r) => {
    if (!r.date) return;
    const match = r.date.match(/^(\d{4})[/-](\d{1,2})/);
    if (match) {
      const yyyy = match[1];
      const mm = match[2].padStart(2, '0');
      const ym = `${yyyy}-${mm}`;
      const prev = monthMap.get(ym) || { count: 0, totalExpense: 0 };
      monthMap.set(ym, {
        count: prev.count + 1,
        totalExpense: prev.totalExpense + (r.amount < 0 && !r.transfer ? Math.abs(r.amount) : 0),
      });
    }
  });

  return Array.from(monthMap.entries())
    .map(([month, data]) => {
      const [y, m] = month.split('-');
      return {
        month,
        label: `${y}年${parseInt(m, 10)}月`,
        count: data.count,
        totalExpense: data.totalExpense,
      };
    })
    .sort((a, b) => b.month.localeCompare(a.month)); // 新しい月順
};

/**
 * 加工済みデータをスプレッドシート書き込み用の二次元配列に変換
 */
export const recordsToSpreadsheetRows = (records: MoneyForwardRecord[]): (string | number)[][] => {
  return records.map((r) => [
    r.calculationTarget ? 1 : 0,
    r.date,
    r.content,
    r.amount,
    r.institution,
    r.majorCategory,
    r.mediumCategory,
    r.memo,
    r.transfer ? 1 : 0,
    r.mfId,
    r.customFlag,
    r.customMemo,
  ]);
};

/**
 * 加工後データをCSV文字列としてエクスポート（UTF-8 BOM付き）
 */
export const exportRecordsToCsv = (records: MoneyForwardRecord[], filename = 'moneyforward_processed.csv'): void => {
  const headers = [
    '計算対象',
    '日付',
    '内容',
    '金額（円）',
    '保有金融機関',
    '大項目',
    '中項目',
    'メモ',
    '振替',
    'ID',
    '独自フラグ',
    '独自メモ',
  ];

  const data = records.map((r) => [
    r.calculationTarget ? '1' : '0',
    r.date,
    r.content,
    r.amount,
    r.institution,
    r.majorCategory,
    r.mediumCategory,
    r.memo,
    r.transfer ? '1' : '0',
    r.mfId,
    r.customFlag,
    r.customMemo,
  ]);

  const csvString = Papa.unparse([headers, ...data]);
  // UTF-8 BOM付きでダウンロード
  const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
  const blob = new Blob([bom, csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
