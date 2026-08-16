import React from 'react';
import { X, Keyboard } from 'lucide-react';

interface ShortcutHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutHelpModal: React.FC<ShortcutHelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    {
      category: '移動・選択',
      items: [
        { key: '↑ / ↓', desc: '行のフォーカスを上下に移動' },
        { key: 'Space', desc: '行のチェックボックスを選択 / 解除' },
        { key: 'Shift + ↑ / ↓', desc: '複数行を連続選択' },
        { key: 'Cmd / Ctrl + A', desc: '表示中のすべての行を選択 / 解除' },
      ],
    },
    {
      category: 'フラグ付け & 操作',
      items: [
        { key: '1  または  s', desc: 'フォーカス行（または選択行）を「清算対象」にする' },
        { key: '3', desc: 'フォーカス行（または選択行）を「清算済み」にする' },
        { key: '2  または  x', desc: 'フォーカス行（または選択行）を「除外」にする' },
        { key: '0  または  u', desc: 'フォーカス行（または選択行）を「未設定」に戻す' },
        { key: 'c', desc: '計算対象（○ / ×）を切り替え' },
        { key: 'Enter', desc: 'フォーカス行の独自メモ編集を開始' },
      ],
    },
    {
      category: 'ナビゲーション & 全体',
      items: [
        { key: '[  /  ]', desc: '前の月 / 次の月 へ切り替え' },
        { key: '← / →  または  h / l', desc: '前のページ / 次のページ へ移動' },
        { key: '/', desc: '検索バーにフォーカス' },
        { key: 'Esc', desc: '検索や入力のフォーカス解除 / モーダルを閉じる' },
        { key: '?', desc: 'このショートカットヘルプを表示' },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* ヘッダー */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
              <Keyboard className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">キーボードショートカット</h2>
              <p className="text-xs text-slate-500">
                キーボードだけで高速にフラグ付け・仕分けができます
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
        <div className="p-4 sm:p-5 overflow-y-auto space-y-5 text-xs">
          {shortcuts.map((group) => (
            <div key={group.category} className="space-y-2">
              <h3 className="font-bold text-slate-700 text-[11px] uppercase tracking-wider text-indigo-600">
                {group.category}
              </h3>
              <div className="space-y-1.5">
                {group.items.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between py-1 px-2 rounded-lg bg-slate-50 border border-slate-150"
                  >
                    <span className="text-slate-600 font-medium">{item.desc}</span>
                    <kbd className="px-2 py-0.5 font-mono font-bold text-[11px] bg-white border border-slate-300 rounded shadow-2xs text-slate-800">
                      {item.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* フッター */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 text-center text-slate-400 text-[11px]">
          いつでも <kbd className="px-1.5 py-0.5 bg-white border rounded font-mono font-bold text-slate-700">?</kbd> キーを押してこの一覧を表示できます
        </div>
      </div>
    </div>
  );
};
