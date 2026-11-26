"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createApp } = require("./helpers/dom.cjs");

function newTransaction(app, values = {}) {
  app.document.querySelector("[data-new-transaction]").click();
  fillTransaction(app, values);
  app.event(app.$("transaction-form"), "submit");
  app.flushTimers();
}

function fillTransaction(app, values = {}) {
  const data = { type: "expense", description: "Mercado da semana", amount: "150,50", date: "2026-11-26", categoryId: "food", ...values };
  const radio = app.$("transaction-form").querySelector(`input[name="transaction-type"][value="${data.type}"]`);
  radio.checked = true;
  app.event(radio, "change");
  for (const [id, value] of Object.entries({
    "transaction-description": data.description,
    "transaction-amount": data.amount,
    "transaction-date": data.date,
    "transaction-category": data.categoryId
  })) app.$(id).value = value;
}

function rowAction(app, action) {
  const button = app.$("transaction-rows").querySelector(`button[data-action="${action}"]`);
  assert.ok(button, "Expected rendered " + action + " button");
  button.click();
}

function currency(text) { return text.replace(/\s/g, ""); }

test("bootstrap com DOM simulado apresenta estado vazio sem criar registros", () => {
  const app = createApp();
  assert.equal(app.writes.length, 0);
  assert.equal(app.$("storage-error").hidden, true);
  assert.equal(app.$("transactions-empty").hidden, false);
  assert.match(app.$("transactions-empty").textContent, /Comece pelo primeiro lançamento/);
  assert.equal(app.$("transaction-table-wrap").hidden, true);
  assert.equal(currency(app.$("balance-value").textContent), "R$0,00");
  assert.equal(app.$("export-csv").disabled, true);
});

test("handlers cadastram receita e despesa, atualizam totais e persistem após reload", () => {
  const app = createApp();
  newTransaction(app, { type: "income", categoryId: "salary", description: "Salário", amount: "3.000,00" });
  newTransaction(app);
  assert.equal(app.saved().transactions.length, 2);
  assert.equal(app.saved().transactions.find((item) => item.type === "expense").amountCents, 15050);
  assert.equal(currency(app.$("income-value").textContent), "R$3.000,00");
  assert.equal(currency(app.$("expense-value").textContent), "R$150,50");
  assert.equal(currency(app.$("balance-value").textContent), "R$2.849,50");
  assert.equal(app.$("transaction-rows").childElementCount, 2);
  assert.equal(app.$("transaction-dialog").open, false);
  const reloaded = createApp({ records: app.records });
  assert.equal(reloaded.writes.length, 0);
  assert.equal(reloaded.$("transaction-rows").childElementCount, 2);
  assert.equal(currency(reloaded.$("balance-value").textContent), "R$2.849,50");
});

test("submit inválido preserva entradas e aponta primeiro campo sem gravar", () => {
  const app = createApp();
  newTransaction(app, { description: "", amount: "-2", date: "2026-02-30" });
  assert.equal(app.writes.length, 0);
  assert.equal(app.$("transaction-dialog").open, true);
  assert.equal(app.document.activeElement, app.$("transaction-description"));
  for (const field of ["description", "amount", "date"]) {
    assert.equal(app.$("transaction-" + field).getAttribute("aria-invalid"), "true");
    assert.equal(app.$("error-" + field).hidden, false);
  }
  assert.equal(app.$("transaction-amount").value, "-2");
  assert.equal(app.$("transaction-form-error").hidden, false);
});

test("edição mantém id e exclusão só grava depois da confirmação", () => {
  const app = createApp();
  newTransaction(app);
  const id = app.saved().transactions[0].id;
  rowAction(app, "edit");
  assert.equal(app.$("transaction-dialog-title").textContent, "Editar lançamento");
  assert.equal(app.$("transaction-amount").value, "150,50");
  fillTransaction(app, { description: "Mercado atualizado", amount: "200,00", categoryId: "shopping" });
  app.event(app.$("transaction-form"), "submit");
  app.flushTimers();
  assert.equal(app.saved().transactions[0].id, id);
  assert.equal(app.saved().transactions[0].amountCents, 20000);
  assert.equal(app.saved().transactions[0].categoryId, "shopping");
  rowAction(app, "delete");
  assert.equal(app.$("confirm-dialog").open, true);
  assert.equal(app.saved().transactions.length, 1);
  app.$("confirm-dialog").querySelector("[data-close-dialog]").click();
  assert.equal(app.saved().transactions.length, 1);
  rowAction(app, "delete");
  app.$("confirm-action").click();
  assert.equal(app.saved().transactions.length, 0);
  assert.equal(app.$("confirm-dialog").open, false);
  assert.equal(currency(app.$("expense-value").textContent), "R$0,00");
});

test("orçamento mensal e por categoria é salvo e alerta a partir de 80%", () => {
  const app = createApp();
  newTransaction(app, { amount: "80,00" });
  app.$("manage-budgets").click();
  assert.equal(app.$("budget-dialog").open, true);
  app.$("budget-total").value = "100,00";
  app.$("budget-food").value = "80,00";
  app.event(app.$("budget-form"), "submit");
  assert.equal(app.saved().budgets["2026-11"].totalCents, 10000);
  assert.equal(app.saved().budgets["2026-11"].categories.food, 8000);
  assert.match(app.$("budget-overview").textContent, /80% utilizado/);
  assert.match(app.$("budget-overview").textContent, /pelo menos 80%/);
  assert.match(app.$("budget-overview").textContent, /100% · Limite atingido/);
  app.$("manage-budgets").click();
  app.$("budget-total").value = "";
  app.$("budget-food").value = "";
  app.event(app.$("budget-form"), "submit");
  assert.equal(app.saved().budgets["2026-11"], undefined);
});

test("filtros combinados alteram a lista e preservam o resumo do mês", () => {
  const app = createApp();
  newTransaction(app, { description: "Alimentação mercado", amount: "30,00", date: "2026-11-10" });
  newTransaction(app, { description: "Alimentação café", amount: "20,00", date: "2026-11-20" });
  newTransaction(app, { description: "Transporte", amount: "50,00", categoryId: "transport", date: "2026-11-20" });
  app.$("search-filter").value = "ALIMENTACAO";
  app.$("category-filter").value = "food";
  app.$("start-filter").value = "2026-11-20";
  app.$("end-filter").value = "2026-11-20";
  app.event(app.$("filter-form"), "input");
  assert.equal(app.$("transaction-rows").childElementCount, 1);
  assert.match(app.$("transaction-rows").textContent, /Alimentação café/);
  assert.equal(currency(app.$("expense-value").textContent), "R$100,00");
  app.$("start-filter").value = "2026-11-21";
  app.event(app.$("filter-form"), "change");
  assert.equal(app.$("filter-error").hidden, false);
  assert.equal(app.$("export-csv").disabled, true);
  app.$("reset-filters").click();
  app.flushTimers();
  assert.equal(app.$("transaction-rows").childElementCount, 3);
  assert.equal(app.$("filter-error").hidden, true);
});

test("texto de usuário é renderizado como texto, sem criar elementos HTML", () => {
  const app = createApp();
  const description = '<img src=x onerror="alert(1)">';
  newTransaction(app, { description });
  assert.match(app.$("transaction-rows").textContent, /<img src=x/);
  assert.equal(app.$("transaction-rows").querySelector("img"), null);
  assert.equal(app.saved().transactions[0].description, description);
});

test("falha ao salvar não altera estado ou resumo e mantém formulário preenchido", () => {
  const app = createApp();
  newTransaction(app);
  const before = app.records.get("expense-tracker:v1");
  app.faults.write = true;
  newTransaction(app, { description: "Não salvo", amount: "500,00" });
  assert.equal(app.records.get("expense-tracker:v1"), before);
  assert.equal(app.$("transaction-dialog").open, true);
  assert.equal(app.$("transaction-description").value, "Não salvo");
  assert.equal(currency(app.$("expense-value").textContent), "R$150,50");
  assert.match(app.$("transaction-form-error").textContent, /Não foi possível salvar/);
  assert.equal(app.$("save-transaction").disabled, false);
});

test("dados corrompidos permanecem intactos e bloqueiam gravação", () => {
  const raw = '{"json": "incompleto"';
  const records = new Map([["expense-tracker:v1", raw]]);
  const app = createApp({ records });
  assert.equal(app.$("storage-error").hidden, false);
  assert.equal(app.$("balance-value").textContent, "—");
  assert.equal(app.$("save-transaction").disabled, true);
  assert.equal(app.$("save-budget").disabled, true);
  assert.equal(app.$("export-backup").textContent, "Baixar recuperação");
  assert.equal(app.writes.length, 0);
  assert.equal(records.get("expense-tracker:v1"), raw);
  app.document.querySelector("[data-new-transaction]").click();
  assert.equal(app.$("transaction-dialog").open, false);
});

test("armazenamento inacessível exibe indisponibilidade sem simular saldo zero", () => {
  const app = createApp({ faults: { access: true } });
  assert.equal(app.$("storage-error").hidden, false);
  assert.equal(app.$("balance-value").textContent, "—");
  assert.match(app.$("storage-error-message").textContent, /acessar o armazenamento/);
  assert.equal(app.writes.length, 0);
  assert.equal(app.$("import-backup").disabled, true);
});

test("evento storage torna a tela somente leitura antes de nova gravação", () => {
  const app = createApp();
  newTransaction(app);
  const writes = app.writes.length;
  app.storageEvent("expense-tracker:v1");
  assert.equal(app.$("storage-error").hidden, false);
  assert.match(app.$("storage-error-message").textContent, /outra aba/);
  assert.equal(app.$("save-transaction").disabled, true);
  assert.equal(app.$("manage-budgets").disabled, true);
  rowAction(app, "delete");
  assert.equal(app.writes.length, writes);
  assert.equal(app.saved().transactions.length, 1);
});

async function chooseBackup(app, text, size = Buffer.byteLength(text, "utf8")) {
  app.$("backup-file").files = [{ size, async text() { return text; } }];
  app.event(app.$("backup-file"), "change");
  await new Promise(setImmediate);
}

function replacementBackup(app) {
  return app.context.ExpenseTracker.storage.serializeBackup({
    version: 1,
    transactions: [{ id: "restored-1", type: "income", description: "Receita restaurada", amountCents: 250000, date: "2026-10-15", categoryId: "salary" }],
    budgets: { "2026-10": { totalCents: 120000, categories: { food: 30000 } } }
  });
}

test("restauração válida exige confirmação e substitui registros e orçamentos", async () => {
  const app = createApp();
  newTransaction(app);
  const previous = app.records.get("expense-tracker:v1");
  await chooseBackup(app, replacementBackup(app));
  assert.equal(app.$("confirm-dialog").open, true);
  assert.equal(app.records.get("expense-tracker:v1"), previous);
  assert.match(app.$("confirm-message").textContent, /substituirá todos os dados/);
  app.$("confirm-action").click();
  app.flushTimers();
  assert.equal(app.saved().transactions.length, 1);
  assert.equal(app.saved().transactions[0].id, "restored-1");
  assert.equal(app.saved().budgets["2026-10"].categories.food, 30000);
  assert.equal(app.$("month-filter").value, "2026-10");
  assert.equal(currency(app.$("balance-value").textContent), "R$2.500,00");
  assert.equal(app.$("confirm-dialog").open, false);
});

test("cancelar restauração preserva integralmente o armazenamento atual", async () => {
  const app = createApp();
  newTransaction(app);
  const previous = app.records.get("expense-tracker:v1");
  const writes = app.writes.length;
  await chooseBackup(app, replacementBackup(app));
  app.$("confirm-dialog").querySelector("[data-close-dialog]").click();
  assert.equal(app.$("confirm-dialog").open, false);
  assert.equal(app.records.get("expense-tracker:v1"), previous);
  assert.equal(app.writes.length, writes);
  app.$("confirm-action").click();
  assert.equal(app.writes.length, writes);
});

test("backup inválido ou maior que o limite informa erro sem abrir confirmação", async () => {
  const app = createApp();
  newTransaction(app);
  const previous = app.records.get("expense-tracker:v1");
  await chooseBackup(app, "{json inválido");
  assert.equal(app.$("confirm-dialog").open, false);
  assert.equal(app.$("toast").classList.contains("error"), true);
  assert.match(app.$("toast").textContent, /backup JSON válido/);
  assert.equal(app.$("import-backup").disabled, false);
  assert.equal(app.records.get("expense-tracker:v1"), previous);
  await chooseBackup(app, "{}", app.context.ExpenseTracker.storage.MAX_BACKUP_BYTES + 1);
  assert.match(app.$("toast").textContent, /20 MiB/);
  assert.equal(app.$("confirm-dialog").open, false);
  assert.equal(app.records.get("expense-tracker:v1"), previous);
});

test("alteração em outra aba durante leitura de backup impede restauração", async () => {
  const app = createApp();
  newTransaction(app);
  const previous = app.records.get("expense-tracker:v1");
  const text = replacementBackup(app);
  let finishReading;
  app.$("backup-file").files = [{ size: text.length, text() { return new Promise((resolve) => { finishReading = resolve; }); } }];
  app.event(app.$("backup-file"), "change");
  assert.equal(app.$("import-backup").disabled, true);
  assert.equal(app.$("import-backup").textContent, "Lendo backup…");
  app.storageEvent("expense-tracker:v1");
  finishReading(text);
  await new Promise(setImmediate);
  assert.equal(app.$("confirm-dialog").open, false);
  assert.equal(app.$("import-backup").disabled, true);
  assert.match(app.$("toast").textContent, /outra aba/);
  assert.equal(app.records.get("expense-tracker:v1"), previous);
});

test("download de backup e recuperação usa os dados reais sem gravar alterações", async () => {
  const app = createApp();
  newTransaction(app);
  const writes = app.writes.length;
  app.$("export-backup").click();
  const download = app.document.downloads.at(-1);
  assert.match(download.filename, /^expense-tracker-backup-/);
  const backup = JSON.parse(await app.blobs.get(download.href).text());
  assert.equal(backup.data.transactions[0].description, "Mercado da semana");
  assert.equal(app.writes.length, writes);

  const raw = "{arquivo corrompido";
  const recovery = createApp({ records: new Map([["expense-tracker:v1", raw]]) });
  recovery.$("export-backup").click();
  const recovered = recovery.document.downloads.at(-1);
  assert.match(recovered.filename, /^expense-tracker-recuperacao-/);
  assert.equal(await recovery.blobs.get(recovered.href).text(), raw);
  assert.equal(recovery.writes.length, 0);
});
