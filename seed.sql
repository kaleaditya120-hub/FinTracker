-- Seed data — mirrors what was previously hardcoded in index.html,
-- so the dashboard looks identical on first run.

INSERT INTO budget (monthly_total) VALUES (1500.00);

INSERT INTO categories (name, slug, color_key, monthly_limit) VALUES
  ('Food',                 'food',          'blue',   300.00),
  ('Books & Stationery',   'books',         'purple', 150.00),
  ('Entertainment',        'entertainment', 'indigo', 100.00),
  ('Rent / Hostel',        'rent',          'teal',   950.00);

INSERT INTO transactions (category_id, description, amount, txn_date) VALUES
  ((SELECT id FROM categories WHERE slug = 'food'),          'Campus Coffee Cart',            4.50,  '2026-07-15'),
  ((SELECT id FROM categories WHERE slug = 'books'),         'Intro to Algorithms Textbook',   68.00, '2026-07-13'),
  ((SELECT id FROM categories WHERE slug = 'entertainment'), 'Movie Night — AMC',              18.75, '2026-07-11'),
  ((SELECT id FROM categories WHERE slug = 'rent'),          'Hostel Rent — July',             950.00, '2026-07-01'),
  ((SELECT id FROM categories WHERE slug = 'food'),          'Grocery Run — Trader Joe''s',    32.10, '2026-06-29');
