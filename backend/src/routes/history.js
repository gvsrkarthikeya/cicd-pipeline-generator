import { Router } from 'express';
import { randomUUID } from 'crypto';
import { protect } from '../middleware/auth.js';
import supabase from '../lib/supabase.js';
import { customizePipeline } from '../core/pipelineCustomizer.js';

const router = Router();

// GET /api/history/:repoId — list modification history for a repo
router.get('/:repoId', protect, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('history')
      .select('*')
      .eq('repo_id', req.params.repoId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ history: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/history/:repoId — log a modification (ADD/EDIT/DELETE)
router.post('/:repoId', protect, async (req, res) => {
  const { action, stepName, beforeState, afterState } = req.body;

  if (!action || !['ADD', 'EDIT', 'DELETE'].includes(action)) {
    return res.status(400).json({ error: 'action must be one of ADD, EDIT, DELETE' });
  }

  try {
    const { data, error } = await supabase
      .from('history')
      .insert({
        repo_id: req.params.repoId,
        user_id: req.userId,
        action,
        step_name: stepName,
        before_state: beforeState,
        after_state: afterState
      })
      .select('*')
      .single();

    if (error) throw error;
    res.status(201).json({ history: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/history/:historyId/share — generate (or return existing) a
// public share_id for a history entry so it can be viewed without auth
router.post('/:historyId/share', protect, async (req, res) => {
  try {
    const { data: entry, error: fetchError } = await supabase
      .from('history')
      .select('*')
      .eq('id', req.params.historyId)
      .eq('user_id', req.userId)
      .single();

    if (fetchError || !entry) return res.status(404).json({ error: 'History entry not found' });

    if (entry.share_id) {
      return res.json({ shareId: entry.share_id });
    }

    const shareId = randomUUID();

    const { error: updateError } = await supabase
      .from('history')
      .update({ share_id: shareId })
      .eq('id', req.params.historyId);

    if (updateError) throw updateError;

    res.status(201).json({ shareId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/history/:historyId/revert — undo a previously logged ADD/EDIT/DELETE
// change by applying the inverse operation to the repo's current pipeline
router.post('/:historyId/revert', protect, async (req, res) => {
  try {
    const { data: entry, error: fetchError } = await supabase
      .from('history')
      .select('*')
      .eq('id', req.params.historyId)
      .eq('user_id', req.userId)
      .single();

    if (fetchError || !entry) return res.status(404).json({ error: 'History entry not found' });

    const { data: existingPipeline, error: pipelineError } = await supabase
      .from('pipelines')
      .select('*')
      .eq('repo_id', entry.repo_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (pipelineError || !existingPipeline) {
      return res.status(404).json({ error: 'No pipeline found for this repo' });
    }

    // Compute the inverse of the original action so the history timeline
    // continues to read correctly (ADD -> delete, DELETE -> add, EDIT -> edit)
    let inverseOperation;
    let inverseStep;
    if (entry.action === 'ADD') {
      inverseOperation = 'delete';
    } else if (entry.action === 'DELETE') {
      inverseOperation = 'add';
      inverseStep = entry.before_state;
    } else if (entry.action === 'EDIT') {
      inverseOperation = 'edit';
      inverseStep = entry.before_state;
    } else {
      return res.status(400).json({ error: `Cannot revert action "${entry.action}"` });
    }

    if (inverseOperation !== 'delete' && !inverseStep) {
      return res.status(400).json({ error: 'No prior state recorded for this change' });
    }

    let customized;
    try {
      customized = customizePipeline(
        existingPipeline.yaml_content,
        inverseOperation,
        entry.step_name,
        inverseStep
      );
    } catch (customizeErr) {
      return res.status(400).json({ error: customizeErr.message });
    }

    const { data: savedPipeline, error: saveError } = await supabase
      .from('pipelines')
      .insert({
        repo_id: entry.repo_id,
        yaml_content: customized.yaml,
        reasoning: existingPipeline.reasoning
      })
      .select('*')
      .single();

    if (saveError) throw saveError;

    const { data: historyEntry, error: historyError } = await supabase
      .from('history')
      .insert({
        repo_id: entry.repo_id,
        user_id: req.userId,
        action: inverseOperation.toUpperCase(),
        step_name: entry.step_name,
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

export default router;
