import React from 'react';
import { MoneyForwardRecord } from '../types';
import { TrendingDown, TrendingUp, Tag, Layers, CheckCheck } from 'lucide-react';

interface SummaryCardsProps {
  records: MoneyForwardRecord[];
  customFlags: string[];
  onMarkAsSettled?: (count: number, sum: number) => void;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({
  records,
  customFlags,
  onMarkAsSettled,
}) => {
  // 計算対象かつ振替ではない支出
  const validExpenses = records.filter(
    (r) => r.calculationTarget && !r.transfer && r.amount < 0
  );
  const totalExpense = validExpenses.reduce((sum, r) => sum + Math.abs(r.amount), 0);

  // 収入
  const totalIncome = records
    .filter((r) => r.calculationTarget && !r.transfer && r.amount > 0)
    .reduce((sum, r) => sum + r.amount, 0);

  // フラグ別集計（未設定以外）
  // 支出（マイナス）と割引・返金（プラス）を相殺した「実質金額（純額）」を算出
  const flagSummaries = customFlags
    .filter((f) => f !== '未設定')
    .map((flag) => {
      const matching = records.filter((r) => r.customFlag === flag);
      // 支出合計（絶対値）
      const expenseSum = matching
        .filter((r) => r.amount < 0)
        .reduce((acc, r) => acc + Math.abs(r.amount), 0);
      // 割引・返金合計（プラス金額）
      const discountSum = matching
        .filter((r) => r.amount > 0)
        .reduce((acc, r) => acc + r.amount, 0);

      // 実質純額（支出 - 割引）
      const netSum = expenseSum - discountSum;
      const count = matching.length;
      return { flag, sum: netSum, expenseSum, discountSum, count };
    })
    .filter((item) => item.count > 0);

  return (
    <div className="space-y-4">
      {/* メイン統計カード */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 総支出 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 flex items-center gap-1">
              <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
              総支出（振替除く）
            </p>
            <p className="text-2xl font-bold text-slate-900 mt-1.5 tracking-tight">
              ¥{totalExpense.toLocaleString()}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">{validExpenses.length} 件の支出</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
            出
          </div>
        </div>

        {/* 総収入 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              総収入（振替除く）
            </p>
            <p className="text-2xl font-bold text-slate-900 mt-1.5 tracking-tight">
              ¥{totalIncome.toLocaleString()}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {records.filter((r) => r.calculationTarget && !r.transfer && r.amount > 0).length} 件の収入
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            入
          </div>
        </div>

        {/* 収支差額 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-indigo-500" />
              収支差額
            </p>
            <p
              className={`text-2xl font-bold mt-1.5 tracking-tight ${
                totalIncome - totalExpense >= 0 ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              ¥{(totalIncome - totalExpense).toLocaleString()}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">全 {records.length} 件</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            差
          </div>
        </div>

        {/* フラグ付き明細の件数 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 flex items-center gap-1">
              <Tag className="w-3.5 h-3.5 text-amber-500" />
              フラグ設定済み
            </p>
            <p className="text-2xl font-bold text-slate-900 mt-1.5 tracking-tight">
              {records.filter((r) => r.customFlag && r.customFlag !== '未設定').length}{' '}
              <span className="text-sm font-normal text-slate-500">/ {records.length} 件</span>
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              未設定: {records.filter((r) => !r.customFlag || r.customFlag === '未設定').length} 件
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            旗
          </div>
        </div>
      </div>

      {/* フラグ別の小計タグ・バッジ（清算対象などの合計） */}
      {flagSummaries.length > 0 && (
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold text-slate-500 shrink-0 flex items-center gap-1">
              <Tag className="w-3 h-3" /> フラグ別小計:
            </span>
            <div className="flex flex-wrap gap-2">
              {flagSummaries.map((item) => {
                const isSettlementTarget = item.flag === '清算対象' || item.flag === '精算対象';
                const isSettled = item.flag === '清算済み' || item.flag === '精算済み';

                return (
                  <div
                    key={item.flag}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs ${
                      isSettlementTarget
                        ? 'bg-indigo-50/70 border-indigo-300 text-indigo-950 shadow-2xs font-medium'
                        : isSettled
                        ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    <span className="font-semibold">{item.flag}</span>
                    <span
                      className={`font-bold ${
                        isSettlementTarget
                          ? 'text-indigo-600 text-sm'
                          : isSettled
                          ? 'text-emerald-700'
                          : 'text-slate-800'
                      }`}
                    >
                      ¥{item.sum.toLocaleString()}
                    </span>
                    {item.discountSum > 0 && (
                      <span className="text-[10px] text-emerald-600 font-medium">
                        (支出: ¥{item.expenseSum.toLocaleString()} / 割引・返金: -¥{item.discountSum.toLocaleString()})
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400">({item.count}件)</span>

                    {/* 「清算対象」の横に「清算済みにする」一括変更ボタン */}
                    {isSettlementTarget && onMarkAsSettled && item.count > 0 && (
                      <button
                        type="button"
                        onClick={() => onMarkAsSettled(item.count, item.sum)}
                        className="ml-1 px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-md transition-all cursor-pointer shadow-2xs flex items-center gap-1"
                        title="表示中の清算対象レコードを一括で「清算済み」に変更します"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        <span>清算済みにする</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
