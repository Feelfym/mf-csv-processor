import React, { useState, useEffect, useMemo, useRef } from 'react';
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
import {
  exportRecordsToCsv,
  decodeCsvBuffer,
  parseMoneyForwardCsv,
  mergeAndDeduplicateRecords,
} from './utils/csvParser';
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
import { ImportModal } from './components/ImportModal';
import { NotebookLmExportModal } from './components/NotebookLmExportModal';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import { isAnyModalOpen } from './hooks/useModal';

/** 履歴の最大保持数 */
const MAX_HISTORY = 50;
/** この時間内の同一キー操作（メモ入力など）は1つの履歴にまとめる */
const COALESCE_MS = 1500;

interface HistoryEntry {
  records: MoneyForwardRecord[];
  fileName: string | null;
  label: string;
  coalesceKey?: string;
  time: number;
}

interface ToastAction {
  label: string;
  onClick: () => void;
}

export function App() {
  // 設定 & ルール
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [rules, setRules] = useState<AutoRule[]>(loadRules);

  // 明細データ
  const [records, setRecords] = useState<MoneyForwardRecord[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rawCsvContent, setRawCsvContent] = useState<string>('');

  // 取り込み確認モーダル用の一時データ
  const [pendingImport, setPendingImport] = useState<{
    rawRecords: MoneyForwardRecord[];
    fileName: string;
    rawCsv: string;
  } | null>(null);

  // 期間フィルタ ('ALL' | 'YEAR:2026' | 'MONTH:2026-08')
  const [selectedPeriod, setSelectedPeriod] = useState<string>('ALL');

  // テーブル内フィルタ（キーワード検索、フラグ、大項目、振替非表示、支出のみ）
  const [filters, setFilters] = useState<FilterOptions>(DEFAULT_FILTERS);

  // モーダル開閉
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [isShortcutHelpOpen, setIsShortcutHelpOpen] = useState(false);
  const [isNotebookLmModalOpen, setIsNotebookLmModalOpen] = useState(false);

  // 通信状態
  const [isSaving, setIsSaving] = useState(false);

  // 初回マウントフラグ（初回ロード時の上書き保存防止）
  const isInitialMount = useRef(true);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const hiddenFileInputRef = useRef<HTMLInputElement>(null);

  // トースト通知
  const [toast, setToast] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
    action?: ToastAction;
  } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ===== 操作履歴（元に戻す / やり直し） =====
  // 明細は常にイミュータブルに更新しているため、配列参照を積むだけで済む（メモリ負荷は小さい）
  const recordsRef = useRef(records);
  recordsRef.current = records;
  const fileNameRef = useRef(fileName);
  fileNameRef.current = fileName;
  const undoStackRef = useRef<HistoryEntry[]>([]);
  const redoStackRef = useRef<HistoryEntry[]>([]);
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });

  const syncHistoryState = () =>
    setHistoryState({
      canUndo: undoStackRef.current.length > 0,
      canRedo: redoStackRef.current.length > 0,
    });

  /**
   * 履歴に積みながら明細を更新する
   * @param coalesceKey 同じキーの連続操作（メモ入力など）を1つの履歴にまとめる
   */
  const commitRecords = (
    next: MoneyForwardRecord[] | ((prev: MoneyForwardRecord[]) => MoneyForwardRecord[]),
    label: string,
    options: { coalesceKey?: string; fileName?: string | null } = {}
  ) => {
    const prev = recordsRef.current;
    const nextRecords = typeof next === 'function' ? next(prev) : next;
    if (nextRecords === prev && options.fileName === undefined) return;

    const now = Date.now();
    const last = undoStackRef.current[undoStackRef.current.length - 1];
    const canCoalesce =
      options.coalesceKey !== undefined &&
      last !== undefined &&
      last.coalesceKey === options.coalesceKey &&
      now - last.time < COALESCE_MS &&
      redoStackRef.current.length === 0;

    if (canCoalesce && last) {
      last.time = now;
    } else {
      undoStackRef.current.push({
        records: prev,
        fileName: fileNameRef.current,
        label,
        coalesceKey: options.coalesceKey,
        time: now,
      });
      if (undoStackRef.current.length > MAX_HISTORY) undoStackRef.current.shift();
    }
    redoStackRef.current = [];

    recordsRef.current = nextRecords;
    setRecords(nextRecords);
    if (options.fileName !== undefined) {
      fileNameRef.current = options.fileName;
      setFileName(options.fileName);
    }
    syncHistoryState();
  };

  const restoreSnapshot = (entry: HistoryEntry) => {
    recordsRef.current = entry.records;
    fileNameRef.current = entry.fileName;
    setRecords(entry.records);
    setFileName(entry.fileName);
  };

  const handleUndo = () => {
    const entry = undoStackRef.current.pop();
    if (!entry) {
      showToast('info', '元に戻せる操作はありません');
      return;
    }
    redoStackRef.current.push({
      records: recordsRef.current,
      fileName: fileNameRef.current,
      label: entry.label,
      time: Date.now(),
    });
    restoreSnapshot(entry);
    syncHistoryState();
    showToast('info', `「${entry.label}」を元に戻しました`, { label: 'やり直す', onClick: handleRedo });
  };

  const handleRedo = () => {
    const entry = redoStackRef.current.pop();
    if (!entry) {
      showToast('info', 'やり直せる操作はありません');
      return;
    }
    undoStackRef.current.push({
      records: recordsRef.current,
      fileName: fileNameRef.current,
      label: entry.label,
      time: Date.now(),
    });
    restoreSnapshot(entry);
    syncHistoryState();
    showToast('info', `「${entry.label}」をやり直しました`, { label: '元に戻す', onClick: handleUndo });
  };

  /** 履歴に積んだ操作のトーストに付ける「元に戻す」ボタン */
  const undoAction: ToastAction = { label: '元に戻す', onClick: () => handleUndo() };

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

  // グローバルショートカット ([ / ] で月移動, ? でヘルプ, Cmd+Z で元に戻す)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // モーダル表示中はモーダル側（ESC等）に任せる
      if (isAnyModalOpen()) return;

      const activeEl = document.activeElement as HTMLElement | null;

      // 元に戻す / やり直し（テキスト入力中はブラウザ標準の入力Undoを優先）
      if ((e.metaKey || e.ctrlKey) && !e.altKey) {
        const key = e.key.toLowerCase();
        const isTextEditing =
          activeEl?.tagName === 'TEXTAREA' ||
          (activeEl instanceof HTMLInputElement &&
            !['checkbox', 'radio', 'button', 'file'].includes(activeEl.type));
        if (!isTextEditing && (key === 'z' || key === 'y')) {
          e.preventDefault();
          if (key === 'y' || e.shiftKey) {
            handleRedo();
          } else {
            handleUndo();
          }
          return;
        }
      }

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

  const showToast = (
    type: 'success' | 'error' | 'info',
    message: string,
    action?: ToastAction
  ) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ type, message, action });
    // 「元に戻す」付きのトーストは押す時間を確保するため長めに表示
    toastTimerRef.current = setTimeout(() => setToast(null), action ? 7000 : 4000);
  };

  // CSVファイル解析ハンドラ（FileUploader または Headerの追加ボタンから）
  const handleDataLoaded = (
    loadedRecords: MoneyForwardRecord[],
    uploadedFileName: string,
    rawCsv: string
  ) => {
    setPendingImport({
      rawRecords: loadedRecords,
      fileName: uploadedFileName,
      rawCsv,
    });
  };

  // 取り込みモーダルで確定した時の処理
  const handleConfirmImport = (
    selectedRecords: MoneyForwardRecord[],
    mode: 'replace' | 'append'
  ) => {
    if (!pendingImport) return;

    if (mode === 'replace' || records.length === 0) {
      // 1. 新規置き換えモード
      const { updatedRecords, modifiedCount } = applyRulesToRecords(selectedRecords, rules, false);
      commitRecords(updatedRecords, 'CSVの読み込み', { fileName: pendingImport.fileName });
      setRawCsvContent(pendingImport.rawCsv);
      setSelectedPeriod('ALL');
      setFilters(DEFAULT_FILTERS);

      if (modifiedCount > 0) {
        showToast('success', `${selectedRecords.length} 件を読込、${modifiedCount} 件に自動フラグを付与しました`, undoAction);
      } else {
        showToast('success', `${selectedRecords.length} 件の明細を読み込みました`, undoAction);
      }
    } else {
      // 2. 既存データに追加モード（重複排除付き）
      const { updatedRecords: incomingWithRules } = applyRulesToRecords(selectedRecords, rules, false);
      const { mergedRecords, addedCount, duplicateCount } = mergeAndDeduplicateRecords(
        records,
        incomingWithRules
      );

      commitRecords(mergedRecords, 'CSVの追加取り込み', {
        fileName: `${fileName || 'merged'} + ${pendingImport.fileName}`,
      });
      setRawCsvContent((prev) => `${prev}\n${pendingImport.rawCsv}`);

      showToast(
        'success',
        `${addedCount} 件の明細を新たに追加しました${
          duplicateCount > 0 ? ` (${duplicateCount} 件の重複を自動スキップ)` : ''
        }`,
        undoAction
      );
    }

    setPendingImport(null);
  };

  // 全データ一括バックアップからの完全復元ハンドラ
  const handleRestoreFullBackup = (backupData: {
    records: MoneyForwardRecord[];
    rules: AutoRule[];
    settings: AppSettings;
    fileName: string | null;
    selectedPeriod: string;
  }) => {
    commitRecords(backupData.records, 'バックアップからの復元', { fileName: backupData.fileName });
    setRules(backupData.rules);
    setSettings(backupData.settings);
    setSelectedPeriod(backupData.selectedPeriod || 'ALL');
    setFilters(DEFAULT_FILTERS);

    // ストレージにも即時反映
    saveStoredData({
      records: backupData.records,
      fileName: backupData.fileName,
      rawCsvContent: '',
      selectedPeriod: backupData.selectedPeriod,
    });
    saveRules(backupData.rules);
    saveSettings(backupData.settings);

    showToast('success', `全データ（${backupData.records.length} 件の明細 + ルール + 設定）を完全復元しました！（ルール・設定は元に戻せません）`, undoAction);
  };

  // 1. 期間で絞り込まれたレコード
  const periodFilteredRecords = useMemo(() => {
    return filterRecordsByPeriod(records, selectedPeriod);
  }, [records, selectedPeriod]);

  // 2. 期間 ＋ テーブル側フィルタ（検索・フラグ・大項目・支出のみ等）適用後の最終レコード
  const fullyFilteredRecords = useMemo(() => {
    return applyFiltersToRecords(periodFilteredRecords, filters);
  }, [periodFilteredRecords, filters]);

  // 現在の期間ラベル
  const currentPeriodLabel = useMemo(() => {
    const periodOptions = getAvailablePeriods(records);
    const found = periodOptions.find((p) => p.value === selectedPeriod);
    return found ? found.label : '全期間';
  }, [records, selectedPeriod]);

  // 明細の個別更新
  const handleUpdateRecord = (id: string, updates: Partial<MoneyForwardRecord>) => {
    const label =
      'customMemo' in updates
        ? 'メモの編集'
        : 'customFlag' in updates
        ? 'フラグの変更'
        : 'calculationTarget' in updates
        ? '計算対象の切り替え'
        : '明細の編集';
    commitRecords(
      (prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)),
      label,
      // メモは1文字ごとに更新されるため、同じ行の連続入力は1つの履歴にまとめる
      'customMemo' in updates ? { coalesceKey: `memo:${id}` } : {}
    );
  };

  // 一括フラグ更新
  const handleBatchUpdateFlag = (selectedIds: string[], newFlag: string) => {
    const idSet = new Set(selectedIds);
    commitRecords(
      (prev) => prev.map((r) => (idSet.has(r.id) ? { ...r, customFlag: newFlag } : r)),
      `${selectedIds.length} 件のフラグ変更`
    );
    showToast('success', `${selectedIds.length} 件のフラグを「${newFlag}」に変更しました`, undoAction);
  };

  // 一括計算対象切り替え
  const handleBatchToggleCalcTarget = (selectedIds: string[], target: boolean) => {
    const idSet = new Set(selectedIds);
    commitRecords(
      (prev) => prev.map((r) => (idSet.has(r.id) ? { ...r, calculationTarget: target } : r)),
      `${selectedIds.length} 件の計算対象切り替え`
    );
    showToast(
      'success',
      `${selectedIds.length} 件を${target ? '計算対象' : '計算対象外'}に設定しました`,
      undoAction
    );
  };

  // 選択中/表示中の「清算対象」を一括で「清算済み」に変更
  const handleMarkAsSettled = (_count?: number, sum?: number) => {
    const targetRecords = fullyFilteredRecords.filter(
      (r) => r.customFlag === '清算対象' || r.customFlag === '精算対象'
    );

    if (targetRecords.length === 0) {
      showToast('info', '清算対象の明細がありません');
      return;
    }

    const targetIds = new Set(targetRecords.map((r) => r.id));
    const totalAmount =
      sum ??
      targetRecords.reduce(
        (acc, r) => acc + (r.amount < 0 ? Math.abs(r.amount) : -r.amount),
        0
      );

    const periodText = selectedPeriod !== 'ALL' ? `${currentPeriodLabel}の` : '表示中の';
    if (
      !confirm(
        `【清算完了の確認】\n\n・対象件数: ${targetRecords.length} 件\n・対象金額（実質純額）: ¥${totalAmount.toLocaleString()}\n\n${periodText}「清算対象」データをすべて「清算済み」に変更しますか？\n※当月分の清算を完了とし、次回集計から除外します。`
      )
    ) {
      return;
    }

    commitRecords(
      (prev) => prev.map((r) => (targetIds.has(r.id) ? { ...r, customFlag: '清算済み' } : r)),
      `${targetRecords.length} 件の清算済み変更`
    );

    showToast('success', `${targetRecords.length} 件の明細を「清算済み」に変更しました！`, undoAction);
  };

  // 選択中の期間（月/年）を一括削除
  const handleDeletePeriod = (period: string, label: string, count: number) => {
    if (!confirm(`【確認】\n${label} のデータ（${count} 件）を一括削除してもよろしいですか？\n※削除後に Cmd+Z（Ctrl+Z）で元に戻せます。`)) {
      return;
    }

    let remainingRecords: MoneyForwardRecord[] = [];
    if (period.startsWith('MONTH:')) {
      const targetMonth = period.replace('MONTH:', '');
      remainingRecords = records.filter((r) => {
        const match = r.date.match(/^(\d{4})[/-](\d{1,2})/);
        if (!match) return true;
        const ym = `${match[1]}-${match[2].padStart(2, '0')}`;
        return ym !== targetMonth;
      });
    } else if (period.startsWith('YEAR:')) {
      const targetYear = period.replace('YEAR:', '');
      remainingRecords = records.filter((r) => {
        const match = r.date.match(/^(\d{4})/);
        if (!match) return true;
        return match[1] !== targetYear;
      });
    }

    commitRecords(remainingRecords, `${label} のデータ削除`);
    setSelectedPeriod('ALL');
    showToast(
      'info',
      `${label} のデータ（${count} 件）を削除しました（残り: ${remainingRecords.length} 件）`,
      undoAction
    );
  };

  // ルール適用（モーダルから）
  const handleApplyRules = (rulesToApply: AutoRule[], overwriteExisting: boolean) => {
    const { updatedRecords, modifiedCount } = applyRulesToRecords(
      records,
      rulesToApply,
      overwriteExisting
    );
    commitRecords(updatedRecords, 'ルールの適用');
    showToast('success', `${modifiedCount} 件の明細にルールを適用しました`, undoAction);
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
    if (confirm('現在の編集内容をクリアして最初からやり直しますか？\n※クリア後に Cmd+Z（Ctrl+Z）で元に戻せます。')) {
      commitRecords([], 'データのクリア', { fileName: null });
      setSelectedPeriod('ALL');
      setFilters(DEFAULT_FILTERS);
      clearStoredData();
      showToast('info', '作業データをクリアしました', undoAction);
    }
  };

  // ヘッダーからの追加ファイル選択ハンドラ
  const handleHeaderFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const decoded = decodeCsvBuffer(buffer);
      const parsed = parseMoneyForwardCsv(decoded);
      if (parsed.length === 0) {
        showToast('error', 'CSVから明細データを取得できませんでした');
        return;
      }
      handleDataLoaded(parsed, file.name, decoded);
    } catch (err: any) {
      showToast('error', `CSVの読み込みに失敗しました: ${err.message}`);
    } finally {
      if (hiddenFileInputRef.current) hiddenFileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* 隠しファイル入力（ヘッダーからのCSV追加取込用） */}
      <input
        ref={hiddenFileInputRef}
        type="file"
        accept=".csv,text/csv"
        onChange={handleHeaderFileInputChange}
        className="hidden"
      />

      {/* ヘッダー */}
      <Header
        fileName={fileName}
        recordCount={records.length}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenRules={() => setIsRulesOpen(true)}
        onExportCsv={handleExportCsv}
        onSaveToGas={handleSaveToGas}
        onReset={handleReset}
        onOpenImportCsv={() => hiddenFileInputRef.current?.click()}
        onOpenNotebookLmExport={() => setIsNotebookLmModalOpen(true)}
        isSaving={isSaving}
        hasGasUrl={Boolean(settings.gasWebAppUrl)}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={historyState.canUndo}
        canRedo={historyState.canRedo}
      />

      {/* メインコンテンツ */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {records.length === 0 ? (
          <FileUploader
            onDataLoaded={handleDataLoaded}
            onRestoreBackup={handleRestoreFullBackup}
          />
        ) : (
          <div className="space-y-6 animate-fadeIn">
            {/* 年月・期間セレクター */}
            <PeriodSelector
              records={records}
              selectedPeriod={selectedPeriod}
              onSelectPeriod={setSelectedPeriod}
              filteredCount={fullyFilteredRecords.length}
              onDeletePeriod={handleDeletePeriod}
            />

            {/* サマリーカード（現在のフィルタ状態に連動） */}
            <SummaryCards
              records={fullyFilteredRecords}
              customFlags={settings.customFlags}
              onMarkAsSettled={handleMarkAsSettled}
            />

            {/* カテゴリ & フラグ分析チャート（現在のフィルタ状態に連動 & クリックで絞り込み） */}
            <CategoryChart
              records={fullyFilteredRecords}
              allPeriodRecords={periodFilteredRecords}
              filters={filters}
              onFiltersChange={setFilters}
            />

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
        currentRecords={records}
        currentRules={rules}
        currentFileName={fileName}
        currentSelectedPeriod={selectedPeriod}
        onRestoreFullBackup={handleRestoreFullBackup}
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

      {/* CSV取り込み設定モーダル（月選択 & 重複排除追加） */}
      {pendingImport && (
        <ImportModal
          isOpen={Boolean(pendingImport)}
          onClose={() => setPendingImport(null)}
          rawRecords={pendingImport.rawRecords}
          fileName={pendingImport.fileName}
          existingCount={records.length}
          onConfirmImport={handleConfirmImport}
        />
      )}

      {/* NotebookLM用レポート搬出モーダル */}
      {isNotebookLmModalOpen && (
        <NotebookLmExportModal
          isOpen={isNotebookLmModalOpen}
          onClose={() => setIsNotebookLmModalOpen(false)}
          records={fullyFilteredRecords}
          periodLabel={currentPeriodLabel}
          customFlags={settings.customFlags}
          notebookLmUrl={settings.notebookLmUrl}
          onOpenSettings={() => {
            setIsNotebookLmModalOpen(false);
            setIsSettingsOpen(true);
          }}
          onMarkAsSettled={handleMarkAsSettled}
        />
      )}

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
            {toast.action && (
              <button
                type="button"
                onClick={() => {
                  const action = toast.action;
                  setToast(null);
                  action?.onClick();
                }}
                className="ml-2 px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 font-bold text-white transition-colors cursor-pointer whitespace-nowrap"
              >
                {toast.action.label}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
