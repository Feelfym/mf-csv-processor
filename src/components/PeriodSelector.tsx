import React, { useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { getAvailablePeriods } from '../utils/dateUtils';
import { MoneyForwardRecord } from '../types';

interface PeriodSelectorProps {
  records: MoneyForwardRecord[];
  selectedPeriod: string;
  onSelectPeriod: (period: string) => void;
  filteredCount: number;
}

export const PeriodSelector: React.FC<PeriodSelectorProps> = ({
  records,
  selectedPeriod,
  onSelectPeriod,
  filteredCount,
}) => {
  const periodOptions = useMemo(() => getAvailablePeriods(records), [records]);

  // 月の選択肢のみのリスト（前月・翌月移動用）
  const monthOptions = useMemo(
    () => periodOptions.filter((opt) => opt.value.startsWith('MONTH:')),
    [periodOptions]
  );

  const currentMonthIndex = monthOptions.findIndex((opt) => opt.value === selectedPeriod);

  const handlePrevMonth = () => {
    if (currentMonthIndex < monthOptions.length - 1) {
      onSelectPeriod(monthOptions[currentMonthIndex + 1].value);
    } else if (currentMonthIndex === -1 && monthOptions.length > 0) {
      onSelectPeriod(monthOptions[0].value);
    }
  };

  const handleNextMonth = () => {
    if (currentMonthIndex > 0) {
      onSelectPeriod(monthOptions[currentMonthIndex - 1].value);
    }
  };

  return (
    <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
      {/* 期間選択セレクト */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
          <Calendar className="w-4 h-4" />
        </div>
        <div>
          <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">
            対象期間の絞り込み
          </span>
          <div className="flex items-center gap-2 mt-0.5">
            <select
              value={selectedPeriod}
              onChange={(e) => onSelectPeriod(e.target.value)}
              className="font-bold text-sm text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg py-1 px-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
            >
              {periodOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} ({opt.count.toLocaleString()} 件)
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 前月 / 翌月 ナビゲーション & 件数バッジ */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-slate-500 hidden sm:inline">
          表示中: <strong className="text-slate-800 font-semibold">{filteredCount.toLocaleString()}</strong> / {records.length.toLocaleString()} 件
        </span>

        {monthOptions.length > 1 && (
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={handlePrevMonth}
              disabled={currentMonthIndex === monthOptions.length - 1}
              className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer"
              title="前の月へ"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => onSelectPeriod('ALL')}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                selectedPeriod === 'ALL'
                  ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              全期間
            </button>

            <button
              type="button"
              onClick={handleNextMonth}
              disabled={currentMonthIndex <= 0}
              className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer"
              title="次の月へ"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
