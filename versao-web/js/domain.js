(function (global) {
  "use strict";

  const MAX_AMOUNT_CENTS = 100000000000;
  const MAX_TRANSACTIONS = 10000;
  const CATEGORY_DEFINITIONS = Object.freeze([
    { id: "food", label: "Alimentação", color: "#b45429", type: "expense" },
    { id: "housing", label: "Moradia", color: "#6554a4", type: "expense" },
    { id: "transport", label: "Transporte", color: "#296d9b", type: "expense" },
    { id: "health", label: "Saúde", color: "#ae4163", type: "expense" },
    { id: "education", label: "Educação", color: "#38794b", type: "expense" },
    { id: "leisure", label: "Lazer", color: "#8e6920", type: "expense" },
    { id: "shopping", label: "Compras", color: "#8c5086", type: "expense" },
    { id: "bills", label: "Contas", color: "#406f73", type: "expense" },
    { id: "other", label: "Outros", color: "#637181", type: "expense" },
    { id: "salary", label: "Salário", color: "#25795a", type: "income" },
    { id: "freelance", label: "Freelance", color: "#296d9b", type: "income" },
    { id: "investments", label: "Investimentos", color: "#6554a4", type: "income" },
    { id: "other-income", label: "Outras receitas", color: "#637181", type: "income" }
  ].map(Object.freeze));
  const categoryById = new Map(CATEGORY_DEFINITIONS.map((category) => [category.id, category]));

  function isRecord(value) {
    return value !== null && Object.prototype.toString.call(value) === "[object Object]";
  }

  function categoriesForType(type) {
    return CATEGORY_DEFINITIONS.filter((category) => category.type === type);
  }

  function isValidMonth(value) {
    return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) && Number(value.slice(0, 4)) > 0;
  }

  function isValidDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !isValidMonth(value.slice(0, 7))) return false;
    const [year, month, day] = value.split("-").map(Number);
    const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const monthLengths = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return day >= 1 && day <= monthLengths[month - 1];
  }

  function validCents(value, allowZero = false) {
    return Number.isSafeInteger(value) && value >= (allowZero ? 0 : 1) && value <= MAX_AMOUNT_CENTS;
  }

  function parseAmount(input) {
    if (typeof input !== "string") throw new Error("Informe um valor válido, como 125,50.");
    const value = input.trim();
    let whole;
    let fraction;
    if (/^\d+(?:,\d{1,2})?$/.test(value)) {
      [whole, fraction = ""] = value.split(",");
    } else if (/^[1-9]\d{0,2}(?:\.\d{3})+(?:,\d{1,2})?$/.test(value)) {
      [whole, fraction = ""] = value.split(",");
      whole = whole.replace(/\./g, "");
    } else if (/^\d+\.\d{1,2}$/.test(value)) {
      [whole, fraction] = value.split(".");
    } else {
      throw new Error("Use um valor positivo com até duas casas decimais, como 125,50.");
    }
    // Convert digits directly, avoiding floating-point rounding of currency.
    const normalizedWhole = whole.replace(/^0+/, "") || "0";
    if (normalizedWhole.length > 10) throw new Error("O valor máximo permitido é R$ 1.000.000.000,00.");
    const cents = Number(normalizedWhole) * 100 + Number(fraction.padEnd(2, "0"));
    if (!validCents(cents)) throw new Error("Informe um valor entre R$ 0,01 e R$ 1.000.000.000,00.");
    return cents;
  }

  function validateTransaction(input) {
    if (!isRecord(input)) throw new Error("Lançamento inválido.");
    if (typeof input.id !== "string" || !input.id.trim() || input.id.length > 100) throw new Error("Identificador de lançamento inválido.");
    if (!["expense", "income"].includes(input.type)) throw new Error("Escolha receita ou despesa.");
    if (typeof input.description !== "string" || !input.description.trim() || input.description.trim().length > 120) {
      throw new Error("A descrição deve ter entre 1 e 120 caracteres.");
    }
    if (!validCents(input.amountCents)) throw new Error("O valor do lançamento deve ser positivo e estar dentro do limite permitido.");
    if (!isValidDate(input.date)) throw new Error("Informe uma data válida.");
    const category = categoryById.get(input.categoryId);
    if (!category || category.type !== input.type) throw new Error("Escolha uma categoria compatível com o tipo de lançamento.");
    return {
      id: input.id,
      type: input.type,
      description: input.description.trim(),
      amountCents: input.amountCents,
      date: input.date,
      categoryId: input.categoryId
    };
  }

  function emptyState() {
    return { version: 1, transactions: [], budgets: {} };
  }

  function validateState(input) {
    if (!isRecord(input) || input.version !== 1) throw new Error("Formato ou versão dos dados não reconhecido.");
    if (!Array.isArray(input.transactions) || input.transactions.length > MAX_TRANSACTIONS) {
      throw new Error("A lista de lançamentos é inválida ou excede o limite de 10.000 registros.");
    }
    const transactions = Array.from(input.transactions, validateTransaction);
    if (new Set(transactions.map((item) => item.id)).size !== transactions.length) {
      throw new Error("Existem identificadores de lançamento duplicados.");
    }
    if (!isRecord(input.budgets)) throw new Error("Os orçamentos estão em um formato inválido.");
    const budgets = {};
    for (const [month, budget] of Object.entries(input.budgets)) {
      if (!isValidMonth(month) || !isRecord(budget) || !validCents(budget.totalCents, true) || !isRecord(budget.categories)) {
        throw new Error("Existe um orçamento mensal inválido.");
      }
      const categories = {};
      for (const [categoryId, limit] of Object.entries(budget.categories)) {
        const category = categoryById.get(categoryId);
        if (!category || category.type !== "expense" || !validCents(limit)) {
          throw new Error("Existe um limite por categoria inválido.");
        }
        categories[categoryId] = limit;
      }
      budgets[month] = { totalCents: budget.totalCents, categories };
    }
    return { version: 1, transactions, budgets };
  }

  function normalizeSearch(value) {
    return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  }

  function filterTransactions(transactions, filters = {}) {
    const { month = "", search = "", type = "", categoryId = "", startDate = "", endDate = "" } = filters;
    if (month && !isValidMonth(month)) throw new Error("Selecione um mês válido.");
    if (type && !["expense", "income"].includes(type)) throw new Error("Tipo de lançamento inválido.");
    if (categoryId && !categoryById.has(categoryId)) throw new Error("Categoria inválida.");
    if ((startDate && !isValidDate(startDate)) || (endDate && !isValidDate(endDate))) throw new Error("Informe datas válidas para o filtro.");
    if (startDate && endDate && startDate > endDate) throw new Error("A data inicial deve ser anterior ou igual à data final.");
    if (typeof search !== "string") throw new Error("Informe um texto válido para buscar.");
    const needle = normalizeSearch(search.trim());
    return transactions.filter((item) =>
      (!month || item.date.startsWith(month)) &&
      (!type || item.type === type) &&
      (!categoryId || item.categoryId === categoryId) &&
      (!startDate || item.date >= startDate) &&
      (!endDate || item.date <= endDate) &&
      (!needle || normalizeSearch(item.description).includes(needle))
    ).sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  }

  function summarize(transactions) {
    const result = { incomeCents: 0, expenseCents: 0, balanceCents: 0, count: transactions.length };
    for (const item of transactions) {
      if (item.type === "income") result.incomeCents += item.amountCents;
      else result.expenseCents += item.amountCents;
    }
    result.balanceCents = result.incomeCents - result.expenseCents;
    return result;
  }

  function categoryTotals(transactions) {
    const totals = new Map();
    for (const item of transactions) {
      if (item.type !== "expense") continue;
      const total = totals.get(item.categoryId) || { categoryId: item.categoryId, amountCents: 0, count: 0 };
      total.amountCents += item.amountCents;
      total.count += 1;
      totals.set(item.categoryId, total);
    }
    return [...totals.values()].sort((a, b) => b.amountCents - a.amountCents || a.categoryId.localeCompare(b.categoryId));
  }

  function budgetStatus(spentCents, limitCents) {
    if (!Number.isSafeInteger(spentCents) || spentCents < 0 || !validCents(limitCents, true)) throw new Error("Valores de orçamento inválidos.");
    if (!limitCents) return { percent: 0, remainingCents: 0, status: "none" };
    const percent = (spentCents / limitCents) * 100;
    return {
      percent,
      remainingCents: limitCents - spentCents,
      status: spentCents >= limitCents ? "exceeded" : spentCents >= limitCents * 0.8 ? "warning" : "ok"
    };
  }

  global.ExpenseTracker = global.ExpenseTracker || {};
  global.ExpenseTracker.domain = Object.freeze({
    CATEGORY_DEFINITIONS, MAX_AMOUNT_CENTS, categoriesForType, parseAmount,
    validateTransaction, emptyState, validateState, filterTransactions,
    summarize, categoryTotals, budgetStatus, isValidDate, isValidMonth
  });
})(globalThis);
