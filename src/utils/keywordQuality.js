'use strict';

const BLOCKED_TERMS = new Set([
  'lavdi',
  'lavda',
  'loda',
  'lund',
  'bhenchod',
  'behenchod',
  'madarchod',
  'mc',
  'bc',
  'milf',
]);

function normalizeKeywordText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function getKeywordQualityIssue(value) {
  const keyword = normalizeKeywordText(value);
  if (!keyword) return 'keyword is required';
  if (keyword.length > 200) return 'keyword must be 200 characters or fewer';
  if (!/[a-z0-9]/i.test(keyword)) return 'keyword must contain letters or numbers';
  if (BLOCKED_TERMS.has(keyword)) return 'keyword is not suitable for reporting';
  if (keyword.split(' ').some((part) => BLOCKED_TERMS.has(part))) return 'keyword is not suitable for reporting';
  if (/^(.)\1{5,}$/.test(keyword.replace(/\s+/g, ''))) return 'keyword looks invalid';
  return null;
}

function isKeywordUsable(value) {
  return !getKeywordQualityIssue(value);
}

module.exports = {
  normalizeKeywordText,
  getKeywordQualityIssue,
  isKeywordUsable,
};
