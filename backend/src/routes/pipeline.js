import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import supabase from '../lib/supabase.js';
import { runInferenceEngine } from '../core/inferenceEngine.js';
import { recommendOptimizations } from '../core/recommender.js';
import { customizePipeline } from '../core/pipelineCustomizer.js';
import { generateAndSavePipeline } from '../core/pipelineService.js';
import { applyRecommendation, APPLIABLE_RECOMMENDATION_TITLES } from '../core/applyRecommendation.js';

const router = Router();

// POST /api/pipeline/generate — run the full core engine for a saved repo
// and persist the generated pipeline
router.post('/generate', protect, async (req, res) => {
  const { repoId, branch: branchOverride } = req.body;

  if (!repoId) return res.status(400).json({ error: 'repoId is required' });

  try {
    const { data: repo, error: repoError } = await supabase
      .from('repos')
      .select('*')
      .eq('id', repoId)
      .eq('user_id', req.userId)
      .single();

    if (repoError || !repo) return res.status(404).json({ error: 'Repo not found' });

    const branch = branchOverride?.trim() || repo.branch;

    if (branch !== repo.branch) {
      const { error: branchUpdateError } = await supabase
        .from('repos')
        .update({ branch })
        .eq('id', repoId)
        .eq('user_id', req.userId);

      if (branchUpdateError) throw branchUpdateError;
    }

    const result = await generateAndSavePipeline({
      repoId,
      repoUrl: repo.repo_url,
      branch,
      userId: req.userId,
      githubToken: repo.is_private ? repo.github_token : null
    });

    if (!result.success) return res.status(400).json({ error: result.error });

    res.status(201).json({
      pipeline: result.pipeline,
      analysis: result.analysis.analysis,
      decisions: result.decisions,
      explanationSummary: result.explanationSummary,
      recommendations: result.recommendations
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

// GET /api/pipeline/:repoId/recommendations — recompute optimization
// suggestions from the repo's last stored analysis (no re-fetch from GitHub)
router.get('/:repoId/recommendations', protect, async (req, res) => {
  try {
    const { data: repo, error: repoError } = await supabase
      .from('repos')
      .select('*')
      .eq('id', req.params.repoId)
      .eq('user_id', req.userId)
      .single();

    if (repoError || !repo) return res.status(404).json({ error: 'Repo not found' });
    if (!repo.detected_stack) {
      return res.status(404).json({ error: 'Repo has not been analyzed yet' });
    }

    const inference = runInferenceEngine(repo.detected_stack, repo.branch);
    if (!inference.success) return res.status(500).json({ error: inference.error });

    const optimizations = recommendOptimizations(repo.detected_stack, inference);
    if (!optimizations.success) return res.status(500).json({ error: optimizations.error });

    res.json({
      recommendations: optimizations.recommendations,
      summary: optimizations.summary,
      appliableTitles: APPLIABLE_RECOMMENDATION_TITLES,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/pipeline/:repoId/apply-recommendation — apply a supported
// recommendation (by title) directly to the repo's most recent pipeline,
// persist the new version, and log the change to history.
router.post('/:repoId/apply-recommendation', protect, async (req, res) => {
  const { title } = req.body;

  if (!title) return res.status(400).json({ error: 'title is required' });

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

    let applied;
    try {
      applied = applyRecommendation(existingPipeline.yaml_content, title);
    } catch (applyErr) {
      return res.status(400).json({ error: applyErr.message });
    }

    const { data: savedPipeline, error: saveError } = await supabase
      .from('pipelines')
      .insert({
        repo_id: req.params.repoId,
        yaml_content: applied.yaml,
        reasoning: existingPipeline.reasoning,
      })
      .select('*')
      .single();

    if (saveError) throw saveError;

    const { data: historyEntry, error: historyError } = await supabase
      .from('history')
      .insert({
        repo_id: req.params.repoId,
        user_id: req.userId,
        action: 'EDIT',
        step_name: title,
        before_state: null,
        after_state: { description: applied.description },
      })
      .select('*')
      .single();

    if (historyError) throw historyError;

    res.status(200).json({ pipeline: savedPipeline, history: historyEntry, description: applied.description });
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
