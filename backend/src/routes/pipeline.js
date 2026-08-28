import { Router } from 'express';

const router = Router();

router.post('/generate', (_req, res) => {
  res.json({ message: 'Pipeline generation ready' });
});

export default router;
