import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import supabase from '../lib/supabase.js';
import { analyzeRepo } from '../core/analyzer.js';
import { generateAndSavePipeline } from '../core/pipelineService.js';
import { verifyRepoAccess, getDefaultBranch } from '../lib/github.js';

const router = Router();

// POST /api/repos/verify-token — check that a pasted GitHub PAT actually
// grants access to the given repo before the frontend marks it "authorized"
router.post('/verify-token', protect, async (req, res) => {
  const { repoUrl, githubToken } = req.body;

  if (!repoUrl) return res.status(400).json({ error: 'repoUrl is required' });
  if (!githubToken) return res.status(400).json({ error: 'githubToken is required' });

  try {
    const result = await verifyRepoAccess(repoUrl, githubToken);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

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

// GET /api/repos/:id — fetch a single repo owned by the current user
router.get('/:id', protect, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('repos')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Repo not found' });
    res.json({ repo: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/repos/:id — remove a repo owned by the current user. Cascades
// to its pipelines/history rows via the DB foreign keys.
router.delete('/:id', protect, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('repos')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .select('id')
      .single();

    if (error || !data) return res.status(404).json({ error: 'Repo not found' });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/repos — add a new repo: analyze it and save the result
router.post('/', protect, async (req, res) => {
  const { repoUrl, branch: branchInput, isPrivate = false, githubToken } = req.body;

  if (!repoUrl) return res.status(400).json({ error: 'repoUrl is required' });
  if (isPrivate && !githubToken) {
    return res.status(400).json({ error: 'githubToken is required for private repositories' });
  }

  try {
    // When the user leaves the branch field blank, resolve the repo's actual
    // default branch (e.g. "master" for expressjs/express) instead of
    // assuming "main", which 404s on repos that still default to "master".
    const branch = branchInput?.trim() || (await getDefaultBranch(repoUrl, isPrivate ? githubToken : null));

    const analysis = await analyzeRepo(repoUrl, branch, isPrivate ? githubToken : null);
    if (!analysis.success) return res.status(400).json({ error: analysis.error });

    const { data: repo, error } = await supabase
      .from('repos')
      .insert({
        user_id: req.userId,
        repo_url: repoUrl,
        branch,
        is_private: isPrivate,
        github_token: isPrivate ? githubToken : null,
        detected_stack: analysis,
        last_analyzed_at: new Date().toISOString()
      })
      .select('*')
      .single();

    if (error) throw error;

    // Automatically generate the pipeline right away so the repo is fully
    // ready (Pipeline/History/Recommendations tabs populated) as soon as
    // it's added, instead of leaving it empty until a manual re-run.
    const pipelineResult = await generateAndSavePipeline({
      repoId: repo.id,
      repoUrl,
      branch,
      userId: req.userId,
      githubToken: isPrivate ? githubToken : null,
      existingAnalysis: analysis
    });

    res.status(201).json({ repo, pipelineGenerated: pipelineResult.success });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
