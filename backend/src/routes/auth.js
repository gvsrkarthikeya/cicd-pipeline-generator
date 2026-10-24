import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import supabase from '../lib/supabase.js';
import { generateToken } from '../lib/jwt.js';
import { protect } from '../middleware/auth.js';

const router = Router();

// A short fingerprint of the user's current password hash, embedded in
// password-reset tokens. Once the password changes, the fingerprint no
// longer matches, which invalidates any outstanding reset tokens without
// needing a dedicated "used tokens" table.
function passwordFingerprint(passwordHash) {
  return crypto.createHash('sha256').update(passwordHash).digest('hex').slice(0, 16);
}


// POST /api/auth/signup
router.post('/signup', async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password)
        return res.status(400).json({ error: 'All fields required' });

    try {
        // Check if user already exists
        const { data: existing } = await supabase
            .from('users')
            .select('id')
            .eq('email', email)
            .single();

        if (existing)
            return res.status(400).json({ error: 'Email already registered' });

        // Hash password
        const password_hash = await bcrypt.hash(password, 10);

        // Insert user
        const { data: user, error } = await supabase
            .from('users')
            .insert({ name, email, password_hash })
            .select('id, name, email')
            .single();

        if (error) throw error;

        const token = generateToken(user.id);
        res.status(201).json({ token, user });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password)
        return res.status(400).json({ error: 'Email and password required' });

    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (error || !user)
            return res.status(401).json({ error: 'Invalid credentials' });

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid)
            return res.status(401).json({ error: 'Invalid credentials' });

        const token = generateToken(user.id);
        res.json({ token, user: { id: user.id, name: user.name, email: user.email } });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/auth/me — fetch the current user's profile
router.get('/me', protect, async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email, created_at')
      .eq('id', req.userId)
      .single();

    if (error || !user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/auth/profile — update the current user's display name
router.put('/profile', protect, async (req, res) => {
  const name = req.body.name?.trim();

  if (!name) return res.status(400).json({ error: 'Name is required' });

  try {
    const { data: user, error } = await supabase
      .from('users')
      .update({ name })
      .eq('id', req.userId)
      .select('id, name, email')
      .single();

    if (error || !user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/auth/password — change the current user's password (requires the
// current password)
router.put('/password', protect, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new password are required' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, password_hash')
      .eq('id', req.userId)
      .single();

    if (error || !user) return res.status(404).json({ error: 'User not found' });

    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

    const password_hash = await bcrypt.hash(newPassword, 10);
    const { error: updateError } = await supabase
      .from('users')
      .update({ password_hash })
      .eq('id', req.userId);

    if (updateError) throw updateError;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/forgot-password — issues a short-lived reset token.
// There's no email provider wired up yet, so the reset link is returned
// directly in the response instead of being emailed.
router.post('/forgot-password', async (req, res) => {
  const email = req.body.email?.trim();

  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    const { data: user } = await supabase
      .from('users')
      .select('id, password_hash')
      .eq('email', email)
      .single();

    // Always respond with 200 regardless of whether the email exists, to
    // avoid leaking which emails are registered.
    if (!user) return res.json({ success: true });

    const resetToken = jwt.sign(
      { userId: user.id, purpose: 'reset', pwv: passwordFingerprint(user.password_hash) },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    res.json({ success: true, resetToken });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/reset-password — consumes a reset token issued above
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;

  if (!token || !password) return res.status(400).json({ error: 'Token and password are required' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  try {
    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(400).json({ error: 'This reset link is invalid or has expired' });
    }

    if (payload.purpose !== 'reset') {
      return res.status(400).json({ error: 'This reset link is invalid or has expired' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('id, password_hash')
      .eq('id', payload.userId)
      .single();

    if (error || !user) return res.status(400).json({ error: 'This reset link is invalid or has expired' });
    if (passwordFingerprint(user.password_hash) !== payload.pwv) {
      return res.status(400).json({ error: 'This reset link has already been used' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const { error: updateError } = await supabase
      .from('users')
      .update({ password_hash })
      .eq('id', user.id);

    if (updateError) throw updateError;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;