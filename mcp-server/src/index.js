const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');

const server = new Server(
    { name: 'cicd-generator', version: '1.0.0' },
    { capabilities: { tools: {} } }
);

// Register tools
require('./tools/analyzeRepo')(server);
require('./tools/generatePipeline')(server);
require('./tools/explainDecision')(server);
require('./tools/suggestOptimizations')(server);
require('./tools/customizePipeline')(server);

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}

main();