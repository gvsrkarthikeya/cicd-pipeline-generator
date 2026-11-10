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

  describe('monorepo (stacks in sub-folders)', () => {
    const mockMonorepo = () => {
      getFileTree.mockResolvedValue([
        'render.yaml',
        '.claude/settings.json',
        'backend/requirements.txt',
        'backend/Dockerfile',
        'backend/app/main.py',
        'frontend/package.json',
        'frontend/src/main.tsx',
        'frontend/node_modules/x/package.json',
      ]);
      getKeyFiles.mockImplementation(async (_url, _branch, _token, dir = '') => {
        if (dir === 'backend') return { 'requirements.txt': 'fastapi==0.110\npytest==8.0\n' };
        if (dir === 'frontend') {
          return {
            'package.json': JSON.stringify({
              dependencies: { react: '^18.0.0' },
              devDependencies: {},
              scripts: {},
            }),
          };
        }
        return {};
      });
    };

    it('detects a stack per sub-folder when the root has no indicator files', async () => {
      mockMonorepo();

      const result = await analyzeRepo('https://github.com/acme/cloudcanvas', 'main', null);

      expect(result.success).toBe(true);
      const { analysis } = result;
      expect(analysis.projectType).toBe('monorepo');
      expect(analysis.language).toBeNull();
      expect(analysis.subprojects.map((p) => p.path)).toEqual(['backend', 'frontend']);

      const [backend, frontend] = analysis.subprojects;
      expect(backend).toMatchObject({
        language: 'python',
        framework: 'fastapi',
        testFramework: 'pytest',
        deploymentStrategy: 'container',
        hasDocker: true,
      });
      expect(frontend).toMatchObject({
        language: 'nodejs',
        framework: 'react',
        projectType: 'frontend',
        deploymentStrategy: 'static',
      });
      expect(analysis.deploymentStrategy).toBe('container');
      expect(analysis.hasDocker).toBe(true);
      expect(getKeyFiles).toHaveBeenCalledWith(
        'https://github.com/acme/cloudcanvas', 'main', null, 'backend'
      );
    });

    it('adds a monorepo_detection entry and scopes sub-project reasoning by path', async () => {
      mockMonorepo();

      const { reasoning } = await analyzeRepo('https://github.com/acme/cloudcanvas', 'main', null);

      const summary = reasoning.find((r) => r.step === 'monorepo_detection');
      expect(summary.inference).toContain('backend (python)');
      expect(summary.inference).toContain('frontend (nodejs)');
      expect(reasoning.some((r) => r.signal.startsWith('[backend] '))).toBe(true);
      expect(reasoning.some((r) => r.signal.startsWith('[frontend] '))).toBe(true);
    });

    it('reports a sub-folder project, but stays generic when no sub-folder has a stack', async () => {
      getFileTree.mockResolvedValue(['docs/README.md', 'docs/package.json', 'README.md']);
      getKeyFiles.mockResolvedValue({ 'package.json': '{}' });

      const result = await analyzeRepo('https://github.com/acme/docs-only', 'main', null);

      // docs/package.json is a Node project, so it is reported as a sub-project
      expect(result.analysis.subprojects.map((p) => p.path)).toEqual(['docs']);

      getFileTree.mockResolvedValue(['docs/README.md', 'README.md']);
      const generic = await analyzeRepo('https://github.com/acme/docs-only', 'main', null);
      expect(generic.analysis.subprojects).toBeUndefined();
      expect(generic.analysis.language).toBeNull();
      expect(generic.analysis.confidence).toBe(0.3);
    });

    it('does not look into sub-folders when the root already has a stack', async () => {
      getFileTree.mockResolvedValue(['package.json', 'client/package.json']);
      getKeyFiles.mockResolvedValue({
        'package.json': JSON.stringify({ dependencies: {}, devDependencies: {}, scripts: {} }),
      });

      const result = await analyzeRepo('https://github.com/acme/app', 'main', null);

      expect(result.analysis.language).toBe('nodejs');
      expect(result.analysis.subprojects).toBeUndefined();
      expect(getKeyFiles).toHaveBeenCalledTimes(1);
    });
  });
});
