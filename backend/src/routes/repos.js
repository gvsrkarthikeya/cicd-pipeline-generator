import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import supabase from '../lib/supabase.js';
import { analyzeRepo } from '../core/analyzer.js';

const router = Router();

// GET /api/repos — list the current user's saved repos
router.get('/', protect, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('repos')
      .select('*')
      .eq('user_id', req.userId)
      .order('last_analyzed_at', { ascending: false });

    if (error) throw error;
    res.json({ repos: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/repos — add a new repo: analyze it and save the result
router.post('/', protect, async (req, res) => {
  const { repoUrl, branch = 'main' } = req.body;

  if (!repoUrl) return res.status(400).json({ error: 'repoUrl is required' });

  try {
    const analysis = await analyzeRepo(repoUrl, branch);
    if (!analysis.success) return res.status(400).json({ error: analysis.error });

    const { data: repo, error } = await supabase
      .from('repos')
      .insert({
        user_id: req.userId,
        repo_url: repoUrl,
        branch,
        detected_stack: analysis,
        last_analyzed_at: new Date().toISOString()
      })
      .select('*')
      .single();

    if (error) throw error;
    res.status(201).json({ repo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
