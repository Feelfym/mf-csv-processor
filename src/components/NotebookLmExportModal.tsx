import React, { useState, useMemo } from 'react';
import { MoneyForwardRecord } from '../types';
import { generateNotebookLmMarkdown } from '../utils/notebookLmFormatter';
import {
  X,
  Copy,
  Check,
  Download,
  ExternalLink,
  BookOpen,
  Settings,
} from 'lucide-react';

interface NotebookLmExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: MoneyForwardRecord[];
  periodLabel: string;
  customFlags: string[];
  notebookLmUrl?: string;
  onOpenSettings?: () => void;
  onMarkAsSettled?: () => void;
}

export const NotebookLmExportModal: React.FC<NotebookLmExportModalProps> = ({
  isOpen,
  onClose,
  records,
  periodLabel,
  customFlags,
  notebookLmUrl,
  onOpenSettings,
  onMarkAsSettled,
}) => {
  const [includeDetailTable, setIncludeDetailTable] = useState(true);
  const [copied, setCopied] = useState(false);

  // Markdownテキストを生成
  const markdownText = useMemo(() => {
    return generateNotebookLmMarkdown(records, {
      periodLabel,
      customFlags,
      includeDetailTable,
    });
  }, [records, periodLabel, customFlags, includeDetailTable]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(markdownText);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([markdownText], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safePeriod = periodLabel.replace(/[/\\?%*:|"<>]/g, '_');
    a.download = `${safePeriod}_家計簿レポート_NotebookLM.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const targetNotebookUrl = notebookLmUrl?.trim() || 'https://notebooklm.google.com/';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* ヘッダー */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">NotebookLM 用レポート搬出</h2>
              <p className="text-xs text-slate-500">
                <span className="font-medium text-slate-700">{periodLabel}</span> (対象: {records.length.toLocaleString()} 件)
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
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 text-xs">
          {/* 使い方のヒント & NotebookLMクイックリンク */}
          <div className="p-3.5 bg-indigo-50/70 border border-indigo-200/80 rounded-xl space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold text-indigo-950 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                NotebookLMへの登録手順:
              </span>

              <a
                href={targetNotebookUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-3 py-1 bg-white hover:bg-slate-50 text-indigo-700 font-bold border border-indigo-300 rounded-lg transition-all shadow-2xs cursor-pointer text-xs"
              >
                <span>{notebookLmUrl ? '登録先ノートブックを開く' : 'NotebookLMを開く'}</span>
                <ExternalLink className="w-3 h-3 text-indigo-500" />
              </a>
            </div>

            <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-600 pl-1 leading-relaxed">
              <li>下部の <strong>「クリップボードにコピー」</strong> ボタンを押します。</li>
              <li>NotebookLMのノートを開き、<strong>「ソースを追加」→「テキストを貼り付け」</strong> を選択してペーストします。</li>
            </ol>

            {!notebookLmUrl && onOpenSettings && (
              <p className="text-[11px] text-slate-400 pt-1 flex items-center gap-1 border-t border-indigo-100">
                <Settings className="w-3 h-3" />
                <span>
                  右上の設定（⚙️）からNotebookLMのノートURLを登録すると、専用ノートへ1クリックでジャンプできるようになります。
                </span>
              </p>
            )}
          </div>

          {/* 出力オプション */}
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
              <input
                type="checkbox"
                checked={includeDetailTable}
                onChange={(e) => setIncludeDetailTable(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span>全明細の一覧テーブル（Markdown表）も含める</span>
            </label>

            <span className="text-slate-400 text-[11px]">
              文字数: 約 {markdownText.length.toLocaleString()} 文字
            </span>
          </div>

          {/* Markdownプレビュー表示 */}
          <div className="relative border border-slate-200 rounded-xl overflow-hidden bg-slate-900 text-slate-100">
            <div className="px-3 py-1.5 bg-slate-800 border-b border-slate-700 flex items-center justify-between text-[11px] text-slate-300 font-mono">
              <span>生成されたMarkdownプレビュー</span>
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1 text-indigo-300 hover:text-white cursor-pointer"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'コピー済み' : 'コピー'}</span>
              </button>
            </div>
            <pre className="p-3.5 max-h-64 overflow-y-auto text-[11px] font-mono whitespace-pre-wrap leading-relaxed">
              {markdownText}
            </pre>
          </div>
        </div>

        {/* フッター */}
        <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3 text-xs">
          <button
            type="button"
            onClick={handleDownload}
            className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 font-medium border border-slate-300 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            .md ファイルで保存
          </button>

          <div className="flex flex-wrap items-center gap-2">
            {onMarkAsSettled && records.some((r) => r.customFlag === '清算対象' || r.customFlag === '精算対象') && (
              <button
                type="button"
                onClick={() => {
                  onMarkAsSettled();
                  onClose();
                }}
                className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold border border-emerald-300 rounded-xl transition-colors cursor-pointer text-xs"
                title="表示中の清算対象データをすべて「清算済み」に変更してモーダルを閉じます"
              >
                清算対象を「清算済み」に変更
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-slate-600 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              閉じる
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className={`px-4 py-2 font-bold rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                copied
                  ? 'bg-emerald-600 text-white ring-2 ring-emerald-400'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  コピー完了！
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  クリップボードにコピー
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
