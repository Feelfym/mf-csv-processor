import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, CheckCircle2, AlertCircle, Database } from 'lucide-react';
import { decodeCsvBuffer, parseMoneyForwardCsv } from '../utils/csvParser';
import { MoneyForwardRecord, AppSettings, AutoRule } from '../types';

interface FileUploaderProps {
  onDataLoaded: (records: MoneyForwardRecord[], fileName: string, rawCsv: string) => void;
  onRestoreBackup?: (backupData: {
    records: MoneyForwardRecord[];
    rules: AutoRule[];
    settings: AppSettings;
    fileName: string | null;
    selectedPeriod: string;
  }) => void;
}

export const FileUploader: React.FC<FileUploaderProps> = ({ onDataLoaded, onRestoreBackup }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backupFileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    if (!file.name.endsWith('.csv') && !file.type.includes('csv') && !file.type.includes('text')) {
      setError('CSVファイル（.csv）を選択してください。');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const decodedText = decodeCsvBuffer(arrayBuffer);
      const records = parseMoneyForwardCsv(decodedText);

      if (records.length === 0) {
        setError('CSVから明細データを取得できませんでした。マネーフォワードのCSVフォーマットか確認してください。');
        setIsLoading(false);
        return;
      }

      onDataLoaded(records, file.name, decodedText);
    } catch (err: any) {
      console.error('File parsing error:', err);
      setError(`CSVの読み込み中にエラーが発生しました: ${err.message || err}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  // バックアップJSON復元
  const handleBackupFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!parsed || !Array.isArray(parsed.records)) {
          throw new Error('有効なバックアップJSONファイルではありません（recordsが見つかりません）');
        }

        if (onRestoreBackup) {
          onRestoreBackup({
            records: parsed.records,
            rules: Array.isArray(parsed.rules) ? parsed.rules : [],
            settings: parsed.settings,
            fileName: parsed.fileName || null,
            selectedPeriod: parsed.selectedPeriod || 'ALL',
          });
        }
      } catch (err: any) {
        alert(`バックアップの復元に失敗しました: ${err.message}`);
      } finally {
        if (backupFileInputRef.current) backupFileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  // サンプルデータ読み込み用
  const loadSampleData = () => {
    const sampleCsv = `計算対象,日付,内容,金額（円）,保有金融機関,大項目,中項目,メモ,振替,ID
1,2026/08/01,セブンイレブン 渋谷店,-850,三井住友カード,食費,食料品,,0,1001
1,2026/08/02,ＪＲ東日本 新宿駅,-1200,Suica,交通費,電車,出張移動,0,1002
1,2026/08/03,スターバックス コーヒー,-680,PayPay,カフェ・喫茶,カフェ,打合せ,0,1003
1,2026/08/05,株式会社〇〇 給与振込,350000,三菱UFJ銀行,収入,給与,,0,1004
1,2026/08/06,日本交通 タクシー,-3400,三井住友カード,交通費,タクシー,会食帰り,0,1005
1,2026/08/08,Amazon.co.jp,-4980,三井住友カード,日用品,消耗品,,0,1006
1,2026/08/10,Uber Eats,-2300,三井住友カード,食費,出前,,0,1007
0,2026/08/12,カード引き落とし,-85400,三菱UFJ銀行,振替,カード引き落とし,,1,1008
1,2026/08/14,居酒屋 魚河岸 新橋店,-12500,三井住友カード,交際費,飲み会,チーム懇親会(後日立替精算),0,1009
1,2026/08/15,TOHOシネマズ 映画鑑賞,-2000,楽天カード,エンタメ,映画,,0,1010`;

    const records = parseMoneyForwardCsv(sampleCsv);
    onDataLoaded(records, 'sample_moneyforward.csv', sampleCsv);
  };

  return (
    <div className="max-w-3xl mx-auto py-12 px-4 sm:px-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-slate-800 tracking-tight sm:text-3xl">
          マネーフォワード CSV を取り込む
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          MFからエクスポートした入出金履歴CSV（Shift-JIS / UTF-8）をドラッグ＆ドロップしてください。
        </p>
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer bg-white shadow-xs ${
          isDragging
            ? 'border-emerald-500 bg-emerald-50/50 scale-[1.01]'
            : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50/60'
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileInputChange}
          accept=".csv,text/csv"
          className="hidden"
        />

        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-xs">
            {isLoading ? (
              <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            ) : (
              <UploadCloud className="w-8 h-8" />
            )}
          </div>

          <div>
            <p className="text-base font-semibold text-slate-700">
              CSVファイルをここにドロップ
            </p>
            <p className="text-xs text-slate-500 mt-1">または クリックしてファイルを選択</p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Shift-JIS自動変換
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> 重複・文字化けなし
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> 完全ブラウザ内処理
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {/* サブアクション（バックアップ復元 & サンプルデータ） */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-xs">
        {onRestoreBackup && (
          <>
            <input
              ref={backupFileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleBackupFileInputChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => backupFileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold rounded-lg border border-indigo-200 transition-colors cursor-pointer"
            >
              <Database className="w-3.5 h-3.5 text-indigo-600" />
              バックアップJSONから復元
            </button>
          </>
        )}

        <button
          type="button"
          onClick={loadSampleData}
          className="inline-flex items-center gap-1.5 text-slate-600 hover:text-slate-900 font-medium py-1.5 px-3 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer border border-slate-200"
        >
          <FileText className="w-3.5 h-3.5 text-slate-500" />
          サンプルデータで動作を試す
        </button>
      </div>
    </div>
  );
};
