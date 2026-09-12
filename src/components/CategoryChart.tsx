import React, { useState, useMemo } from 'react';
import { MoneyForwardRecord, FilterOptions } from '../types';
import { applyFiltersToRecords } from '../utils/filterUtils';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
} from 'recharts';
import { PieChart as PieIcon, BarChart3, Filter, X, ArrowLeft, AlertCircle } from 'lucide-react';

interface CategoryChartProps {
  records: MoneyForwardRecord[];
  allPeriodRecords?: MoneyForwardRecord[]; // チャート全体の母集団（大項目・フラグ比率把握用）
  filters: FilterOptions;
  onFiltersChange: (newFilters: FilterOptions) => void;
}

const COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ec4899', // pink
  '#8b5cf6', // purple
  '#06b6d4', // cyan
  '#f97316', // orange
  '#64748b', // slate
  '#14b8a6', // teal
  '#6366f1', // indigo
];

export const CategoryChart: React.FC<CategoryChartProps> = ({
  records,
  allPeriodRecords,
  filters,
  onFiltersChange,
}) => {
  const [viewType, setViewType] = useState<'category' | 'flag'>('category');

  const isFilteringCategory = filters.selectedMajorCategory !== 'ALL';
  const isFilteringFlag = filters.selectedFlag !== 'ALL';

  const baseRecords = allPeriodRecords || records;

  // 1. 大項目フィルター以外の全フィルター（フラグ、検索、支出のみ等）を適用したレコード
  const recordsFilteredExceptCategory = useMemo(() => {
    return applyFiltersToRecords(baseRecords, {
      ...filters,
      selectedMajorCategory: 'ALL',
    });
  }, [baseRecords, filters]);

  // 2. フラグフィルター以外の全フィルター（大項目、検索、支出のみ等）を適用したレコード
  const recordsFilteredExceptFlag = useMemo(() => {
    return applyFiltersToRecords(baseRecords, {
      ...filters,
      selectedFlag: 'ALL',
    });
  }, [baseRecords, filters]);

  // 大項目別ビューの集計
  // - 大項目が選択されている場合: 全フィルター適用済みレコード（records）を使い、「中項目別」の内訳を表示
  // - 大項目が未選択（ALL）の場合: 大項目以外のフィルター適用済みレコードを使い、「大項目別」の内訳を表示
  const categoryExpenses = useMemo(() => {
    const target = isFilteringCategory ? records : recordsFilteredExceptCategory;
    return target.filter((r) => r.calculationTarget && !r.transfer && r.amount < 0);
  }, [isFilteringCategory, records, recordsFilteredExceptCategory]);

  const categoryData = useMemo(() => {
    const categoryMap: { [key: string]: number } = {};
    categoryExpenses.forEach((r) => {
      const key = isFilteringCategory
        ? (r.mediumCategory && r.mediumCategory !== '未分類'
            ? r.mediumCategory
            : r.majorCategory
            ? `${r.majorCategory}(その他)`
            : '未分類')
        : (r.majorCategory || '未分類');
      categoryMap[key] = (categoryMap[key] || 0) + Math.abs(r.amount);
    });

    return Object.entries(categoryMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [categoryExpenses, isFilteringCategory]);

  // フラグ別ビューの集計（大項目フィルター等を反映したレコードからフラグ別の純額を算出）
  const flagData = useMemo(() => {
    const flagMap: { [key: string]: number } = {};
    recordsFilteredExceptFlag.forEach((r) => {
      const flag = r.customFlag || '未設定';
      if (!flagMap[flag]) flagMap[flag] = 0;
      // 支出（amount < 0）はプラス加算、割引・返金（amount > 0）はマイナス減算
      flagMap[flag] += -r.amount;
    });

    return Object.entries(flagMap)
      .filter(([_, value]) => value > 0)
      .map(([name, value]) => ({ name, value: Math.max(0, value) }))
      .sort((a, b) => b.value - a.value);
  }, [recordsFilteredExceptFlag]);

  const totalExpense = useMemo(() => {
    return categoryData.reduce((sum, d) => sum + d.value, 0);
  }, [categoryData]);

  // 大項目クリックハンドラ（トグル）
  const handleCategoryClick = (categoryName: string) => {
    if (isFilteringCategory) {
      // 中項目表示中の場合、クリックされた中項目名でキーワード検索、または大項目選択を解除
      // ここでは大項目解除を行う
      onFiltersChange({ ...filters, selectedMajorCategory: 'ALL' });
    } else {
      if (filters.selectedMajorCategory === categoryName) {
        onFiltersChange({ ...filters, selectedMajorCategory: 'ALL' });
      } else {
        onFiltersChange({ ...filters, selectedMajorCategory: categoryName });
      }
    }
  };

  // フラグクリックハンドラ（トグル）
  const handleFlagClick = (flagName: string) => {
    if (filters.selectedFlag === flagName) {
      onFiltersChange({ ...filters, selectedFlag: 'ALL' });
    } else {
      onFiltersChange({ ...filters, selectedFlag: flagName });
    }
  };

  // 支出が0件の場合のメッセージ表示
  const hasNoData = viewType === 'category' ? categoryExpenses.length === 0 : flagData.length === 0;

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-slate-800">
              {viewType === 'category'
                ? isFilteringCategory
                  ? `支出の内訳・分析（${filters.selectedMajorCategory} の中項目別）`
                  : '支出の内訳・分析（大項目別）'
                : isFilteringCategory
                ? `フラグ別内訳（${filters.selectedMajorCategory}）`
                : 'フラグ別内訳'}
            </h3>

            {/* 大項目選択中に「すべての大項目に戻る」ボタン */}
            {viewType === 'category' && isFilteringCategory && (
              <button
                type="button"
                onClick={() => onFiltersChange({ ...filters, selectedMajorCategory: 'ALL' })}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-md border border-indigo-200 transition-colors cursor-pointer"
                title="大項目一覧に戻る"
              >
                <ArrowLeft className="w-3 h-3" />
                すべての大項目を表示
              </button>
            )}

            {/* 選択中フィルターバッジ */}
            {(isFilteringCategory || isFilteringFlag) && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-100 text-indigo-800 animate-fadeIn">
                <Filter className="w-3 h-3" />
                {isFilteringCategory ? `大項目: ${filters.selectedMajorCategory}` : ''}
                {isFilteringCategory && isFilteringFlag ? ' / ' : ''}
                {isFilteringFlag ? `フラグ: ${filters.selectedFlag}` : ''}
                <button
                  type="button"
                  onClick={() =>
                    onFiltersChange({
                      ...filters,
                      selectedMajorCategory: 'ALL',
                      selectedFlag: 'ALL',
                    })
                  }
                  className="ml-1 hover:text-indigo-950 cursor-pointer"
                  title="絞り込み解除"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {isFilteringCategory && viewType === 'category'
              ? `${filters.selectedMajorCategory} の中項目別の詳細内訳を表示しています`
              : '項目をクリックすると、そのカテゴリやフラグでテーブルを即座に絞り込みます'}
          </p>
        </div>

        <div className="flex items-center bg-slate-100 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => setViewType('category')}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
              viewType === 'category'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <PieIcon className="w-3.5 h-3.5" />
            {isFilteringCategory ? '中項目別' : '大項目別'}
          </button>
          <button
            type="button"
            onClick={() => setViewType('flag')}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
              viewType === 'flag'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            フラグ別
          </button>
        </div>
      </div>

      {hasNoData ? (
        <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-2">
          <AlertCircle className="w-8 h-8 text-slate-300" />
          <p className="text-xs">条件に一致する支出データがありません</p>
          <p className="text-[11px] text-slate-400">フィルター条件を変更するか解除してください</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          {/* チャート */}
          <div className="md:col-span-6 h-56 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              {viewType === 'category' ? (
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    onClick={(entry) => handleCategoryClick(entry.name)}
                    className="cursor-pointer"
                  >
                    {categoryData.map((entry, index) => {
                      const isSelected = !isFilteringCategory && filters.selectedMajorCategory === entry.name;
                      return (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                          opacity={!isFilteringCategory && isFilteringCategory && !isSelected ? 0.35 : 1}
                          stroke={isSelected ? '#1e1b4b' : '#fff'}
                          strokeWidth={isSelected ? 3 : 1}
                          className="transition-all cursor-pointer hover:opacity-80"
                        />
                      );
                    })}
                  </Pie>
                  <Tooltip
                    formatter={(value: any) => [`¥${Number(value || 0).toLocaleString()}`, '支出']}
                  />
                </PieChart>
              ) : (
                <BarChart
                  data={flagData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                  onClick={(e) => {
                    if (e && e.activePayload && e.activePayload[0]) {
                      handleFlagClick(e.activePayload[0].payload.name);
                    }
                  }}
                  className="cursor-pointer"
                >
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={70} tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value: any) => [`¥${Number(value || 0).toLocaleString()}`, '金額']}
                  />
                  <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]}>
                    {flagData.map((entry, index) => {
                      const isSelected = filters.selectedFlag === entry.name;
                      return (
                        <Cell
                          key={`bar-${index}`}
                          fill={COLORS[index % COLORS.length]}
                          opacity={isFilteringFlag && !isSelected ? 0.35 : 1}
                          stroke={isSelected ? '#1e1b4b' : 'none'}
                          strokeWidth={isSelected ? 2 : 0}
                          className="cursor-pointer hover:opacity-80 transition-all"
                        />
                      );
                    })}
                  </Bar>
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>

          {/* リスト・凡例 */}
          <div className="md:col-span-6 space-y-1.5 max-h-56 overflow-y-auto pr-2">
            {(viewType === 'category' ? categoryData : flagData).map((item, idx) => {
              const percentage = totalExpense > 0 ? ((item.value / totalExpense) * 100).toFixed(1) : '0';
              const isSelected =
                viewType === 'category'
                  ? !isFilteringCategory && filters.selectedMajorCategory === item.name
                  : filters.selectedFlag === item.name;

              return (
                <div
                  key={item.name}
                  onClick={() =>
                    viewType === 'category' ? handleCategoryClick(item.name) : handleFlagClick(item.name)
                  }
                  className={`flex items-center justify-between text-xs p-1.5 rounded-lg transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-50 border border-indigo-300 font-semibold text-indigo-950 shadow-2xs'
                      : 'hover:bg-slate-50 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                    />
                    <span className="truncate">{item.name}</span>
                    {isSelected && (
                      <span className="text-[10px] px-1.5 py-0.2 bg-indigo-600 text-white rounded font-bold">
                        絞込中
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-semibold">¥{item.value.toLocaleString()}</span>
                    <span className="text-slate-400 w-10 text-right">{percentage}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
