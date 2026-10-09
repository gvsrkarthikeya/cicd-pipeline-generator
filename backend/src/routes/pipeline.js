import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import supabase from '../lib/supabase.js';
import { analyzeRepo } from '../core/analyzer.js';
import { runInferenceEngine } from '../core/inferenceEngine.js';
import { generateYaml } from '../core/yamlGenerator.js';
import { explainDecision } from '../core/explainability.js';
import { recommendOptimizations } from '../core/recommender.js';
import { customizePipeline } from '../core/pipelineCustomizer.js';

const router = Router();

// POST /api/pipeline/generate — run the full core engine for a saved repo
// and persist the generated pipeline
router.post('/generate', protect, async (req, res) => {
  const { repoId } = req.body;

  if (!repoId) return res.status(400).json({ error: 'repoId is required' });

  try {
    const { data: repo, error: repoError } = await supabase
      .from('repos')
      .select('*')
      .eq('id', repoId)
      .eq('user_id', req.userId)
      .single();

    if (repoError || !repo) return res.status(404).json({ error: 'Repo not found' });

    const analysis = await analyzeRepo(repo.repo_url, repo.branch);
    if (!analysis.success) return res.status(400).json({ error: analysis.error });

    const inference = runInferenceEngine(analysis, repo.branch);
    if (!inference.success) return res.status(500).json({ error: inference.error });

    const repoName = repo.repo_url.split('/').filter(Boolean).slice(-2).join('/');
    const pipeline = generateYaml(inference, repoName);
    if (!pipeline.success) return res.status(500).json({ error: pipeline.error });

    const explanation = explainDecision(analysis, inference, pipeline);
    const optimizations = recommendOptimizations(analysis, inference);

    // Refresh the repo's stored analysis snapshot
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

    // Log this generation as a history entry so the repo has an auditable trail
    await supabase.from('history').insert({
      repo_id: repoId,
      user_id: req.userId,
      action: 'ADD',
      step_name: 'pipeline_generated',
      after_state: { yaml: pipeline.yaml }
    });

    res.status(201).json({
      pipeline: savedPipeline,
      analysis: analysis.analysis,
      decisions: inference.decisions,
      explanationSummary: explanation.summary,
      recommendations: optimizations.recommendations
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/pipeline/:repoId — apply an add/edit/delete step customization to
// the repo's most recently generated pipeline, persist the new version, and
// log the change to history
router.put('/:repoId', protect, async (req, res) => {
  const { operation, stepName, step } = req.body;

  if (!operation || !['add', 'edit', 'delete'].includes(operation)) {
    return res.status(400).json({ error: 'operation must be one of add, edit, delete' });
  }
  if (!stepName) return res.status(400).json({ error: 'stepName is required' });

  try {
    const { data: repo, error: repoError } = await supabase
      .from('repos')
      .select('id')
      .eq('id', req.params.repoId)
      .eq('user_id', req.userId)
      .single();

    if (repoError || !repo) return res.status(404).json({ error: 'Repo not found' });

    const { data: existingPipeline, error: fetchError } = await supabase
      .from('pipelines')
      .select('*')
      .eq('repo_id', req.params.repoId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (fetchError || !existingPipeline) {
      return res.status(404).json({ error: 'No pipeline found for this repo' });
    }

    let customized;
    try {
      customized = customizePipeline(existingPipeline.yaml_content, operation, stepName, step);
    } catch (customizeErr) {
      return res.status(400).json({ error: customizeErr.message });
    }

    const { data: savedPipeline, error: saveError } = await supabase
      .from('pipelines')
      .insert({
        repo_id: req.params.repoId,
        yaml_content: customized.yaml,
        reasoning: existingPipeline.reasoning
      })
      .select('*')
      .single();

    if (saveError) throw saveError;

    const { data: historyEntry, error: historyError } = await supabase
      .from('history')
      .insert({
        repo_id: req.params.repoId,
        user_id: req.userId,
        action: operation.toUpperCase(),
        step_name: stepName,
        before_state: customized.beforeStep,
        after_state: customized.afterStep
      })
      .select('*')
      .single();

    if (historyError) throw historyError;

    res.status(200).json({ pipeline: savedPipeline, history: historyEntry });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/pipeline/:repoId — get the most recently generated pipeline for a repo
router.get('/:repoId', protect, async (req, res) => {
  try {
    const { data: repo, error: repoError } = await supabase
      .from('repos')
      .select('id')
      .eq('id', req.params.repoId)
      .eq('user_id', req.userId)
      .single();

    if (repoError || !repo) return res.status(404).json({ error: 'Repo not found' });

    const { data, error } = await supabase
      .from('pipelines')
      .select('*')
      .eq('repo_id', req.params.repoId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) return res.status(404).json({ error: 'No pipeline found for this repo' });
    res.json({ pipeline: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
