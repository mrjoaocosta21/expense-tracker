"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../js/storage.js"), "utf8");

function testDomain() {
  return {
    CATEGORY_DEFINITIONS: [{ id: "food", label: "Alimentação" }, { id: "salary", label: "Salário" }],
    emptyState() { return { version: 1, transactions: [], budgets: {} }; },
    validateState(state) {
      if (!state || state.version !== 1 || !Array.isArray(state.transactions) || !state.budgets ||
          state.transactions.some((item) => !item.id || !Number.isSafeInteger(item.amountCents) || item.amountCents <= 0)) {
        throw new Error("Estado inválido.");
      }
      return JSON.parse(JSON.stringify(state));
    }
  };
}

function setup(options = {}) {
  const data = new Map();
  let writes = 0;
  let quota = false;
  const memory = {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) {
      if (quota) throw new Error("QuotaExceededError");
      writes += 1;
      data.set(key, String(value));
    }
  };
  const context = vm.createContext({ ExpenseTracker: { domain: options.domain || testDomain() } });
  vm.runInContext(source, context);
  return {
    api: context.ExpenseTracker.storage,
    memory,
    data,
    get writes() { return writes; },
    set quota(value) { quota = value; }
  };
}

function state(description = "Mercado") {
  return { version: 1, budgets: {}, transactions: [{
    id: "transaction-1", type: "expense", description, amountCents: 123456,
    date: "2026-11-26", categoryId: "food"
  }] };
}

test("primeiro uso não escreve dados e persistência mantém centavos", () => {
  const env = setup();
  const repository = env.api.createRepository(() => env.memory);
  assert.equal(repository.load().transactions.length, 0);
  assert.equal(env.writes, 0);
  repository.save(state());
  assert.equal(env.writes, 1);
  const reopened = env.api.createRepository(() => env.memory);
  assert.equal(reopened.load().transactions[0].amountCents, 123456);
});

test("save exige load válido antes de escrever", () => {
  const env = setup();
  const repository = env.api.createRepository(() => env.memory);
  assert.throws(() => repository.save(state()), /carregar/);
  assert.equal(env.writes, 0);
});

for (const raw of ["{json quebrado", JSON.stringify({ version: 2, transactions: [], budgets: {} })]) {
  test("dados inválidos são preservados e exportáveis: " + raw, () => {
    const env = setup();
    env.data.set(env.api.STORAGE_KEY, raw);
    const repository = env.api.createRepository(() => env.memory);
    assert.throws(() => repository.load(), /dados salvos/);
    assert.equal(repository.exportRaw(), raw);
    assert.throws(() => repository.save(state()), /carregar/);
    assert.equal(env.memory.getItem(env.api.STORAGE_KEY), raw);
    assert.equal(env.writes, 0);
  });
}

test("falha de acesso e falha de leitura explicam o erro e bloqueiam gravação", () => {
  const env = setup();
  const inaccessible = env.api.createRepository(() => { throw new Error("SecurityError"); });
  assert.throws(() => inaccessible.load(), /acessar o armazenamento/);
  assert.throws(() => inaccessible.save(state()), /carregar/);
  const unreadable = env.api.createRepository(() => ({ ...env.memory, getItem() { throw new Error("SecurityError"); } }));
  assert.throws(() => unreadable.load(), /ler os dados/);
  assert.equal(env.writes, 0);
});

test("quota excedida preserva estado anterior e permite nova tentativa", () => {
  const env = setup();
  const repository = env.api.createRepository(() => env.memory);
  repository.load();
  repository.save(state());
  const before = repository.exportRaw();
  env.quota = true;
  assert.throws(() => repository.save(state("Novo mercado")), /armazenamento pode estar cheio/);
  assert.equal(repository.exportRaw(), before);
  env.quota = false;
  repository.save(state("Nova tentativa"));
  assert.equal(JSON.parse(repository.exportRaw()).transactions[0].description, "Nova tentativa");
});

test("estado inválido não atinge o armazenamento", () => {
  const env = setup();
  const repository = env.api.createRepository(() => env.memory);
  repository.load();
  const invalid = state();
  invalid.transactions[0].amountCents = 0;
  assert.throws(() => repository.save(invalid), /inválido/);
  assert.equal(env.writes, 0);
  assert.equal(repository.exportRaw(), null);
});

test("mudanças em outra aba são detectadas sem sobrescrever", () => {
  const env = setup();
  const first = env.api.createRepository(() => env.memory);
  const second = env.api.createRepository(() => env.memory);
  first.load();
  second.load();
  first.save(state("Primeira aba"));
  assert.throws(() => second.save(state("Segunda aba")), /outra aba.*Recarregue/);
  assert.equal(JSON.parse(first.exportRaw()).transactions[0].description, "Primeira aba");
  second.load();
  second.save(state("Segunda aba atualizada"));
  assert.equal(JSON.parse(second.exportRaw()).transactions[0].description, "Segunda aba atualizada");
});

test("remoção de dados em outra aba também exige recarregar", () => {
  const env = setup();
  const repository = env.api.createRepository(() => env.memory);
  repository.load();
  repository.save(state());
  env.data.delete(env.api.STORAGE_KEY);
  assert.throws(() => repository.save(state()), /outra aba/);
  assert.equal(env.memory.getItem(env.api.STORAGE_KEY), null);
});

test("backup completo vai e volta sem escrever no navegador", () => {
  const env = setup();
  const data = state();
  data.budgets = { "2026-11": { totalCents: 500000, categories: { food: 100000 } } };
  const serialized = env.api.serializeBackup(data);
  const wrapper = JSON.parse(serialized);
  assert.equal(wrapper.app, "expense-tracker");
  assert.equal(wrapper.version, 1);
  assert.ok(Number.isFinite(Date.parse(wrapper.exportedAt)));
  assert.equal(JSON.stringify(env.api.parseBackup(serialized)), JSON.stringify(data));
  assert.equal(env.writes, 0);
});

test("backups malformados, incompatíveis e inválidos são recusados", () => {
  const env = setup();
  const serialized = env.api.serializeBackup(state());
  for (const invalid of [
    "{",
    "null",
    JSON.stringify(state()),
    serialized.replace('"app": "expense-tracker"', '"app": "outro"'),
    serialized.replace('"version": 1', '"version": 2'),
    serialized.replace('"amountCents": 123456', '"amountCents": 0'),
    serialized.replace(/"exportedAt": "[^"]+"/, '"exportedAt": "ontem"')
  ]) assert.throws(() => env.api.parseBackup(invalid), /backup|arquivo/);
  assert.equal(env.writes, 0);
});

test("limite de backup considera bytes UTF-8", () => {
  const env = setup();
  assert.equal(env.api.MAX_BACKUP_BYTES, 20 * 1024 * 1024);
  assert.throws(() => env.api.parseBackup("a".repeat(env.api.MAX_BACKUP_BYTES + 1)), /20 MiB/);
  assert.throws(() => env.api.parseBackup("é".repeat(env.api.MAX_BACKUP_BYTES / 2 + 1)), /20 MiB/);
});

test("CSV usa BOM, separador brasileiro e escapa campos e fórmulas", () => {
  const env = setup();
  const data = state('=HYPERLINK("teste");\ntexto');
  const csv = env.api.toCsv(data.transactions);
  assert.ok(csv.startsWith('\uFEFF"Data";"Tipo";"Descrição";"Categoria";"Valor (R$)"\r\n'));
  assert.ok(csv.includes('"\'=HYPERLINK(""teste"");\ntexto"'));
  assert.ok(csv.includes('"Alimentação";"1234,56"'));
  for (const description of ["+1+1", "-1+1", "@SUM(1)", "\tformula", "\rformula", "   =1+1"]) {
    assert.ok(env.api.toCsv(state(description).transactions).includes('"\'' + description + '"'));
  }
});

test("CSV diferencia receitas e despesas com valor positivo em cada linha", () => {
  const env = setup();
  const data = state();
  data.transactions[0].type = "income";
  data.transactions[0].categoryId = "salary";
  data.transactions[0].amountCents = 1;
  const csv = env.api.toCsv(data.transactions);
  assert.ok(csv.includes('"Receita"'));
  assert.ok(csv.includes('"Salário";"0,01"'));
  assert.equal(env.api.toCsv([]).split("\r\n").length, 2);
});

test("integração com domínio real preserva orçamento, receitas e despesas no backup", () => {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../js/domain.js"), "utf8"), context);
  vm.runInContext(source, context);
  const api = context.ExpenseTracker.storage;
  const original = state();
  original.transactions.push({
    id: "income-1", type: "income", description: "Salário", amountCents: 450000,
    date: "2026-11-01", categoryId: "salary"
  });
  original.budgets = { "2026-11": { totalCents: 300000, categories: { food: 90000 } } };
  const restored = api.parseBackup(api.serializeBackup(original));
  assert.equal(JSON.stringify(restored), JSON.stringify(context.ExpenseTracker.domain.validateState(original)));
  assert.ok(api.toCsv(restored.transactions).includes('"Salário";"4500,00"'));
  const incompatible = JSON.parse(api.serializeBackup(original));
  incompatible.data.transactions[0].categoryId = "salary";
  assert.throws(() => api.parseBackup(JSON.stringify(incompatible)), /dados inválidos/);
});


test("10.000 lançamentos com descrições Unicode podem ser salvos, exportados e restaurados", () => {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../js/domain.js"), "utf8"), context);
  const rules = context.ExpenseTracker.domain;
  const env = setup({ domain: rules });
  const repository = env.api.createRepository(() => env.memory);
  repository.load();
  const original = {
    version: 1,
    transactions: Array.from({ length: 10000 }, (_, index) => ({
      id: String(index).padStart(36, "0"), type: "expense", description: "漢".repeat(120),
      amountCents: rules.MAX_AMOUNT_CENTS, date: "2026-11-26", categoryId: "food"
    })),
    budgets: {}
  };
  const saved = repository.save(original);
  const serialized = env.api.serializeBackup(saved);
  assert.ok(Buffer.byteLength(serialized, "utf8") > 5 * 1024 * 1024);
  assert.ok(Buffer.byteLength(serialized, "utf8") < env.api.MAX_BACKUP_BYTES);
  assert.equal(JSON.stringify(env.api.parseBackup(serialized)), JSON.stringify(saved));
  const reopened = env.api.createRepository(() => env.memory).load();
  assert.equal(JSON.stringify(reopened), JSON.stringify(saved));
});

test("estado cujo backup excede o limite não é exportado nem substitui os dados salvos", () => {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../js/domain.js"), "utf8"), context);
  const rules = context.ExpenseTracker.domain;
  const env = setup({ domain: rules });
  const repository = env.api.createRepository(() => env.memory);
  repository.load();
  repository.save(state());
  const before = repository.exportRaw();
  const beforeWrites = env.writes;
  const categories = Object.fromEntries(rules.categoriesForType("expense").map((category) => [category.id, rules.MAX_AMOUNT_CENTS]));
  const oversized = { version: 1, transactions: [], budgets: {} };
  // Valid month keys and category limits can still make the complete backup too large.
  for (let index = 0; index < 60000; index++) {
    const year = String(Math.floor(index / 12) + 1).padStart(4, "0");
    const month = String(index % 12 + 1).padStart(2, "0");
    oversized.budgets[`${year}-${month}`] = { totalCents: rules.MAX_AMOUNT_CENTS, categories };
  }
  assert.doesNotThrow(() => rules.validateState(oversized));
  assert.throws(() => env.api.serializeBackup(oversized), /20 MiB/);
  assert.throws(() => repository.save(oversized), /20 MiB/);
  assert.equal(env.writes, beforeWrites);
  assert.equal(repository.exportRaw(), before);
  // A rejected oversized update leaves the snapshot usable for a corrected update.
  repository.save(state("Ajuste após tentativa"));
  assert.equal(JSON.parse(repository.exportRaw()).transactions[0].description, "Ajuste após tentativa");
});
