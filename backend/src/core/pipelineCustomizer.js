import { load, dump } from 'js-yaml';

function getSteps(workflow) {
  const jobNames = Object.keys(workflow.jobs || {});
  if (jobNames.length === 0) throw new Error('Workflow has no jobs to modify');
  const jobName = jobNames[0];
  workflow.jobs[jobName].steps = workflow.jobs[jobName].steps || [];
  return workflow.jobs[jobName].steps;
}

// Applies an add/edit/delete operation to a named step inside a GitHub Actions
// workflow YAML string and returns the updated YAML plus the before/after
// state of the affected step (used for history logging).
export function customizePipeline(yaml, operation, stepName, step) {
  const workflow = load(yaml);
  const steps = getSteps(workflow);
  const existingIndex = steps.findIndex((s) => s.name === stepName);
  const beforeStep = existingIndex !== -1 ? steps[existingIndex] : null;

  if (operation === 'add') {
    if (!step) throw new Error('`step` is required for the add operation');
    if (existingIndex !== -1) throw new Error(`A step named "${stepName}" already exists`);
    steps.push({ name: stepName, ...step });
  } else if (operation === 'edit') {
    if (existingIndex === -1) throw new Error(`No step named "${stepName}" found`);
    if (!step) throw new Error('`step` is required for the edit operation');
    steps[existingIndex] = { ...steps[existingIndex], ...step, name: stepName };
  } else if (operation === 'delete') {
    if (existingIndex === -1) throw new Error(`No step named "${stepName}" found`);
    steps.splice(existingIndex, 1);
  } else {
    throw new Error(`Unknown operation "${operation}" — must be add, edit, or delete`);
  }

  const afterStep = operation === 'delete'
    ? null
    : steps.find((s) => s.name === stepName) || null;

  const updatedYaml = dump(workflow, { lineWidth: -1 });

  return { yaml: updatedYaml, beforeStep, afterStep };
}
