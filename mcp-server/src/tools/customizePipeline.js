import { z } from 'zod';
import { load, dump } from 'js-yaml';

function getSteps(workflow) {
  const jobNames = Object.keys(workflow.jobs || {});
  if (jobNames.length === 0) throw new Error('Workflow has no jobs to modify');
  const jobName = jobNames[0];
  workflow.jobs[jobName].steps = workflow.jobs[jobName].steps || [];
  return workflow.jobs[jobName].steps;
}

export function registerCustomizePipeline(server) {
  server.registerTool(
    'customize_pipeline',
    {
      title: 'Customize Pipeline',
      description:
        'Adds, edits, or deletes a step in an existing GitHub Actions YAML pipeline and returns the updated YAML.',
      inputSchema: {
        yaml: z.string().describe('The existing GitHub Actions workflow YAML content'),
        operation: z.enum(['add', 'edit', 'delete']).describe('The modification to perform'),
        stepName: z.string().describe('The `name` of the step to add/edit/delete'),
        step: z
          .object({
            name: z.string().optional(),
            uses: z.string().optional(),
            run: z.string().optional(),
            with: z.record(z.any()).optional()
          })
          .optional()
          .describe('Step definition, required for add/edit operations')
      }
    },
    async ({ yaml, operation, stepName, step }) => {
      try {
        const workflow = load(yaml);
        const steps = getSteps(workflow);
        const existingIndex = steps.findIndex((s) => s.name === stepName);

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
        }

        const updatedYaml = dump(workflow, { lineWidth: -1 });

        return {
          content: [{ type: 'text', text: updatedYaml }]
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Customization failed: ${err.message}` }]
        };
      }
    }
  );
}
