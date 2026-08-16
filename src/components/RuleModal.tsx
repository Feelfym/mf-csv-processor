import React, { useState, useRef } from 'react';
import { AutoRule } from '../types';
import {
  X,
  Plus,
  Trash2,
  Sparkles,
  Check,
  ToggleLeft,
  ToggleRight,
  Download,
  Upload,
} from 'lucide-react';

interface RuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  rules: AutoRule[];
  customFlags: string[];
  onSaveRules: (rules: AutoRule[]) => void;
  onApplyRules: (rules: AutoRule[], overwriteExisting: boolean) => void;
}

export const RuleModal: React.FC<RuleModalProps> = ({
  isOpen,
  onClose,
  rules,
  customFlags,
  onSaveRules,
  onApplyRules,
}) => {
  const [localRules, setLocalRules] = useState<AutoRule[]>(rules);
  const [newRule, setNewRule] = useState<Omit<AutoRule, 'id'>>({
    name: '',
    targetField: 'content',
    matchType: 'contains',
    keyword: '',
    applyFlag: customFlags.find((f) => f === '清算対象') || customFlags[1] || '清算対象',
    enabled: true,
  });
  const [overwrite, setOverwrite] = useState(false);
  const [showAppliedToast, setShowAppliedToast] = useState(false);
  const [messageToast, setMessageToast] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const showMsg = (msg: string) => {
    setMessageToast(msg);
    setTimeout(() => setMessageToast(null), 3000);
  };

  const handleAddRule = () => {
    if (!newRule.keyword.trim()) return;
    const created: AutoRule = {
      ...newRule,
      id: `rule-${Date.now()}`,
      name: newRule.name.trim() || `「${newRule.keyword}」→ ${newRule.applyFlag}`,
    };
    const updated = [...localRules, created];
    setLocalRules(updated);
    onSaveRules(updated);
    setNewRule({
      name: '',
      targetField: 'content',
      matchType: 'contains',
      keyword: '',
      applyFlag: customFlags.find((f) => f === '清算対象') || '清算対象',
      enabled: true,
    });
  };

  const handleToggleEnable = (id: string) => {
    const updated = localRules.map((r) =>
      r.id === id ? { ...r, enabled: !r.enabled } : r
    );
    setLocalRules(updated);
    onSaveRules(updated);
  };

  const handleDeleteRule = (id: string) => {
    const updated = localRules.filter((r) => r.id !== id);
    setLocalRules(updated);
    onSaveRules(updated);
  };

  const handleApplyNow = () => {
    onApplyRules(localRules, overwrite);
    setShowAppliedToast(true);
    setTimeout(() => setShowAppliedToast(false), 2500);
  };

  // JSONエクスポート
  const handleExportRules = () => {
    if (localRules.length === 0) {
      showMsg('エクスポートするルールがありません');
      return;
    }
    const dataStr = JSON.stringify(localRules, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mf_auto_rules_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showMsg(`${localRules.length} 件のルールをJSONで保存しました`);
  };

  // JSONインポート
  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!Array.isArray(parsed)) {
          throw new Error('配列形式のJSONではありません');
        }

        // バリデーション
        const validRules: AutoRule[] = parsed.filter(
          (r: any) => r && typeof r.keyword === 'string' && typeof r.applyFlag === 'string'
        ).map((r: any, idx: number) => ({
          id: r.id || `imported-${Date.now()}-${idx}`,
          name: r.name || `「${r.keyword}」→ ${r.applyFlag}`,
          targetField: r.targetField || 'content',
          matchType: r.matchType || 'contains',
          keyword: r.keyword,
          applyFlag: r.applyFlag,
          enabled: r.enabled !== false,
        }));

        if (validRules.length === 0) {
          showMsg('有効なルールデータが見つかりませんでした');
          return;
        }

        const shouldAppend = confirm(
          `${validRules.length} 件のルールが見つかりました。\n\n「OK」: 既存のルールに追加する\n「キャンセル」: 既存のルールを置き換える（上書き）`
        );

        let merged: AutoRule[];
        if (shouldAppend) {
          // 重複排除（同じkeywordとapplyFlagは除外）
          const existingKeys = new Set(localRules.map((r) => `${r.targetField}_${r.keyword}_${r.applyFlag}`));
          const newOnes = validRules.filter(
            (r) => !existingKeys.has(`${r.targetField}_${r.keyword}_${r.applyFlag}`)
          );
          merged = [...localRules, ...newOnes];
          showMsg(`${newOnes.length} 件の新しいルールを追加しました（重複除外済）`);
        } else {
          merged = validRules;
          showMsg(`${validRules.length} 件のルールで上書き保存しました`);
        }

        setLocalRules(merged);
        onSaveRules(merged);
      } catch (err: any) {
        alert(`インポートに失敗しました: ${err.message}`);
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* ヘッダー */}
        <div className="p-4 sm:p-6 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">自動フラグ付与ルール</h2>
              <p className="text-xs text-slate-500">
                指定したキーワードが含まれる明細に自動でフラグを付与します
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
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {/* 新規ルールの追加フォーム */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1">
              <Plus className="w-3.5 h-3.5 text-emerald-600" /> ルールを追加
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs">
              <div className="sm:col-span-3">
                <label className="block text-slate-500 mb-1">対象の項目</label>
                <select
                  value={newRule.targetField}
                  onChange={(e) => setNewRule({ ...newRule, targetField: e.target.value as any })}
                  className="w-full py-1.5 px-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="content">内容・店舗名</option>
                  <option value="majorCategory">大項目</option>
                  <option value="mediumCategory">中項目</option>
                  <option value="institution">金融機関</option>
                  <option value="memo">メモ</option>
                </select>
              </div>

              <div className="sm:col-span-3">
                <label className="block text-slate-500 mb-1">条件</label>
                <select
                  value={newRule.matchType}
                  onChange={(e) => setNewRule({ ...newRule, matchType: e.target.value as any })}
                  className="w-full py-1.5 px-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="contains">を含む</option>
                  <option value="equals">と完全に一致</option>
                  <option value="startsWith">から始まる</option>
                  <option value="endsWith">で終わる</option>
                </select>
              </div>

              <div className="sm:col-span-3">
                <label className="block text-slate-500 mb-1">キーワード</label>
                <input
                  type="text"
                  placeholder="例: JR, タクシー"
                  value={newRule.keyword}
                  onChange={(e) => setNewRule({ ...newRule, keyword: e.target.value })}
                  className="w-full py-1.5 px-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-slate-500 mb-1">付与するフラグ</label>
                <select
                  value={newRule.applyFlag}
                  onChange={(e) => setNewRule({ ...newRule, applyFlag: e.target.value })}
                  className="w-full py-1.5 px-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold text-indigo-700"
                >
                  {customFlags
                    .filter((f) => f !== '未設定')
                    .map((flag) => (
                      <option key={flag} value={flag}>
                        {flag}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={handleAddRule}
                disabled={!newRule.keyword.trim()}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-medium text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                ルールを保存
              </button>
            </div>
          </div>

          {/* 登録済みルール一覧 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-700">登録済みルール一覧 ({localRules.length}件)</h3>
              
              {/* エクスポート・インポートボタン */}
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleImportFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2.5 py-1 text-xs font-medium text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                  title="JSONファイルからルールを復元"
                >
                  <Upload className="w-3 h-3 text-slate-500" />
                  インポート
                </button>
                <button
                  type="button"
                  onClick={handleExportRules}
                  disabled={localRules.length === 0}
                  className="px-2.5 py-1 text-xs font-medium text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-40 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                  title="現在のルールをJSONファイルでダウンロード"
                >
                  <Download className="w-3 h-3 text-slate-500" />
                  エクスポート
                </button>
              </div>
            </div>

            {localRules.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center border border-dashed border-slate-200 rounded-xl">
                登録されているルールはありません。上から追加するか、インポートしてください。
              </p>
            ) : (
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {localRules.map((rule) => (
                  <div
                    key={rule.id}
                    className={`p-2.5 rounded-lg border text-xs flex items-center justify-between transition-colors ${
                      rule.enabled
                        ? 'bg-white border-slate-200'
                        : 'bg-slate-50 border-slate-200 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleToggleEnable(rule.id)}
                        className="text-slate-400 hover:text-slate-600 cursor-pointer"
                        title={rule.enabled ? '無効にする' : '有効にする'}
                      >
                        {rule.enabled ? (
                          <ToggleRight className="w-5 h-5 text-emerald-600" />
                        ) : (
                          <ToggleLeft className="w-5 h-5 text-slate-300" />
                        )}
                      </button>
                      <div>
                        <span className="font-semibold text-slate-800">
                          {rule.targetField === 'content'
                            ? '内容'
                            : rule.targetField === 'majorCategory'
                            ? '大項目'
                            : rule.targetField === 'mediumCategory'
                            ? '中項目'
                            : rule.targetField === 'institution'
                            ? '金融機関'
                            : 'メモ'}
                        </span>
                        <span className="text-slate-400 mx-1">が</span>
                        <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                          "{rule.keyword}"
                        </span>
                        <span className="text-slate-400 mx-1">
                          {rule.matchType === 'contains'
                            ? 'を含む'
                            : rule.matchType === 'equals'
                            ? 'と一致'
                            : rule.matchType === 'startsWith'
                            ? 'で始まる'
                            : 'で終わる'}
                          とき
                        </span>
                        <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                          → {rule.applyFlag}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteRule(rule.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                      title="削除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* フッター（今すぐ全データに適用） */}
        <div className="p-4 sm:p-6 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-4">
          <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={overwrite}
              onChange={(e) => setOverwrite(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500"
            />
            すでにフラグが設定されている行も上書きする
          </label>

          <div className="flex items-center gap-2">
            {(showAppliedToast || messageToast) && (
              <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1 animate-fadeIn">
                <Check className="w-4 h-4" /> {messageToast || '適用しました！'}
              </span>
            )}
            <button
              type="button"
              onClick={handleApplyNow}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Sparkles className="w-4 h-4" />
              明細データに適用する
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
