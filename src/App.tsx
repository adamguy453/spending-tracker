import React, { useEffect, useMemo, useState } from "react";

type Entry = {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number;
  category: string;
  what: string;
};

const DEFAULT_CATEGORIES = [
  "Fun",
  "Bills",
  "Subscriptions",
  "Hygiene",
  "Gas",
  "Car",
  "Supplements",
  "Food",
  "Other",
];

const STORAGE = {
  categories: "spendTracker:categories",
  entries: (monthKey: string) => `spendTracker:entries:${monthKey}`,
  budgets: (monthKey: string) => `spendTracker:budgets:${monthKey}`,
};

function money(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function safeJsonParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function monthKeyFromMonthInput(monthValue: string) {
  // monthValue like "2026-01"
  return monthValue;
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function thisMonthISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
}

export default function App() {
  // Month selection
  const [monthValue, setMonthValue] = useState<string>(thisMonthISO());
  const monthKey = monthKeyFromMonthInput(monthValue);

  // Categories (global, not per-month)
  const [categories, setCategories] = useState<string[]>(() => {
    const saved = safeJsonParse<string[]>(
      localStorage.getItem(STORAGE.categories),
      []
    );
    const normalized = saved
      .map((s) => (typeof s === "string" ? s.trim() : ""))
      .filter(Boolean);

    return normalized.length ? normalized : DEFAULT_CATEGORIES;
  });

  // Budgets (per month)
  const [budgets, setBudgets] = useState<Record<string, number>>({});

  // Entries (per month)
  const [entries, setEntries] = useState<Entry[]>([]);

  // UI state
  const [isEditingBudgets, setIsEditingBudgets] = useState(false);
  const [isManagingCategories, setIsManagingCategories] = useState(false);

  // Add category input
  const [newCategory, setNewCategory] = useState("");

  // Add/Edit expense form
  const [formDate, setFormDate] = useState(todayISO());
  const [formAmount, setFormAmount] = useState<string>("");
  const [formCategory, setFormCategory] = useState<string>(() => {
    return DEFAULT_CATEGORIES[0];
  });
  const [formWhat, setFormWhat] = useState<string>("");

  const [editingId, setEditingId] = useState<string | null>(null);

  // --- Load categories -> ensure current selected category exists
  useEffect(() => {
    localStorage.setItem(STORAGE.categories, JSON.stringify(categories));
    // If current selected category got removed, fall back to first
    if (!categories.includes(formCategory)) {
      setFormCategory(categories[0] ?? "Other");
    }
  }, [categories]);

  // --- Load entries + budgets for the selected month
  useEffect(() => {
    const loadedEntries = safeJsonParse<Entry[]>(
      localStorage.getItem(STORAGE.entries(monthKey)),
      []
    ).filter(
      (e) =>
        e &&
        typeof e.id === "string" &&
        typeof e.date === "string" &&
        typeof e.amount === "number" &&
        typeof e.category === "string" &&
        typeof e.what === "string"
    );

    const loadedBudgets = safeJsonParse<Record<string, number>>(
      localStorage.getItem(STORAGE.budgets(monthKey)),
      {}
    );

    setEntries(loadedEntries);

    // Make sure budgets has numeric values only
    const cleaned: Record<string, number> = {};
    for (const [k, v] of Object.entries(loadedBudgets)) {
      cleaned[k] = typeof v === "number" && isFinite(v) ? v : 0;
    }
    setBudgets(cleaned);

    // Reset edit state when switching months
    setEditingId(null);
    setFormAmount("");
    setFormWhat("");
    setFormDate(todayISO());
  }, [monthKey]);

  // --- Persist entries + budgets
  useEffect(() => {
    localStorage.setItem(STORAGE.entries(monthKey), JSON.stringify(entries));
  }, [entries, monthKey]);

  useEffect(() => {
    localStorage.setItem(STORAGE.budgets(monthKey), JSON.stringify(budgets));
  }, [budgets, monthKey]);

  // --- Derived stats
  const categoryTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const e of entries) {
      totals[e.category] = (totals[e.category] ?? 0) + e.amount;
    }
    return totals;
  }, [entries]);

  const monthTotal = useMemo(() => {
    return entries.reduce((sum, e) => sum + e.amount, 0);
  }, [entries]);

  const entriesCount = entries.length;

  const biggestCategory = useMemo(() => {
    let bestCat = "—";
    let bestVal = 0;
    for (const [cat, total] of Object.entries(categoryTotals)) {
      if (total > bestVal) {
        bestVal = total;
        bestCat = cat;
      }
    }
    if (bestVal <= 0) return "—";
    return `${bestCat} (${money(bestVal)})`;
  }, [categoryTotals]);

  // --- Actions
  function clearMonth() {
    if (!confirm(`Clear all entries + budgets for ${monthKey}?`)) return;
    setEntries([]);
    setBudgets({});
    localStorage.removeItem(STORAGE.entries(monthKey));
    localStorage.removeItem(STORAGE.budgets(monthKey));
  }

  function clearAll() {
    if (
      !confirm(
        "Clear EVERYTHING? (All months, all entries, all budgets, all categories reset to default.)"
      )
    )
      return;

    // brute force remove known keys
    // (keeps it simple, since we don't track all month keys separately)
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key.startsWith("spendTracker:")) localStorage.removeItem(key);
    }

    setCategories(DEFAULT_CATEGORIES);
    setEntries([]);
    setBudgets({});
    setMonthValue(thisMonthISO());
    setEditingId(null);
    setFormAmount("");
    setFormWhat("");
    setFormDate(todayISO());
  }

  function addOrUpdateExpense() {
    const amount = Number(formAmount);
    if (!isFinite(amount) || amount <= 0) {
      alert("Amount must be greater than 0.");
      return;
    }
    if (!formWhat.trim()) {
      alert('"What was it?" can’t be empty.');
      return;
    }
    if (!formCategory.trim()) {
      alert("Category is required.");
      return;
    }
    if (!formDate) {
      alert("Date is required.");
      return;
    }

    // If user removed the category but an old entry is being edited,
    // we still allow it; but for new entries we strongly prefer existing categories.
    if (!categories.includes(formCategory)) {
      const ok = confirm(
        `"${formCategory}" is not in your category list. Add it as a new category?`
      );
      if (ok) {
        setCategories((prev) => [...prev, formCategory].sort());
      } else {
        alert("Pick an existing category.");
        return;
      }
    }

    if (editingId) {
      setEntries((prev) =>
        prev.map((e) =>
          e.id === editingId
            ? {
                ...e,
                date: formDate,
                amount,
                category: formCategory,
                what: formWhat.trim(),
              }
            : e
        )
      );
      setEditingId(null);
    } else {
      const entry: Entry = {
        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
        date: formDate,
        amount,
        category: formCategory,
        what: formWhat.trim(),
      };
      setEntries((prev) => [entry, ...prev].sort((a, b) => (a.date < b.date ? 1 : -1)));
    }

    setFormAmount("");
    setFormWhat("");
    // keep date and category
  }

  function startEdit(e: Entry) {
    setEditingId(e.id);
    setFormDate(e.date);
    setFormAmount(String(e.amount));
    setFormCategory(e.category);
    setFormWhat(e.what);
    // scroll to form area (nice UX)
    setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 50);
  }

  function cancelEdit() {
    setEditingId(null);
    setFormAmount("");
    setFormWhat("");
    setFormDate(todayISO());
    // keep category
  }

  function deleteEntry(id: string) {
    if (!confirm("Delete this entry?")) return;
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  function addCategory() {
    const name = newCategory.trim();
    if (!name) return;

    // prevent duplicates ignoring case
    const exists = categories.some((c) => c.toLowerCase() === name.toLowerCase());
    if (exists) {
      alert("That category already exists.");
      return;
    }

    setCategories((prev) => [...prev, name].sort());
    setNewCategory("");
  }

  function removeCategory(name: string) {
    const used = entries.some((e) => e.category === name);
    const msg = used
      ? `"${name}" is used by existing entries. Removing it will NOT delete those entries, but it will disappear from your dropdown. Continue?`
      : `Remove category "${name}"?`;

    if (!confirm(msg)) return;

    setCategories((prev) => prev.filter((c) => c !== name));
    setBudgets((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });

    if (formCategory === name) {
      setFormCategory(categories.find((c) => c !== name) ?? "Other");
    }
  }

  function setBudget(cat: string, value: string) {
    const n = Number(value);
    setBudgets((prev) => ({
      ...prev,
      [cat]: isFinite(n) && n >= 0 ? n : 0,
    }));
  }

  // --- UI bits
  const containerStyle: React.CSSProperties = {
    maxWidth: 1100,
    margin: "0 auto",
    padding: "28px 18px 60px",
    color: "rgba(255,255,255,0.92)",
    fontFamily:
      'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
  };

  const panelStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 14,
    padding: 16,
    boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
  };

  const buttonStyle: React.CSSProperties = {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.08)",
    color: "rgba(255,255,255,0.92)",
    cursor: "pointer",
    fontWeight: 600,
  };

  const dangerButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    border: "1px solid rgba(255,90,90,0.55)",
    background: "rgba(255,90,90,0.12)",
  };

  const primaryButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    border: "1px solid rgba(90,180,255,0.65)",
    background: "rgba(90,180,255,0.18)",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 10px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.25)",
    color: "rgba(255,255,255,0.92)",
    outline: "none",
  };

  const labelStyle: React.CSSProperties = { display: "grid", gap: 6 };

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(1200px 600px at 20% 0%, rgba(90,180,255,0.18), transparent 60%), radial-gradient(900px 500px at 80% 20%, rgba(255,90,90,0.12), transparent 60%), #0b1220",
      }}
    >
      <div style={containerStyle}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 42, letterSpacing: -0.6 }}>Spending Tracker</h1>
            <p style={{ marginTop: 6, opacity: 0.8 }}>
              Stored locally in your browser (no bank syncing).
            </p>
          </div>

          <button style={dangerButtonStyle} onClick={clearAll}>
            Clear All
          </button>
        </div>

        {/* Top panel */}
        <div style={{ ...panelStyle, marginTop: 18 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: 14,
              alignItems: "start",
            }}
          >
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ opacity: 0.85, fontWeight: 700 }}>Month</div>
                  <input
                    type="month"
                    value={monthValue}
                    onChange={(e) => setMonthValue(e.target.value)}
                    style={{ ...inputStyle, width: 200 }}
                  />
                </div>

                <div style={{ opacity: 0.9, fontWeight: 700, paddingTop: 22 }}>{monthKey}</div>
              </div>

              {/* Stats cards */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 12,
                }}
              >
                <div style={panelStyle}>
                  <div style={{ opacity: 0.8, fontWeight: 700 }}>Month Total</div>
                  <div style={{ fontSize: 24, fontWeight: 900, marginTop: 6 }}>{money(monthTotal)}</div>
                </div>

                <div style={panelStyle}>
                  <div style={{ opacity: 0.8, fontWeight: 700 }}>Biggest Category</div>
                  <div style={{ fontSize: 18, fontWeight: 900, marginTop: 8 }}>{biggestCategory}</div>
                </div>

                <div style={panelStyle}>
                  <div style={{ opacity: 0.8, fontWeight: 700 }}>Entries</div>
                  <div style={{ fontSize: 24, fontWeight: 900, marginTop: 6 }}>{entriesCount}</div>
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <button style={dangerButtonStyle} onClick={clearMonth}>
                Clear Month
              </button>

              <button
                style={buttonStyle}
                onClick={() => setIsManagingCategories((v) => !v)}
              >
                {isManagingCategories ? "Done" : "Manage Categories"}
              </button>

              <button
                style={buttonStyle}
                onClick={() => setIsEditingBudgets((v) => !v)}
              >
                {isEditingBudgets ? "Done" : "Edit Budgets"}
              </button>
            </div>
          </div>

          {/* Manage categories */}
          {isManagingCategories && (
            <div style={{ ...panelStyle, marginTop: 14 }}>
              <h3 style={{ marginTop: 0 }}>Categories</h3>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
                <div style={{ ...labelStyle, minWidth: 260 }}>
                  <span style={{ opacity: 0.85, fontWeight: 700 }}>Add a category</span>
                  <input
                    style={inputStyle}
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="e.g., Pets, Travel, Medical..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter") addCategory();
                    }}
                  />
                </div>

                <button style={primaryButtonStyle} onClick={addCategory}>
                  Add Category
                </button>
              </div>

              <div
                style={{
                  marginTop: 14,
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: 10,
                }}
              >
                {categories.map((cat) => (
                  <div key={cat} style={{ ...panelStyle, padding: 12, display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                    <div style={{ fontWeight: 800 }}>{cat}</div>
                    <button style={dangerButtonStyle} onClick={() => removeCategory(cat)}>
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              <p style={{ marginTop: 12, opacity: 0.75 }}>
                Removing a category does <b>not</b> delete old entries that used it.
              </p>
            </div>
          )}

          {/* Category totals + budgets */}
          <div style={{ marginTop: 14 }}>
            <h3 style={{ margin: "6px 0 10px" }}>Category Totals</h3>

            {isEditingBudgets && (
              <div style={{ ...panelStyle, marginBottom: 12 }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: 10,
                  }}
                >
                  {categories.map((cat) => (
                    <label key={cat} style={labelStyle}>
                      <span style={{ opacity: 0.85, fontWeight: 700 }}>{cat} Budget</span>
                      <input
                        type="number"
                        min={0}
                        step="1"
                        style={inputStyle}
                        value={budgets[cat] ?? 0}
                        onChange={(e) => setBudget(cat, e.target.value)}
                      />
                    </label>
                  ))}
                </div>
                <p style={{ marginTop: 10, opacity: 0.75 }}>
                  Budgets save automatically for {monthKey}.
                </p>
              </div>
            )}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 10,
              }}
            >
              {categories.map((cat) => {
                const spent = categoryTotals[cat] ?? 0;
                const budget = budgets[cat] ?? 0;
                const pct = budget > 0 ? clamp((spent / budget) * 100, 0, 999) : 0;
                const remaining = budget - spent;
                const over = budget > 0 && remaining < 0;

                return (
                  <div key={cat} style={{ ...panelStyle, padding: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ fontWeight: 900 }}>{cat}</div>
                      <div style={{ fontWeight: 900 }}>{money(spent)}</div>
                    </div>

                    {/* Progress / Budget */}
                    <div style={{ marginTop: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, opacity: 0.85 }}>
                        <span>Budget: {budget > 0 ? money(budget) : "—"}</span>
                        <span>{budget > 0 ? `${Math.round(clamp(pct, 0, 999))}%` : "No budget"}</span>
                      </div>

                      <div
                        style={{
                          height: 8,
                          borderRadius: 999,
                          background: "rgba(255,255,255,0.12)",
                          overflow: "hidden",
                          marginTop: 6,
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${clamp(pct, 0, 100)}%`,
                            background: over ? "rgba(255,90,90,0.92)" : "rgba(90,180,255,0.92)",
                          }}
                        />
                      </div>

                      {budget > 0 && (
                        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.9 }}>
                          {remaining >= 0
                            ? `Remaining: ${money(remaining)}`
                            : `Over by: ${money(Math.abs(remaining))}`}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Add expense */}
        <div style={{ ...panelStyle, marginTop: 14 }}>
          <h3 style={{ marginTop: 0 }}>{editingId ? "Edit Expense" : "Add Expense"}</h3>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(180px, 1fr))",
              gap: 12,
              alignItems: "end",
            }}
          >
            <label style={labelStyle}>
              <span style={{ opacity: 0.85, fontWeight: 700 }}>Date</span>
              <input type="date" style={inputStyle} value={formDate} onChange={(e) => setFormDate(e.target.value)} />
            </label>

            <label style={labelStyle}>
              <span style={{ opacity: 0.85, fontWeight: 700 }}>Amount</span>
              <input
                type="number"
                min={0}
                step="0.01"
                style={inputStyle}
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                placeholder="12.34"
              />
            </label>

            <label style={labelStyle}>
              <span style={{ opacity: 0.85, fontWeight: 700 }}>Category</span>
              <select
                style={inputStyle}
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                {/* If editing an entry whose category no longer exists */}
                {!categories.includes(formCategory) && (
                  <option value={formCategory}>{formCategory} (old)</option>
                )}
              </select>
            </label>
          </div>

          <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
            <label style={labelStyle}>
              <span style={{ opacity: 0.85, fontWeight: 700 }}>What was it?</span>
              <input
                style={inputStyle}
                value={formWhat}
                onChange={(e) => setFormWhat(e.target.value)}
                placeholder="Groceries, protein powder, car wash..."
              />
            </label>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
              {editingId && (
                <button style={buttonStyle} onClick={cancelEdit}>
                  Cancel
                </button>
              )}
              <button style={primaryButtonStyle} onClick={addOrUpdateExpense}>
                {editingId ? "Save" : "Add"}
              </button>
            </div>

            <div style={{ fontSize: 12, opacity: 0.75 }}>
              Tip: Amount must be &gt; 0 and “What was it?” can’t be empty.
            </div>
          </div>
        </div>

        {/* Entries table */}
        <div style={{ ...panelStyle, marginTop: 14 }}>
          <h3 style={{ marginTop: 0 }}>This Month’s Entries</h3>

          {entries.length === 0 ? (
            <p style={{ opacity: 0.75 }}>No entries yet for {monthKey}.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", opacity: 0.85 }}>
                    <th style={{ padding: "10px 8px" }}>Date</th>
                    <th style={{ padding: "10px 8px" }}>What</th>
                    <th style={{ padding: "10px 8px" }}>Category</th>
                    <th style={{ padding: "10px 8px" }}>Amount</th>
                    <th style={{ padding: "10px 8px" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {entries
                    .slice()
                    .sort((a, b) => (a.date < b.date ? 1 : -1))
                    .map((e) => (
                      <tr key={e.id} style={{ borderTop: "1px solid rgba(255,255,255,0.10)" }}>
                        <td style={{ padding: "10px 8px", whiteSpace: "nowrap" }}>{e.date}</td>
                        <td style={{ padding: "10px 8px", fontWeight: 700 }}>{e.what}</td>
                        <td style={{ padding: "10px 8px" }}>
                          <span
                            style={{
                              display: "inline-block",
                              padding: "4px 10px",
                              borderRadius: 999,
                              border: "1px solid rgba(255,255,255,0.18)",
                              background: "rgba(255,255,255,0.06)",
                              fontSize: 12,
                              fontWeight: 800,
                            }}
                          >
                            {e.category}
                          </span>
                        </td>
                        <td style={{ padding: "10px 8px", fontWeight: 900 }}>{money(e.amount)}</td>
                        <td style={{ padding: "10px 8px" }}>
                          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                            <button style={buttonStyle} onClick={() => startEdit(e)}>
                              Edit
                            </button>
                            <button style={dangerButtonStyle} onClick={() => deleteEntry(e.id)}>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p style={{ marginTop: 16, opacity: 0.65, fontSize: 12 }}>
          Note: Everything saves locally on this device/browser.
        </p>
      </div>
    </div>
  );
}
