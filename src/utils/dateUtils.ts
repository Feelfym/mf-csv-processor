import { MoneyForwardRecord } from '../types';

/**
 * 日付文字列から YYYY-MM を抽出して正規化 (例: "2026/08/01" -> "2026-08", "2026/8/1" -> "2026-08")
 */
export const normalizeYearMonth = (dateStr: string): string | null => {
  if (!dateStr) return null;
  const cleaned = dateStr.trim().replace(/\//g, '-');
  const match = cleaned.match(/^(\d{4})-(\d{1,2})/);
  if (!match) return null;
  const year = match[1];
  const month = match[2].padStart(2, '0');
  return `${year}-${month}`;
};

/**
 * 日付文字列から YYYY を抽出
 */
export const normalizeYear = (dateStr: string): string | null => {
  if (!dateStr) return null;
  const match = dateStr.trim().match(/^(\d{4})/);
  return match ? match[1] : null;
};

export interface PeriodOption {
  value: string; // 'ALL' | 'YEAR:2026' | 'MONTH:2026-08'
  label: string; // 'すべての期間' | '2026年 (通年)' | '2026年08月'
  count: number;
}

/**
 * レコード配列から利用可能な年・年月のリストを自動集計
 */
export const getAvailablePeriods = (records: MoneyForwardRecord[]): PeriodOption[] => {
  const monthCounts: { [ym: string]: number } = {};
  const yearCounts: { [y: string]: number } = {};

  records.forEach((r) => {
    const ym = normalizeYearMonth(r.date);
    if (ym) {
      monthCounts[ym] = (monthCounts[ym] || 0) + 1;
      const year = ym.split('-')[0];
      yearCounts[year] = (yearCounts[year] || 0) + 1;
    }
  });

  const options: PeriodOption[] = [
    {
      value: 'ALL',
      label: 'すべての期間',
      count: records.length,
    },
  ];

  // 年のリスト (降順)
  const sortedYears = Object.keys(yearCounts).sort().reverse();
  const sortedMonths = Object.keys(monthCounts).sort().reverse();

  // 年の選択肢
  sortedYears.forEach((year) => {
    options.push({
      value: `YEAR:${year}`,
      label: `${year}年 (年間合計)`,
      count: yearCounts[year],
    });
  });

  // 月の選択肢
  sortedMonths.forEach((ym) => {
    const [y, m] = ym.split('-');
    options.push({
      value: `MONTH:${ym}`,
      label: `${y}年${m}月`,
      count: monthCounts[ym],
    });
  });

  return options;
};

/**
 * 指定した期間でレコードをフィルタリング
 */
export const filterRecordsByPeriod = (
  records: MoneyForwardRecord[],
  periodValue: string
): MoneyForwardRecord[] => {
  if (!periodValue || periodValue === 'ALL') {
    return records;
  }

  if (periodValue.startsWith('YEAR:')) {
    const targetYear = periodValue.replace('YEAR:', '');
    return records.filter((r) => normalizeYear(r.date) === targetYear);
  }

  if (periodValue.startsWith('MONTH:')) {
    const targetYm = periodValue.replace('MONTH:', '');
    return records.filter((r) => normalizeYearMonth(r.date) === targetYm);
  }

  return records;
};
