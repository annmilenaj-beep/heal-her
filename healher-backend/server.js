const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
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

app.listen(port, () => {
    console.log(`Backend server running on http://localhost:${port}`);
});
