-- Tab. Student Finance Tracker — schema

DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS budget;

-- Single row holding the overall monthly budget.
-- (One row for now since there's no multi-user auth yet.)
CREATE TABLE budget (
  id             SERIAL PRIMARY KEY,
  monthly_total  NUMERIC(10,2) NOT NULL
);

-- Spending categories: Food, Books & Stationery, Entertainment, Rent/Hostel...
-- color_key/slug map directly to the CSS classes already in styles.css
-- (dot-blue, pill-food, --blue-500 etc.)
CREATE TABLE categories (
  id             SERIAL PRIMARY KEY,
  name           VARCHAR(50)  NOT NULL,
  slug           VARCHAR(30)  NOT NULL UNIQUE,  -- 'food', 'books', 'entertainment', 'rent'
  color_key      VARCHAR(20)  NOT NULL,          -- 'blue', 'purple', 'indigo', 'teal'
  monthly_limit  NUMERIC(10,2) NOT NULL
);

-- Individual logged expenses
CREATE TABLE transactions (
  id           SERIAL PRIMARY KEY,
  category_id  INT REFERENCES categories(id) ON DELETE SET NULL,
  description  VARCHAR(255) NOT NULL,
  amount       NUMERIC(10,2) NOT NULL,
  txn_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transactions_date ON transactions (txn_date DESC);
