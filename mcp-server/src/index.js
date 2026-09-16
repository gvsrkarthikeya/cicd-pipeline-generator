import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { registerAnalyzeRepo } from './tools/analyzeRepo.js';
import { registerGeneratePipeline } from './tools/generatePipeline.js';
import { registerExplainDecision } from './tools/explainDecision.js';
import { registerSuggestOptimizations } from './tools/suggestOptimizations.js';
import { registerCustomizePipeline } from './tools/customizePipeline.js';

const server = new McpServer(
    { name: 'cicd-generator', version: '1.0.0' },
    { capabilities: { tools: {} } }
);

// Register tools
registerAnalyzeRepo(server);
registerGeneratePipeline(server);
registerExplainDecision(server);
registerSuggestOptimizations(server);
registerCustomizePipeline(server);

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('cicd-generator MCP server running on stdio');
}

main().catch((err) => {
    console.error('Fatal error starting MCP server:', err);
    process.exit(1);
});