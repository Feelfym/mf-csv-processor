import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { MoneyForwardRecord, FilterOptions } from '../types';
import {
  Search,
  Filter,
  CheckSquare,
  Square,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Tag,
  EyeOff,
  Check,
  Keyboard,
} from 'lucide-react';

interface TransactionTableProps {
  records: MoneyForwardRecord[]; // 期間＋フィルタ適用済みのレコード
  allPeriodRecords: MoneyForwardRecord[]; // フィルタ選択肢用（大項目一覧の抽出など）
  filters: FilterOptions;
  onFiltersChange: (newFilters: FilterOptions) => void;
  customFlags: string[];
  onUpdateRecord: (id: string, updates: Partial<MoneyForwardRecord>) => void;
  onBatchUpdateFlag: (selectedIds: string[], newFlag: string) => void;
  onBatchToggleCalcTarget: (selectedIds: string[], target: boolean) => void;
  onOpenShortcutHelp: () => void;
  searchRef?: React.RefObject<HTMLInputElement | null>;
}

export const TransactionTable: React.FC<TransactionTableProps> = ({
  records,
  allPeriodRecords,
  filters,
  onFiltersChange,
  customFlags,
  onUpdateRecord,
  onBatchUpdateFlag,
  onBatchToggleCalcTarget,
  onOpenShortcutHelp,
  searchRef,
}) => {
  // ソート状態
  const [sortField, setSortField] = useState<'date' | 'amount' | 'content' | 'customFlag'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // 選択状態
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // キーボードフォーカス中の行インデックス
  const [focusedIndex, setFocusedIndex] = useState<number>(0);

  // ページネーション
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);

  // 行の参照（スクロール追従用）
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);
  const internalSearchRef = useRef<HTMLInputElement>(null);
  const actualSearchRef = searchRef || internalSearchRef;

  // 大項目のユニークリスト（期間内の全レコードから取得）
  const majorCategories = useMemo(() => {
    const set = new Set<string>();
    allPeriodRecords.forEach((r) => {
      if (r.majorCategory) set.add(r.majorCategory);
    });
    return Array.from(set).sort();
  }, [allPeriodRecords]);

  // ソート適用
  const sortedRecords = useMemo(() => {
    return [...records].sort((a, b) => {
      let compare = 0;
      if (sortField === 'date') {
        compare = a.date.localeCompare(b.date);
      } else if (sortField === 'amount') {
        compare = a.amount - b.amount;
      } else if (sortField === 'content') {
        compare = a.content.localeCompare(b.content);
      } else if (sortField === 'customFlag') {
        compare = (a.customFlag || '').localeCompare(b.customFlag || '');
      }
      return sortOrder === 'asc' ? compare : -compare;
    });
  }, [records, sortField, sortOrder]);

  // ページネーション計算
  const totalPages = Math.max(1, Math.ceil(sortedRecords.length / pageSize));
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedRecords.slice(start, start + pageSize);
  }, [sortedRecords, currentPage, pageSize]);

  // フォーカス行のスクロール追従
  useEffect(() => {
    if (focusedIndex >= 0 && rowRefs.current[focusedIndex]) {
      rowRefs.current[focusedIndex]?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [focusedIndex]);

  // ページ変更時やリスト減少時にフォーカスインデックスを補正
  useEffect(() => {
    if (paginatedRecords.length > 0 && focusedIndex >= paginatedRecords.length) {
      setFocusedIndex(paginatedRecords.length - 1);
    }
  }, [paginatedRecords.length, focusedIndex]);

  // 一括選択トグル
  const isAllSelected =
    paginatedRecords.length > 0 && paginatedRecords.every((r) => selectedIds.has(r.id));

  const handleToggleSelectAll = useCallback(() => {
    const next = new Set(selectedIds);
    if (isAllSelected) {
      paginatedRecords.forEach((r) => next.delete(r.id));
    } else {
      paginatedRecords.forEach((r) => next.add(r.id));
    }
    setSelectedIds(next);
  }, [isAllSelected, paginatedRecords, selectedIds]);

  const handleToggleSelectRow = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSort = (field: 'date' | 'amount' | 'content' | 'customFlag') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // キーボードナビゲーションハンドラ
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInputActive =
        activeEl?.tagName === 'INPUT' ||
        activeEl?.tagName === 'SELECT' ||
        activeEl?.tagName === 'TEXTAREA';

      // 検索バーや入力中で Escape を押した場合はフォーカスを解除
      if (e.key === 'Escape') {
        if (isInputActive && activeEl instanceof HTMLElement) {
          activeEl.blur();
        }
        return;
      }

      // 入力フォームにフォーカスがある時はテーブルショートカットを無視
      if (isInputActive) {
        return;
      }

      // '/' キーで検索バーにフォーカス
      if (e.key === '/') {
        e.preventDefault();
        actualSearchRef.current?.focus();
        actualSearchRef.current?.select();
        return;
      }

      // '?' キーでショートカットヘルプ表示
      if (e.key === '?') {
        e.preventDefault();
        onOpenShortcutHelp();
        return;
      }

      // Cmd+A / Ctrl+A で全選択
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        handleToggleSelectAll();
        return;
      }

      if (paginatedRecords.length === 0) return;

      const currentRecord = paginatedRecords[focusedIndex];

      // 下へ移動 (↓)
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (e.shiftKey && currentRecord) {
          handleToggleSelectRow(currentRecord.id);
        }
        setFocusedIndex((prev) => Math.min(paginatedRecords.length - 1, prev + 1));
        return;
      }

      // 上へ移動 (↑)
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (e.shiftKey && currentRecord) {
          handleToggleSelectRow(currentRecord.id);
        }
        setFocusedIndex((prev) => Math.max(0, prev - 1));
        return;
      }

      // ページ送り (← / h または → / l)
      if (e.key === 'ArrowLeft' || e.key === 'h') {
        e.preventDefault();
        setCurrentPage((p) => Math.max(1, p - 1));
        return;
      }
      if (e.key === 'ArrowRight' || e.key === 'l') {
        e.preventDefault();
        setCurrentPage((p) => Math.min(totalPages, p + 1));
        return;
      }

      // Space で選択切り替え
      if (e.key === ' ') {
        e.preventDefault();
        if (currentRecord) {
          handleToggleSelectRow(currentRecord.id);
        }
        return;
      }

      // '1' または 's' で「清算対象」に設定
      if (e.key === '1' || e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (selectedIds.size > 0) {
          onBatchUpdateFlag(Array.from(selectedIds), '清算対象');
          setSelectedIds(new Set());
        } else if (currentRecord) {
          onUpdateRecord(currentRecord.id, { customFlag: '清算対象' });
        }
        return;
      }

      // '2' または 'x' で「除外」に設定
      if (e.key === '2' || e.key.toLowerCase() === 'x') {
        e.preventDefault();
        if (selectedIds.size > 0) {
          onBatchUpdateFlag(Array.from(selectedIds), '除外');
          setSelectedIds(new Set());
        } else if (currentRecord) {
          onUpdateRecord(currentRecord.id, { customFlag: '除外' });
        }
        return;
      }

      // '3' で「清算済み」に設定
      if (e.key === '3') {
        e.preventDefault();
        if (selectedIds.size > 0) {
          onBatchUpdateFlag(Array.from(selectedIds), '清算済み');
          setSelectedIds(new Set());
        } else if (currentRecord) {
          onUpdateRecord(currentRecord.id, { customFlag: '清算済み' });
        }
        return;
      }

      // '0' または 'u' で「未設定」に戻す
      if (e.key === '0' || e.key.toLowerCase() === 'u') {
        e.preventDefault();
        if (selectedIds.size > 0) {
          onBatchUpdateFlag(Array.from(selectedIds), '未設定');
          setSelectedIds(new Set());
        } else if (currentRecord) {
          onUpdateRecord(currentRecord.id, { customFlag: '未設定' });
        }
        return;
      }

      // 'c' で計算対象を切り替え
      if (e.key.toLowerCase() === 'c') {
        e.preventDefault();
        if (selectedIds.size > 0) {
          const targetState = currentRecord ? !currentRecord.calculationTarget : true;
          onBatchToggleCalcTarget(Array.from(selectedIds), targetState);
          setSelectedIds(new Set());
        } else if (currentRecord) {
          onUpdateRecord(currentRecord.id, {
            calculationTarget: !currentRecord.calculationTarget,
          });
        }
        return;
      }

      // Enter でフォーカス行のメモ入力欄にフォーカス
      if (e.key === 'Enter') {
        e.preventDefault();
        const memoInput = rowRefs.current[focusedIndex]?.querySelector('input[type="text"]') as HTMLInputElement;
        if (memoInput) {
          memoInput.focus();
          memoInput.select();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    paginatedRecords,
    focusedIndex,
    selectedIds,
    totalPages,
    handleToggleSelectAll,
    handleToggleSelectRow,
    onBatchUpdateFlag,
    onBatchToggleCalcTarget,
    onUpdateRecord,
    onOpenShortcutHelp,
    actualSearchRef,
  ]);

  const selectedCount = selectedIds.size;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
      {/* フィルタ・検索バー */}
      <div className="p-4 border-b border-slate-200 bg-slate-50/50 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            {/* 検索入力 */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                ref={actualSearchRef}
                type="text"
                placeholder="検索... (/ キーでフォーカス, Escで解除)"
                value={filters.keyword}
                onChange={(e) => {
                  onFiltersChange({ ...filters, keyword: e.target.value });
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            {/* フラグフィルタ */}
            <div className="flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={filters.selectedFlag}
                onChange={(e) => {
                  onFiltersChange({ ...filters, selectedFlag: e.target.value });
                  setCurrentPage(1);
                }}
                className="py-1.5 px-2.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              >
                <option value="ALL">すべてのフラグ</option>
                {customFlags.map((flag) => (
                  <option key={flag} value={flag}>
                    {flag}
                  </option>
                ))}
              </select>
            </div>

            {/* 大項目フィルタ */}
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={filters.selectedMajorCategory}
                onChange={(e) => {
                  onFiltersChange({ ...filters, selectedMajorCategory: e.target.value });
                  setCurrentPage(1);
                }}
                className="py-1.5 px-2.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 max-w-[140px]"
              >
                <option value="ALL">すべての大項目</option>
                {majorCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* 振替非表示トグル */}
            <button
              type="button"
              onClick={() => onFiltersChange({ ...filters, hideTransfers: !filters.hideTransfers })}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                filters.hideTransfers
                  ? 'bg-slate-100 text-slate-700 border-slate-300'
                  : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <EyeOff className="w-3.5 h-3.5" />
              振替を非表示
            </button>

            {/* 支出のみトグル */}
            <button
              type="button"
              onClick={() => onFiltersChange({ ...filters, onlyExpense: !filters.onlyExpense })}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                filters.onlyExpense
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
              }`}
            >
              支出のみ
            </button>
          </div>

          {/* キーボードショートカットヘルプボタン */}
          <button
            type="button"
            onClick={onOpenShortcutHelp}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors cursor-pointer shrink-0"
            title="ショートカットヘルプ (?)"
          >
            <Keyboard className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">ショートカット</span>
            <kbd className="px-1 py-0.2 text-[10px] bg-slate-100 border rounded text-slate-500">?</kbd>
          </button>
        </div>

        {/* 一括操作バー（常にスペースを確保してレイアウトシフト・ガタつきを防止） */}
        <div
          className={`min-h-[42px] px-3 py-1.5 rounded-xl border flex flex-wrap items-center justify-between gap-3 transition-colors duration-150 ${
            selectedCount > 0
              ? 'bg-indigo-50 border-indigo-200 text-indigo-900 shadow-2xs'
              : 'bg-slate-100/50 border-dashed border-slate-200 text-slate-400'
          }`}
        >
          {selectedCount > 0 ? (
            <>
              <div className="flex items-center gap-2 text-xs font-semibold text-indigo-900">
                <Check className="w-4 h-4 text-indigo-600" />
                <span>{selectedCount} 件を選択中</span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-indigo-700 font-medium">一括フラグ設定:</span>
                <button
                  type="button"
                  onClick={() => {
                    onBatchUpdateFlag(Array.from(selectedIds), '清算対象');
                    setSelectedIds(new Set());
                  }}
                  className="px-2.5 py-1 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors cursor-pointer shadow-2xs flex items-center gap-1"
                >
                  <span>清算対象</span>
                  <kbd className="text-[10px] opacity-75 font-mono">1 / s</kbd>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onBatchUpdateFlag(Array.from(selectedIds), '清算済み');
                    setSelectedIds(new Set());
                  }}
                  className="px-2.5 py-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-md transition-colors cursor-pointer shadow-2xs flex items-center gap-1"
                >
                  <span>清算済み</span>
                  <kbd className="text-[10px] opacity-75 font-mono">3</kbd>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onBatchUpdateFlag(Array.from(selectedIds), '除外');
                    setSelectedIds(new Set());
                  }}
                  className="px-2.5 py-1 text-xs font-medium bg-white text-slate-700 hover:bg-slate-200 border border-slate-300 rounded-md transition-colors cursor-pointer shadow-2xs flex items-center gap-1"
                >
                  <span>除外</span>
                  <kbd className="text-[10px] opacity-75 font-mono">2 / x</kbd>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onBatchUpdateFlag(Array.from(selectedIds), '未設定');
                    setSelectedIds(new Set());
                  }}
                  className="px-2.5 py-1 text-xs font-medium bg-white text-slate-500 hover:bg-slate-100 border border-slate-300 rounded-md transition-colors cursor-pointer shadow-2xs"
                >
                  未設定
                </button>

                <div className="h-4 w-px bg-indigo-300 mx-1" />

                <button
                  type="button"
                  onClick={() => {
                    onBatchToggleCalcTarget(Array.from(selectedIds), true);
                    setSelectedIds(new Set());
                  }}
                  className="px-2 py-1 text-xs bg-white text-slate-700 hover:bg-slate-100 border border-slate-300 rounded-md transition-colors cursor-pointer"
                >
                  計算対象にする (c)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onBatchToggleCalcTarget(Array.from(selectedIds), false);
                    setSelectedIds(new Set());
                  }}
                  className="px-2 py-1 text-xs bg-white text-slate-700 hover:bg-slate-100 border border-slate-300 rounded-md transition-colors cursor-pointer"
                >
                  計算対象外にする
                </button>
              </div>
            </>
          ) : (
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5 select-none py-0.5">
              <span className="font-medium text-slate-500">一括操作:</span>
              <span>チェックボックスまたは <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded font-mono text-[10px] text-slate-600">Space</kbd> / <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded font-mono text-[10px] text-slate-600">Shift+↑/↓</kbd> で複数行を選択すると、ここに一括フラグ設定ボタンが表示されます</span>
            </div>
          )}
        </div>
      </div>

      {/* テーブル本体 */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-100/75 border-b border-slate-200 text-slate-600 font-semibold select-none">
              <th className="w-10 px-3 py-2.5 text-center">
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  className="text-slate-500 hover:text-slate-800 cursor-pointer inline-flex"
                  title="全選択 (Cmd+A)"
                >
                  {isAllSelected ? (
                    <CheckSquare className="w-4 h-4 text-indigo-600" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                </button>
              </th>
              <th
                onClick={() => handleSort('date')}
                className="px-3 py-2.5 cursor-pointer hover:bg-slate-200/60 transition-colors whitespace-nowrap"
              >
                <div className="flex items-center gap-1">
                  日付 <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th
                onClick={() => handleSort('content')}
                className="px-3 py-2.5 cursor-pointer hover:bg-slate-200/60 transition-colors"
              >
                <div className="flex items-center gap-1">
                  内容 / 摘要 <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th
                onClick={() => handleSort('amount')}
                className="px-3 py-2.5 text-right cursor-pointer hover:bg-slate-200/60 transition-colors whitespace-nowrap"
              >
                <div className="flex items-center justify-end gap-1">
                  金額 (円) <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th className="px-3 py-2.5 whitespace-nowrap">金融機関</th>
              <th className="px-3 py-2.5 whitespace-nowrap">大項目 / 中項目</th>
              <th
                onClick={() => handleSort('customFlag')}
                className="px-3 py-2.5 cursor-pointer hover:bg-slate-200/60 transition-colors whitespace-nowrap"
              >
                <div className="flex items-center gap-1 text-indigo-700 font-bold">
                  独自フラグ <ArrowUpDown className="w-3 h-3 text-indigo-600" />
                </div>
              </th>
              <th className="px-3 py-2.5">メモ / 独自メモ</th>
              <th className="px-3 py-2.5 text-center whitespace-nowrap">対象</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/70">
            {paginatedRecords.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-slate-400">
                  条件に一致する明細がありません
                </td>
              </tr>
            ) : (
              paginatedRecords.map((record, index) => {
                const isSelected = selectedIds.has(record.id);
                const isFocused = index === focusedIndex;
                const isExpense = record.amount < 0;
                const isTransfer = record.transfer;

                return (
                  <tr
                    key={record.id}
                    ref={(el) => {
                      rowRefs.current[index] = el;
                    }}
                    onClick={() => setFocusedIndex(index)}
                    className={`transition-colors cursor-pointer ${
                      isFocused
                        ? 'bg-indigo-50/70 ring-1 ring-inset ring-indigo-400'
                        : isSelected
                        ? 'bg-indigo-50/30'
                        : 'hover:bg-slate-50/80'
                    } ${!record.calculationTarget ? 'opacity-45 bg-slate-50/30' : ''}`}
                  >
                    {/* チェックボックス */}
                    <td className="px-3 py-2.5 text-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleSelectRow(record.id);
                        }}
                        className="text-slate-400 hover:text-slate-700 cursor-pointer inline-flex"
                        title="選択 (Space)"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-indigo-600" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </td>

                    {/* 日付 */}
                    <td className="px-3 py-2.5 font-mono text-slate-600 whitespace-nowrap">
                      {record.date}
                    </td>

                    {/* 内容 */}
                    <td className="px-3 py-2.5 font-medium text-slate-800 max-w-xs truncate">
                      <div className="flex items-center gap-1.5">
                        {isTransfer && (
                          <span className="text-[10px] px-1.5 py-0.2 bg-slate-200 text-slate-600 rounded">
                            振替
                          </span>
                        )}
                        <span title={record.content}>{record.content}</span>
                      </div>
                    </td>

                    {/* 金額 */}
                    <td
                      className={`px-3 py-2.5 text-right font-mono font-semibold whitespace-nowrap ${
                        isExpense ? 'text-slate-800' : 'text-emerald-600'
                      }`}
                    >
                      {record.amount > 0 ? `+¥${record.amount.toLocaleString()}` : `¥${record.amount.toLocaleString()}`}
                    </td>

                    {/* 金融機関 */}
                    <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap truncate max-w-[120px]">
                      {record.institution}
                    </td>

                    {/* カテゴリ */}
                    <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">
                      <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 text-[11px] text-slate-700">
                        {record.majorCategory}
                      </span>
                      {record.mediumCategory && record.mediumCategory !== '未分類' && (
                        <span className="text-[11px] text-slate-400 ml-1">/ {record.mediumCategory}</span>
                      )}
                    </td>

                    {/* 独自フラグ（プルダウン編集） */}
                    <td className="px-3 py-2.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={record.customFlag || '未設定'}
                        onChange={(e) => onUpdateRecord(record.id, { customFlag: e.target.value })}
                        className={`text-xs font-semibold px-2.5 py-1 rounded-lg border focus:outline-none transition-colors cursor-pointer ${
                          record.customFlag === '清算対象' || record.customFlag === '精算対象'
                            ? 'bg-indigo-50 text-indigo-800 border-indigo-300 shadow-2xs font-bold'
                            : record.customFlag === '清算済み' || record.customFlag === '精算済み'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold'
                            : record.customFlag === '除外'
                            ? 'bg-slate-100 text-slate-400 border-slate-300 line-through'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {customFlags.map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* メモ / 独自メモ */}
                    <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <div className="space-y-1">
                        {record.memo && (
                          <p className="text-[11px] text-slate-400 truncate max-w-xs" title={`MFメモ: ${record.memo}`}>
                            {record.memo}
                          </p>
                        )}
                        <input
                          type="text"
                          placeholder="独自メモ... (Enterで編集)"
                          value={record.customMemo || ''}
                          onChange={(e) => onUpdateRecord(record.id, { customMemo: e.target.value })}
                          className="w-full text-xs px-2 py-0.5 bg-slate-50 hover:bg-white focus:bg-white border border-transparent hover:border-slate-300 focus:border-indigo-500 rounded focus:outline-none transition-colors"
                        />
                      </div>
                    </td>

                    {/* 計算対象トグル */}
                    <td className="px-3 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateRecord(record.id, { calculationTarget: !record.calculationTarget })
                        }
                        title={record.calculationTarget ? '計算対象 (cキーで切替)' : '計算対象外 (cキーで切替)'}
                        className={`w-6 h-6 rounded-md inline-flex items-center justify-center text-xs font-bold transition-colors cursor-pointer ${
                          record.calculationTarget
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            : 'bg-slate-200 text-slate-400 hover:bg-slate-300'
                        }`}
                      >
                        {record.calculationTarget ? '○' : '×'}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ページネーションフッター */}
      <div className="p-4 border-t border-slate-200 bg-slate-50/50 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
        <div className="flex items-center gap-3">
          <span>
            全 <span className="font-semibold text-slate-700">{sortedRecords.length}</span> 件中{' '}
            {sortedRecords.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} -{' '}
            {Math.min(currentPage * pageSize, sortedRecords.length)} 件を表示
          </span>
          <span className="hidden md:inline text-[11px] text-slate-400">
            (選択中: {focusedIndex + 1}行目 / キーボード: <kbd className="font-mono font-bold">↑/↓</kbd> 移動, <kbd className="font-mono font-bold">1</kbd> 清算, <kbd className="font-mono font-bold">2</kbd> 除外, <kbd className="font-mono font-bold">Space</kbd> 選択)
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span>表示件数:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="py-1 px-2 bg-white border border-slate-300 rounded-md focus:outline-none"
            >
              <option value={50}>50件</option>
              <option value={100}>100件</option>
              <option value={200}>200件</option>
              <option value={500}>500件</option>
            </select>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1 rounded-md bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white cursor-pointer"
              title="前のページ (h / ←)"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-medium text-slate-700">
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="p-1 rounded-md bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white cursor-pointer"
              title="次のページ (l / →)"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
