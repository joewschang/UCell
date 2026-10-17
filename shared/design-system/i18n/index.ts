import catalog from './zh-TW.json';

export const locale = 'zh-TW';
export const languageParameters = Object.freeze({locale, currency: 'TWD', timeZone: 'Asia/Taipei'});
const labels: Readonly<Record<string, string>> = catalog.labels;
const glossary: Readonly<Record<string, string>> = catalog.glossary;
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const terms = [...new Set([...Object.keys(glossary), ...Object.keys(labels)])].sort((a, b) => b.length - a.length);
const matcher = new RegExp(`(?<![A-Za-z0-9_])(?:${terms.map(escape).join('|')})(?![A-Za-z0-9_])`, 'g');

/** Presentation only. Never use translated values for API payloads, identity or comparisons. */
export function uiText(value: string): string {
  const trimmed = value.trim();
  const exact = labels[trimmed] ?? glossary[trimmed];
  if (exact) return value.replace(trimmed, exact);
  return value.replace(matcher, term => glossary[term] ?? labels[term]);
}

/** Unknown domain values are explicit rather than silently claiming a successful state. */
export function domainLabel(value: unknown, fallback = '尚未提供中文名稱'): string {
  if (value === null || value === undefined || value === '') return '—';
  const raw = String(value);
  if (labels[raw]) return labels[raw];
  const translated = uiText(raw);
  return translated !== raw || /[\u3400-\u9fff]/.test(raw) ? translated : fallback;
}

export function uiValue(value: unknown): string {
  return uiText(String(value ?? '—'));
}

/** Translate literal wording only; interpolated names, URLs and identifiers remain exact. */
export function uiTemplate(parts: TemplateStringsArray, ...values: unknown[]): string {
  return parts.reduce((result, part, index) => result + uiText(part) + (index < values.length ? String(values[index] ?? '') : ''), '');
}

export function errorText(value: unknown): string {
  const raw = value instanceof Error ? value.message : String(value ?? '');
  const translated = uiText(raw);
  return /[\u3400-\u9fff]/.test(translated) ? translated : '暫時無法完成操作，請重新載入後再試。';
}
