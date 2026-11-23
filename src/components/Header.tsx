import React, { useState, useRef, useEffect } from 'react';
import {
  Settings,
  Sparkles,
  Download,
  CloudUpload,
  FileSpreadsheet,
  RefreshCw,
  CheckCircle2,
  PlusCircle,
  BookOpen,
  Undo2,
  Redo2,
  ChevronDown,
  FileUp,
  AlertTriangle,
} from 'lucide-react';

interface HeaderProps {
  fileName: string | null;
  recordCount: number;
  onOpenSettings: () => void;
  onOpenRules: () => void;
  onExportCsv: () => void;
  onSaveToGas: () => void;
  onReset: () => void;
  onOpenImportCsv?: () => void;
  onOpenNotebookLmExport?: () => void;
  onOpenAddRecord?: () => void;
  isSaving: boolean;
  hasGasUrl: boolean;
  storageError?: string | null;
  lastSavedTime?: string | null;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  fileName,
  recordCount,
  onOpenSettings,
  onOpenRules,
  onExportCsv,
  onSaveToGas,
  onReset,
  onOpenImportCsv,
  onOpenNotebookLmExport,
  onOpenAddRecord,
  isSaving,
  hasGasUrl,
  storageError,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
}) => {
  // 開いているドロップダウンメニュー ('add' | 'export' | 'settings' | null)
  const [activeDropdown, setActiveDropdown] = useState<'add' | 'export' | 'settings' | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 外側クリック / タップでドロップダウンを閉じる
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setActiveDropdown(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveDropdown(null);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const toggleDropdown = (name: 'add' | 'export' | 'settings') => {
    setActiveDropdown((prev) => (prev === name ? null : name));
  };

  const closeDropdown = () => setActiveDropdown(null);

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4">
        {/* ロゴ・タイトル */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-sm shrink-0">
            <FileSpreadsheet className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h1 className="text-sm sm:text-lg font-bold text-slate-800 tracking-tight whitespace-nowrap truncate">
                <span className="sm:hidden">MF CSV</span>
                <span className="hidden sm:inline">MF CSV Processor</span>
              </h1>
              <span className="hidden sm:inline-block text-xs bg-emerald-100 text-emerald-800 font-medium px-2 py-0.5 rounded-full whitespace-nowrap">
                v1.31
              </span>
              {fileName && (
                storageError ? (
                  <button
                    type="button"
                    onClick={onOpenSettings}
                    title={storageError}
                    className="hidden md:inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 px-2 py-0.5 rounded-md border border-rose-300 whitespace-nowrap cursor-pointer"
                  >
                    <AlertTriangle className="w-3 h-3 text-rose-600" /> 保存失敗（要バックアップ）
                  </button>
                ) : (
                  <span className="hidden md:inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 whitespace-nowrap">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> ブラウザ保存中
                  </span>
                )
              )}
            </div>
            {fileName ? (
              <p className="text-[11px] sm:text-xs text-slate-500 truncate max-w-[110px] sm:max-w-md lg:max-w-lg">
                <span className="hidden sm:inline font-medium text-slate-700">{fileName} </span>
                <span>{recordCount.toLocaleString()} 件</span>
              </p>
            ) : (
              <p className="hidden sm:block text-xs text-slate-400 truncate">マネーフォワードCSVの加工・フラグ付け・集計</p>
            )}
          </div>
        </div>

        {/* アクションボタン群（ドロップダウン集約） */}
        <div ref={containerRef} className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* 元に戻す / やり直し */}
          {onUndo && onRedo && (fileName || canUndo || canRedo) && (
            <div className="flex items-center rounded-lg border border-slate-200 overflow-hidden bg-white shadow-2xs">
              <button
                type="button"
                onClick={onUndo}
                disabled={!canUndo}
                title="元に戻す (Cmd/Ctrl + Z)"
                aria-label="元に戻す"
                className="p-1.5 text-slate-600 hover:bg-slate-100 disabled:text-slate-300 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <Undo2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onRedo}
                disabled={!canRedo}
                title="やり直す (Cmd/Ctrl + Shift + Z)"
                aria-label="やり直す"
                className="p-1.5 text-slate-600 hover:bg-slate-100 disabled:text-slate-300 disabled:hover:bg-transparent disabled:cursor-not-allowed border-l border-slate-200 transition-colors cursor-pointer"
              >
                <Redo2 className="w-4 h-4" />
              </button>
            </div>
          )}

          {fileName && (
            <>
              {/* 1. 「追加」ドロップダウン */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => toggleDropdown('add')}
                  className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer shadow-2xs ${
                    activeDropdown === 'add'
                      ? 'bg-emerald-600 text-white border-emerald-600 ring-2 ring-emerald-500/20'
                      : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100/80'
                  }`}
                  aria-expanded={activeDropdown === 'add'}
                >
                  <PlusCircle className={`w-3.5 h-3.5 ${activeDropdown === 'add' ? 'text-white' : 'text-emerald-700'}`} />
                  <span>追加</span>
                  <ChevronDown className={`w-3 h-3 transition-transform duration-150 ${activeDropdown === 'add' ? 'rotate-180 text-white' : 'text-emerald-600'}`} />
                </button>

                {activeDropdown === 'add' && (
                  <div className="absolute right-0 mt-1.5 w-60 max-w-[calc(100vw-1.5rem)] bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-50 animate-fadeIn text-xs">
                    {onOpenAddRecord && (
                      <button
                        type="button"
                        onClick={() => {
                          closeDropdown();
                          onOpenAddRecord();
                        }}
                        className="w-full px-3 py-2.5 sm:py-2 text-left flex items-start gap-2.5 hover:bg-slate-50 transition-colors cursor-pointer group"
                      >
                        <PlusCircle className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0 group-hover:scale-110 transition-transform" />
                        <div>
                          <div className="font-bold text-slate-800 flex items-center gap-1.5">
                            明細を手動追加
                            <kbd className="hidden md:inline px-1 py-0.2 text-[10px] bg-slate-100 border border-slate-200 rounded text-slate-500 font-mono">n</kbd>
                          </div>
                          <div className="text-[11px] text-slate-500">現金や未連携の明細を1件追加</div>
                        </div>
                      </button>
                    )}

                    {onOpenImportCsv && (
                      <button
                        type="button"
                        onClick={() => {
                          closeDropdown();
                          onOpenImportCsv();
                        }}
                        className="w-full px-3 py-2.5 sm:py-2 text-left flex items-start gap-2.5 hover:bg-slate-50 transition-colors cursor-pointer group"
                      >
                        <FileUp className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0 group-hover:scale-110 transition-transform" />
                        <div>
                          <div className="font-bold text-slate-800">CSVを追加・置換取込</div>
                          <div className="text-[11px] text-slate-500">月選択や重複排除付きで合算</div>
                        </div>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* 2. 「出力・保存」ドロップダウン */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => toggleDropdown('export')}
                  className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer shadow-2xs ${
                    activeDropdown === 'export'
                      ? 'bg-indigo-600 text-white border-indigo-600 ring-2 ring-indigo-500/20'
                      : 'bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-100/80'
                  }`}
                  aria-expanded={activeDropdown === 'export'}
                >
                  <Download className={`w-3.5 h-3.5 ${activeDropdown === 'export' ? 'text-white' : 'text-indigo-700'}`} />
                  <span className="sm:hidden">出力</span>
                  <span className="hidden sm:inline">出力・保存</span>
                  <ChevronDown className={`w-3 h-3 transition-transform duration-150 ${activeDropdown === 'export' ? 'rotate-180 text-white' : 'text-indigo-600'}`} />
                </button>

                {activeDropdown === 'export' && (
                  <div className="absolute right-0 mt-1.5 w-64 max-w-[calc(100vw-1.5rem)] bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-50 animate-fadeIn text-xs">
                    {onOpenNotebookLmExport && (
                      <button
                        type="button"
                        onClick={() => {
                          closeDropdown();
                          onOpenNotebookLmExport();
                        }}
                        className="w-full px-3 py-2 text-left flex items-start gap-2.5 hover:bg-slate-50 transition-colors cursor-pointer group"
                      >
                        <BookOpen className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0 group-hover:scale-110 transition-transform" />
                        <div>
                          <div className="font-bold text-slate-800">NotebookLM用レポート搬出</div>
                          <div className="text-[11px] text-slate-500">AI分析用Markdownを生成・コピー</div>
                        </div>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        closeDropdown();
                        onSaveToGas();
                      }}
                      disabled={isSaving}
                      className="w-full px-3 py-2 text-left flex items-start gap-2.5 hover:bg-slate-50 transition-colors cursor-pointer group disabled:opacity-50"
                    >
                      <CloudUpload className={`w-4 h-4 text-emerald-600 mt-0.5 shrink-0 group-hover:scale-110 transition-transform ${isSaving ? 'animate-bounce' : ''}`} />
                      <div>
                        <div className="font-bold text-slate-800 flex items-center gap-1.5">
                          スプレッドシートへ保存
                          {!hasGasUrl && (
                            <span className="text-[10px] font-normal text-amber-600 bg-amber-50 px-1 py-0.2 rounded border border-amber-200">要URL設定</span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {isSaving ? '送信処理中...' : 'GAS経由でGoogleドライブ/シートへ保存'}
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        closeDropdown();
                        onExportCsv();
                      }}
                      className="w-full px-3 py-2 text-left flex items-start gap-2.5 hover:bg-slate-50 transition-colors cursor-pointer group"
                    >
                      <Download className="w-4 h-4 text-slate-600 mt-0.5 shrink-0 group-hover:scale-110 transition-transform" />
                      <div>
                        <div className="font-bold text-slate-800">CSVファイルをダウンロード</div>
                        <div className="text-[11px] text-slate-500">加工・フラグ付与後のデータを保存</div>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {/* 3. 「設定・管理」ドロップダウン */}
          <div className="relative">
            <button
              type="button"
              onClick={() => toggleDropdown('settings')}
              className={`p-2 text-slate-600 hover:text-slate-800 rounded-lg border transition-colors cursor-pointer ${
                activeDropdown === 'settings'
                  ? 'bg-slate-100 border-slate-300 ring-2 ring-slate-400/20'
                  : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
              title="設定・管理メニュー"
              aria-expanded={activeDropdown === 'settings'}
            >
              <Settings className="w-4 h-4" />
            </button>

            {activeDropdown === 'settings' && (
              <div className="absolute right-0 mt-1.5 w-60 max-w-[calc(100vw-1.5rem)] bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-50 animate-fadeIn text-xs">
                <button
                  type="button"
                  onClick={() => {
                    closeDropdown();
                    onOpenRules();
                  }}
                  className="w-full px-3 py-2 text-left flex items-start gap-2.5 hover:bg-slate-50 transition-colors cursor-pointer group"
                >
                  <Sparkles className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0 group-hover:scale-110 transition-transform" />
                  <div>
                    <div className="font-bold text-slate-800">自動仕訳ルール</div>
                    <div className="text-[11px] text-slate-500">キーワード一致による自動フラグ設定</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    closeDropdown();
                    onOpenSettings();
                  }}
                  className="w-full px-3 py-2 text-left flex items-start gap-2.5 hover:bg-slate-50 transition-colors cursor-pointer group"
                >
                  <Settings className="w-4 h-4 text-slate-600 mt-0.5 shrink-0 group-hover:scale-110 transition-transform" />
                  <div>
                    <div className="font-bold text-slate-800">アプリ環境設定</div>
                    <div className="text-[11px] text-slate-500">GAS / NotebookLM連携、独自フラグ</div>
                  </div>
                </button>

                {fileName && (
                  <>
                    <div className="my-1 border-t border-slate-150" />
                    <button
                      type="button"
                      onClick={() => {
                        closeDropdown();
                        onReset();
                      }}
                      className="w-full px-3 py-2 text-left flex items-start gap-2.5 hover:bg-rose-50 transition-colors cursor-pointer group text-rose-700"
                    >
                      <RefreshCw className="w-4 h-4 text-rose-500 mt-0.5 shrink-0 group-hover:rotate-180 transition-transform" />
                      <div>
                        <div className="font-bold">作業データをクリア</div>
                        <div className="text-[11px] text-rose-500">編集内容を初期状態に戻す</div>
                      </div>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
