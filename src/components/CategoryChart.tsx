import React, { useState } from 'react';
import { MoneyForwardRecord } from '../types';
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
import { PieChart as PieIcon, BarChart3 } from 'lucide-react';

interface CategoryChartProps {
  records: MoneyForwardRecord[];
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

export const CategoryChart: React.FC<CategoryChartProps> = ({ records }) => {
  const [viewType, setViewType] = useState<'category' | 'flag'>('category');

  // 計算対象かつ振替を除く支出のみ集計
  const expenses = records.filter(
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
  records.forEach((r) => {
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

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-800">支出の内訳・分析</h3>
          <p className="text-xs text-slate-400">振替を除いた支出データの分析</p>
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
                >
                  {categoryData.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any) => [`¥${Number(value || 0).toLocaleString()}`, '支出']}
                />
              </PieChart>
            ) : (
              <BarChart data={flagData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={70} tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value: any) => [`¥${Number(value || 0).toLocaleString()}`, '金額']}
                />
                <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* リスト・凡例 */}
        <div className="md:col-span-6 space-y-2 max-h-56 overflow-y-auto pr-2">
          {(viewType === 'category' ? categoryData : flagData).map((item, idx) => {
            const percentage = totalExpense > 0 ? ((item.value / totalExpense) * 100).toFixed(1) : '0';
            return (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 truncate">
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                  />
                  <span className="text-slate-700 truncate">{item.name}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-semibold text-slate-900">¥{item.value.toLocaleString()}</span>
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
