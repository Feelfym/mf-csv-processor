import { MoneyForwardRecord, FilterOptions } from '../types';

export const DEFAULT_FILTERS: FilterOptions = {
  keyword: '',
  selectedFlag: 'ALL',
  selectedMajorCategory: 'ALL',
  onlyExpense: false,
  hideTransfers: true,
  dateRange: { start: '', end: '' },
};

/**
 * フィルタ条件に基づいてレコードを絞り込み
 */
export const applyFiltersToRecords = (
  records: MoneyForwardRecord[],
  filters: FilterOptions
): MoneyForwardRecord[] => {
  return records.filter((rec) => {
    // キーワード検索
    if (filters.keyword.trim()) {
      const kw = filters.keyword.toLowerCase();
      const matchContent = (rec.content || '').toLowerCase().includes(kw);
      const matchMemo = (rec.memo || '').toLowerCase().includes(kw);
      const matchCustomMemo = (rec.customMemo || '').toLowerCase().includes(kw);
      const matchInst = (rec.institution || '').toLowerCase().includes(kw);
      if (!matchContent && !matchMemo && !matchCustomMemo && !matchInst) return false;
    }

    // フラグフィルタ
    if (filters.selectedFlag !== 'ALL') {
      if (filters.selectedFlag === '未設定') {
        if (rec.customFlag && rec.customFlag !== '未設定') return false;
      } else {
        if (rec.customFlag !== filters.selectedFlag) return false;
      }
    }

    // 大項目フィルタ
    if (filters.selectedMajorCategory !== 'ALL' && rec.majorCategory !== filters.selectedMajorCategory) {
      return false;
    }

    // 支出のみフィルタ
    if (filters.onlyExpense && rec.amount >= 0) {
      return false;
    }

    // 振替非表示
    if (filters.hideTransfers && rec.transfer) {
      return false;
    }

    return true;
  });
};
