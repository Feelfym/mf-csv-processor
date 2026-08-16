import React, { useState } from 'react';
import { AppSettings } from '../types';
import { X, Save, Plus, Trash2, ShieldCheck, HelpCircle } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSaveSettings: (newSettings: AppSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
}) => {
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [newFlagInput, setNewFlagInput] = useState('');
  const [showSavedToast, setShowSavedToast] = useState(false);

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
    if (flagToDelete === '未設定') return; // 未設定は削除不可
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* ヘッダー */}
        <div className="p-4 sm:p-6 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-800">アプリ設定</h2>
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
