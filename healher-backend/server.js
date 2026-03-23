const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const https = require('https');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// PostgreSQL connection using the provided connection string
const pool = new Pool({
    connectionString: 'postgresql://healher_user:CRLC7wmXvCNvB5YARZKuTORXtwluYEjz@dpg-d6la2v5actks73bvk2v0-a.oregon-postgres.render.com/healher',
    ssl: {
        rejectUnauthorized: false
    }
});

pool.connect()
    .then(() => console.log('Connected to PostgreSQL successfully.'))
    .catch(err => console.error('Error connecting to PostgreSQL', err.stack));

// Catch idle pg client errors so they don't crash the Node process
pool.on('error', (err, client) => {
    console.error('Unexpected error on idle client', err);
});

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database schema (if not exists)
async function initDb() {
    const query = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_profiles (
      user_id INTEGER PRIMARY KEY REFERENCES users(id),
      full_name VARCHAR(255),
      age INTEGER,
      height INTEGER,
      weight INTEGER
    );
  `;
    try {
        await pool.query(query);
        console.log("Database schema initialized.");
    } catch (err) {
        console.error("Error initializing schema:", err);
    }
}
initDb();

// Routes
app.post('/api/signup', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        const query = 'INSERT INTO users(email, password) VALUES($1, $2) RETURNING id';
        const values = [email, password]; // Keeping plain text based on user request "yres" / implicit simple
        const result = await pool.query(query, values);

        res.status(201).json({ message: 'User created successfully', userId: result.rows[0].id });
    } catch (err) {
        if (err.code === '23505') { // unique violation
            return res.status(409).json({ error: 'Email already exists' });
        }
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        const query = 'SELECT * FROM users WHERE email = $1 AND password = $2';
        const values = [email, password];
        const result = await pool.query(query, values);

        if (result.rows.length > 0) {
            res.json({ message: 'Login successful', userId: result.rows[0].id });
        } else {
            res.status(401).json({ error: 'Invalid email or password' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/user-details', async (req, res) => {
    const { userId, fullName, age, height, weight } = req.body;

    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    try {
        // Upsert user profile
        const query = `
      INSERT INTO user_profiles(user_id, full_name, age, height, weight) 
      VALUES($1, $2, $3, $4, $5)
      ON CONFLICT (user_id) 
      DO UPDATE SET 
        full_name = EXCLUDED.full_name,
        age = EXCLUDED.age,
        height = EXCLUDED.height,
        weight = EXCLUDED.weight
    `;
        const values = [userId, fullName, age, height, weight];
        await pool.query(query, values);

        res.status(200).json({ message: 'User details saved successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PCOD logic derived from user Python input
app.post('/api/calculate-period-score', (req, res) => {
    const data = req.body;
    let score = 0;

    // 1. Period Duration
    if (data.duration === "2-5") score += 0;
    else if (data.duration === "6-7") score += 1;
    else if (data.duration === ">7") score += 2;

    // 2. Cycle Regularity
    if (data.regularity === "yes") score += 0;
    else if (data.regularity === "sometimes") score += 1;
    else if (data.regularity === "no") score += 2;

    // 3. Missed Periods
    if (data.missed === "no") score += 0;
    else if (data.missed === "yes") score += 2;

    // 4. Flow Type
    if (data.flow === "normal") score += 0;
    else if (data.flow === "light/heavy") score += 1;

    // 5. Heavy Bleeding / Clots
    if (data.clots === "no") score += 0;
    else if (data.clots === "yes") score += 1;

    // 6. Pain Severity
    if (data.pain === "mild") score += 0;
    else if (data.pain === "moderate") score += 1;
    else if (data.pain === "severe") score += 2;

    // 7. Cycle Change (last 6 months)
    if (data.cycle_change === "no") score += 0;
    else if (data.cycle_change === "yes") score += 1;

    // 8. Diagnosed PCOD
    if (data.pcod === "no" || data.pcod === "not_sure") score += 0;
    else if (data.pcod === "yes") score += 2;

    res.json({ score: score });
});

// OpenRouter AI Chat Proxy
app.post('/api/chat', (req, res) => {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Messages array is required' });
    }

    const dataPayload = JSON.stringify({
        "model": "nvidia/nemotron-3-super-120b-a12b:free",
        "messages": messages
    });

    console.log('Sending request to OpenRouter with model:', "nvidia/nemotron-3-super-120b-a12b:free");
    console.log('API Key starts with:', process.env.OPENROUTER_API_KEY ? process.env.OPENROUTER_API_KEY.substring(0, 10) : 'MISSING');

    const options = {
        hostname: 'openrouter.ai',
        path: '/api/v1/chat/completions',
        method: 'POST',
        headers: {
            "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "HTTP-Referer": "https://heal-her.onrender.com/",
            "X-Title": "HealHer Web App",
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(dataPayload)
        }
    };

    console.log('Request Headers:', JSON.stringify(options.headers, null, 2));

    let responseSent = false;

    const reqPost = https.request(options, (resPost) => {
        let result = '';
        resPost.on('data', chunk => { result += chunk; });
        resPost.on('end', () => {
            if (responseSent) return;
            responseSent = true;
            if (resPost.statusCode >= 400) {
                console.error(`OpenRouter Error (${resPost.statusCode}):`, result);
                return res.status(resPost.statusCode).json({ error: result });
            }
            try {
                res.json(JSON.parse(result));
            } catch (e) {
                console.error("Failed to parse OpenRouter response:", result);
                res.status(500).json({ error: "Failed to parse AI response" });
            }
        });
    });

    reqPost.on('error', (e) => {
        if (responseSent) return;
        responseSent = true;
        console.error("ChatProxy request error:", e.message);
        res.status(500).json({ error: 'AI proxy connection failed' });
    });

    reqPost.write(dataPayload);
    reqPost.end();
});

// Start the server
app.get('/api/user-details/:userId', async (req, res) => {
    const { userId } = req.params;

    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    try {
        const query = 'SELECT * FROM user_profiles WHERE user_id = $1';
        const result = await pool.query(query, [userId]);

        if (result.rows.length > 0) {
            res.json(result.rows[0]);
        } else {
            res.status(404).json({ error: 'User profile not found' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.listen(port, "0.0.0.0", () => {
    console.log(`Backend server running on port ${port}`);
});
