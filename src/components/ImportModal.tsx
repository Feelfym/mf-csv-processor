import React, { useState, useMemo } from 'react';
import { MoneyForwardRecord } from '../types';
import { getMonthsBreakdown } from '../utils/csvParser';
import { FileSpreadsheet, Calendar, CheckSquare, Square, RefreshCw, PlusCircle, X, AlertCircle } from 'lucide-react';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  rawRecords: MoneyForwardRecord[];
  fileName: string;
  existingCount: number;
  onConfirmImport: (selectedRecords: MoneyForwardRecord[], mode: 'replace' | 'append') => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  rawRecords,
  fileName,
  existingCount,
  onConfirmImport,
}) => {
  // 月別内訳の計算
  const monthsBreakdown = useMemo(() => getMonthsBreakdown(rawRecords), [rawRecords]);

  // 選択中の月（初期状態は「すべて」または「最新の月」）
  const [selectedMonths, setSelectedMonths] = useState<Set<string>>(
    () => new Set(monthsBreakdown.map((m) => m.month))
  );

  // 取り込みモード ('replace' | 'append')
  const [importMode, setImportMode] = useState<'replace' | 'append'>(
    existingCount > 0 ? 'append' : 'replace'
  );

  if (!isOpen) return null;

  // すべて選択 / 解除
  const isAllMonthsSelected =
    monthsBreakdown.length > 0 && monthsBreakdown.every((m) => selectedMonths.has(m.month));

  const handleToggleSelectAllMonths = () => {
    if (isAllMonthsSelected) {
      setSelectedMonths(new Set());
    } else {
      setSelectedMonths(new Set(monthsBreakdown.map((m) => m.month)));
    }
  };

  const handleToggleMonth = (month: string) => {
    setSelectedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(month)) {
        next.delete(month);
      } else {
        next.add(month);
      }
      return next;
    });
  };

  // 選択された月だけに絞り込んだレコード一覧
  const filteredRecordsToImport = rawRecords.filter((r) => {
    if (!r.date) return false;
    const match = r.date.match(/^(\d{4})[/-](\d{1,2})/);
    if (!match) return false;
    const ym = `${match[1]}-${match[2].padStart(2, '0')}`;
    return selectedMonths.has(ym);
  });

  const handleExecute = () => {
    if (filteredRecordsToImport.length === 0) return;
    onConfirmImport(filteredRecordsToImport, importMode);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* ヘッダー */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">CSVデータの取り込み設定</h2>
              <p className="text-xs text-slate-500 truncate max-w-xs sm:max-w-md">
                ファイル: <span className="font-medium text-slate-700">{fileName}</span> (全 {rawRecords.length} 件)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* コンテンツ */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 text-xs">
          {/* 既存データがある場合の取り込み方法選択 */}
          {existingCount > 0 && (
            <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2.5">
              <div className="flex items-center gap-1.5 text-indigo-900 font-bold">
                <AlertCircle className="w-4 h-4 text-indigo-600" />
                <span>現在すでに {existingCount} 件の作業データがあります</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setImportMode('append')}
                  className={`p-3 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                    importMode === 'append'
                      ? 'bg-white border-indigo-600 ring-2 ring-indigo-500/20 shadow-xs'
                      : 'bg-white/60 border-slate-200 hover:bg-white text-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-slate-800">
                    <PlusCircle className="w-4 h-4 text-emerald-600" />
                    <span>既存データに追加 (おすすめ)</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    重複する明細（同一日付・金額・内容など）を自動スキップし、新しい明細だけを追加します。
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setImportMode('replace')}
                  className={`p-3 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                    importMode === 'replace'
                      ? 'bg-white border-indigo-600 ring-2 ring-indigo-500/20 shadow-xs'
                      : 'bg-white/60 border-slate-200 hover:bg-white text-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-slate-800">
                    <RefreshCw className="w-4 h-4 text-rose-600" />
                    <span>新規データとして置換</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    現在の作業データをすべてリセットし、今回選択したデータだけで置き換えます。
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* 取り込む月の選択 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                取り込む対象の月を選択してください:
              </h3>
              <button
                type="button"
                onClick={handleToggleSelectAllMonths}
                className="text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
              >
                {isAllMonthsSelected ? 'すべて解除' : 'すべて選択'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
              {monthsBreakdown.map((m) => {
                const isSelected = selectedMonths.has(m.month);
                return (
                  <div
                    key={m.month}
                    onClick={() => handleToggleMonth(m.month)}
                    className={`p-2.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'bg-indigo-50/50 border-indigo-300 text-slate-900 shadow-2xs font-semibold'
                        : 'bg-slate-50/50 border-slate-200 text-slate-500 hover:bg-slate-100/60'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="text-slate-400 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleMonth(m.month);
                        }}
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-indigo-600" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                      <span>{m.label}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] text-slate-500">{m.count} 件</span>
                      {m.totalExpense > 0 && (
                        <span className="text-[10px] text-slate-400 block font-normal">
                          支出: ¥{m.totalExpense.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* フッター */}
        <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
          <div className="text-slate-600 font-medium">
            取り込み対象: <span className="font-bold text-indigo-600 text-sm">{filteredRecordsToImport.length}</span> 件
            <span className="text-slate-400 ml-1">({selectedMonths.size} ヶ月分)</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-slate-600 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleExecute}
              disabled={filteredRecordsToImport.length === 0}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <FileSpreadsheet className="w-4 h-4" />
              {importMode === 'append' ? '重複排除して追加' : 'データを読み込む'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
