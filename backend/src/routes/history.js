import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import supabase from '../lib/supabase.js';

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

export default router;
