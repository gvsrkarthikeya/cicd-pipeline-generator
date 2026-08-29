import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

config();

import authRoutes from './routes/auth.js';
import reposRoutes from './routes/repos.js';
import pipelineRoutes from './routes/pipeline.js';
import historyRoutes from './routes/history.js';

const app = express();
app.use(express.json());
app.use(cors());

app.use('/api/auth', authRoutes);
app.use('/api/repos', reposRoutes);
app.use('/api/pipeline', pipelineRoutes);
app.use('/api/history', historyRoutes);

if (process.env.NODE_ENV === 'production') {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    app.use(express.static(path.join(__dirname, '../../frontend/dist')));
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
    });
}

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));