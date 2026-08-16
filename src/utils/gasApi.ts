import { MoneyForwardRecord } from '../types';
import { recordsToSpreadsheetRows } from './csvParser';

export interface SaveToGasOptions {
  gasWebAppUrl: string;
  googleDriveFolderId?: string;
  records: MoneyForwardRecord[];
  fileName?: string;
  rawCsvContent?: string;
}

export interface GasApiResponse {
  success: boolean;
  message?: string;
  count?: number;
}

export const saveToGoogleSheetsViaGas = async (
  options: SaveToGasOptions
): Promise<GasApiResponse> => {
  const { gasWebAppUrl, googleDriveFolderId, records, fileName, rawCsvContent } = options;

  if (!gasWebAppUrl || !gasWebAppUrl.startsWith('http')) {
    throw new Error('有効なGoogle Apps Script (GAS) のWebアプリURLが設定されていません。設定画面からURLを入力してください。');
  }

  if (!records || records.length === 0) {
    throw new Error('保存するレコードがありません。');
  }

  const rows = recordsToSpreadsheetRows(records);

  const payload = {
    rows,
    folderId: googleDriveFolderId || '',
    fileName: fileName || `mf_export_${new Date().toISOString().slice(0, 10)}.csv`,
    csvContent: rawCsvContent || '',
  };

  try {
    // GASのdoPostは text/plain 形式でPOSTするとCORSプリフライト(OPTIONS)を回避でき、
    // GAS側で JSON.parse(e.postData.contents) として安全に取得できます。
    const response = await fetch(gasWebAppUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
    }

    const resJson = await response.json();
    if (resJson.status === 'success') {
      return {
        success: true,
        count: resJson.count ?? rows.length,
        message: 'スプレッドシートへ正常に保存されました。',
      };
    } else {
      throw new Error(resJson.message || 'GAS実行エラーが発生しました。');
    }
  } catch (error: any) {
    console.error('GAS save failed:', error);
    // CORSの不透明レスポンスやネットワーク例外の場合のハンドリング
    return {
      success: false,
      message: error.message || 'GASへの通信に失敗しました。URLや権限設定を確認してください。',
    };
  }
};
