import { useEffect, useMemo, useState } from "react";

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

type Entry = {
  id: string;
  month: string; // YYYY-MM
  date: string; // YYYY-MM-DD
  amount: number;
  category: Category;
  location: string;
  what: string;
};

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

const STORAGE_KEY = "spend-tracker.v1";

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function monthFromDate(dateISO: string) {
  return dateISO.slice(0, 7);
}

function formatMoney(n: number) {
  return `$${n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function monthLabel(month: string) {
  // month = YYYY-MM
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleString(undefined, { month: "long", year: "numeric" });
}

function safeParse<T>(raw: string | null, fallback: T): T {
  try {
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export default function App() {
  // --- DATA ---
  const [allEntries, setAllEntries] = useState<Entry[]>(() =>
    safeParse<Entry[]>(localStorage.getItem(STORAGE_KEY), [])
  );

  // Default month = current month
  const [month, setMonth] = useState<string>(() => monthFromDate(todayISO()));

  // --- ADD FORM ---
  const [date, setDate] = useState<string>(todayISO());
  const [amount, setAmount] = useState<string>("");
  const [category, setCategory] = useState<Category>("Fun");
  const [location, setLocation] = useState<string>("");
  const [what, setWhat] = useState<string>("");

  // --- EDIT STATE ---
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Entry | null>(null);

  // Persist to localStorage whenever entries change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allEntries));
  }, [allEntries]);

  // Keep add form date in the selected month (nice UX)
  useEffect(() => {
    const formMonth = monthFromDate(date);
    if (formMonth !== month) {
      // set date to first day of selected month
      setDate(`${month}-01`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const monthEntries = useMemo(() => {
    return allEntries
      .filter((e) => e.month === month)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [allEntries, month]);

  const monthTotal = useMemo(() => {
    return monthEntries.reduce((sum, e) => sum + e.amount, 0);
  }, [monthEntries]);

  const categoryTotals = useMemo(() => {
    const map: Record<Category, number> = Object.fromEntries(
      CATEGORIES.map((c) => [c, 0])
    ) as Record<Category, number>;

    for (const e of monthEntries) map[e.category] += e.amount;
    return map;
  }, [monthEntries]);

  const biggestCategory = useMemo(() => {
    let best: Category | null = null;
    let bestVal = 0;
    for (const c of CATEGORIES) {
      const v = categoryTotals[c];
      if (v > bestVal) {
        bestVal = v;
        best = c;
      }
    }
    return best ? `${best} (${formatMoney(bestVal)})` : "—";
  }, [categoryTotals]);

  function addExpense() {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return;
    if (!what.trim()) return;

    const entry: Entry = {
      id: crypto.randomUUID(),
      month,
      date,
      amount: amt,
      category,
      location: location.trim(),
      what: what.trim(),
    };

    setAllEntries((prev) => [entry, ...prev]);

    // Reset inputs but keep month/date sensible
    setAmount("");
    setCategory("Fun");
    setLocation("");
    setWhat("");
  }

  function deleteEntry(id: string) {
    setAllEntries((prev) => prev.filter((e) => e.id !== id));
    if (editingId === id) {
      setEditingId(null);
      setEditDraft(null);
    }
  }

  function startEdit(e: Entry) {
    setEditingId(e.id);
    setEditDraft({ ...e });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft(null);
  }

  function saveEdit() {
    if (!editDraft || !editingId) return;

    const amt = Number(editDraft.amount);
    if (!Number.isFinite(amt) || amt <= 0) return;
    if (!editDraft.what.trim()) return;

    // Keep month consistent with selected month (we’re editing within a month view)
    const updated: Entry = {
      ...editDraft,
      month,
      date: editDraft.date.slice(0, 10),
      amount: amt,
      location: editDraft.location.trim(),
      what: editDraft.what.trim(),
    };

    setAllEntries((prev) => prev.map((x) => (x.id === editingId ? updated : x)));
    setEditingId(null);
    setEditDraft(null);
  }

  function clearMonth() {
    setAllEntries((prev) => prev.filter((e) => e.month !== month));
    setEditingId(null);
    setEditDraft(null);
  }

  function clearAll() {
    setAllEntries([]);
    setEditingId(null);
    setEditDraft(null);
  }

  return (
    <div style={styles.page}>
      <div style={styles.headerRow}>
        <div>
          <h1 style={styles.title}>Spending Tracker</h1>
          <div style={styles.subtitle}>Stored locally in your browser (no bank syncing).</div>
        </div>
        <button style={{ ...styles.btn, ...styles.btnDangerOutline }} onClick={clearAll}>
          Clear All
        </button>
      </div>

      {/* Month */}
      <div style={styles.panel}>
        <div style={styles.panelHeaderRow}>
          <div>
            <div style={styles.sectionLabel}>Month</div>
            <div style={styles.monthRow}>
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                style={styles.input}
              />
              <div style={{ opacity: 0.85 }}>{monthLabel(month)}</div>
            </div>
          </div>

          <button style={{ ...styles.btn, ...styles.btnOutline }} onClick={clearMonth}>
            Clear Month
          </button>
        </div>

        {/* Summary cards */}
        <div style={styles.cards}>
          <MiniCard title="Month Total" value={formatMoney(monthTotal)} />
          <MiniCard title="Biggest Category" value={biggestCategory} />
          <MiniCard title="Entries" value={String(monthEntries.length)} />
          <MiniCard title="Month" value={month} />
        </div>

        {/* Category totals */}
        <div style={{ marginTop: 14 }}>
          <div style={styles.sectionLabel}>Category Totals</div>
          <div style={styles.categoryGrid}>
            {CATEGORIES.map((c) => (
              <div key={c} style={styles.categoryPill}>
                <div style={{ fontWeight: 700 }}>{c}</div>
                <div style={{ fontVariantNumeric: "tabular-nums" }}>
                  {formatMoney(categoryTotals[c])}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add Expense */}
      <div style={styles.panel}>
        <div style={styles.sectionTitle}>Add Expense</div>

        <div style={styles.addGrid}>
          <Field label="Date">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={styles.input} />
          </Field>

          <Field label="Amount">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="12.34"
              inputMode="decimal"
              style={styles.input}
            />
          </Field>

          <Field label="Category">
            <select value={category} onChange={(e) => setCategory(e.target.value as Category)} style={styles.input}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Field>

          <Field label="Location">
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Costco, Shell, Amazon…"
              style={styles.input}
            />
          </Field>

          <Field label="What was it?" full>
            <input
              value={what}
              onChange={(e) => setWhat(e.target.value)}
              placeholder="Groceries, protein powder, car wash…"
              style={styles.input}
            />
          </Field>

          <div style={styles.addActionsRow}>
            <div style={styles.tip}>
              Tip: Amount must be {">"} 0 and “What was it?” can’t be empty.
            </div>
            <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={addExpense}>
              Add
            </button>
          </div>
        </div>
      </div>

      {/* Entries */}
      <div style={styles.panel}>
        <div style={styles.sectionTitle}>This Month’s Entries</div>

        <div style={styles.table}>
          <div style={{ ...styles.tr, ...styles.th }}>
            <div>Date</div>
            <div>What</div>
            <div>Location</div>
            <div>Category</div>
            <div style={{ textAlign: "right" }}>Amount</div>
            <div style={{ textAlign: "right" }}>Actions</div>
          </div>

          {monthEntries.length === 0 ? (
            <div style={styles.empty}>No entries yet for this month.</div>
          ) : (
            monthEntries.map((e) => {
              const isEditing = editingId === e.id;

              return (
                <div key={e.id} style={styles.tr}>
                  {/* Date */}
                  <div>
                    {isEditing ? (
                      <input
                        type="date"
                        value={editDraft?.date ?? e.date}
                        onChange={(ev) =>
                          setEditDraft((d) => (d ? { ...d, date: ev.target.value } : d))
                        }
                        style={styles.inputSmall}
                      />
                    ) : (
                      e.date
                    )}
                  </div>

                  {/* What */}
                  <div style={{ fontWeight: 700 }}>
                    {isEditing ? (
                      <input
                        value={editDraft?.what ?? e.what}
                        onChange={(ev) =>
                          setEditDraft((d) => (d ? { ...d, what: ev.target.value } : d))
                        }
                        style={styles.inputSmallWide}
                      />
                    ) : (
                      e.what
                    )}
                  </div>

                  {/* Location */}
                  <div style={{ opacity: 0.85 }}>
                    {isEditing ? (
                      <input
                        value={editDraft?.location ?? e.location}
                        onChange={(ev) =>
                          setEditDraft((d) => (d ? { ...d, location: ev.target.value } : d))
                        }
                        style={styles.inputSmallWide}
                      />
                    ) : (
                      e.location || "—"
                    )}
                  </div>

                  {/* Category */}
                  <div>
                    {isEditing ? (
                      <select
                        value={editDraft?.category ?? e.category}
                        onChange={(ev) =>
                          setEditDraft((d) => (d ? { ...d, category: ev.target.value as Category } : d))
                        }
                        style={styles.inputSmall}
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    ) : (
                      <span style={styles.categoryChip}>{e.category}</span>
                    )}
                  </div>

                  {/* Amount */}
                  <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>
                    {isEditing ? (
                      <input
                        value={String(editDraft?.amount ?? e.amount)}
                        onChange={(ev) =>
                          setEditDraft((d) => (d ? { ...d, amount: ev.target.value as unknown as any } : d))
                        }
                        inputMode="decimal"
                        style={styles.inputSmallAmount}
                      />
                    ) : (
                      formatMoney(e.amount)
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ textAlign: "right", display: "flex", justifyContent: "flex-end", gap: 8 }}>
                    {isEditing ? (
                      <>
                        <button style={{ ...styles.btn, ...styles.btnPrimarySmall }} onClick={saveEdit}>
                          Save
                        </button>
                        <button style={{ ...styles.btn, ...styles.btnOutlineSmall }} onClick={cancelEdit}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button style={{ ...styles.btn, ...styles.btnOutlineSmall }} onClick={() => startEdit(e)}>
                          Edit
                        </button>
                        <button
                          style={{ ...styles.btn, ...styles.btnDangerSmall }}
                          onClick={() => deleteEntry(e.id)}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {editingId && (
          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
            Editing tip: Amount must be {">"} 0, and “What” can’t be empty.
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div style={{ ...styles.field, ...(full ? styles.fieldFull : null) }}>
      <div style={styles.label}>{label}</div>
      {children}
    </div>
  );
}

function MiniCard({ title, value }: { title: string; value: string }) {
  return (
    <div style={styles.card}>
      <div style={styles.cardTitle}>{title}</div>
      <div style={styles.cardValue}>{value}</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: 1100,
    margin: "0 auto",
    padding: 24,
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
    color: "#e9eef7",
  },
  headerRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 },
  title: { margin: 0, fontSize: 44, fontWeight: 900, letterSpacing: -1 },
  subtitle: { marginTop: 6, opacity: 0.8, fontSize: 13 },

  panel: {
    marginTop: 14,
    padding: 16,
    borderRadius: 14,
    background: "rgba(30, 49, 86, 0.35)",
    border: "1px solid rgba(255,255,255,0.10)",
    boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
  },

  panelHeaderRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 },
  monthRow: { display: "flex", alignItems: "center", gap: 12, marginTop: 6 },
  sectionLabel: { fontSize: 12, opacity: 0.8 },
  sectionTitle: { fontSize: 18, fontWeight: 900, marginBottom: 12 },

  cards: {
    marginTop: 14,
    display: "grid",
    gap: 12,
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  },
  card: {
    padding: 12,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0,0,0,0.12)",
  },
  cardTitle: { fontSize: 12, opacity: 0.75 },
  cardValue: { marginTop: 6, fontSize: 18, fontWeight: 900 },

  categoryGrid: {
    marginTop: 10,
    display: "grid",
    gap: 10,
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  },
  categoryPill: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0,0,0,0.10)",
  },

  addGrid: {
    display: "grid",
    gap: 12,
    gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
    alignItems: "end",
  },
  field: { display: "flex", flexDirection: "column", gap: 6, gridColumn: "span 3" },
  fieldFull: { gridColumn: "1 / -1" },
  label: { fontSize: 12, opacity: 0.75 },

  addActionsRow: {
    gridColumn: "1 / -1",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginTop: 2,
  },
  tip: { fontSize: 12, opacity: 0.75 },

  input: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.18)",
    color: "#e9eef7",
    outline: "none",
  },

  inputSmall: {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.18)",
    color: "#e9eef7",
    outline: "none",
    width: "100%",
  },
  inputSmallWide: {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.18)",
    color: "#e9eef7",
    outline: "none",
    width: "100%",
    minWidth: 160,
  },
  inputSmallAmount: {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.18)",
    color: "#e9eef7",
    outline: "none",
    width: 110,
    textAlign: "right",
  },

  table: {
    borderRadius: 12,
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.12)",
  },
  tr: {
    display: "grid",
    gridTemplateColumns: "140px 1.2fr 1fr 160px 140px 210px",
    gap: 12,
    padding: 12,
    alignItems: "center",
    background: "rgba(0,0,0,0.10)",
    borderTop: "1px solid rgba(255,255,255,0.08)",
  },
  th: {
    background: "rgba(0,0,0,0.18)",
    fontSize: 12,
    fontWeight: 800,
    opacity: 0.85,
    borderTop: "none",
  },
  empty: { padding: 14, opacity: 0.75 },

  categoryChip: {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(0,0,0,0.12)",
    fontSize: 12,
    fontWeight: 800,
  },

  btn: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(0,0,0,0.12)",
    color: "#e9eef7",
    cursor: "pointer",
    fontWeight: 800,
  },
  btnPrimary: { background: "#2f6bff", border: "1px solid rgba(255,255,255,0.18)" },
  btnOutline: { background: "transparent" },
  btnDangerOutline: { background: "transparent", border: "1px solid rgba(255, 92, 92, 0.6)" },

  btnPrimarySmall: { padding: "8px 10px", background: "#2f6bff" },
  btnOutlineSmall: { padding: "8px 10px", background: "transparent" },
  btnDangerSmall: { padding: "8px 10px", background: "rgba(255, 92, 92, 0.15)", border: "1px solid rgba(255, 92, 92, 0.6)" },
};

// Responsive tweak: stack Add Expense fields nicely
// (inline styles can't use media queries easily—so we keep it simple and rely on grid wrapping)
// If you want perfect responsive behavior, we can move styling into CSS next.
