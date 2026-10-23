import { describe, it, expect } from 'vitest';
import { load } from 'js-yaml';
import { generateYaml } from '../yamlGenerator.js';

const inferenceResult = (decisions, confidence = 0.9) => ({ success: true, decisions, confidence });

describe('generateYaml', () => {
  it('returns success: false when the inference result failed', () => {
    const result = generateYaml({ success: false });
    expect(result.success).toBe(false);
  });

  it('generates a valid, parseable workflow for a nodejs project', () => {
    const result = generateYaml(
      inferenceResult({
        language: 'nodejs',
        runtimeVersion: '20',
        buildTool: 'npm',
        steps: ['checkout', 'install', 'lint', 'test'],
        commands: { install: 'npm ci', lint: 'npm run lint', test: 'npm test', build: 'npm run build' },
        deploymentStrategy: 'server',
      }),
      'my-app'
    );

    expect(result.success).toBe(true);
    const workflow = load(result.yaml);
    expect(workflow.name).toBe('my-app CI/CD');

    const steps = workflow.jobs.build.steps;
    expect(steps[0]).toMatchObject({ name: 'Checkout code', uses: 'actions/checkout@v4' });
    expect(steps.some((s) => s.uses === 'actions/setup-node@v4')).toBe(true);
    expect(steps.some((s) => s.name === 'Install dependencies' && s.run === 'npm ci')).toBe(true);
    expect(steps.some((s) => s.name === 'Run lint')).toBe(true);
    expect(steps.some((s) => s.name === 'Run tests')).toBe(true);
    // deployment placeholder appended last
    expect(steps[steps.length - 1].name).toMatch(/Deploy to server/);
  });

  it('only includes a checkout step when language is unknown', () => {
    const result = generateYaml(
      inferenceResult({ language: null, steps: ['checkout'], deploymentStrategy: 'generic' })
    );

    const workflow = load(result.yaml);
    const steps = workflow.jobs.build.steps;
    expect(steps[0]).toMatchObject({ name: 'Checkout code' });
    expect(steps[steps.length - 1].name).toMatch(/Deploy \(placeholder\)/);
  });

  it('uses the maven/gradle build command for java projects', () => {
    const result = generateYaml(
      inferenceResult({
        language: 'java',
        runtimeVersion: '17',
        buildTool: 'maven',
        steps: ['checkout', 'install'],
        commands: null,
        deploymentStrategy: 'server',
      })
    );

    const workflow = load(result.yaml);
    const steps = workflow.jobs.build.steps;
    expect(steps.some((s) => s.run === 'mvn -B install')).toBe(true);
    const setupStep = steps.find((s) => s.uses === 'actions/setup-java@v4');
    expect(setupStep.with.distribution).toBe('temurin');
  });

  it('adds a container deployment placeholder when strategy is container', () => {
    const result = generateYaml(
      inferenceResult({
        language: 'nodejs',
        runtimeVersion: '20',
        steps: ['checkout', 'install'],
        commands: { install: 'npm ci' },
        deploymentStrategy: 'container',
      })
    );

    const workflow = load(result.yaml);
    const steps = workflow.jobs.build.steps;
    expect(steps[steps.length - 1].run).toMatch(/docker build/);
  });
});
