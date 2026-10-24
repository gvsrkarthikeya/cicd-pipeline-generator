import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/github.js', () => ({
  getFileTree: vi.fn(),
  getKeyFiles: vi.fn(),
}));

const { getFileTree, getKeyFiles } = await import('../../lib/github.js');
const { analyzeRepo } = await import('../analyzer.js');

describe('analyzeRepo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('detects a Node/React frontend project with no linter/test framework', async () => {
    getFileTree.mockResolvedValue(['package.json', 'src/App.jsx']);
    getKeyFiles.mockResolvedValue({
      'package.json': JSON.stringify({
        dependencies: { react: '^18.0.0' },
        devDependencies: {},
        scripts: { build: 'vite build' },
      }),
    });

    const result = await analyzeRepo('https://github.com/acme/app', 'main', null);

    expect(result.success).toBe(true);
    expect(result.analysis.language).toBe('nodejs');
    expect(result.analysis.framework).toBe('react');
    expect(result.analysis.projectType).toBe('frontend');
    expect(result.analysis.testFramework).toBeNull();
    expect(result.analysis.linter).toBeNull();
    expect(result.analysis.deploymentStrategy).toBe('static');
    expect(result.analysis.hasDocker).toBe(false);
  });

  it('detects an Express backend with jest + eslint configured', async () => {
    getFileTree.mockResolvedValue(['package.json', 'src/app.js']);
    getKeyFiles.mockResolvedValue({
      'package.json': JSON.stringify({
        dependencies: { express: '^5.0.0' },
        devDependencies: { jest: '^29.0.0', eslint: '^9.0.0' },
        scripts: { test: 'jest' },
      }),
    });

    const result = await analyzeRepo('https://github.com/acme/api', 'main', null);

    expect(result.analysis.language).toBe('nodejs');
    expect(result.analysis.framework).toBe('express');
    expect(result.analysis.projectType).toBe('backend');
    expect(result.analysis.testFramework).toBe('jest');
    expect(result.analysis.linter).toBe('eslint');
    expect(result.analysis.deploymentStrategy).toBe('server');
  });

  it('selects container deployment strategy when a Dockerfile is present', async () => {
    getFileTree.mockResolvedValue(['package.json', 'Dockerfile']);
    getKeyFiles.mockResolvedValue({
      'package.json': JSON.stringify({ dependencies: {}, devDependencies: {}, scripts: {} }),
    });

    const result = await analyzeRepo('https://github.com/acme/api', 'main', null);

    expect(result.analysis.hasDocker).toBe(true);
    expect(result.analysis.deploymentStrategy).toBe('container');
  });

  it('detects a Python project from requirements.txt', async () => {
    getFileTree.mockResolvedValue(['requirements.txt', 'app.py']);
    getKeyFiles.mockResolvedValue({
      'requirements.txt': 'flask==2.0.0\npytest==7.0.0\n# comment line\n',
    });

    const result = await analyzeRepo('https://github.com/acme/pyapp', 'main', null);

    expect(result.analysis.language).toBe('python');
    expect(result.analysis.framework).toBe('flask');
    expect(result.analysis.testFramework).toBe('pytest');
    expect(result.analysis.buildTool).toBe('pip');
  });

  it('falls back to an unknown/generic stack when no indicator files are found', async () => {
    getFileTree.mockResolvedValue(['README.md']);
    getKeyFiles.mockResolvedValue({});

    const result = await analyzeRepo('https://github.com/acme/mystery', 'main', null);

    expect(result.success).toBe(true);
    expect(result.analysis.language).toBeNull();
    expect(result.analysis.confidence).toBe(0.3);
    expect(result.analysis.deploymentStrategy).toBe('server');
  });

  it('returns success: false when fetching the file tree throws', async () => {
    getFileTree.mockRejectedValue(new Error('Repository not found or token lacks access'));

    const result = await analyzeRepo('https://github.com/acme/private-repo', 'main', null);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Repository not found or token lacks access');
  });
});
