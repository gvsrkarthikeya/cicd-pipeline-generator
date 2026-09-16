import { z } from 'zod';
import { analyzeRepo } from '../../../backend/src/core/analyzer.js';
import { runInferenceEngine } from '../../../backend/src/core/inferenceEngine.js';
import { generateYaml } from '../../../backend/src/core/yamlGenerator.js';
import { explainDecision } from '../../../backend/src/core/explainability.js';

function repoNameFromUrl(repoUrl) {
  return repoUrl.split('/').filter(Boolean).slice(-2).join('/');
}

export function registerExplainDecision(server) {
  server.registerTool(
    'explain_decision',
    {
      title: 'Explain Pipeline Decisions',
      description:
        'Runs the full analysis + inference + YAML generation chain for a repository and returns a structured, human-readable reasoning trail explaining every decision made.',
      inputSchema: {
        repoUrl: z.string().describe('Full GitHub repository URL, e.g. https://github.com/owner/repo'),
        branch: z.string().optional().default('main').describe('Branch to target for triggers'),
        githubToken: z.string().optional().describe('GitHub token for private repos or higher rate limits')
      }
    },
    async ({ repoUrl, branch = 'main', githubToken }) => {
      const analysis = await analyzeRepo(repoUrl, branch, githubToken || null);
      if (!analysis.success) {
        return { isError: true, content: [{ type: 'text', text: `Analysis failed: ${analysis.error}` }] };
      }

      const inference = runInferenceEngine(analysis, branch);
      if (!inference.success) {
        return { isError: true, content: [{ type: 'text', text: `Inference failed: ${inference.error}` }] };
      }

      const pipeline = generateYaml(inference, repoNameFromUrl(repoUrl));

      const explanation = explainDecision(analysis, inference, pipeline.success ? pipeline : null);

      return {
        content: [{ type: 'text', text: JSON.stringify(explanation, null, 2) }]
      };
    }
  );
}
