import { describe, it, expect } from 'vitest';
import { dump } from 'js-yaml';
import { applyRecommendation, APPLIABLE_RECOMMENDATION_TITLES } from '../applyRecommendation.js';

const nodeWorkflow = () =>
  dump({
    name: 'app CI/CD',
    jobs: {
      build: {
        'runs-on': 'ubuntu-latest',
        steps: [
          { name: 'Checkout code', uses: 'actions/checkout@v4' },
          { name: 'Set up nodejs', uses: 'actions/setup-node@v4', with: { 'node-version': '20' } },
          { name: 'Install dependencies', run: 'npm ci' },
          { name: 'Run tests', run: 'npm test' },
        ],
      },
    },
  });

describe('applyRecommendation', () => {
  it('exposes the list of appliable recommendation titles', () => {
    expect(APPLIABLE_RECOMMENDATION_TITLES).toEqual(
      expect.arrayContaining(['Add dependency caching', 'Scope workflow permissions', 'No linter detected'])
    );
  });

  it('throws for a recommendation title that has no applier', () => {
    expect(() => applyRecommendation(nodeWorkflow(), 'Not a real recommendation')).toThrow(
      /cannot be auto-applied/
    );
  });

  it('enables npm dependency caching on the setup-node step', () => {
    const { yaml, description } = applyRecommendation(nodeWorkflow(), 'Add dependency caching');
    expect(description).toMatch(/npm dependency caching/);
    expect(yaml).toMatch(/cache: npm/);
  });

  it('throws when dependency caching is already enabled', () => {
    const once = applyRecommendation(nodeWorkflow(), 'Add dependency caching').yaml;
    expect(() => applyRecommendation(once, 'Add dependency caching')).toThrow(/already enabled/);
  });

  it('adds a scoped permissions block', () => {
    const { yaml, description } = applyRecommendation(nodeWorkflow(), 'Scope workflow permissions');
    expect(description).toMatch(/permissions/);
    expect(yaml).toMatch(/contents: read/);
  });

  it('throws when permissions are already scoped', () => {
    const once = applyRecommendation(nodeWorkflow(), 'Scope workflow permissions').yaml;
    expect(() => applyRecommendation(once, 'Scope workflow permissions')).toThrow(/already scoped/);
  });

  it('adds an eslint lint step for nodejs projects', () => {
    const { yaml, description } = applyRecommendation(nodeWorkflow(), 'No linter detected');
    expect(description).toMatch(/Run lint/);
    expect(yaml).toMatch(/npx eslint \./);
  });

  it('throws when a lint step already exists', () => {
    const once = applyRecommendation(nodeWorkflow(), 'No linter detected').yaml;
    expect(() => applyRecommendation(once, 'No linter detected')).toThrow(/already exists/);
  });
});
