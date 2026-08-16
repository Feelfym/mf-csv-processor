import React, { useState, useRef } from 'react';
import { AppSettings, AutoRule, MoneyForwardRecord } from '../types';
import {
  X,
  Save,
  Plus,
  Trash2,
  ShieldCheck,
  HelpCircle,
  Download,
  Upload,
  Database,
  CheckCircle2,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSaveSettings: (newSettings: AppSettings) => void;
  // 全データ移行用
  currentRecords?: MoneyForwardRecord[];
  currentRules?: AutoRule[];
  currentFileName?: string | null;
  currentSelectedPeriod?: string;
  onRestoreFullBackup?: (backupData: {
    records: MoneyForwardRecord[];
    rules: AutoRule[];
    settings: AppSettings;
    fileName: string | null;
    selectedPeriod: string;
  }) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  currentRecords = [],
  currentRules = [],
  currentFileName = null,
  currentSelectedPeriod = 'ALL',
  onRestoreFullBackup,
}) => {
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [newFlagInput, setNewFlagInput] = useState('');
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [migrationMessage, setMigrationMessage] = useState<string | null>(null);

  const backupFileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleAddFlag = () => {
    const trimmed = newFlagInput.trim();
    if (!trimmed || localSettings.customFlags.includes(trimmed)) return;
    setLocalSettings({
      ...localSettings,
      customFlags: [...localSettings.customFlags, trimmed],
    });
    setNewFlagInput('');
  };

  const handleDeleteFlag = (flagToDelete: string) => {
    if (flagToDelete === '未設定') return;
    setLocalSettings({
      ...localSettings,
      customFlags: localSettings.customFlags.filter((f) => f !== flagToDelete),
    });
  };

  const handleSave = () => {
    onSaveSettings(localSettings);
    setShowSavedToast(true);
    setTimeout(() => {
      setShowSavedToast(false);
      onClose();
    }, 800);
  };

  // 全データ一括バックアップ（JSONエクスポート）
  const handleExportFullBackup = () => {
    const backupData = {
      version: '1.1',
      timestamp: new Date().toISOString(),
      recordCount: currentRecords.length,
      records: currentRecords,
      rules: currentRules,
      settings: localSettings,
      fileName: currentFileName,
      selectedPeriod: currentSelectedPeriod,
    };

    const dataStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    a.download = `mf_processor_backup_${currentRecords.length}items_${dateStr}.json`;
    a.click();
    URL.revokeObjectURL(url);

    setMigrationMessage(`全データ（${currentRecords.length} 件の明細 + ルール + 設定）を保存しました`);
    setTimeout(() => setMigrationMessage(null), 4000);
  };

  // 全データ一括復元（JSONインポート）
  const handleImportFullBackupChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!parsed || !Array.isArray(parsed.records)) {
          throw new Error('有効なバックアップJSONファイルではありません（records配列が見つかりません）');
        }

        const count = parsed.records.length;
        const confirmMsg = `【バックアップの復元】\n\n・明細データ: ${count} 件\n・自動ルール: ${
          parsed.rules?.length || 0
        } 件\n・ファイル名: ${parsed.fileName || 'なし'}\n\nこのデータを復元して現在の状態を上書きしますか？`;

        if (!confirm(confirmMsg)) return;

        if (onRestoreFullBackup) {
          onRestoreFullBackup({
            records: parsed.records,
            rules: Array.isArray(parsed.rules) ? parsed.rules : [],
            settings: parsed.settings || localSettings,
            fileName: parsed.fileName || null,
            selectedPeriod: parsed.selectedPeriod || 'ALL',
          });
        }

        setLocalSettings(parsed.settings || localSettings);
        setMigrationMessage(`${count} 件のデータを完全復元しました！`);
        setTimeout(() => {
          setMigrationMessage(null);
          onClose();
        }, 1200);
      } catch (err: any) {
        alert(`復元に失敗しました: ${err.message}`);
      } finally {
        if (backupFileInputRef.current) backupFileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* ヘッダー */}
        <div className="p-4 sm:p-6 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-800">アプリ設定 & データ移行</h2>
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
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* 全データ一括移行・バックアップ */}
          <div className="p-4 bg-gradient-to-br from-indigo-50/80 to-purple-50/80 border border-indigo-200/80 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-indigo-950 font-bold">
                <Database className="w-4 h-4 text-indigo-600" />
                <span>全データ一括移行・バックアップ (JSON)</span>
              </div>
              <span className="text-[11px] font-semibold text-indigo-700 bg-white px-2 py-0.5 rounded-full border border-indigo-200">
                現在のデータ: {currentRecords.length} 件
              </span>
            </div>

            <p className="text-[11px] text-slate-600 leading-relaxed">
              ローカルサーバーからGitHub Pagesへデータを移行したい時や、PC間で作業を引き継ぐ際に使用します。
              <strong>明細データ（フラグ・メモ付き）、自動ルール、GAS設定</strong> を丸ごと1ファイルで保存・復元できます。
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <input
                ref={backupFileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleImportFullBackupChange}
                className="hidden"
              />

              <button
                type="button"
                onClick={handleExportFullBackup}
                disabled={currentRecords.length === 0}
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold rounded-lg transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
                title="現在の全作業データをJSONファイルとしてダウンロード"
              >
                <Download className="w-3.5 h-3.5" />
                全データをバックアップ (エクスポート)
              </button>

              <button
                type="button"
                onClick={() => backupFileInputRef.current?.click()}
                className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 font-bold border border-slate-300 rounded-lg transition-colors cursor-pointer shadow-2xs flex items-center gap-1.5"
                title="バックアップJSONファイルからすべてのデータを完全復元"
              >
                <Upload className="w-3.5 h-3.5 text-indigo-600" />
                バックアップから復元 (インポート)
              </button>
            </div>

            {migrationMessage && (
              <div className="p-2 bg-emerald-100 text-emerald-800 rounded-lg flex items-center gap-1.5 text-xs font-semibold animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{migrationMessage}</span>
              </div>
            )}
          </div>

          {/* GAS WebアプリURL */}
          <div className="space-y-1.5">
            <label className="block font-bold text-slate-700">
              Google Apps Script (GAS) WebアプリURL
            </label>
            <input
              type="text"
              placeholder="https://script.google.com/macros/s/XXXXX/exec"
              value={localSettings.gasWebAppUrl}
              onChange={(e) =>
                setLocalSettings({ ...localSettings, gasWebAppUrl: e.target.value.trim() })
              }
              className="w-full py-2 px-3 bg-slate-50 focus:bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono text-[11px]"
            />
            <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              URLはお使いのブラウザ（ローカル）にのみ保存され、外部に漏洩しません。
            </p>
          </div>

          {/* Googleドライブ フォルダID */}
          <div className="space-y-1.5">
            <label className="block font-bold text-slate-700">
              Googleドライブ フォルダID（CSVバックアップ保存先・任意）
            </label>
            <input
              type="text"
              placeholder="1A2B3C4D5E6F..."
              value={localSettings.googleDriveFolderId}
              onChange={(e) =>
                setLocalSettings({ ...localSettings, googleDriveFolderId: e.target.value.trim() })
              }
              className="w-full py-2 px-3 bg-slate-50 focus:bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono text-[11px]"
            />
            <p className="text-[11px] text-slate-400 flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5" />
              ドライブのフォルダURL末尾（drive.google.com/drive/folders/〇〇）の文字列です。
            </p>
          </div>

          {/* NotebookLM ノートブックURL */}
          <div className="space-y-1.5">
            <label className="block font-bold text-slate-700">
              NotebookLM ノートブックURL（連携先・任意）
            </label>
            <input
              type="text"
              placeholder="https://notebooklm.google.com/notebook/XXXXX"
              value={localSettings.notebookLmUrl || ''}
              onChange={(e) =>
                setLocalSettings({ ...localSettings, notebookLmUrl: e.target.value.trim() })
              }
              className="w-full py-2 px-3 bg-slate-50 focus:bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono text-[11px]"
            />
            <p className="text-[11px] text-slate-400 flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5" />
              登録すると「NotebookLM搬出」時に1クリックで対象ノートブックを直接開けるようになります。
            </p>
          </div>

          {/* 独自フラグの管理 */}
          <div className="space-y-2 pt-2 border-t border-slate-200">
            <label className="block font-bold text-slate-700">
              利用可能なフラグ一覧のカスタマイズ
            </label>
            <p className="text-[11px] text-slate-500">
              明細ごとに付与できるフラグ（タグ）を追加・削除できます。
            </p>

            {/* フラグ追加入力 */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="新しいフラグ名（例: ふるさと納税）"
                value={newFlagInput}
                onChange={(e) => setNewFlagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddFlag();
                  }
                }}
                className="flex-1 py-1.5 px-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={handleAddFlag}
                disabled={!newFlagInput.trim()}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 disabled:opacity-40 text-white rounded-lg transition-colors cursor-pointer flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> 追加
              </button>
            </div>

            {/* フラグバッジ一覧 */}
            <div className="flex flex-wrap gap-2 pt-2">
              {localSettings.customFlags.map((flag) => (
                <span
                  key={flag}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 text-xs"
                >
                  <span>{flag}</span>
                  {flag !== '未設定' && (
                    <button
                      type="button"
                      onClick={() => handleDeleteFlag(flag)}
                      className="text-slate-400 hover:text-rose-600 transition-colors ml-1 cursor-pointer"
                      title="削除"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* フッター */}
        <div className="p-4 sm:p-6 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 text-slate-600 hover:text-slate-800 font-medium cursor-pointer"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 text-xs"
          >
            <Save className="w-4 h-4" />
            {showSavedToast ? '保存しました！' : '設定を保存'}
          </button>
        </div>
      </div>
    </div>
  );
};
