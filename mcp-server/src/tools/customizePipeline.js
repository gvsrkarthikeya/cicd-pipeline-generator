import { z } from 'zod';
import { customizePipeline } from '../../../backend/src/core/pipelineCustomizer.js';

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
        const { yaml: updatedYaml } = customizePipeline(yaml, operation, stepName, step);

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

