import { t } from './i18n';

export function repoDisplayName(repoUrl = '') {
  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/i);
  return match ? `${match[1]}/${match[2]}` : repoUrl;
}

const TITLE_CASE = {
  nodejs: 'Node.js',
  node: 'Node.js',
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  python: 'Python',
  java: 'Java',
  fastapi: 'FastAPI',
  nestjs: 'NestJS',
  nextjs: 'Next.js',
  pip: 'pip',
  npm: 'npm',
  maven: 'Maven',
  gradle: 'Gradle',
};

function label(value) {
  if (!value) return null;
  const key = String(value).toLowerCase();
  if (TITLE_CASE[key]) return TITLE_CASE[key];
  return key.charAt(0).toUpperCase() + key.slice(1);
}

export function repoStackSummary(detectedStack) {
  const analysis = detectedStack?.analysis;
  if (!analysis) return t('repo.notAnalyzed');

  const parts = [
    label(analysis.language),
    analysis.hasDocker ? 'Docker' : label(analysis.framework) ?? label(analysis.buildTool),
  ].filter(Boolean);

  return parts.length ? parts.join(' + ') : t('repo.unknownStack');
}

export function repoStackChips(detectedStack) {
  const analysis = detectedStack?.analysis;
  if (!analysis) return [];

  return [
    label(analysis.language),
    label(analysis.framework),
    label(analysis.testFramework),
    label(analysis.linter),
    label(analysis.buildTool),
    analysis.hasDocker ? 'Docker' : null,
  ].filter(Boolean);
}

function humanizeStep(step = '') {
  return step
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

const DETECTION_STEPS = new Set([
  'language_detection',
  'framework_detection',
  'test_detection',
  'linter_detection',
  'deployment_detection',
]);

export function reasoningConfidenceScores(reasoning = []) {
  const seen = new Set();

  return reasoning
    .filter((entry) => DETECTION_STEPS.has(entry.step) && typeof entry.confidence === 'number')
    .filter((entry) => {
      if (seen.has(entry.step)) return false;
      seen.add(entry.step);
      return true;
    })
    .map((entry) => ({
      label: humanizeStep(entry.step),
      value: Math.round(entry.confidence * 100),
    }));
}

export function reasoningTrailItems(reasoning = []) {
  return reasoning
    .filter((entry) => entry.inference)
    .map((entry) => entry.inference);
}

export function extractStepNames(yaml = '') {
  const matches = [...yaml.matchAll(/^\s*-\s*name:\s*(.+)\s*$/gm)];
  return matches.map((match) => match[1].replace(/^['"]|['"]$/g, ''));
}

function escapeRegExp(value = '') {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Returns 'run' for custom/command steps (editable/deletable from the UI),
// 'uses' for scaffold steps backed by a GitHub Action (checkout, setup-*,
// deploy placeholder — not safe to edit via the simple run-command form),
// or null if the step can't be found.
export function extractStepKind(yaml = '', stepName = '') {
  const lines = yaml.split('\n');
  const startIndex = lines.findIndex((line) =>
    new RegExp(`^\\s*-\\s*name:\\s*['"]?${escapeRegExp(stepName)}['"]?\\s*$`).test(line)
  );
  if (startIndex === -1) return null;

  for (let i = startIndex + 1; i < lines.length; i += 1) {
    if (/^\s*-\s*name:/.test(lines[i])) break;
    if (/^\s*uses:/.test(lines[i])) return 'uses';
    if (/^\s*run:/.test(lines[i])) return 'run';
  }
  return null;
}

export function extractStepRunCommand(yaml = '', stepName = '') {
  const lines = yaml.split('\n');
  const startIndex = lines.findIndex((line) =>
    new RegExp(`^\\s*-\\s*name:\\s*['"]?${escapeRegExp(stepName)}['"]?\\s*$`).test(line)
  );
  if (startIndex === -1) return '';

  for (let i = startIndex + 1; i < lines.length; i += 1) {
    if (/^\s*-\s*name:/.test(lines[i])) break;
    const match = lines[i].match(/^\s*run:\s*(.+)$/);
    if (match) return match[1].replace(/^['"]|['"]$/g, '');
  }
  return '';
}

export function relativeTime(timestamp) {
  if (!timestamp) return t('repo.never');

  // Supabase returns `timestamp without time zone` values as UTC strings that
  // carry no offset (e.g. "2026-10-23T04:50:18.123"). JS would parse those as
  // local time, so append a Z when no offset is present.
  const normalized =
    typeof timestamp === 'string' && !/(Z|[+-]\d{2}:?\d{2})$/.test(timestamp)
      ? `${timestamp}Z`
      : timestamp;

  const then = new Date(normalized).getTime();
  if (Number.isNaN(then)) return t('repo.never');

  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return t('repo.justNow');

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return t('repo.minutesAgo', { value: minutes });

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('repo.hoursAgo', { value: hours });

  const days = Math.floor(hours / 24);
  if (days < 30) return t('repo.daysAgo', { value: days });

  const months = Math.floor(days / 30);
  if (months < 12) return t('repo.monthsAgo', { value: months });

  return t('repo.yearsAgo', { value: Math.floor(months / 12) });
}
