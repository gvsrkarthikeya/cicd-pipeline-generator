import { load, dump } from 'js-yaml';

// All jobs' step arrays, in workflow order (a monorepo workflow has one job per project)
function getAllSteps(workflow) {
  const jobNames = Object.keys(workflow.jobs || {});
  if (jobNames.length === 0) throw new Error('Workflow has no jobs to modify');
  return jobNames.map((jobName) => {
    workflow.jobs[jobName].steps = workflow.jobs[jobName].steps || [];
    return workflow.jobs[jobName].steps;
  });
}

// Locate a step by name across all jobs
function findStep(allSteps, stepName) {
  for (const steps of allSteps) {
    const index = steps.findIndex((s) => s.name === stepName);
    if (index !== -1) return { steps, index };
  }
  return null;
}

// Applies an add/edit/delete operation to a named step inside a GitHub Actions
// workflow YAML string and returns the updated YAML plus the before/after
// state of the affected step (used for history logging).
// New steps are appended to the first job.
export function customizePipeline(yaml, operation, stepName, step) {
  const workflow = load(yaml);
  const allSteps = getAllSteps(workflow);
  const found = findStep(allSteps, stepName);
  const beforeStep = found ? found.steps[found.index] : null;

  if (operation === 'add') {
    if (!step) throw new Error('`step` is required for the add operation');
    if (found) throw new Error(`A step named "${stepName}" already exists`);
    allSteps[0].push({ name: stepName, ...step });
  } else if (operation === 'edit') {
    if (!found) throw new Error(`No step named "${stepName}" found`);
    if (!step) throw new Error('`step` is required for the edit operation');
    found.steps[found.index] = { ...found.steps[found.index], ...step, name: stepName };
  } else if (operation === 'delete') {
    if (!found) throw new Error(`No step named "${stepName}" found`);
    found.steps.splice(found.index, 1);
  } else {
    throw new Error(`Unknown operation "${operation}" — must be add, edit, or delete`);
  }

  const afterStep = operation === 'delete'
    ? null
    : findStep(allSteps, stepName)?.steps.find((s) => s.name === stepName) || null;

  const updatedYaml = dump(workflow, { lineWidth: -1 });

  return { yaml: updatedYaml, beforeStep, afterStep };
}
