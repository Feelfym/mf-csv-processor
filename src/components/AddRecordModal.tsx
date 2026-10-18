import React, { useState, useMemo, useEffect } from 'react';
import { MoneyForwardRecord } from '../types';
import { useModal } from '../hooks/useModal';
import { X, PlusCircle, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';

interface AddRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddRecord: (record: Omit<MoneyForwardRecord, 'id'>) => void;
  customFlags: string[];
  existingRecords: MoneyForwardRecord[];
  currentPeriod: string; // 'ALL' | 'YEAR:2026' | 'MONTH:2026-08'
}

export const AddRecordModal: React.FC<AddRecordModalProps> = ({
  isOpen,
  onClose,
  onAddRecord,
  customFlags,
  existingRecords,
  currentPeriod,
}) => {
  const { overlayProps, dialogProps } = useModal(isOpen, onClose, { closeOnBackdrop: false });

  // フォーム初期値の生成（現在の期間に基づく）
  const getInitialDate = () => {
    if (currentPeriod.startsWith('MONTH:')) {
      const ym = currentPeriod.replace('MONTH:', '');
      return `${ym}-01`;
    }
    const today = new Date();
    return today.toISOString().slice(0, 10);
  };

  const [date, setDate] = useState(getInitialDate);
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [amountStr, setAmountStr] = useState('');
  const [content, setContent] = useState('');
  const [majorCategory, setMajorCategory] = useState('未分類');
  const [mediumCategory, setMediumCategory] = useState('未分類');
  const [institution, setInstitution] = useState('現金');
  const [customFlag, setCustomFlag] = useState(customFlags.includes('清算対象') ? '清算対象' : '未設定');
  const [customMemo, setCustomMemo] = useState('');
  const [calculationTarget, setCalculationTarget] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // モーダルが開くたびに初期化
  useEffect(() => {
    if (isOpen) {
      setDate(getInitialDate());
      setType('expense');
      setAmountStr('');
      setContent('');
      setMajorCategory('未分類');
      setMediumCategory('未分類');
      setInstitution('現金');
      setCustomFlag(customFlags.includes('清算対象') ? '清算対象' : '未設定');
      setCustomMemo('');
      setCalculationTarget(true);
      setError(null);
    }
  }, [isOpen, currentPeriod, customFlags]);

  // 既存レコードから大項目・中項目・金融機関の候補を抽出
  const categoryTree = useMemo(() => {
    const tree: Record<string, Set<string>> = {};
    existingRecords.forEach((r) => {
      const major = r.majorCategory || '未分類';
      const medium = r.mediumCategory || '未分類';
      if (!tree[major]) tree[major] = new Set();
      tree[major].add(medium);
    });
    return tree;
  }, [existingRecords]);

  const majorCategoryOptions = useMemo(() => {
    const set = new Set(Object.keys(categoryTree));
    set.add('未分類');
    return Array.from(set).sort();
  }, [categoryTree]);

  const mediumCategoryOptions = useMemo(() => {
    const mediums = categoryTree[majorCategory];
    const set = new Set(mediums ? Array.from(mediums) : []);
    set.add('未分類');
    return Array.from(set).sort();
  }, [categoryTree, majorCategory]);

  const institutionOptions = useMemo(() => {
    const set = new Set<string>();
    set.add('現金');
    existingRecords.forEach((r) => {
      if (r.institution) set.add(r.institution);
    });
    return Array.from(set).sort();
  }, [existingRecords]);

  // 大項目が変わったとき、中項目をリセットまたは調整
  const handleMajorCategoryChange = (newMajor: string) => {
    setMajorCategory(newMajor);
    const availableMediums = categoryTree[newMajor];
    if (availableMediums && availableMediums.size > 0) {
      setMediumCategory(Array.from(availableMediums)[0]);
    } else {
      setMediumCategory('未分類');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedContent = content.trim();
    if (!trimmedContent) {
      setError('内容を入力してください');
      return;
    }

    const numAmount = parseFloat(amountStr.replace(/,/g, ''));
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('有効な金額（1円以上）を入力してください');
      return;
    }

    // マネーフォワードの仕様に合わせる（支出はマイナス、収入はプラス）
    const finalAmount = type === 'expense' ? -Math.abs(numAmount) : Math.abs(numAmount);
    // 日付表記を YYYY/MM/DD に統一
    const formattedDate = date.replace(/-/g, '/');

    onAddRecord({
      date: formattedDate,
      content: trimmedContent,
      amount: finalAmount,
      rawAmount: numAmount,
      majorCategory: majorCategory.trim() || '未分類',
      mediumCategory: mediumCategory.trim() || '未分類',
      institution: institution.trim() || '現金',
      calculationTarget,
      memo: '',
      transfer: false,
      mfId: '',
      customFlag: customFlag || '未設定',
      customMemo: customMemo.trim(),
    });

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      {...overlayProps}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fadeIn"
    >
      <div
        {...dialogProps}
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] outline-none"
      >
        {/* ヘッダー */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <PlusCircle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">明細を手動追加</h2>
              <p className="text-xs text-slate-500">現金や未連携の明細をリストに追加します</p>
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

        {/* フォーム本体 */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 font-medium">
              {error}
            </div>
          )}

          {/* 支出 / 収入 の切り替え */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5">収支種別</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setType('expense')}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border font-bold transition-all cursor-pointer ${
                  type === 'expense'
                    ? 'bg-rose-50 border-rose-400 text-rose-700 ring-2 ring-rose-500/20'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <ArrowDownCircle className={`w-4 h-4 ${type === 'expense' ? 'text-rose-600' : 'text-slate-400'}`} />
                支出（マイナス）
              </button>
              <button
                type="button"
                onClick={() => setType('income')}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border font-bold transition-all cursor-pointer ${
                  type === 'income'
                    ? 'bg-emerald-50 border-emerald-400 text-emerald-700 ring-2 ring-emerald-500/20'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <ArrowUpCircle className={`w-4 h-4 ${type === 'income' ? 'text-emerald-600' : 'text-slate-400'}`} />
                収入（プラス）
              </button>
            </div>
          </div>

          {/* 金額 & 日付 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                金額 (円) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">¥</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="3000"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  className="w-full pl-7 pr-3 py-2 text-sm font-semibold bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                日付 <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                required
              />
            </div>
          </div>

          {/* 内容（摘要） */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              内容 (摘要 / 店名) <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              data-autofocus
              placeholder="例: セブンイレブン、タクシー代、ランチなど"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800"
              required
            />
          </div>

          {/* 大項目 & 中項目 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">大項目</label>
              <select
                value={majorCategory}
                onChange={(e) => handleMajorCategoryChange(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                {majorCategoryOptions.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">中項目</label>
              <select
                value={mediumCategory}
                onChange={(e) => setMediumCategory(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                {mediumCategoryOptions.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 独自フラグ & 金融機関 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">独自フラグ</label>
              <select
                value={customFlag}
                onChange={(e) => setCustomFlag(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                {customFlags.map((flag) => (
                  <option key={flag} value={flag}>
                    {flag}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">保有金融機関</label>
              <input
                type="text"
                list="institution-list"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
              <datalist id="institution-list">
                {institutionOptions.map((inst) => (
                  <option key={inst} value={inst} />
                ))}
              </datalist>
            </div>
          </div>

          {/* 独自メモ */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">独自メモ (任意)</label>
            <input
              type="text"
              placeholder="例: Aさんと折半、プロジェクト立替など"
              value={customMemo}
              onChange={(e) => setCustomMemo(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800"
            />
          </div>

          {/* 計算対象チェックボックス */}
          <div className="pt-1">
            <label className="inline-flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={calculationTarget}
                onChange={(e) => setCalculationTarget(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
              />
              <span className="font-medium text-slate-700">計算対象に含める</span>
            </label>
          </div>

          {/* フッターボタン */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              キャンセル (Esc)
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-all shadow-xs cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              明細を追加する (Enter)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
