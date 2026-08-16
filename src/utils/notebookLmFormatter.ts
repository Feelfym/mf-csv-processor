import { MoneyForwardRecord } from '../types';

interface FormatOptions {
  periodLabel: string;
  customFlags: string[];
  includeDetailTable?: boolean;
}

/**
 * NotebookLM用テキスト（Markdown構造化レポート）を生成
 */
export const generateNotebookLmMarkdown = (
  records: MoneyForwardRecord[],
  options: FormatOptions
): string => {
  const { periodLabel, customFlags, includeDetailTable = true } = options;

  // 1. 基本集計
  const validExpenses = records.filter(
    (r) => r.calculationTarget && !r.transfer && r.amount < 0
  );
  const totalExpense = validExpenses.reduce((sum, r) => sum + Math.abs(r.amount), 0);

  const totalIncome = records
    .filter((r) => r.calculationTarget && !r.transfer && r.amount > 0)
    .reduce((sum, r) => sum + r.amount, 0);

  const netBalance = totalIncome - totalExpense;

  // 2. フラグ別集計（純額計算）
  const flagSummaries = customFlags
    .filter((f) => f !== '未設定')
    .map((flag) => {
      const matching = records.filter((r) => r.customFlag === flag);
      const expenseSum = matching
        .filter((r) => r.amount < 0)
        .reduce((acc, r) => acc + Math.abs(r.amount), 0);
      const discountSum = matching
        .filter((r) => r.amount > 0)
        .reduce((acc, r) => acc + r.amount, 0);
      const netSum = expenseSum - discountSum;
      return { flag, sum: netSum, expenseSum, discountSum, count: matching.length, records: matching };
    })
    .filter((item) => item.count > 0);

  // 3. 大項目別集計
  const categoryMap: { [key: string]: { sum: number; count: number } } = {};
  validExpenses.forEach((r) => {
    const cat = r.majorCategory || '未分類';
    if (!categoryMap[cat]) categoryMap[cat] = { sum: 0, count: 0 };
    categoryMap[cat].sum += Math.abs(r.amount);
    categoryMap[cat].count += 1;
  });

  const categoryList = Object.entries(categoryMap)
    .map(([name, data]) => ({
      name,
      sum: data.sum,
      count: data.count,
      percentage: totalExpense > 0 ? ((data.sum / totalExpense) * 100).toFixed(1) : '0',
    }))
    .sort((a, b) => b.sum - a.sum);

  // 4. 清算対象明細
  const settlementRecords = records.filter(
    (r) => r.customFlag === '清算対象' || r.customFlag === '精算対象'
  );

  // Markdown組み立て
  const lines: string[] = [];

  lines.push(`# ${periodLabel} 家計・収支データレポート`);
  lines.push(`- 出力日時: ${new Date().toLocaleString('ja-JP')}`);
  lines.push(`- 対象明細件数: ${records.length.toLocaleString()} 件`);
  lines.push('');

  lines.push('## 1. 収支サマリー');
  lines.push(`- **総支出（振替除く）**: ¥${totalExpense.toLocaleString()} (${validExpenses.length} 件)`);
  lines.push(`- **総収入（振替除く）**: ¥${totalIncome.toLocaleString()} (${records.filter((r) => r.calculationTarget && !r.transfer && r.amount > 0).length} 件)`);
  lines.push(`- **収支差額**: ${netBalance >= 0 ? `+¥${netBalance.toLocaleString()}` : `-¥${Math.abs(netBalance).toLocaleString()}`}`);
  lines.push('');

  if (flagSummaries.length > 0) {
    lines.push('## 2. 独自フラグ別集計');
    flagSummaries.forEach((fs) => {
      let desc = `- **${fs.flag}**: **¥${fs.sum.toLocaleString()}** (${fs.count} 件)`;
      if (fs.discountSum > 0) {
        desc += ` [内訳: 支出 ¥${fs.expenseSum.toLocaleString()} / 割引・返金 -¥${fs.discountSum.toLocaleString()}]`;
      }
      lines.push(desc);
    });
    lines.push('');
  }

  if (categoryList.length > 0) {
    lines.push('## 3. 大項目別 支出内訳');
    categoryList.forEach((c) => {
      lines.push(`- **${c.name}**: ¥${c.sum.toLocaleString()} (${c.percentage}% / ${c.count}件)`);
    });
    lines.push('');
  }

  if (settlementRecords.length > 0) {
    lines.push(`## 4. 清算対象 明細一覧 (${settlementRecords.length} 件)`);
    lines.push('| 日付 | 内容 / 摘要 | 金額 (円) | 大項目 | メモ / 独自メモ |');
    lines.push('| :--- | :--- | :--- | :--- | :--- |');
    settlementRecords.forEach((r) => {
      const memoText = [r.memo, r.customMemo].filter(Boolean).join(' / ');
      const amountStr = r.amount > 0 ? `+¥${r.amount.toLocaleString()}` : `¥${r.amount.toLocaleString()}`;
      lines.push(`| ${r.date} | ${r.content} | ${amountStr} | ${r.majorCategory} | ${memoText || '-'} |`);
    });
    lines.push('');
  }

  if (includeDetailTable && records.length > 0) {
    lines.push(`## 5. 全明細データ一覧 (${records.length} 件)`);
    lines.push('| 日付 | 内容 | 金額 (円) | 大項目 | 中項目 | 金融機関 | フラグ | メモ | 対象 |');
    lines.push('| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |');
    records.forEach((r) => {
      const memoText = [r.memo, r.customMemo].filter(Boolean).join(' / ');
      const amountStr = r.amount > 0 ? `+¥${r.amount.toLocaleString()}` : `¥${r.amount.toLocaleString()}`;
      const targetStr = r.calculationTarget ? '○' : '×';
      lines.push(
        `| ${r.date} | ${r.content} | ${amountStr} | ${r.majorCategory} | ${r.mediumCategory} | ${r.institution} | ${r.customFlag || '未設定'} | ${memoText || '-'} | ${targetStr} |`
      );
    });
    lines.push('');
  }

  return lines.join('\n');
};
