// server.js — Tab. Student Finance Tracker API
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const pool = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve the frontend (index.html, styles.css, app.js) as static files.
// In dev you can also run the frontend separately on live-server —
// cors() above makes that work too.
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Helpers ----------

// Recomputes everything the dashboard needs from the two source tables.
// Nothing about "spent" or "remaining" is stored — it's always derived
// from transactions, so the numbers can never drift out of sync.
async function getDashboardData() {
  const { rows: [budgetRow] } = await pool.query('SELECT monthly_total FROM budget ORDER BY id LIMIT 1');
  const monthlyTotal = Number(budgetRow?.monthly_total || 0);

  const { rows: categories } = await pool.query(`
    SELECT
      c.id, c.name, c.slug, c.color_key, c.monthly_limit,
      COALESCE(SUM(t.amount), 0) AS spent
    FROM categories c
    LEFT JOIN transactions t ON t.category_id = c.id
    GROUP BY c.id
    ORDER BY c.id
  `);

  const totalSpent = categories.reduce((sum, c) => sum + Number(c.spent), 0);

  const { rows: transactions } = await pool.query(`
    SELECT t.id, t.description, t.amount, t.txn_date, c.name AS category_name, c.slug AS category_slug
    FROM transactions t
    LEFT JOIN categories c ON c.id = t.category_id
    ORDER BY t.txn_date DESC, t.id DESC
    LIMIT 5
  `);

  return {
    budget: {
      monthlyTotal,
      totalSpent,
      remaining: monthlyTotal - totalSpent,
      percentSpent: monthlyTotal ? Math.round((totalSpent / monthlyTotal) * 100) : 0,
    },
    categories: categories.map(c => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      colorKey: c.color_key,
      limit: Number(c.monthly_limit),
      spent: Number(c.spent),
      percent: c.monthly_limit > 0 ? Math.round((Number(c.spent) / Number(c.monthly_limit)) * 100) : 0,
    })),
    transactions: transactions.map(t => ({
      id: t.id,
      description: t.description,
      amount: Number(t.amount),
      date: t.txn_date,
      categoryName: t.category_name,
      categorySlug: t.category_slug,
    })),
  };
}

// ---------- Routes ----------

// Everything the dashboard needs in one round trip (used on page load).
app.get('/api/dashboard', async (req, res) => {
  try {
    res.json(await getDashboardData());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load dashboard data' });
  }
});

// Just the top-level numbers (budget / spent / remaining).
app.get('/api/summary', async (req, res) => {
  try {
    const { budget } = await getDashboardData();
    res.json(budget);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load summary' });
  }
});

// Just the category breakdown (for the rings).
app.get('/api/categories', async (req, res) => {
  try {
    const { categories } = await getDashboardData();
    res.json(categories);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load categories' });
  }
});

// Just the last 5 transactions (for the table).
app.get('/api/transactions', async (req, res) => {
  try {
    const { transactions } = await getDashboardData();
    res.json(transactions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load transactions' });
  }
});

// Add Expense form -> POST here
app.post('/api/expenses', async (req, res) => {
  const { amount, category, description, date } = req.body;

  if (!amount || !category || !description || !date) {
    return res.status(400).json({ error: 'amount, category, description and date are all required' });
  }
  if (Number(amount) <= 0) {
    return res.status(400).json({ error: 'amount must be greater than 0' });
  }

  try {
    const { rows: [cat] } = await pool.query('SELECT id FROM categories WHERE slug = $1', [category]);
    if (!cat) return res.status(400).json({ error: `Unknown category: ${category}` });

    await pool.query(
      `INSERT INTO transactions (category_id, description, amount, txn_date)
       VALUES ($1, $2, $3, $4)`,
      [cat.id, description, amount, date]
    );

    // Return the freshly recomputed dashboard so the frontend can
    // re-render everything from a single response.
    res.status(201).json(await getDashboardData());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add expense' });
  }
});

// Quick Budget Update form -> PUT here
// category = 'overall' updates the budget table, anything else updates that category's limit.
app.put('/api/budgets/:category', async (req, res) => {
  const { category } = req.params;
  const { amount } = req.body;

  if (!amount || Number(amount) <= 0) {
    return res.status(400).json({ error: 'amount must be greater than 0' });
  }

  try {
    if (category === 'overall') {
      await pool.query('UPDATE budget SET monthly_total = $1', [amount]);
    } else {
      const { rowCount } = await pool.query(
        'UPDATE categories SET monthly_limit = $1 WHERE slug = $2',
        [amount, category]
      );
      if (rowCount === 0) return res.status(400).json({ error: `Unknown category: ${category}` });
    }

    res.json(await getDashboardData());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update budget' });
  }
});

app.listen(PORT, () => {
  console.log(`Tab. API running at http://localhost:${PORT}`);
});
