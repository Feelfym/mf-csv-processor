export interface MoneyForwardRecord {
  id: string; // 一意なID (CSVのIDまたは生成UUID)
  calculationTarget: boolean; // 計算対象 (1: true, 0: false)
  date: string; // 日付 (YYYY/MM/DD または YYYY-MM-DD)
  content: string; // 内容 (摘要/店舗名など)
  amount: number; // 金額 (支出は負または正、MFは支出がマイナス、収入がプラス、あるいは正数表記)
  rawAmount: number; // 生の金額
  institution: string; // 保有金融機関
  majorCategory: string; // 大項目
  mediumCategory: string; // 中項目
  memo: string; // メモ
  transfer: boolean; // 振替 (1: true, 0: false)
  mfId: string; // MF本来のID (あれば)

  // アプリ独自の拡張フィールド
  customFlag: string; // 独自フラグ (例: "立替", "精算対象", "経費", "除外", "特別費", "未設定")
  customMemo: string; // 独自メモ
  selected?: boolean; // UIでの一括選択用
}

export interface AutoRule {
  id: string;
  name: string;
  targetField: 'content' | 'majorCategory' | 'mediumCategory' | 'institution' | 'memo';
  matchType: 'contains' | 'equals' | 'startsWith' | 'endsWith';
  keyword: string;
  applyFlag: string;
  enabled: boolean;
}

export interface AppSettings {
  gasWebAppUrl: string;
  googleDriveFolderId: string;
  notebookLmUrl?: string; // NotebookLMの特定のノートブックURL
  customFlags: string[];
}

export type FilterOptions = {
  keyword: string;
  selectedFlag: string;
  selectedMajorCategory: string;
  onlyExpense: boolean;
  hideTransfers: boolean;
  dateRange: {
    start: string;
    end: string;
  };
};
