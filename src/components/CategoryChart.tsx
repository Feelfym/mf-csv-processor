import React, { useState } from 'react';
import { MoneyForwardRecord, FilterOptions } from '../types';
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
import { PieChart as PieIcon, BarChart3, Filter, X } from 'lucide-react';

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

  // チャート集計用の母集団データ（期間内のデータ）
  const sourceRecords = allPeriodRecords || records;

  // 計算対象かつ振替を除く支出のみ集計
  const expenses = sourceRecords.filter(
    (r) => r.calculationTarget && !r.transfer && r.amount < 0
  );

  // 大項目別集計
  const categoryMap: { [key: string]: number } = {};
  expenses.forEach((r) => {
    const cat = r.majorCategory || '未分類';
    categoryMap[cat] = (categoryMap[cat] || 0) + Math.abs(r.amount);
  });

  const categoryData = Object.entries(categoryMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // フラグ別集計（支出から割引・返金を差し引いた純額）
  const flagMap: { [key: string]: number } = {};
  sourceRecords.forEach((r) => {
    const flag = r.customFlag || '未設定';
    if (!flagMap[flag]) flagMap[flag] = 0;
    // 支出（amount < 0）はプラス加算、割引・返金（amount > 0）はマイナス減算
    flagMap[flag] += -r.amount;
  });

  const flagData = Object.entries(flagMap)
    .filter(([_, value]) => value > 0)
    .map(([name, value]) => ({ name, value: Math.max(0, value) }))
    .sort((a, b) => b.value - a.value);

  const totalExpense = categoryData.reduce((sum, d) => sum + d.value, 0);

  if (expenses.length === 0) {
    return null;
  }

  // 大項目クリックハンドラ（トグル）
  const handleCategoryClick = (categoryName: string) => {
    if (filters.selectedMajorCategory === categoryName) {
      onFiltersChange({ ...filters, selectedMajorCategory: 'ALL' });
    } else {
      onFiltersChange({ ...filters, selectedMajorCategory: categoryName });
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

  const isFilteringCategory = filters.selectedMajorCategory !== 'ALL';
  const isFilteringFlag = filters.selectedFlag !== 'ALL';

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-800">支出の内訳・分析</h3>
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
          <p className="text-xs text-slate-400">
            項目をクリックすると、そのカテゴリやフラグでテーブルを即座に絞り込みます
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
            大項目別
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
                    const isSelected = filters.selectedMajorCategory === entry.name;
                    return (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                        opacity={isFilteringCategory && !isSelected ? 0.35 : 1}
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
                ? filters.selectedMajorCategory === item.name
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
    </div>
  );
};
