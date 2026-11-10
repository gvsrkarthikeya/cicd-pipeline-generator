// Applies a subset of the recommender's suggestions directly to a generated
// GitHub Actions workflow YAML. Only recommendations with a safe, fully
// deterministic transform are supported here — the rest are informational
// only and must be applied manually.

import { load, dump } from 'js-yaml';

// Every job in the workflow, with its (guaranteed) steps array
function getJobs(workflow) {
  const jobNames = Object.keys(workflow.jobs || {});
  if (!jobNames.length) throw new Error('Workflow has no jobs to modify');
  return jobNames.map((name) => {
    const job = workflow.jobs[name];
    job.steps = job.steps || [];
    return job;
  });
}

// Monorepo jobs run inside a sub-folder; non-monorepo jobs return null
function getWorkingDirectory(job) {
  return job.defaults?.run?.['working-directory'] || null;
}

function detectLanguage(steps) {
  if (steps.some((s) => s.uses?.startsWith('actions/setup-node'))) return 'nodejs';
  if (steps.some((s) => s.uses?.startsWith('actions/setup-python'))) return 'python';
  if (steps.some((s) => s.uses?.startsWith('actions/setup-java'))) return 'java';
  return null;
}

// Appliers receive (workflow, job) and mutate them; they return a description
// or throw if the change is not applicable to that job.
const APPLIERS = {
  'Add dependency caching': (workflow, job) => {
    const steps = job.steps;
    const workingDirectory = getWorkingDirectory(job);
    const language = detectLanguage(steps);

    if (language === 'nodejs' || language === 'python') {
      const usesPrefix = language === 'nodejs' ? 'actions/setup-node' : 'actions/setup-python';
      const cacheKey = language === 'nodejs' ? 'npm' : 'pip';
      const setupStep = steps.find((s) => s.uses?.startsWith(usesPrefix));
      if (!setupStep) throw new Error('No matching setup step found to cache');
      if (setupStep.with?.cache) throw new Error('Dependency caching is already enabled');
      setupStep.with = { ...(setupStep.with || {}), cache: cacheKey };
      if (workingDirectory) {
        // The lockfile lives in the sub-folder, not at the repo root
        const lockfile = language === 'nodejs' ? 'package-lock.json' : 'requirements.txt';
        setupStep.with['cache-dependency-path'] = `${workingDirectory}/${lockfile}`;
      }
      return `Enabled ${cacheKey} dependency caching on the "${setupStep.name}" step`;
    }

    if (language === 'java') {
      if (steps.some((s) => s.name?.startsWith('Cache dependencies'))) {
        throw new Error('Dependency caching is already enabled');
      }
      const setupIndex = steps.findIndex((s) => s.uses?.startsWith('actions/setup-java'));
      const cacheStep = {
        name: workingDirectory ? `Cache dependencies (${workingDirectory})` : 'Cache dependencies',
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

  'No linter detected': (workflow, job) => {
    const steps = job.steps;
    const workingDirectory = getWorkingDirectory(job);
    if (steps.some((s) => s.name?.startsWith('Run lint'))) throw new Error('A lint step already exists');
    const language = detectLanguage(steps);
    const lintCommand = language === 'python' ? 'flake8 .' : 'npx eslint .';
    const installIndex = steps.findIndex((s) => s.name?.startsWith('Install dependencies'));
    const insertIndex = installIndex !== -1 ? installIndex + 1 : steps.length;
    const name = workingDirectory ? `Run lint (${workingDirectory})` : 'Run lint';
    steps.splice(insertIndex, 0, { name, run: lintCommand });
    return `Added a "${name}" step (${lintCommand})`;
  },
};

export const APPLIABLE_RECOMMENDATION_TITLES = Object.keys(APPLIERS);

// Re-applies previously accepted recommendations to a newly regenerated
// workflow YAML while tolerating already-applied or incompatible cases.
export function restoreAppliedRecommendations(yaml, titles = []) {
  if (!yaml || !Array.isArray(titles) || titles.length === 0) {
    return yaml;
  }

  const uniqueTitles = [...new Set(
    titles
      .filter(Boolean)
      .filter((title) => APPLIABLE_RECOMMENDATION_TITLES.includes(title))
  )];

  let updatedYaml = yaml;

  for (const title of uniqueTitles) {
    try {
      updatedYaml = applyRecommendation(updatedYaml, title).yaml;
    } catch {
      // The recommendation is already present or not valid for the regenerated
      // workflow; keep the latest YAML and continue without aborting the rerun.
    }
  }

  return updatedYaml;
}

// Applies the named recommendation to the given workflow YAML string.
// Returns { yaml, description }. Throws a descriptive Error if the
// recommendation isn't supported or can't be applied (e.g. already applied).
export function applyRecommendation(yaml, title) {
  const applier = APPLIERS[title];
  if (!applier) {
    throw new Error('This recommendation cannot be auto-applied yet — please update the pipeline manually.');
  }

  const workflow = load(yaml);
  const jobs = getJobs(workflow);

  // Apply to every job; the recommendation succeeds if at least one job changed.
  // If none did, surface the first failure (e.g. "already enabled").
  const descriptions = [];
  let firstError = null;
  for (const job of jobs) {
    try {
      descriptions.push(applier(workflow, job));
    } catch (err) {
      firstError = firstError || err;
    }
  }
  if (!descriptions.length) throw firstError;

  const updatedYaml = dump(workflow, { lineWidth: -1 });

  return { yaml: updatedYaml, description: descriptions.join('; ') };
}
