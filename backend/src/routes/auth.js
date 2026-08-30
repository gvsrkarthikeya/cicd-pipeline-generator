import { Router } from 'express';
import bcrypt from 'bcryptjs';
import supabase from '../lib/supabase.js';
import { generateToken } from '../lib/jwt.js';

const router = Router();

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

export default router;