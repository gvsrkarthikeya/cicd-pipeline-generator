// Applies a subset of the recommender's suggestions directly to a generated
// GitHub Actions workflow YAML. Only recommendations with a safe, fully
// deterministic transform are supported here — the rest are informational
// only and must be applied manually.

import { load, dump } from 'js-yaml';

function getJobSteps(workflow) {
  const jobNames = Object.keys(workflow.jobs || {});
  if (!jobNames.length) throw new Error('Workflow has no jobs to modify');
  const jobName = jobNames[0];
  workflow.jobs[jobName].steps = workflow.jobs[jobName].steps || [];
  return workflow.jobs[jobName].steps;
}

function detectLanguage(steps) {
  if (steps.some((s) => s.uses?.startsWith('actions/setup-node'))) return 'nodejs';
  if (steps.some((s) => s.uses?.startsWith('actions/setup-python'))) return 'python';
  if (steps.some((s) => s.uses?.startsWith('actions/setup-java'))) return 'java';
  return null;
}

const APPLIERS = {
  'Add dependency caching': (workflow, steps) => {
    const language = detectLanguage(steps);

    if (language === 'nodejs' || language === 'python') {
      const usesPrefix = language === 'nodejs' ? 'actions/setup-node' : 'actions/setup-python';
      const cacheKey = language === 'nodejs' ? 'npm' : 'pip';
      const setupStep = steps.find((s) => s.uses?.startsWith(usesPrefix));
      if (!setupStep) throw new Error('No matching setup step found to cache');
      if (setupStep.with?.cache) throw new Error('Dependency caching is already enabled');
      setupStep.with = { ...(setupStep.with || {}), cache: cacheKey };
      return `Enabled ${cacheKey} dependency caching on the "${setupStep.name}" step`;
    }

    if (language === 'java') {
      if (steps.some((s) => s.name === 'Cache dependencies')) {
        throw new Error('Dependency caching is already enabled');
      }
      const setupIndex = steps.findIndex((s) => s.uses?.startsWith('actions/setup-java'));
      const cacheStep = {
        name: 'Cache dependencies',
        uses: 'actions/cache@v4',
        with: {
          path: '~/.m2\n~/.gradle/caches',
          key: "${{ runner.os }}-deps-${{ hashFiles('**/pom.xml', '**/*.gradle*') }}",
        },
      };
      steps.splice(setupIndex + 1, 0, cacheStep);
      return 'Added a dependency cache step for Maven/Gradle';
    }

    throw new Error('Could not determine the language to cache for');
  },

  'Scope workflow permissions': (workflow) => {
    if (workflow.permissions) throw new Error('Workflow permissions are already scoped');
    workflow.permissions = { contents: 'read' };
    return 'Added a `permissions: contents: read` block to the workflow';
  },

  'No linter detected': (workflow, steps) => {
    if (steps.some((s) => s.name === 'Run lint')) throw new Error('A lint step already exists');
    const language = detectLanguage(steps);
    const lintCommand = language === 'python' ? 'flake8 .' : 'npx eslint .';
    const installIndex = steps.findIndex((s) => s.name === 'Install dependencies');
    const insertIndex = installIndex !== -1 ? installIndex + 1 : steps.length;
    steps.splice(insertIndex, 0, { name: 'Run lint', run: lintCommand });
    return `Added a "Run lint" step (${lintCommand})`;
  },
};

export const APPLIABLE_RECOMMENDATION_TITLES = Object.keys(APPLIERS);

// Applies the named recommendation to the given workflow YAML string.
// Returns { yaml, description }. Throws a descriptive Error if the
// recommendation isn't supported or can't be applied (e.g. already applied).
export function applyRecommendation(yaml, title) {
  const applier = APPLIERS[title];
  if (!applier) {
    throw new Error('This recommendation cannot be auto-applied yet — please update the pipeline manually.');
  }

  const workflow = load(yaml);
  const steps = getJobSteps(workflow);
  const description = applier(workflow, steps);
  const updatedYaml = dump(workflow, { lineWidth: -1 });

  return { yaml: updatedYaml, description };
}
