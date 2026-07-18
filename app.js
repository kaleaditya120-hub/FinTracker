// app.js — connects the static Tab. UI to the Express/PostgreSQL API.
// Everything here does one of three things:
//   1. Fetch /api/dashboard and paint the numbers into the page
//   2. Build the category ring cards + transaction rows from JSON
//   3. Intercept the two forms and POST/PUT to the API instead of reloading

const API_BASE = ''; // same-origin (Express serves this file); set to 'http://localhost:3000' if hosted separately

const money = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Splits "1234.50" into ["1,234", "50"] to match the .summary-value / .summary-value-sub markup
function splitMoney(n) {
  const [whole, cents] = money(n).split('.');
  return [whole, cents];
}

function formatShortDate(isoDate) {
  const d = new Date(isoDate + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
}

// ---------- Rendering ----------

function renderSummary(budget) {
  const [budgetWhole, budgetCents] = splitMoney(budget.monthlyTotal);
  document.getElementById('budget-value').innerHTML =
    `$${budgetWhole}<span class="summary-value-sub">.${budgetCents}</span>`;
  document.getElementById('budget-progress-fill').style.width = `${Math.min(budget.percentSpent, 100)}%`;
  document.getElementById('budget-progress-track').setAttribute('aria-valuenow', budget.percentSpent);
  document.getElementById('budget-caption').textContent =
    `$${money(budget.totalSpent)} spent · $${money(Math.max(budget.remaining, 0))} left`;

  const [expWhole, expCents] = splitMoney(budget.totalSpent);
  document.getElementById('expenses-value').innerHTML =
    `$${expWhole}<span class="summary-value-sub">.${expCents}</span>`;
  document.getElementById('expenses-month-label').textContent =
    new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  // Week-over-week trend needs a trend query of its own (see note in README) —
  // hidden for now rather than showing a fake number.
  document.getElementById('expenses-trend').closest('.summary-caption').style.display = 'none';

  const [balWhole, balCents] = splitMoney(Math.max(budget.remaining, 0));
  document.getElementById('balance-value').innerHTML =
    `$${balWhole}<span class="summary-value-sub">.${balCents}</span>`;
  const remainingPct = budget.monthlyTotal ? Math.round((budget.remaining / budget.monthlyTotal) * 100) : 0;
  document.getElementById('balance-caption').textContent =
    remainingPct <= 0 ? 'Budget fully spent this month' : `Only ${remainingPct}% of budget left this month`;

  const balanceCard = document.getElementById('balance-card');
  balanceCard.classList.toggle('is-low', remainingPct < 10);

  // Alert banner: surface any category at 90%+ or fully spent
  renderAlertBanner(budget);
}

function renderAlertBanner(budget) {
  // populated after categories load; see loadDashboard()
}

function renderCategories(categories) {
  const grid = document.getElementById('category-grid');
  grid.innerHTML = categories.map(cat => {
    const pct = Math.min(cat.percent, 100);
    const badge = cat.percent >= 100
      ? '<span class="badge-warning">Fully spent</span>'
      : cat.percent >= 90
        ? `<span class="badge-warning">${cat.percent}% spent</span>`
        : '';
    return `
      <article class="category-card">
        <div class="category-top">
          <span class="category-name"><span class="dot dot-${cat.colorKey}" aria-hidden="true"></span>${cat.name}</span>
          ${badge}
        </div>
        <div class="ring" style="--p:${pct}; --ring-color: var(--${cat.colorKey}-500);">
          <span>${cat.percent}<small>%</small></span>
        </div>
        <p class="category-amounts">$${money(cat.spent)} <span class="subdued">of</span> $${money(cat.limit)}</p>
      </article>`;
  }).join('');

  // Now that we know per-category status, build the alert banner text
  const flagged = categories.filter(c => c.percent >= 90);
  const banner = document.getElementById('alert-banner');
  if (flagged.length === 0) {
    banner.hidden = true;
  } else {
    const parts = flagged.map(c =>
      c.percent >= 100 ? `${c.name} is fully spent for the month` : `${c.name} is at ${c.percent}% of its budget`
    );
    document.getElementById('alert-text').textContent = parts.join(' and ') + '.';
    banner.hidden = false;
  }

  // Also populate the category <select> in the budget-update form and
  // add-expense form so they stay in sync with whatever categories exist.
  populateCategorySelects(categories);
}

function populateCategorySelects(categories) {
  const expenseSelect = document.getElementById('exp-category');
  const budgetSelect = document.getElementById('budget-category');
  const expenseOptions = categories.map(c => `<option value="${c.slug}">${c.name}</option>`).join('');

  expenseSelect.innerHTML = expenseOptions + '<option value="other">Other</option>';
  budgetSelect.innerHTML =
    '<option value="overall">Overall Monthly Budget</option>' + expenseOptions;
}

function renderTransactions(transactions) {
  const pillClassFor = (slug) => `pill-${slug || 'other'}`;
  const tbody = document.getElementById('transactions-body');
  tbody.innerHTML = transactions.map(t => `
    <tr>
      <td><time datetime="${t.date}">${formatShortDate(t.date)}</time></td>
      <td>${t.description}</td>
      <td><span class="pill ${pillClassFor(t.categorySlug)}">${t.categoryName || 'Other'}</span></td>
      <td class="align-right amount">−$${money(t.amount)}</td>
    </tr>`).join('');
}

// ---------- Data loading ----------

async function loadDashboard() {
  const res = await fetch(`${API_BASE}/api/dashboard`);
  if (!res.ok) throw new Error('Failed to load dashboard');
  const data = await res.json();
  renderCategories(data.categories); // populates selects + alert banner too
  renderSummary(data.budget);
  renderTransactions(data.transactions);
}

// ---------- Form handling ----------

function setSubmitting(button, isSubmitting, label) {
  button.disabled = isSubmitting;
  button.textContent = isSubmitting ? 'Saving…' : label;
}

document.getElementById('add-expense-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const button = document.getElementById('add-expense-submit');
  const payload = {
    amount: document.getElementById('exp-amount').value,
    category: document.getElementById('exp-category').value,
    description: document.getElementById('exp-description').value,
    date: document.getElementById('exp-date').value,
  };

  setSubmitting(button, true, 'Add expense');
  try {
    const res = await fetch(`${API_BASE}/api/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to add expense');

    renderCategories(data.categories);
    renderSummary(data.budget);
    renderTransactions(data.transactions);
    e.target.reset();
    document.getElementById('exp-date').value = new Date().toISOString().slice(0, 10);
  } catch (err) {
    alert(err.message);
  } finally {
    setSubmitting(button, false, 'Add expense');
  }
});

document.getElementById('budget-update-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const button = document.getElementById('budget-update-submit');
  const category = document.getElementById('budget-category').value;
  const amount = document.getElementById('budget-amount').value;

  setSubmitting(button, true, 'Update budget');
  try {
    const res = await fetch(`${API_BASE}/api/budgets/${category}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update budget');

    renderCategories(data.categories);
    renderSummary(data.budget);
    renderTransactions(data.transactions);
    e.target.reset();
  } catch (err) {
    alert(err.message);
  } finally {
    setSubmitting(button, false, 'Update budget');
  }
});

// ---------- Init ----------

document.getElementById('exp-date').value = new Date().toISOString().slice(0, 10);
loadDashboard().catch(err => {
  console.error(err);
  alert('Could not reach the server. Is the backend running on the right port?');
});
