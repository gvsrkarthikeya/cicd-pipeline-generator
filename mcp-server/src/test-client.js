import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const transport = new StdioClientTransport({
  command: 'node',
  args: ['src/index.js']
});

const client = new Client({ name: 'test-client', version: '1.0.0' });
await client.connect(transport);

const { tools } = await client.listTools();
console.log('Registered tools:', tools.map((t) => t.name));

const result = await client.callTool({
  name: 'generate_pipeline',
  arguments: { repoUrl: 'https://github.com/pallets/flask', branch: 'main' }
});

console.log('--- generate_pipeline result ---');
for (const item of result.content) {
  console.log(item.text);
}

const customized = await client.callTool({
  name: 'customize_pipeline',
  arguments: {
    yaml: result.content[0].text,
    operation: 'add',
    stepName: 'Lint code',
    step: { run: 'flake8 .' }
  }
});

console.log('--- customize_pipeline (add lint step) result ---');
for (const item of customized.content) {
  console.log(item.text);
}

const deleted = await client.callTool({
  name: 'customize_pipeline',
  arguments: {
    yaml: customized.content[0].text,
    operation: 'delete',
    stepName: 'Lint code'
  }
});

console.log('--- customize_pipeline (delete lint step) result ---');
for (const item of deleted.content) {
  console.log(item.text);
}

await client.close();
process.exit(0);
