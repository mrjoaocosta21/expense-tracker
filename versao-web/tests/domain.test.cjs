"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
require("../js/domain.js");
const domain = globalThis.ExpenseTracker.domain;

function transaction(overrides = {}) {
  return { id: "a", type: "expense", description: "Almoço", amountCents: 1234, date: "2026-11-26", categoryId: "food", ...overrides };
}

test("converts local and decimal money precisely into integer cents", () => {
  for (const [input, expected] of [["1.234,56", 123456], ["1234,56", 123456], ["1234.56", 123456], ["10", 1000], ["0,01", 1], ["0.29", 29], [" 12,5 ", 1250], ["1.234", 123400], ["1.000.000.000,00", domain.MAX_AMOUNT_CENTS]]) {
    assert.equal(domain.parseAmount(input), expected, input);
  }
});

test("rejects zero, negative, non-finite, imprecise, malformed and oversized amounts", () => {
  for (const value of ["", "0", "0,00", "-1", "+1", "1e3", "Infinity", "NaN", "1,234", "1234.567", "12.34,56", "1,234.56", "1.000.000.000,01", "999999999999999999999", 12.34, null]) {
    assert.throws(() => domain.parseAmount(value), Error, String(value));
  }
});

test("validates actual calendar dates without timezone conversion", () => {
  for (const date of ["2024-02-29", "2000-02-29", "2026-11-26", "0099-12-31"]) assert.equal(domain.isValidDate(date), true, date);
  for (const date of ["2026-02-29", "1900-02-29", "2026-04-31", "2026-00-01", "0000-01-01", "2026-1-01", "2026-11-00", "2026-11-26T00:00:00Z", null]) assert.equal(domain.isValidDate(date), false, String(date));
  assert.equal(domain.isValidMonth("2026-11"), true);
  assert.equal(domain.isValidMonth("2026-13"), false);
});

test("validates a transaction and retains descriptions as plain data", () => {
  assert.equal(domain.validateTransaction(transaction({ description: "  <script>alert(1)</script>  " })).description, "<script>alert(1)</script>");
  for (const overrides of [{ id: " " }, { id: "a".repeat(101) }, { type: "other" }, { description: " " }, { description: "a".repeat(121) }, { amountCents: 0 }, { amountCents: 1.5 }, { amountCents: Number.MAX_SAFE_INTEGER }, { date: "2026-02-30" }, { categoryId: "salary" }]) assert.throws(() => domain.validateTransaction(transaction(overrides)));
});

test("validates the complete state and rejects duplicate IDs and unsupported schemas", () => {
  const state = { version: 1, transactions: [transaction()], budgets: { "2026-11": { totalCents: 50000, categories: { food: 10000 } } } };
  assert.deepEqual(domain.validateState(state), state);
  assert.deepEqual(domain.emptyState(), { version: 1, transactions: [], budgets: {} });
  for (const invalid of [null, { ...state, version: 2 }, { ...state, transactions: [transaction(), transaction()] }, { ...state, budgets: [] }, { ...state, transactions: new Array(10001).fill(transaction()) }, { ...state, budgets: { "2026-13": { totalCents: 1, categories: {} } } }, { ...state, budgets: { "2026-11": { totalCents: -1, categories: {} } } }, { ...state, budgets: { "2026-11": { totalCents: 0, categories: { salary: 20 } } } }, { ...state, budgets: { "2026-11": { totalCents: 0, categories: { food: 0 } } } }]) assert.throws(() => domain.validateState(invalid));
});

test("combines search, type, category, month and inclusive date boundaries", () => {
  const transactions = [
    transaction({ id: "later", date: "2026-11-30", description: "CAFÉ especial" }),
    transaction({ id: "first", date: "2026-11-01", description: "Café da manhã" }),
    transaction({ id: "old", date: "2026-10-31", description: "Café antigo" }),
    transaction({ id: "income", type: "income", categoryId: "salary", description: "Café salário" }),
    transaction({ id: "other", categoryId: "other", description: "Café diferente" })
  ];
  const filtered = domain.filterTransactions(transactions, { month: "2026-11", startDate: "2026-11-01", endDate: "2026-11-30", search: "cafe", type: "expense", categoryId: "food" });
  assert.deepEqual(filtered.map((item) => item.id), ["later", "first"]);
  assert.equal(transactions[0].id, "later");
  assert.equal(domain.filterTransactions(transactions, { search: "nada" }).length, 0);
  assert.throws(() => domain.filterTransactions(transactions, { startDate: "2026-11-30", endDate: "2026-11-01" }));
  assert.throws(() => domain.filterTransactions(transactions, { startDate: "2026-02-30" }));
});

test("summarizes money in exact cents and groups only expenses", () => {
  const items = [transaction({ id: "1", amountCents: 10 }), transaction({ id: "2", amountCents: 20 }), transaction({ id: "3", categoryId: "other", amountCents: 25 }), transaction({ id: "4", type: "income", categoryId: "salary", amountCents: 100 })];
  assert.deepEqual(domain.summarize(items), { incomeCents: 100, expenseCents: 55, balanceCents: 45, count: 4 });
  assert.deepEqual(domain.categoryTotals(items), [{ categoryId: "food", amountCents: 30, count: 2 }, { categoryId: "other", amountCents: 25, count: 1 }]);
  assert.deepEqual(domain.summarize([]), { incomeCents: 0, expenseCents: 0, balanceCents: 0, count: 0 });
});

test("uses exact budget warning boundaries, allows zero and shows overspending", () => {
  for (const [spent, expected] of [[7999, "ok"], [8000, "warning"], [9999, "warning"], [10000, "exceeded"], [10001, "exceeded"]]) assert.equal(domain.budgetStatus(spent, 10000).status, expected);
  assert.deepEqual(domain.budgetStatus(123, 0), { percent: 0, remainingCents: 0, status: "none" });
  assert.equal(domain.budgetStatus(10001, 10000).remainingCents, -1);
  assert.ok(Math.abs(domain.budgetStatus(7999, 10000).percent - 79.99) < 1e-10);
});

test("editing amount, category or date moves derived totals without mutating existing records", () => {
  const before = transaction();
  const after = domain.validateTransaction({ ...before, date: "2026-12-01", categoryId: "other", amountCents: 3000 });
  assert.equal(domain.filterTransactions([after], { month: "2026-11" }).length, 0);
  assert.deepEqual(domain.categoryTotals([after]), [{ categoryId: "other", amountCents: 3000, count: 1 }]);
  assert.equal(before.categoryId, "food");
});
