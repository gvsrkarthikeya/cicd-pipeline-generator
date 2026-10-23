// Shared helper that runs the full core engine (inference -> YAML generation
// -> explainability -> recommendations) for a saved repo and persists the
// result. Used by both the pipeline generate/re-run endpoint and the repo
// creation endpoint (so a newly added repo gets a pipeline automatically).

import supabase from '../lib/supabase.js';
import { analyzeRepo } from './analyzer.js';
import { runInferenceEngine } from './inferenceEngine.js';
import { generateYaml } from './yamlGenerator.js';
import { explainDecision } from './explainability.js';
import { recommendOptimizations } from './recommender.js';

export async function generateAndSavePipeline({
  repoId,
  repoUrl,
  branch,
  userId,
  githubToken = null,
  existingAnalysis = null
}) {
  const analysis = existingAnalysis ?? (await analyzeRepo(repoUrl, branch, githubToken));
  if (!analysis.success) {
    return { success: false, error: analysis.error };
  }

  const inference = runInferenceEngine(analysis, branch);
  if (!inference.success) {
    return { success: false, error: inference.error };
  }

  const repoName = repoUrl.split('/').filter(Boolean).slice(-2).join('/');
  const pipeline = generateYaml(inference, repoName);
  if (!pipeline.success) {
    return { success: false, error: pipeline.error };
  }

  const explanation = explainDecision(analysis, inference, pipeline);
  const optimizations = recommendOptimizations(analysis, inference);

  await supabase
    .from('repos')
    .update({ detected_stack: analysis, last_analyzed_at: new Date().toISOString() })
    .eq('id', repoId);

  const { data: savedPipeline, error: saveError } = await supabase
    .from('pipelines')
    .insert({
      repo_id: repoId,
      yaml_content: pipeline.yaml,
      reasoning: explanation.trail
    })
    .select('*')
    .single();

  if (saveError) throw saveError;

  await supabase.from('history').insert({
    repo_id: repoId,
    user_id: userId,
    action: 'ADD',
    step_name: 'pipeline_generated',
    after_state: { yaml: pipeline.yaml }
  });

  return {
    success: true,
    analysis,
    pipeline: savedPipeline,
    decisions: inference.decisions,
    explanationSummary: explanation.summary,
    recommendations: optimizations.success ? optimizations.recommendations : []
  };
}
