import { z } from 'zod';
import { analyzeRepo } from '../../../backend/src/core/analyzer.js';
import { runInferenceEngine } from '../../../backend/src/core/inferenceEngine.js';
import { generateYaml } from '../../../backend/src/core/yamlGenerator.js';

function repoNameFromUrl(repoUrl) {
  return repoUrl.split('/').filter(Boolean).slice(-2).join('/');
}

export function registerGeneratePipeline(server) {
  server.registerTool(
    'generate_pipeline',
    {
      title: 'Generate CI/CD Pipeline',
      description:
        'Analyzes a GitHub repository and generates a complete GitHub Actions CI/CD pipeline YAML, along with the decisions that produced it.',
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
      if (!pipeline.success) {
        return { isError: true, content: [{ type: 'text', text: `YAML generation failed: ${pipeline.error}` }] };
      }

      return {
        content: [
          { type: 'text', text: pipeline.yaml },
          { type: 'text', text: JSON.stringify({ decisions: inference.decisions, confidence: inference.confidence }, null, 2) }
        ]
      };
    }
  );
}
