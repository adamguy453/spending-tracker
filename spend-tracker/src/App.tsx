import { useEffect, useMemo, useState } from "react";
import "./App.css";

type Category =
  | "Fun"
  | "Bill"
  | "Subscription"
  | "Hygiene"
  | "Gas"
  | "Car"
  | "Supplements"
  | "Beer"
  | "Food"
  | "Other";

const CATEGORIES: Category[] = [
  "Fun",
  "Bill",
  "Subscription",
  "Hygiene",
  "Gas",
  "Car",
  "Supplements",
  "Beer",
  "Food",
  "Other",
];

type Expense = {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number;
  location: string;
  what: string;
  category: Category;
};

type DataByMonth = Record<string, Expense[]>; // key: YYYY-MM

const STORAGE_KEY = "spend_tracker_v1";

function monthKeyFromDate(dateISO: string) {
  // YYYY-MM from YYYY-MM-DD
  return dateISO.slice(0, 7);
}

function formatMoney(n: number) {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  return `${sign}$${abs.toFixed(2)}`;
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function defaultMonthKey() {
  return monthKeyFromDate(todayISO());
}

export default function App() {
  const [month, setMonth] = useState<string>(defaultMonthKey());

  const [data, setData] = useState<DataByMonth>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as DataByMonth;
      return parsed ?? {};
    } catch {
      return {};
    }
  });

  // form state
  const [date, setDate] = useState<string>(todayISO());
  const [amount, setAmount] = useState<string>("");
  const [location, setLocation] = useState<string>("");
  const [what, setWhat] = useState<string>("");
  const [category, setCategory] = useState<Category>("Fun");

  const expensesThisMonth = data[month] ?? [];

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // ignore
    }
  }, [data]);

  // If you change month, auto-set date to that month (keeps the “calendar date option”)
  useEffect(() => {
    // If current date doesn't match the selected month, set it to first day of month
    if (month && date.slice(0, 7) !== month) {
      setDate(`${month}-01`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const totalsByCategory = useMemo(() => {
    const totals: Record<Category, number> = Object.fromEntries(
      CATEGORIES.map((c) => [c, 0])
    ) as Record<Category, number>;

    for (const e of expensesThisMonth) totals[e.category] += e.amount;

    return totals;
  }, [expensesThisMonth]);

  const monthTotal = useMemo(() => {
    return expensesThisMonth.reduce((sum, e) => sum + e.amount, 0);
  }, [expensesThisMonth]);

  const sortedExpenses = useMemo(() => {
    return [...expensesThisMonth].sort((a, b) => {
      // newest first
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return a.id < b.id ? 1 : -1;
    });
  }, [expensesThisMonth]);

  function addExpense() {
    const trimmedLocation = location.trim();
    const trimmedWhat = what.trim();

    const num = Number(amount);
    if (!date) return;
    if (!Number.isFinite(num) || num <= 0) return;
    if (!trimmedWhat) return;

    const expense: Expense = {
      id: crypto.randomUUID(),
      date,
      amount: num,
      location: trimmedLocation,
      what: trimmedWhat,
      category,
    };

    const key = monthKeyFromDate(date);

    setData((prev) => {
      const next = { ...prev };
      const arr = next[key] ? [...next[key]] : [];
      arr.push(expense);
      next[key] = arr;
      return next;
    });

    // reset form (keep date & month steady)
    setAmount("");
    setLocation("");
    setWhat("");
    setCategory("Fun");
  }

  function removeExpense(id: string) {
    setData((prev) => {
      const next = { ...prev };
      next[month] = (next[month] ?? []).filter((e) => e.id !== id);
      // clean empty months
      if ((next[month] ?? []).length === 0) delete next[month];
      return next;
    });
  }

  function clearMonth() {
    if (!confirm(`Clear all expenses for ${month}?`)) return;
    setData((prev) => {
      const next = { ...prev };
      delete next[month];
      return next;
    });
  }

  function clearAll() {
    if (!confirm("Clear ALL stored data?")) return;
    setData({});
  }

  return (
    <div className="app">
      <div className="wrap">
        <header className="header">
          <div>
            <h1 className="title">Spending Tracker</h1>
            <div className="subtle">
              Stored locally in your browser (no bank syncing).
            </div>
          </div>

          <div className="headerActions">
            <button className="btn btnDanger" onClick={clearAll}>
              Clear All
            </button>
          </div>
        </header>

        {/* Month selector + actions */}
        <section className="card">
          <div className="row">
            <div className="field">
              <label>Month</label>
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
            </div>

            <div className="actionsRow">
              <button className="btn btnOutline" onClick={clearMonth}>
                Clear Month
              </button>
            </div>
          </div>
        </section>

        {/* Totals */}
        <section className="grid4">
          <div className="stat">
            <div className="statLabel">Month Total</div>
            <div className="statValue">{formatMoney(monthTotal)}</div>
          </div>

          <div className="stat">
            <div className="statLabel">Biggest Category</div>
            <div className="statValue">
              {(() => {
                let best: { c: Category; v: number } | null = null;
                for (const c of CATEGORIES) {
                  const v = totalsByCategory[c];
                  if (!best || v > best.v) best = { c, v };
                }
                if (!best || best.v === 0) return "—";
                return `${best.c} (${formatMoney(best.v)})`;
              })()}
            </div>
          </div>

          <div className="stat">
            <div className="statLabel">Entries</div>
            <div className="statValue">{expensesThisMonth.length}</div>
          </div>

          <div className="stat">
            <div className="statLabel">Month</div>
            <div className="statValue">{month}</div>
          </div>
        </section>

        {/* Category totals */}
        <section className="card">
          <div className="cardTitle">Category Totals</div>
          <div className="catGrid">
            {CATEGORIES.map((c) => (
              <div key={c} className="catPill">
                <div className="catName">{c}</div>
                <div className="catValue">{formatMoney(totalsByCategory[c])}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Add expense */}
        <section className="card">
          <div className="cardTitle">Add Expense</div>

          <div className="formGrid">
            <div className="field">
              <label>Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <div className="field">
              <label>Amount</label>
              <input
                inputMode="decimal"
                placeholder="12.34"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            <div className="field">
              <label>Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Location</label>
              <input
                placeholder="Costco, Shell, Amazon…"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>

            <div className="field fieldSpan">
              <label>What was it?</label>
              <input
                placeholder="Groceries, protein powder, car wash…"
                value={what}
                onChange={(e) => setWhat(e.target.value)}
              />
            </div>

            <div className="field">
              <label>&nbsp;</label>
              <button className="btn btnPrimary" onClick={addExpense}>
                Add
              </button>
            </div>
          </div>

          <div className="subtle" style={{ marginTop: 10 }}>
            Tip: Amount must be &gt; 0 and “What was it?” can’t be empty.
          </div>
        </section>

        {/* List */}
        <section className="card">
          <div className="cardTitle">This Month’s Entries</div>

          {sortedExpenses.length === 0 ? (
            <div className="subtle">No entries for {month} yet.</div>
          ) : (
            <div className="table">
              <div className="tableHead">
                <div>Date</div>
                <div>What</div>
                <div>Location</div>
                <div>Category</div>
                <div className="right">Amount</div>
                <div className="right">Actions</div>
              </div>

              {sortedExpenses.map((e) => (
                <div key={e.id} className="tableRow">
                  <div className="mono">{e.date}</div>
                  <div className="strong">{e.what}</div>
                  <div className="muted">{e.location || "—"}</div>
                  <div className="pill">{e.category}</div>
                  <div className="right strong">{formatMoney(e.amount)}</div>
                  <div className="right">
                    <button
                      className="btn btnSmall btnOutline"
                      onClick={() => removeExpense(e.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
