import { useState, useEffect, useMemo, useRef } from 'react';
import { MoneyForwardRecord, AppSettings, AutoRule, FilterOptions } from './types';
import {
  loadSettings,
  saveSettings,
  loadRules,
  saveRules,
  loadStoredData,
  saveStoredData,
  clearStoredData,
} from './utils/storage';
import { applyRulesToRecords } from './utils/rulesEngine';
import { exportRecordsToCsv } from './utils/csvParser';
import { saveToGoogleSheetsViaGas } from './utils/gasApi';
import { filterRecordsByPeriod, getAvailablePeriods } from './utils/dateUtils';
import { applyFiltersToRecords, DEFAULT_FILTERS } from './utils/filterUtils';

import { Header } from './components/Header';
import { FileUploader } from './components/FileUploader';
import { PeriodSelector } from './components/PeriodSelector';
import { SummaryCards } from './components/SummaryCards';
import { CategoryChart } from './components/CategoryChart';
import { TransactionTable } from './components/TransactionTable';
import { SettingsModal } from './components/SettingsModal';
import { RuleModal } from './components/RuleModal';
import { ShortcutHelpModal } from './components/ShortcutHelpModal';
import { CheckCircle, AlertTriangle } from 'lucide-react';

export function App() {
  // 設定 & ルール
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [rules, setRules] = useState<AutoRule[]>(loadRules);

  // 明細データ
  const [records, setRecords] = useState<MoneyForwardRecord[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rawCsvContent, setRawCsvContent] = useState<string>('');

  // 期間フィルタ ('ALL' | 'YEAR:2026' | 'MONTH:2026-08')
  const [selectedPeriod, setSelectedPeriod] = useState<string>('ALL');

  // テーブル内フィルタ（キーワード検索、フラグ、大項目、振替非表示、支出のみ）
  const [filters, setFilters] = useState<FilterOptions>(DEFAULT_FILTERS);

  // モーダル開閉
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [isShortcutHelpOpen, setIsShortcutHelpOpen] = useState(false);

  // 通信状態
  const [isSaving, setIsSaving] = useState(false);

  // 初回マウントフラグ（初回ロード時の上書き保存防止）
  const isInitialMount = useRef(true);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // トースト通知
  const [toast, setToast] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // 初回ロード（設定・ルール・前回作業データの復元）
  useEffect(() => {
    setSettings(loadSettings());
    setRules(loadRules());

    const savedSession = loadStoredData();
    if (savedSession && savedSession.records && savedSession.records.length > 0) {
      setRecords(savedSession.records);
      setFileName(savedSession.fileName);
      setRawCsvContent(savedSession.rawCsvContent || '');
      if (savedSession.selectedPeriod) {
        setSelectedPeriod(savedSession.selectedPeriod);
      }
      showToast('info', `前回の作業データ（${savedSession.records.length} 件）をブラウザから復元しました`);
    }
  }, []);

  // データ変更時にローカルストレージに自動保存
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (records.length > 0) {
      saveStoredData({
        records,
        fileName,
        rawCsvContent,
        selectedPeriod,
      });
    } else {
      clearStoredData();
    }
  }, [records, fileName, rawCsvContent, selectedPeriod]);

  // グローバルショートカット ([ / ] で月移動, ? でヘルプ)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInputActive =
        activeEl?.tagName === 'INPUT' ||
        activeEl?.tagName === 'SELECT' ||
        activeEl?.tagName === 'TEXTAREA';

      if (isInputActive) return;

      // ? でヘルプ
      if (e.key === '?') {
        e.preventDefault();
        setIsShortcutHelpOpen((prev) => !prev);
        return;
      }

      // [ / ] で前月 / 翌月 切り替え
      if (records.length > 0) {
        const periodOptions = getAvailablePeriods(records);
        const monthOptions = periodOptions.filter((opt) => opt.value.startsWith('MONTH:'));
        if (monthOptions.length > 1) {
          const currentIndex = monthOptions.findIndex((opt) => opt.value === selectedPeriod);
          if (e.key === '[') {
            e.preventDefault();
            if (currentIndex < monthOptions.length - 1) {
              setSelectedPeriod(monthOptions[currentIndex + 1].value);
            } else if (currentIndex === -1) {
              setSelectedPeriod(monthOptions[0].value);
            }
          } else if (e.key === ']') {
            e.preventDefault();
            if (currentIndex > 0) {
              setSelectedPeriod(monthOptions[currentIndex - 1].value);
            }
          }
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [records, selectedPeriod]);

  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // CSV読み込みハンドラ
  const handleDataLoaded = (
    loadedRecords: MoneyForwardRecord[],
    uploadedFileName: string,
    rawCsv: string
  ) => {
    // 読み込み時に有効な自動付与ルールを適用
    const { updatedRecords, modifiedCount } = applyRulesToRecords(loadedRecords, rules, false);

    setRecords(updatedRecords);
    setFileName(uploadedFileName);
    setRawCsvContent(rawCsv);
    setSelectedPeriod('ALL');
    setFilters(DEFAULT_FILTERS);

    if (modifiedCount > 0) {
      showToast('info', `${loadedRecords.length} 件の明細を読込、${modifiedCount} 件に自動フラグを付与しました`);
    } else {
      showToast('success', `${loadedRecords.length} 件の明細を読み込みました`);
    }
  };

  // 1. 期間で絞り込まれたレコード
  const periodFilteredRecords = useMemo(() => {
    return filterRecordsByPeriod(records, selectedPeriod);
  }, [records, selectedPeriod]);

  // 2. 期間 ＋ テーブル側フィルタ（検索・フラグ・大項目・支出のみ等）適用後の最終レコード
  const fullyFilteredRecords = useMemo(() => {
    return applyFiltersToRecords(periodFilteredRecords, filters);
  }, [periodFilteredRecords, filters]);

  // 明細の個別更新
  const handleUpdateRecord = (id: string, updates: Partial<MoneyForwardRecord>) => {
    setRecords((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...updates } : r))
    );
  };

  // 一括フラグ更新
  const handleBatchUpdateFlag = (selectedIds: string[], newFlag: string) => {
    const idSet = new Set(selectedIds);
    setRecords((prev) =>
      prev.map((r) => (idSet.has(r.id) ? { ...r, customFlag: newFlag } : r))
    );
    showToast('success', `${selectedIds.length} 件のフラグを「${newFlag}」に変更しました`);
  };

  // 一括計算対象切り替え
  const handleBatchToggleCalcTarget = (selectedIds: string[], target: boolean) => {
    const idSet = new Set(selectedIds);
    setRecords((prev) =>
      prev.map((r) => (idSet.has(r.id) ? { ...r, calculationTarget: target } : r))
    );
    showToast(
      'success',
      `${selectedIds.length} 件を${target ? '計算対象' : '計算対象外'}に設定しました`
    );
  };

  // ルール適用（モーダルから）
  const handleApplyRules = (rulesToApply: AutoRule[], overwriteExisting: boolean) => {
    const { updatedRecords, modifiedCount } = applyRulesToRecords(
      records,
      rulesToApply,
      overwriteExisting
    );
    setRecords(updatedRecords);
    showToast('success', `${modifiedCount} 件の明細にルールを適用しました`);
  };

  // 設定保存
  const handleSaveSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
    showToast('success', '設定を保存しました');
  };

  // ルール保存
  const handleSaveRules = (newRules: AutoRule[]) => {
    setRules(newRules);
    saveRules(newRules);
  };

  // CSVエクスポート（現在絞り込まれている状態を出力）
  const handleExportCsv = () => {
    if (fullyFilteredRecords.length === 0) return;
    const periodSuffix = selectedPeriod !== 'ALL' ? `_${selectedPeriod.replace(':', '_')}` : '';
    const outName = fileName
      ? fileName.replace('.csv', `${periodSuffix}_processed.csv`)
      : `mf_processed${periodSuffix}_${new Date().toISOString().slice(0, 10)}.csv`;
    exportRecordsToCsv(fullyFilteredRecords, outName);
    showToast('success', `${fullyFilteredRecords.length} 件のCSVファイルをダウンロードしました`);
  };

  // Googleスプレッドシートへ保存
  const handleSaveToGas = async () => {
    if (!settings.gasWebAppUrl) {
      setIsSettingsOpen(true);
      showToast('error', '右上の設定アイコンからGAS WebアプリURLを登録してください');
      return;
    }

    if (fullyFilteredRecords.length === 0) {
      showToast('error', '保存するデータがありません');
      return;
    }

    setIsSaving(true);
    try {
      const result = await saveToGoogleSheetsViaGas({
        gasWebAppUrl: settings.gasWebAppUrl,
        googleDriveFolderId: settings.googleDriveFolderId,
        records: fullyFilteredRecords,
        fileName: fileName || undefined,
        rawCsvContent: rawCsvContent || undefined,
      });

      if (result.success) {
        showToast('success', `スプレッドシートに ${result.count ?? fullyFilteredRecords.length} 件のデータを保存しました！`);
      } else {
        showToast('error', result.message || '保存に失敗しました');
      }
    } catch (err: any) {
      showToast('error', `エラー: ${err.message || err}`);
    } finally {
      setIsSaving(false);
    }
  };

  // リセット
  const handleReset = () => {
    if (confirm('現在の編集内容をクリアして別のCSVを読み込みますか？')) {
      setRecords([]);
      setFileName(null);
      setRawCsvContent('');
      setSelectedPeriod('ALL');
      setFilters(DEFAULT_FILTERS);
      clearStoredData();
      showToast('info', 'ブラウザ保存データをクリアしました');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* ヘッダー */}
      <Header
        fileName={fileName}
        recordCount={records.length}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenRules={() => setIsRulesOpen(true)}
        onExportCsv={handleExportCsv}
        onSaveToGas={handleSaveToGas}
        onReset={handleReset}
        isSaving={isSaving}
        hasGasUrl={Boolean(settings.gasWebAppUrl)}
      />

      {/* メインコンテンツ */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {records.length === 0 ? (
          <FileUploader onDataLoaded={handleDataLoaded} />
        ) : (
          <div className="space-y-6 animate-fadeIn">
            {/* 年月・期間セレクター */}
            <PeriodSelector
              records={records}
              selectedPeriod={selectedPeriod}
              onSelectPeriod={setSelectedPeriod}
              filteredCount={fullyFilteredRecords.length}
            />

            {/* サマリーカード（現在のフィルタ状態に連動） */}
            <SummaryCards records={fullyFilteredRecords} customFlags={settings.customFlags} />

            {/* カテゴリ & フラグ分析チャート（現在のフィルタ状態に連動） */}
            <CategoryChart records={fullyFilteredRecords} />

            {/* メイン明細テーブル */}
            <TransactionTable
              records={fullyFilteredRecords}
              allPeriodRecords={periodFilteredRecords}
              filters={filters}
              onFiltersChange={setFilters}
              customFlags={settings.customFlags}
              onUpdateRecord={handleUpdateRecord}
              onBatchUpdateFlag={handleBatchUpdateFlag}
              onBatchToggleCalcTarget={handleBatchToggleCalcTarget}
              onOpenShortcutHelp={() => setIsShortcutHelpOpen(true)}
              searchRef={searchInputRef}
            />
          </div>
        )}
      </main>

      {/* モーダル群 */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={handleSaveSettings}
      />

      <RuleModal
        isOpen={isRulesOpen}
        onClose={() => setIsRulesOpen(false)}
        rules={rules}
        customFlags={settings.customFlags}
        onSaveRules={handleSaveRules}
        onApplyRules={handleApplyRules}
      />

      <ShortcutHelpModal
        isOpen={isShortcutHelpOpen}
        onClose={() => setIsShortcutHelpOpen(false)}
      />

      {/* トースト通知 */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-slideUp">
          <div
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-xs font-medium border ${
              toast.type === 'success'
                ? 'bg-emerald-900 text-white border-emerald-800'
                : toast.type === 'error'
                ? 'bg-rose-900 text-white border-rose-800'
                : 'bg-slate-900 text-white border-slate-800'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : toast.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            ) : null}
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
