import React from 'react';
import { Settings, Sparkles, Download, CloudUpload, FileSpreadsheet, RefreshCw, CheckCircle2 } from 'lucide-react';

interface HeaderProps {
  fileName: string | null;
  recordCount: number;
  onOpenSettings: () => void;
  onOpenRules: () => void;
  onExportCsv: () => void;
  onSaveToGas: () => void;
  onReset: () => void;
  isSaving: boolean;
  hasGasUrl: boolean;
  lastSavedTime?: string | null;
}

export const Header: React.FC<HeaderProps> = ({
  fileName,
  recordCount,
  onOpenSettings,
  onOpenRules,
  onExportCsv,
  onSaveToGas,
  onReset,
  isSaving,
  hasGasUrl,
}) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* ロゴ・タイトル */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-sm">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-800 tracking-tight">MF CSV Processor</h1>
              <span className="text-xs bg-emerald-100 text-emerald-800 font-medium px-2 py-0.5 rounded-full">
                v1.0
              </span>
              {fileName && (
                <span className="hidden md:inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" /> ブラウザ保存中
                </span>
              )}
            </div>
            {fileName ? (
              <p className="text-xs text-slate-500 truncate max-w-xs sm:max-w-md">
                <span className="font-medium text-slate-700">{fileName}</span> ({recordCount.toLocaleString()} 件)
              </p>
            ) : (
              <p className="text-xs text-slate-400">マネーフォワードCSVの加工・フラグ付け・集計</p>
            )}
          </div>
        </div>

        {/* アクションボタン群 */}
        <div className="flex items-center gap-2">
          {fileName && (
            <>
              <button
                type="button"
                onClick={onReset}
                title="別のCSVファイルを読み込む（データをクリア）"
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                クリア・再読込
              </button>

              <button
                type="button"
                onClick={onOpenRules}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                自動フラグルール
              </button>

              <button
                type="button"
                onClick={onExportCsv}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-slate-600" />
                CSV保存
              </button>

              <button
                type="button"
                onClick={onSaveToGas}
                disabled={isSaving}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all shadow-xs cursor-pointer ${
                  hasGasUrl
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-slate-200 text-slate-500 hover:bg-slate-300'
                }`}
                title={hasGasUrl ? 'スプレッドシートへ保存' : '設定からGAS URLを登録してください'}
              >
                <CloudUpload className={`w-4 h-4 ${isSaving ? 'animate-bounce' : ''}`} />
                {isSaving ? '送信中...' : 'スプシに保存'}
              </button>
            </>
          )}

          <button
            type="button"
            onClick={onOpenSettings}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title="設定"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
};
