import { describe, it, expect } from 'vitest';
import {
  repoDisplayName,
  repoStackSummary,
  repoStackChips,
  reasoningConfidenceScores,
  reasoningTrailItems,
  extractStepNames,
  extractStepKind,
  extractStepRunCommand,
  relativeTime,
} from '../repoFormat.js';

describe('repoDisplayName', () => {
  it('extracts owner/repo from a github URL', () => {
    expect(repoDisplayName('https://github.com/acme/widgets')).toBe('acme/widgets');
  });

  it('strips a trailing .git suffix', () => {
    expect(repoDisplayName('https://github.com/acme/widgets.git')).toBe('acme/widgets');
  });

  it('returns the original string when it does not match a github URL', () => {
    expect(repoDisplayName('not-a-url')).toBe('not-a-url');
  });
});

describe('repoStackSummary', () => {
  it('returns the not-analyzed message when no analysis is present', () => {
    expect(repoStackSummary(null)).toBe('Not analyzed yet');
  });

  it('joins language + docker when docker is present', () => {
    const summary = repoStackSummary({ analysis: { language: 'nodejs', hasDocker: true } });
    expect(summary).toBe('Node.js + Docker');
  });

  it('joins language + framework when no docker', () => {
    const summary = repoStackSummary({ analysis: { language: 'python', framework: 'flask', hasDocker: false } });
    expect(summary).toBe('Python + Flask');
  });
});

describe('repoStackChips', () => {
  it('returns an empty array when no analysis is present', () => {
    expect(repoStackChips(null)).toEqual([]);
  });

  it('includes labeled chips for every detected signal, skipping nulls', () => {
    const chips = repoStackChips({
      analysis: {
        language: 'nodejs',
        framework: 'express',
        testFramework: null,
        linter: 'eslint',
        buildTool: 'npm',
        hasDocker: false,
      },
    });
    expect(chips).toEqual(['Node.js', 'Express', 'Eslint', 'npm']);
  });
});

describe('reasoningConfidenceScores', () => {
  it('filters to detection steps with numeric confidence, dedupes by step, and scales to 0-100', () => {
    const scores = reasoningConfidenceScores([
      { step: 'language_detection', confidence: 0.9 },
      { step: 'language_detection', confidence: 0.5 }, // duplicate step, should be dropped
      { step: 'framework_detection', confidence: 0.8 },
      { step: 'step_selection', confidence: 0.7 }, // not a detection step
      { step: 'linter_detection', confidence: null },
    ]);

    expect(scores).toEqual([
      { label: 'Language Detection', value: 90 },
      { label: 'Framework Detection', value: 80 },
    ]);
  });
});

describe('reasoningTrailItems', () => {
  it('returns only the inference strings, skipping entries without one', () => {
    const items = reasoningTrailItems([
      { inference: 'first' },
      { inference: null },
      { inference: 'second' },
    ]);
    expect(items).toEqual(['first', 'second']);
  });
});

const SAMPLE_YAML = `
name: app CI/CD
jobs:
  build:
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      - name: Install dependencies
        run: npm ci
      - name: Run custom script
        run: npm run custom
`;

describe('extractStepNames', () => {
  it('extracts every step name from the yaml', () => {
    expect(extractStepNames(SAMPLE_YAML)).toEqual([
      'Checkout code',
      'Install dependencies',
      'Run custom script',
    ]);
  });
});

describe('extractStepKind', () => {
  it('returns "uses" for scaffold steps', () => {
    expect(extractStepKind(SAMPLE_YAML, 'Checkout code')).toBe('uses');
  });

  it('returns "run" for custom run steps', () => {
    expect(extractStepKind(SAMPLE_YAML, 'Run custom script')).toBe('run');
  });

  it('returns null when the step cannot be found', () => {
    expect(extractStepKind(SAMPLE_YAML, 'Does not exist')).toBeNull();
  });
});

describe('extractStepRunCommand', () => {
  it('extracts the run command for a given step', () => {
    expect(extractStepRunCommand(SAMPLE_YAML, 'Run custom script')).toBe('npm run custom');
  });

  it('returns an empty string for a "uses" step with no run command', () => {
    expect(extractStepRunCommand(SAMPLE_YAML, 'Checkout code')).toBe('');
  });
});

describe('relativeTime', () => {
  it('returns the never message for a falsy timestamp', () => {
    expect(relativeTime(null)).toBe('Never');
  });

  it('returns "just now" for a timestamp a few seconds ago', () => {
    const now = new Date().toISOString();
    expect(relativeTime(now)).toBe('just now');
  });

  it('handles Supabase-style timestamps without a timezone offset as UTC', () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString().replace('Z', '');
    expect(relativeTime(fiveMinutesAgo)).toBe('5m ago');
  });
});
