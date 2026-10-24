import { describe, it, expect } from 'vitest';
import { recommendOptimizations } from '../recommender.js';

const analyzerResult = (analysis) => ({ success: true, analysis });
const inferenceResult = (decisions) => ({ success: true, decisions });

describe('recommendOptimizations', () => {
  it('returns success: false when the analyzer result failed', () => {
    const result = recommendOptimizations({ success: false }, inferenceResult({}));
    expect(result.success).toBe(false);
  });

  it('returns success: false when the inference result failed', () => {
    const result = recommendOptimizations(analyzerResult({}), { success: false });
    expect(result.success).toBe(false);
  });

  it('recommends dependency caching for a nodejs project', () => {
    const result = recommendOptimizations(
      analyzerResult({ projectType: 'backend', hasExistingCI: true, linter: 'eslint', testFramework: 'jest' }),
      inferenceResult({ language: 'nodejs', deploymentStrategy: 'server' })
    );

    expect(result.success).toBe(true);
    const titles = result.recommendations.map((r) => r.title);
    expect(titles).toContain('Add dependency caching');
  });

  it('flags missing linter and missing test framework', () => {
    const result = recommendOptimizations(
      analyzerResult({ language: 'python', linter: null, testFramework: null, hasExistingCI: true }),
      inferenceResult({ language: 'python', deploymentStrategy: 'server' })
    );

    const titles = result.recommendations.map((r) => r.title);
    expect(titles).toContain('No linter detected');
    expect(titles).toContain('No test framework detected');
  });

  it('always includes baseline security recommendations', () => {
    const result = recommendOptimizations(
      analyzerResult({ linter: 'eslint', testFramework: 'jest', hasExistingCI: true }),
      inferenceResult({ language: 'nodejs', deploymentStrategy: 'static' })
    );

    const titles = result.recommendations.map((r) => r.title);
    expect(titles).toContain('Pin GitHub Actions to a commit SHA');
    expect(titles).toContain('Scope workflow permissions');
  });

  it('recommends avoiding hardcoded tokens for server/container deployments', () => {
    const result = recommendOptimizations(
      analyzerResult({ linter: 'eslint', testFramework: 'jest', hasExistingCI: true }),
      inferenceResult({ language: 'nodejs', deploymentStrategy: 'server' })
    );

    const titles = result.recommendations.map((r) => r.title);
    expect(titles).toContain('Avoid hardcoded tokens');
  });

  it('summarizes recommendation counts by type', () => {
    const result = recommendOptimizations(
      analyzerResult({ language: 'nodejs', linter: null, testFramework: null, hasExistingCI: false }),
      inferenceResult({ language: 'nodejs', deploymentStrategy: 'server' })
    );

    expect(result.summary.total).toBe(result.recommendations.length);
    expect(
      result.summary.byType.performance + result.summary.byType.linting + result.summary.byType.security
    ).toBe(result.summary.total);
  });
});
