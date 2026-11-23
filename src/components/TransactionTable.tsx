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
  PlusCircle,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { isAnyModalOpen } from '../hooks/useModal';
import { DEFAULT_FILTERS } from '../utils/filterUtils';

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
  onOpenAddRecord?: () => void;
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
  onOpenAddRecord,
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

  // モバイル用フィルタ折りたたみ開閉
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

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
      // モーダル表示中はテーブル操作のショートカットを無効化
      if (isAnyModalOpen()) return;

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

      // 'n' キーで新規明細追加
      if (e.key.toLowerCase() === 'n' && onOpenAddRecord) {
        e.preventDefault();
        onOpenAddRecord();
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
    onOpenAddRecord,
    actualSearchRef,
  ]);

  const selectedCount = selectedIds.size;

  // 選択中のレコード合計金額（支出をプラス・返金等をマイナスにした実質純額）
  const selectedNetSum = useMemo(() => {
    if (selectedIds.size === 0) return 0;
    return records
      .filter((r) => selectedIds.has(r.id))
      .reduce((acc, r) => acc + (r.amount < 0 ? Math.abs(r.amount) : -r.amount), 0);
  }, [records, selectedIds]);

  // 適用中フィルタ件数（モバイルのフィルタボタンバッジ用）
  const activeFilterCount =
    (filters.selectedFlag !== 'ALL' ? 1 : 0) +
    (filters.selectedMajorCategory !== 'ALL' ? 1 : 0) +
    (filters.onlyExpense ? 1 : 0) +
    (!filters.hideTransfers ? 1 : 0);

  const hasAnyFilter = activeFilterCount > 0 || filters.keyword.trim() !== '';

  const handleResetFilters = () => {
    onFiltersChange(DEFAULT_FILTERS);
    setCurrentPage(1);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
      {/* フィルタ・検索バー */}
      <div className="p-3 sm:p-4 border-b border-slate-200 bg-slate-50/50 space-y-2.5 sm:space-y-3">
        {/* 上段: 検索入力 ＋ モバイル絞込トグル ＋ 追加・ショートカットボタン */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* 検索入力 */}
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              ref={actualSearchRef}
              type="text"
              placeholder="検索... (内容・メモ・金融機関)"
              value={filters.keyword}
              onChange={(e) => {
                onFiltersChange({ ...filters, keyword: e.target.value });
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-8 py-2 md:py-1.5 text-sm md:text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
            {filters.keyword && (
              <button
                type="button"
                onClick={() => {
                  onFiltersChange({ ...filters, keyword: '' });
                  setCurrentPage(1);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                aria-label="検索語をクリア"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* モバイル専用: フィルタ開閉トグルボタン */}
          <button
            type="button"
            onClick={() => setIsMobileFilterOpen((prev) => !prev)}
            className={`md:hidden flex items-center gap-1.5 px-2.5 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer shrink-0 ${
              isMobileFilterOpen || activeFilterCount > 0
                ? 'bg-indigo-50 text-indigo-700 border-indigo-300'
                : 'bg-white text-slate-600 border-slate-300'
            }`}
            aria-expanded={isMobileFilterOpen}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>絞込</span>
            {activeFilterCount > 0 && (
              <span className="px-1.5 py-0.2 text-[10px] bg-indigo-600 text-white rounded-full font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* 明細手動追加ボタン */}
          {onOpenAddRecord && (
            <button
              type="button"
              onClick={onOpenAddRecord}
              className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-2 md:py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-colors cursor-pointer shrink-0 shadow-2xs"
              title="明細を手動追加 (n)"
            >
              <PlusCircle className="w-3.5 h-3.5 text-emerald-600" />
              <span className="sm:hidden">追加</span>
              <span className="hidden sm:inline">明細を追加</span>
              <kbd className="hidden md:inline px-1 py-0.2 text-[10px] bg-white border border-emerald-200 rounded text-emerald-600">n</kbd>
            </button>
          )}

          {/* キーボードショートカットヘルプボタン（PCのみ） */}
          <button
            type="button"
            onClick={onOpenShortcutHelp}
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors cursor-pointer shrink-0"
            title="ショートカットヘルプ (?)"
          >
            <Keyboard className="w-3.5 h-3.5 text-slate-500" />
            <span>ショートカット</span>
            <kbd className="px-1 py-0.2 text-[10px] bg-slate-100 border rounded text-slate-500">?</kbd>
          </button>
        </div>

        {/* フィルタ条件群（PCでは常時表示、モバイルでは折りたたみ展開時のみ表示） */}
        <div
          className={`${
            isMobileFilterOpen ? 'flex' : 'hidden'
          } md:flex flex-wrap items-center gap-2 sm:gap-2.5 pt-1 md:pt-0`}
        >
          {/* フラグフィルタ */}
          <div className="flex items-center gap-1.5 flex-1 min-w-[140px] md:flex-none">
            <Tag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={filters.selectedFlag}
              onChange={(e) => {
                onFiltersChange({ ...filters, selectedFlag: e.target.value });
                setCurrentPage(1);
              }}
              className="w-full md:w-auto py-1.5 px-2.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
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
          <div className="flex items-center gap-1.5 flex-1 min-w-[140px] md:flex-none">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={filters.selectedMajorCategory}
              onChange={(e) => {
                onFiltersChange({ ...filters, selectedMajorCategory: e.target.value });
                setCurrentPage(1);
              }}
              className="w-full md:w-auto py-1.5 px-2.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 md:max-w-[160px]"
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

          {/* モバイル専用: 並び替えコントロール */}
          <div className="flex md:hidden items-center gap-1.5 w-full pt-1 border-t border-slate-200/70">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-[11px] text-slate-500 shrink-0">並び順:</span>
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as 'date' | 'amount' | 'content' | 'customFlag')}
              className="flex-1 py-1.5 px-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none"
            >
              <option value="date">日付</option>
              <option value="amount">金額</option>
              <option value="content">内容</option>
              <option value="customFlag">独自フラグ</option>
            </select>
            <button
              type="button"
              onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
              className="px-2.5 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-lg text-slate-700 cursor-pointer"
            >
              {sortOrder === 'desc' ? '降順 ↓' : '昇順 ↑'}
            </button>
          </div>

          {/* フィルタ全解除ボタン */}
          {hasAnyFilter && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              フィルタ解除
            </button>
          )}
        </div>

        {/* PC用 一括操作バー（常にスペースを確保してレイアウトシフト・ガタつきを防止） */}
        <div
          className={`hidden md:flex min-h-[42px] px-3 py-1.5 rounded-xl border flex-wrap items-center justify-between gap-3 transition-colors duration-150 ${
            selectedCount > 0
              ? 'bg-indigo-50 border-indigo-200 text-indigo-900 shadow-2xs'
              : 'bg-slate-100/50 border-dashed border-slate-200 text-slate-400'
          }`}
        >
          {selectedCount > 0 ? (
            <>
              <div className="flex items-center gap-2 text-xs font-semibold text-indigo-900">
                <Check className="w-4 h-4 text-indigo-600" />
                <span>
                  {selectedCount} 件を選択中
                  <span className="ml-1.5 font-mono text-indigo-700">
                    （合計 ¥{selectedNetSum.toLocaleString()}）
                  </span>
                </span>
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

      {/* モバイル用 カードリスト表示 (md 未満) */}
      <div className="md:hidden">
        {/* モバイル用 全選択・件数ミニバー */}
        {paginatedRecords.length > 0 && (
          <div className="px-3 py-2 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <button
              type="button"
              onClick={handleToggleSelectAll}
              className="inline-flex items-center gap-1.5 font-medium text-slate-700 cursor-pointer"
            >
              {isAllSelected ? (
                <CheckSquare className="w-4 h-4 text-indigo-600" />
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
              <span>{isAllSelected ? 'このページの選択を解除' : 'このページをすべて選択'}</span>
            </button>
            <span className="text-[11px] text-slate-500">
              {sortedRecords.length.toLocaleString()} 件
            </span>
          </div>
        )}

        {paginatedRecords.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            条件に一致する明細がありません
          </div>
        ) : (
          <div className="divide-y divide-slate-200/80">
            {paginatedRecords.map((record) => {
              const isSelected = selectedIds.has(record.id);
              const isExpense = record.amount < 0;
              const isTransfer = record.transfer;

              return (
                <div
                  key={record.id}
                  className={`p-3.5 space-y-2.5 transition-colors ${
                    isSelected ? 'bg-indigo-50/50' : 'bg-white'
                  } ${!record.calculationTarget ? 'opacity-55 bg-slate-50/60' : ''}`}
                >
                  {/* 1段目: チェックボックス・日付・金融機関 ／ 金額 */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <button
                        type="button"
                        onClick={() => handleToggleSelectRow(record.id)}
                        className="p-1 -m-1 text-slate-400 hover:text-slate-700 cursor-pointer shrink-0"
                        aria-label="行を選択"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-5 h-5 text-indigo-600" />
                        ) : (
                          <Square className="w-5 h-5" />
                        )}
                      </button>
                      <span className="font-mono text-[11px] text-slate-500 shrink-0">
                        {record.date}
                      </span>
                      {isTransfer && (
                        <span className="text-[10px] px-1.5 py-0.2 bg-slate-200 text-slate-600 rounded shrink-0">
                          振替
                        </span>
                      )}
                      {record.institution && (
                        <span className="text-[11px] text-slate-400 truncate">
                          {record.institution}
                        </span>
                      )}
                    </div>
                    <span
                      className={`font-mono text-sm font-bold whitespace-nowrap shrink-0 ${
                        isExpense ? 'text-slate-900' : 'text-emerald-600'
                      }`}
                    >
                      {record.amount > 0
                        ? `+¥${record.amount.toLocaleString()}`
                        : `¥${record.amount.toLocaleString()}`}
                    </span>
                  </div>

                  {/* 2段目: 内容 & カテゴリ */}
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-800 leading-snug break-words">
                      {record.content}
                    </p>
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 text-[11px] text-slate-700">
                        {record.majorCategory}
                      </span>
                      {record.mediumCategory && record.mediumCategory !== '未分類' && (
                        <span className="text-[11px] text-slate-400">/ {record.mediumCategory}</span>
                      )}
                    </div>
                  </div>

                  {/* 3段目: 独自フラグ選択 & 計算対象トグル */}
                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <select
                      value={record.customFlag || '未設定'}
                      onChange={(e) => onUpdateRecord(record.id, { customFlag: e.target.value })}
                      className={`flex-1 max-w-[180px] text-xs font-semibold px-2.5 py-1.5 rounded-lg border focus:outline-none transition-colors cursor-pointer ${
                        record.customFlag === '清算対象' || record.customFlag === '精算対象'
                          ? 'bg-indigo-50 text-indigo-800 border-indigo-300 shadow-2xs font-bold'
                          : record.customFlag === '清算済み' || record.customFlag === '精算済み'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold'
                          : record.customFlag === '除外'
                          ? 'bg-slate-100 text-slate-400 border-slate-300 line-through'
                          : 'bg-white text-slate-600 border-slate-200'
                      }`}
                    >
                      {customFlags.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() =>
                        onUpdateRecord(record.id, { calculationTarget: !record.calculationTarget })
                      }
                      className={`px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1 text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                        record.calculationTarget
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-500'
                      }`}
                    >
                      <span>{record.calculationTarget ? '対象 ○' : '対象外 ×'}</span>
                    </button>
                  </div>

                  {/* 4段目: メモ / 独自メモ */}
                  <div className="space-y-1">
                    {record.memo && (
                      <p className="text-[11px] text-slate-400 break-words">
                        MFメモ: {record.memo}
                      </p>
                    )}
                    <input
                      type="text"
                      placeholder="独自メモを入力..."
                      value={record.customMemo || ''}
                      onChange={(e) => onUpdateRecord(record.id, { customMemo: e.target.value })}
                      className="w-full text-sm px-2.5 py-1.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-lg focus:outline-none transition-colors"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* PC用 テーブル本体 (md 以上) */}
      <div className="hidden md:block overflow-x-auto">
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
      <div
        className={`p-3 sm:p-4 border-t border-slate-200 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3 sm:gap-4 text-xs text-slate-500 ${
          selectedCount > 0 ? 'pb-28 md:pb-4' : ''
        }`}
      >
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

        <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 w-full sm:w-auto">
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
              className="p-1.5 sm:p-1 rounded-md bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white cursor-pointer"
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
              className="p-1.5 sm:p-1 rounded-md bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white cursor-pointer"
              title="次のページ (l / →)"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* モバイル専用: 選択時の画面下部固定 一括操作バー */}
      {selectedCount > 0 && (
        <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-indigo-950 text-white px-3 pt-2.5 pb-3 shadow-2xl border-t border-indigo-800 space-y-2 animate-slideUp">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 font-bold">
              <Check className="w-4 h-4 text-indigo-300" />
              <span>{selectedCount} 件選択中</span>
              <span className="font-mono text-indigo-200">
                （¥{selectedNetSum.toLocaleString()}）
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] text-indigo-200 hover:text-white bg-white/10 rounded-md cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              解除
            </button>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            <button
              type="button"
              onClick={() => {
                onBatchUpdateFlag(Array.from(selectedIds), '清算対象');
                setSelectedIds(new Set());
              }}
              className="px-3 py-1.5 text-xs font-bold bg-indigo-500 active:bg-indigo-600 text-white rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
            >
              清算対象
            </button>
            <button
              type="button"
              onClick={() => {
                onBatchUpdateFlag(Array.from(selectedIds), '清算済み');
                setSelectedIds(new Set());
              }}
              className="px-3 py-1.5 text-xs font-bold bg-emerald-600 active:bg-emerald-700 text-white rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
            >
              清算済み
            </button>
            <button
              type="button"
              onClick={() => {
                onBatchUpdateFlag(Array.from(selectedIds), '除外');
                setSelectedIds(new Set());
              }}
              className="px-3 py-1.5 text-xs font-medium bg-white/15 active:bg-white/25 text-white rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
            >
              除外
            </button>
            <button
              type="button"
              onClick={() => {
                onBatchUpdateFlag(Array.from(selectedIds), '未設定');
                setSelectedIds(new Set());
              }}
              className="px-3 py-1.5 text-xs font-medium bg-white/10 active:bg-white/20 text-indigo-100 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
            >
              未設定
            </button>
            <button
              type="button"
              onClick={() => {
                onBatchToggleCalcTarget(Array.from(selectedIds), true);
                setSelectedIds(new Set());
              }}
              className="px-2.5 py-1.5 text-xs bg-white/10 active:bg-white/20 text-indigo-100 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
            >
              対象 ○
            </button>
            <button
              type="button"
              onClick={() => {
                onBatchToggleCalcTarget(Array.from(selectedIds), false);
                setSelectedIds(new Set());
              }}
              className="px-2.5 py-1.5 text-xs bg-white/10 active:bg-white/20 text-indigo-100 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
            >
              対象外 ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
