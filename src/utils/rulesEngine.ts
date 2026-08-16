import { AutoRule, MoneyForwardRecord } from '../types';

export const evaluateRuleMatch = (record: MoneyForwardRecord, rule: AutoRule): boolean => {
  if (!rule.enabled || !rule.keyword.trim()) return false;

  let targetValue = '';
  switch (rule.targetField) {
    case 'content':
      targetValue = record.content || '';
      break;
    case 'majorCategory':
      targetValue = record.majorCategory || '';
      break;
    case 'mediumCategory':
      targetValue = record.mediumCategory || '';
      break;
    case 'institution':
      targetValue = record.institution || '';
      break;
    case 'memo':
      targetValue = record.memo || '';
      break;
  }

  const normalizedTarget = targetValue.toLowerCase();
  const normalizedKeyword = rule.keyword.toLowerCase().trim();

  switch (rule.matchType) {
    case 'contains':
      return normalizedTarget.includes(normalizedKeyword);
    case 'equals':
      return normalizedTarget === normalizedKeyword;
    case 'startsWith':
      return normalizedTarget.startsWith(normalizedKeyword);
    case 'endsWith':
      return normalizedTarget.endsWith(normalizedKeyword);
    default:
      return false;
  }
};

export const applyRulesToRecord = (
  record: MoneyForwardRecord,
  rules: AutoRule[],
  overwriteExisting = false
): MoneyForwardRecord => {
  // すでにフラグが「未設定」以外で、上書き不可の場合はスキップ
  if (!overwriteExisting && record.customFlag && record.customFlag !== '未設定') {
    return record;
  }

  for (const rule of rules) {
    if (evaluateRuleMatch(record, rule)) {
      return {
        ...record,
        customFlag: rule.applyFlag,
      };
    }
  }

  return record;
};

export const applyRulesToRecords = (
  records: MoneyForwardRecord[],
  rules: AutoRule[],
  overwriteExisting = false
): { updatedRecords: MoneyForwardRecord[]; modifiedCount: number } => {
  let modifiedCount = 0;
  const updatedRecords = records.map((rec) => {
    const updated = applyRulesToRecord(rec, rules, overwriteExisting);
    if (updated.customFlag !== rec.customFlag) {
      modifiedCount++;
    }
    return updated;
  });

  return { updatedRecords, modifiedCount };
};
