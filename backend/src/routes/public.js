import { Router } from 'express';
import supabase from '../lib/supabase.js';

const router = Router();

// GET /api/public/pipeline/:shareId — fetch a shared pipeline snapshot with
// no authentication required. Only returns entries that have an explicit
// share_id set (via POST /api/history/:historyId/share).
router.get('/pipeline/:shareId', async (req, res) => {
  try {
    const { data: entry, error } = await supabase
      .from('history')
      .select('action, step_name, before_state, after_state, created_at')
      .eq('share_id', req.params.shareId)
      .single();

    if (error || !entry) return res.status(404).json({ error: 'Shared pipeline not found' });

    res.json({ snapshot: entry });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
