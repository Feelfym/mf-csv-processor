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

    // 日付も内容も空の行はスキップ
    if (!date && !content && !amountStr) {
      return;
    }

    const rawAmount = parseFloat(amountStr) || 0;
    // MFの支出はマイナスで記録されている場合とプラスの場合があるが、通常支出はマイナス表記
    // わかりやすくするために rawAmount をそのまま保持

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
      customFlag: '未設定',
      customMemo: '',
      selected: false,
    };

    rows.push(record);
  });

  return rows;
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
