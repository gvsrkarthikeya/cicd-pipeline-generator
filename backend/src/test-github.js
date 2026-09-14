import { analyzeRepo } from './core/analyzer.js';
import { runInferenceEngine } from './core/inferenceEngine.js';
import { generateYaml } from './core/yamlGenerator.js';

const test = async (label, url, branch) => {
  console.log(`\n=== ${label} ===`);
  const result = await analyzeRepo(url, branch);
  if (!result.success) {
    console.log('Failed:', result.error);
    return;
  }
  console.log('Analysis:', JSON.stringify(result.analysis, null, 2));
  console.log('Reasoning steps:', result.reasoning.length);

  const inference = runInferenceEngine(result, branch);
  console.log('Decisions:', JSON.stringify(inference.decisions, null, 2));
  console.log('Overall confidence:', inference.confidence);
  console.log('Trail steps:', inference.trail.length);

  const repoName = url.split('/').slice(-2).join('/');
  const pipeline = generateYaml(inference, repoName);
  if (!pipeline.success) {
    console.log('YAML generation failed:', pipeline.error);
    return;
  }
  console.log('Generated YAML:\n' + pipeline.yaml);
};

await test('Flask repo', 'https://github.com/pallets/flask', 'main');
await test('Express repo', 'https://github.com/expressjs/express', 'master');
await test('Unknown stack', 'https://github.com/torvalds/linux', 'master');