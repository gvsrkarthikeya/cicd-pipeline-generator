import { z } from 'zod';
import { analyzeRepo } from '../../../backend/src/core/analyzer.js';
import { runInferenceEngine } from '../../../backend/src/core/inferenceEngine.js';
import { recommendOptimizations } from '../../../backend/src/core/recommender.js';

export function registerSuggestOptimizations(server) {
  server.registerTool(
    'suggest_optimizations',
    {
      title: 'Suggest Pipeline Optimizations',
      description:
        'Analyzes a GitHub repository and returns categorized optimization suggestions (performance, linting, security) for its CI/CD pipeline.',
      inputSchema: {
        repoUrl: z.string().describe('Full GitHub repository URL, e.g. https://github.com/owner/repo'),
        branch: z.string().optional().default('main').describe('Branch to analyze'),
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

      const optimizations = recommendOptimizations(analysis, inference);

      return {
        content: [{ type: 'text', text: JSON.stringify(optimizations, null, 2) }]
      };
    }
  );
}
