import { describe, it, expect, vi } from 'vitest';
import { load } from 'js-yaml';

vi.mock('../../lib/github.js', () => ({
  getFileTree: vi.fn(),
  getKeyFiles: vi.fn(),
}));

const { getFileTree, getKeyFiles } = await import('../../lib/github.js');
const { analyzeRepo } = await import('../analyzer.js');
const { runInferenceEngine } = await import('../inferenceEngine.js');
const { generateYaml } = await import('../yamlGenerator.js');
const { recommendOptimizations } = await import('../recommender.js');
const { applyRecommendation } = await import('../applyRecommendation.js');
const { customizePipeline } = await import('../pipelineCustomizer.js');

// backend/ (FastAPI + Docker) and frontend/ (React) in one repository
const buildMonorepoPipeline = async () => {
  getFileTree.mockResolvedValue([
    'backend/requirements.txt',
    'backend/Dockerfile',
    'frontend/package.json',
    'frontend/src/main.tsx',
  ]);
  getKeyFiles.mockImplementation(async (_url, _branch, _token, dir = '') => {
    if (dir === 'backend') return { 'requirements.txt': 'fastapi==0.110\npytest==8.0\n' };
    if (dir === 'frontend') {
      return {
        'package.json': JSON.stringify({
          dependencies: { react: '^18.0.0' },
          devDependencies: { eslint: '^9.0.0' },
          scripts: { build: 'vite build' },
        }),
      };
    }
    return {};
  });

  const analyzerResult = await analyzeRepo('https://github.com/acme/cloudcanvas', 'main', null);
  const inference = runInferenceEngine(analyzerResult, 'main');
  const generated = generateYaml(inference, 'cloudcanvas');
  return { analyzerResult, inference, generated };
};

describe('monorepo pipeline', () => {
  it('produces per-project inference decisions', async () => {
    const { inference } = await buildMonorepoPipeline();

    expect(inference.success).toBe(true);
    const { projects } = inference.decisions;
    expect(projects.map((p) => [p.path, p.language, p.runtimeVersion])).toEqual([
      ['backend', 'python', '3.11'],
      ['frontend', 'nodejs', '20'],
    ]);
    expect(inference.decisions.deploymentStrategy).toBe('container');
    expect(inference.trail.some((e) => e.signal?.startsWith('[backend] '))).toBe(true);
  });

  it('generates one job per project scoped to its folder', async () => {
    const { generated } = await buildMonorepoPipeline();

    expect(generated.success).toBe(true);
    const workflow = load(generated.yaml);
    expect(Object.keys(workflow.jobs)).toEqual(['backend', 'frontend']);

    const { backend, frontend } = workflow.jobs;
    expect(backend.defaults.run['working-directory']).toBe('backend');
    expect(backend.steps.some((s) => s.uses === 'actions/setup-python@v5')).toBe(true);
    expect(backend.steps[backend.steps.length - 1].name).toMatch(/Build and push Docker image/);
    expect(frontend.defaults.run['working-directory']).toBe('frontend');
    expect(frontend.steps.some((s) => s.uses === 'actions/setup-node@v4')).toBe(true);

    // step names stay unique across the whole workflow
    const names = Object.values(workflow.jobs).flatMap((job) => job.steps.map((s) => s.name));
    expect(new Set(names).size).toBe(names.length);
  });

  it('sanitizes job ids for nested and unusual folder names', () => {
    const decisions = (path) => ({
      path,
      language: null,
      steps: ['checkout'],
      deploymentStrategy: 'generic',
    });
    const result = generateYaml({
      success: true,
      confidence: 0.9,
      decisions: {
        steps: ['checkout'],
        projects: [decisions('apps/web'), decisions('apps-web'), decisions('1st app')],
      },
    });

    expect(Object.keys(load(result.yaml).jobs)).toEqual(['apps-web', 'apps-web-2', '_1st-app']);
  });

  it('recommends caching and linting across projects, naming them', async () => {
    const { analyzerResult, inference } = await buildMonorepoPipeline();

    const { recommendations } = recommendOptimizations(analyzerResult, inference);
    const caching = recommendations.find((r) => r.title === 'Add dependency caching');
    const lint = recommendations.find((r) => r.title === 'No linter detected');

    expect(caching.suggestion).toContain('backend, frontend');
    // only the backend lacks a linter
    expect(lint.suggestion).toContain('(backend)');
    expect(lint.suggestion).toContain('flake8');
    expect(recommendations.filter((r) => r.title === 'Add dependency caching')).toHaveLength(1);
  });

  it('applies caching to every job and points the cache at each sub-folder lockfile', async () => {
    const { generated } = await buildMonorepoPipeline();

    const { yaml, description } = applyRecommendation(generated.yaml, 'Add dependency caching');
    const workflow = load(yaml);

    const pySetup = workflow.jobs.backend.steps.find((s) => s.uses?.startsWith('actions/setup-python'));
    const nodeSetup = workflow.jobs.frontend.steps.find((s) => s.uses?.startsWith('actions/setup-node'));
    expect(pySetup.with).toMatchObject({ cache: 'pip', 'cache-dependency-path': 'backend/requirements.txt' });
    expect(nodeSetup.with).toMatchObject({ cache: 'npm', 'cache-dependency-path': 'frontend/package-lock.json' });
    expect(description).toContain('pip');
    expect(description).toContain('npm');

    expect(() => applyRecommendation(yaml, 'Add dependency caching')).toThrow(/already enabled/);
  });

  it('adds a lint step only to jobs that lack one and scopes permissions once', async () => {
    const { generated } = await buildMonorepoPipeline();

    // the frontend already has a linter (so already has a lint step); backend gets one
    const { yaml } = applyRecommendation(generated.yaml, 'No linter detected');
    const workflow = load(yaml);
    const lintJobs = Object.entries(workflow.jobs)
      .filter(([, job]) => job.steps.some((s) => s.name?.startsWith('Run lint')))
      .map(([name]) => name);
    expect(lintJobs).toEqual(['backend', 'frontend']);

    const scoped = load(applyRecommendation(generated.yaml, 'Scope workflow permissions').yaml);
    expect(scoped.permissions).toEqual({ contents: 'read' });
  });

  it('edits and deletes steps that live in a later job', async () => {
    const { generated } = await buildMonorepoPipeline();
    const workflow = load(generated.yaml);
    const nodeInstall = workflow.jobs.frontend.steps.find((s) => s.name.startsWith('Install dependencies'));

    const edited = customizePipeline(generated.yaml, 'edit', nodeInstall.name, { run: 'npm install' });
    expect(edited.beforeStep.run).toBe('npm ci');
    expect(edited.afterStep.run).toBe('npm install');
    expect(
      load(edited.yaml).jobs.frontend.steps.find((s) => s.name === nodeInstall.name).run
    ).toBe('npm install');

    const deleted = customizePipeline(generated.yaml, 'delete', nodeInstall.name);
    expect(
      load(deleted.yaml).jobs.frontend.steps.some((s) => s.name === nodeInstall.name)
    ).toBe(false);
  });
});
