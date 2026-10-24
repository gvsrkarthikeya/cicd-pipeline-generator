import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY,
    {
        realtime: {
            transport: ws
        }
    }
);

export default supabase;