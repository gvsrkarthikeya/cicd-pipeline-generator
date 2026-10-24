import { z } from 'zod';
import { analyzeRepo } from '../../../backend/src/core/analyzer.js';

export function registerAnalyzeRepo(server) {
  server.registerTool(
    'analyze_repo',
    {
      title: 'Analyze Repository',
      description:
        "Fetches a GitHub repository's file tree and key files, then detects its language, framework, test framework, linter, build tool, and deployment strategy.",
      inputSchema: {
        repoUrl: z.string().describe('Full GitHub repository URL, e.g. https://github.com/owner/repo'),
        branch: z.string().optional().default('main').describe('Branch to analyze'),
        githubToken: z.string().optional().describe('GitHub token for private repos or higher rate limits')
      }
    },
    async ({ repoUrl, branch = 'main', githubToken }) => {
      const result = await analyzeRepo(repoUrl, branch, githubToken || null);

      if (!result.success) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Analysis failed: ${result.error}` }]
        };
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
      };
    }
  );
}
