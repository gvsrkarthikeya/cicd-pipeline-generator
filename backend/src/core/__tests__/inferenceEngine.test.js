import { describe, it, expect } from 'vitest';
import { runInferenceEngine } from '../inferenceEngine.js';

const baseAnalyzerResult = (overrides = {}) => ({
  success: true,
  repoUrl: 'https://github.com/acme/app',
  branch: 'main',
  analysis: {
    language: 'nodejs',
    framework: 'express',
    projectType: 'backend',
    testFramework: 'jest',
    linter: 'eslint',
    buildTool: 'npm',
    deploymentStrategy: 'server',
    confidence: 0.95,
    hasDocker: false,
    hasExistingCI: false,
    totalFiles: 12,
    ...overrides,
  },
  reasoning: [{ step: 'file_tree', signal: 'x', inference: 'y', confidence: 1 }],
});

describe('runInferenceEngine', () => {
  it('returns success: false when the analyzer result failed', () => {
    const result = runInferenceEngine({ success: false, error: 'boom' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/failed analysis/);
  });

  it('builds install/lint/test steps for a fully-configured nodejs backend', () => {
    const result = runInferenceEngine(baseAnalyzerResult());

    expect(result.success).toBe(true);
    expect(result.decisions.steps).toEqual(['checkout', 'install', 'lint', 'test']);
    expect(result.decisions.runtimeVersion).toBe('20');
    expect(result.decisions.deploymentStrategy).toBe('server');
    expect(result.decisions.triggers).toEqual(['push', 'pull_request']);
  });

  it('adds a build step for a frontend nodejs project', () => {
    const result = runInferenceEngine(baseAnalyzerResult({ projectType: 'frontend', framework: 'react' }));
    expect(result.decisions.steps).toContain('build');
  });

  it('omits lint/test steps and records recommendation trail entries when absent', () => {
    const result = runInferenceEngine(baseAnalyzerResult({ linter: null, testFramework: null }));

    expect(result.decisions.steps).toEqual(['checkout', 'install']);
    const recommended = result.trail.filter((t) => t.recommendation);
    expect(recommended.length).toBeGreaterThanOrEqual(2);
  });

  it('handles an unknown language by only including the checkout step', () => {
    const result = runInferenceEngine(baseAnalyzerResult({ language: null, framework: null, buildTool: null }));

    expect(result.decisions.steps).toEqual(['checkout']);
    expect(result.decisions.runtimeVersion).toBeNull();
    expect(result.decisions.commands).toBeNull();
  });

  it('resolves container deployment strategy when a Dockerfile is present', () => {
    const result = runInferenceEngine(baseAnalyzerResult({ hasDocker: true, deploymentStrategy: 'container' }));
    expect(result.decisions.deploymentStrategy).toBe('container');
  });

  it('computes an overall confidence that blends analyzer confidence and trail average', () => {
    const result = runInferenceEngine(baseAnalyzerResult());
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});
