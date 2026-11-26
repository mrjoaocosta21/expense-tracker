(function () {
  "use strict";

  const { domain: rules, storage } = globalThis.ExpenseTracker;
  const repository = storage.createRepository();
  const $ = (id) => document.getElementById(id);
  const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const decimal = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const percent = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
  const dateFormatter = new Intl.DateTimeFormat("pt-BR");
  const monthFormatter = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });
  const categories = new Map(rules.CATEGORY_DEFINITIONS.map((category) => [category.id, category]));
  const PAGE_SIZE = 10;
  let state = rules.emptyState();
  let loaded = false;
  let readOnly = false;
  let selectedMonth = today().slice(0, 7);
  let page = 1;
  let editingId = null;
  let confirmation = null;
  let toastTimer;
  const dialogOrigins = new WeakMap();

  function today() {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function monthLabel(month) {
    return month ? monthFormatter.format(new Date(`${month}-15T12:00:00`)) : "Todos os períodos";
  }

  function formatMoney(cents) { return money.format(cents / 100); }
  function formatDate(date) { return dateFormatter.format(new Date(`${date}T12:00:00`)); }
  function cloneState() { return JSON.parse(JSON.stringify(state)); }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function icon(name, className = "") {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", `icon ${className}`.trim());
    svg.setAttribute("aria-hidden", "true");
    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttribute("href", `#i-${name}`);
    svg.append(use);
    return svg;
  }

  function option(value, label) { return new Option(label, value); }

  function notify(message, error = false) {
    clearTimeout(toastTimer);
    const toast = $("toast");
    toast.textContent = message;
    toast.classList.toggle("error", error);
    toast.hidden = false;
    toastTimer = setTimeout(() => { toast.hidden = true; }, error ? 12000 : 6000);
  }

  function showError(id, message) {
    $(id).textContent = message;
    $(id).hidden = !message;
  }

  function setReadOnly(message) {
    readOnly = true;
    $("storage-error").hidden = false;
    $("storage-error-message").textContent = message;
    document.querySelectorAll("[data-write]").forEach((button) => { button.disabled = true; });
    $("save-transaction").disabled = true;
    $("save-budget").disabled = true;
    $("confirm-action").disabled = true;
  }

  function commit(nextState) {
    if (readOnly) throw new Error("Recarregue a página para acessar os dados antes de salvar.");
    state = repository.save(nextState);
  }

  function showDialog(dialog) {
    dialogOrigins.set(dialog, document.activeElement);
    dialog.showModal();
  }

  function closeDialog(dialog) { dialog.close(); }

  function renderMonthOptions() {
    const months = new Set([selectedMonth, ...state.transactions.map((item) => item.date.slice(0, 7)), ...Object.keys(state.budgets)]);
    const current = new Date();
    for (let offset = -12; offset <= 12; offset++) {
      const date = new Date(current.getFullYear(), current.getMonth() + offset, 15);
      months.add(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
    }
    months.delete("");
    $("month-filter").replaceChildren(option("", "Todos os períodos"), ...[...months].sort().reverse().map((month) => option(month, monthLabel(month))));
    $("month-filter").value = selectedMonth;
  }

  function periodTransactions() { return rules.filterTransactions(state.transactions, { month: selectedMonth }); }

  function renderSummary(items) {
    const totals = rules.summarize(items);
    $("balance-value").textContent = loaded ? formatMoney(totals.balanceCents) : "—";
    $("income-value").textContent = loaded ? formatMoney(totals.incomeCents) : "—";
    $("expense-value").textContent = loaded ? formatMoney(totals.expenseCents) : "—";
    for (const [type, target, label] of [["income", "income-count", "receita"], ["expense", "expense-count", "despesa"]]) {
      const count = items.filter((item) => item.type === type).length;
      $(target).textContent = !loaded ? "Dados indisponíveis" : count ? `${count} ${label}${count === 1 ? "" : "s"} no período` : `Nenhuma ${label} no período`;
    }
    $("period-context").textContent = !loaded ? "Os dados salvos foram preservados." : `${totals.count} lançamento${totals.count === 1 ? "" : "s"} · ${monthLabel(selectedMonth)}`;
  }

  function emptyBlock(symbol, title, description, className = "compact-empty") {
    const block = element("div", className);
    const mark = element("span", "empty-symbol");
    mark.append(icon(symbol));
    block.append(mark, element(className === "empty-state" ? "h3" : "strong", "", title), element("p", "", description));
    return block;
  }

  function categoryDot(category) {
    const dot = element("span", "category-dot");
    dot.style.setProperty("--category-color", category.color);
    dot.setAttribute("aria-hidden", "true");
    return dot;
  }

  function bar(amount, total, color) {
    const track = element("div", "bar-track");
    track.setAttribute("aria-hidden", "true");
    const fill = element("div", "bar-fill");
    fill.style.setProperty("--bar-width", `${Math.min(total ? amount / total * 100 : 0, 100)}%`);
    fill.style.setProperty("--category-color", color);
    track.append(fill);
    return track;
  }

  function renderCategories(items) {
    const container = $("category-chart");
    const groups = rules.categoryTotals(items);
    if (!loaded || !groups.length) {
      container.replaceChildren(emptyBlock("grid", loaded ? "Cada gasto conta uma história" : "Dados indisponíveis", loaded ? "Registre uma despesa para descobrir como seus gastos se distribuem." : "Recarregue a página após verificar o aviso de armazenamento."));
      return;
    }
    const total = groups.reduce((sum, item) => sum + item.amountCents, 0);
    const list = element("ul", "category-list");
    for (const group of groups) {
      const category = categories.get(group.categoryId);
      const item = element("li");
      const line = element("div", "category-line");
      const label = element("span", "category-name");
      label.append(categoryDot(category), document.createTextNode(category.label));
      const value = element("span", "category-amount", formatMoney(group.amountCents));
      value.append(element("span", "category-percent", `${percent.format(group.amountCents / total * 100)}%`));
      line.append(label, value);
      item.append(line, bar(group.amountCents, total, category.color));
      list.append(item);
    }
    const footer = element("p", "chart-total", "Total de despesas");
    footer.append(element("strong", "", formatMoney(total)));
    container.replaceChildren(list, footer);
  }

  function renderBudget(items) {
    const container = $("budget-overview");
    const manage = $("manage-budgets");
    $("budget-period").textContent = selectedMonth ? monthLabel(selectedMonth) : "Orçamentos são definidos por mês";
    manage.disabled = readOnly;
    manage.textContent = selectedMonth ? "Definir orçamento" : "Selecionar mês atual";
    if (!loaded || !selectedMonth) {
      container.replaceChildren(emptyBlock("target", loaded ? "Um mês de cada vez" : "Dados indisponíveis", loaded ? "Selecione um mês para acompanhar seus limites de despesas." : "Verifique o aviso de armazenamento para continuar."));
      return;
    }
    const budget = state.budgets[selectedMonth];
    if (!budget || (!budget.totalCents && !Object.keys(budget.categories).length)) {
      container.replaceChildren(emptyBlock("target", "Dê um destino ao seu dinheiro", "Defina quanto quer gastar neste mês e acompanhe o caminho até lá."));
      return;
    }
    manage.textContent = "Ajustar orçamento";
    const spent = rules.summarize(items).expenseCents;
    container.replaceChildren();
    if (budget.totalCents) {
      const status = rules.budgetStatus(spent, budget.totalCents);
      const progress = element("div", "budget-progress");
      progress.append(element("span", "", "Do limite mensal"), element("strong", "", `${percent.format(status.percent)}% utilizado`));
      const message = status.status === "exceeded"
        ? (status.remainingCents === 0 ? "Você atingiu o limite definido para o mês." : `${formatMoney(-status.remainingCents)} acima do limite mensal.`)
        : `${formatMoney(status.remainingCents)} disponíveis no orçamento.${status.status === "warning" ? " Atenção: você utilizou pelo menos 80% do limite." : ""}`;
      container.append(element("p", "budget-value", formatMoney(spent)), element("p", "budget-limit", `de ${formatMoney(budget.totalCents)} planejados`), progress, bar(spent, budget.totalCents, status.status === "exceeded" ? "#a13939" : status.status === "warning" ? "#805100" : "#14644c"), element("p", `budget-status ${status.status}`, message));
    } else {
      container.append(element("p", "budget-limit", "Limites definidos por categoria. O limite total está livre."));
    }
    const categorySpent = new Map(rules.categoryTotals(items).map((item) => [item.categoryId, item.amountCents]));
    const list = element("ul", "category-limits");
    for (const [categoryId, limit] of Object.entries(budget.categories)) {
      const amount = categorySpent.get(categoryId) || 0;
      const status = rules.budgetStatus(amount, limit);
      const item = element("li");
      const line = element("div", "category-limit-line");
      line.append(element("strong", "", categories.get(categoryId).label), element("span", "category-limit-detail", `${formatMoney(amount)} / ${formatMoney(limit)}`));
      const label = status.status === "exceeded" ? "Limite atingido" : status.status === "warning" ? "Atenção ao limite" : "Dentro do limite";
      item.append(line, element("span", `budget-mini-status ${status.status}`, `${percent.format(status.percent)}% · ${label}`));
      list.append(item);
    }
    if (list.childElementCount) container.append(list);
  }

  function listFilters() {
    return { month: selectedMonth, search: $("search-filter").value, type: $("type-filter").value, categoryId: $("category-filter").value, startDate: $("start-filter").value, endDate: $("end-filter").value };
  }

  function filteredTransactions() {
    const start = $("start-filter");
    const end = $("end-filter");
    if (start.validity.badInput || end.validity.badInput) throw new Error("Complete as datas do filtro ou limpe os campos.");
    return rules.filterTransactions(state.transactions, listFilters());
  }

  function transactionRow(transaction) {
    const row = element("tr");
    const descriptionCell = element("td");
    const description = element("div", "transaction-description");
    const mark = element("span", `metric-icon ${transaction.type}`);
    mark.append(icon(transaction.type));
    const copy = element("div");
    copy.append(element("strong", "", transaction.description), element("span", "transaction-type", transaction.type === "income" ? "Receita" : "Despesa"));
    description.append(mark, copy);
    descriptionCell.append(description);
    const categoryCell = element("td");
    const badge = element("span", "category-badge");
    const category = categories.get(transaction.categoryId);
    badge.append(categoryDot(category), document.createTextNode(category.label));
    categoryCell.append(badge);
    const dateCell = element("td", "transaction-date");
    const time = element("time", "", formatDate(transaction.date));
    time.dateTime = transaction.date;
    dateCell.append(time);
    const valueCell = element("td", `transaction-value ${transaction.type}-value`, `${transaction.type === "income" ? "+" : "−"} ${formatMoney(transaction.amountCents)}`);
    const actionsCell = element("td");
    const actions = element("div", "row-actions");
    for (const [action, symbol, label] of [["edit", "edit", "Editar"], ["delete", "trash", "Excluir"]]) {
      const button = element("button", `icon-button ${action === "delete" ? "delete-button" : ""}`);
      button.type = "button";
      button.dataset.action = action;
      button.dataset.id = transaction.id;
      button.dataset.write = "";
      button.disabled = readOnly;
      button.setAttribute("aria-label", `${label}: ${transaction.description}`);
      button.title = `${label} lançamento`;
      button.append(icon(symbol));
      actions.append(button);
    }
    actionsCell.append(actions);
    row.append(descriptionCell, categoryCell, dateCell, valueCell, actionsCell);
    return row;
  }

  function renderTransactions() {
    let items = [];
    let filterError = "";
    try { items = filteredTransactions(); } catch (error) { filterError = error.message; }
    showError("filter-error", filterError);
    $("start-filter").setAttribute("aria-invalid", String(Boolean(filterError)));
    $("end-filter").setAttribute("aria-invalid", String(Boolean(filterError)));
    const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
    page = Math.min(Math.max(1, page), pageCount);
    const displayed = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    $("transaction-rows").replaceChildren(...displayed.map(transactionRow));
    $("transaction-table-wrap").hidden = !displayed.length;
    const empty = $("transactions-empty");
    empty.hidden = Boolean(displayed.length);
    if (!displayed.length) {
      const hasFilters = Object.entries(listFilters()).some(([key, value]) => key !== "month" && value);
      const title = !loaded ? "Seus dados estão preservados" : filterError ? "Vamos ajustar o período?" : hasFilters ? "Nenhum resultado por aqui" : state.transactions.length ? "Um novo período para organizar" : "Comece pelo primeiro lançamento";
      const description = !loaded ? "Não foi possível ler os registros. Veja o aviso no início da página e baixe o arquivo de recuperação em Seus dados." : filterError ? "Ajuste as datas para visualizar os lançamentos." : hasFilters ? "Tente outra descrição ou limpe os filtros da lista." : "Adicione uma receita ou despesa. O resto começa a fazer sentido a partir daí.";
      const content = emptyBlock("wallet", title, description, "empty-state");
      if (loaded && !filterError) {
        const button = element("button", "button button-secondary", hasFilters ? "Limpar filtros" : "Adicionar lançamento");
        button.type = "button";
        button.disabled = readOnly && !hasFilters;
        button.addEventListener("click", () => hasFilters ? resetFilters() : openTransaction());
        content.append(button);
      }
      empty.replaceChildren(content);
      // The outer container provides the panel spacing.
      content.classList.remove("empty-state");
    }
    $("transaction-count").textContent = !loaded ? "Dados indisponíveis" : filterError ? "Filtros inválidos" : `${items.length} lançamento${items.length === 1 ? "" : "s"} encontrado${items.length === 1 ? "" : "s"}`;
    $("page-label").textContent = `${page} de ${pageCount}`;
    $("previous-page").disabled = page <= 1;
    $("next-page").disabled = page >= pageCount;
    $("export-csv").disabled = !loaded || !items.length || Boolean(filterError);
  }

  function render() {
    renderMonthOptions();
    const items = periodTransactions();
    renderSummary(items);
    renderCategories(items);
    renderBudget(items);
    renderTransactions();
  }

  function resetFilters() {
    $("filter-form").reset();
    page = 1;
    renderTransactions();
  }

  function renderFormCategories(type, selected) {
    $("transaction-category").replaceChildren(...rules.categoriesForType(type).map((category) => option(category.id, category.label)));
    if (selected && categories.get(selected)?.type === type) $("transaction-category").value = selected;
  }

  function clearTransactionErrors() {
    for (const name of ["description", "amount", "date", "category"]) {
      showError(`error-${name}`, "");
      $(name === "category" ? "transaction-category" : `transaction-${name}`).removeAttribute("aria-invalid");
    }
    showError("transaction-form-error", "");
  }

  function openTransaction(transaction) {
    if (readOnly) return;
    editingId = transaction?.id || null;
    const form = $("transaction-form");
    form.reset();
    clearTransactionErrors();
    const type = transaction?.type || "expense";
    form.querySelector(`input[name="transaction-type"][value="${type}"]`).checked = true;
    $("transaction-dialog-title").textContent = editingId ? "Editar lançamento" : "Novo lançamento";
    $("transaction-description").value = transaction?.description || "";
    $("transaction-amount").value = transaction ? decimal.format(transaction.amountCents / 100) : "";
    $("transaction-date").value = transaction?.date || today();
    renderFormCategories(type, transaction?.categoryId);
    showDialog($("transaction-dialog"));
    $("transaction-description").focus();
  }

  function newId() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  }

  function submitTransaction(event) {
    event.preventDefault();
    clearTransactionErrors();
    let firstInvalid;
    function invalid(name, message) {
      const field = $(`transaction-${name}`);
      field.setAttribute("aria-invalid", "true");
      showError(`error-${name}`, message);
      firstInvalid ||= field;
    }
    const description = $("transaction-description").value.trim();
    if (!description || description.length > 120) invalid("description", "Informe uma descrição de até 120 caracteres.");
    let amountCents;
    try { amountCents = rules.parseAmount($("transaction-amount").value); } catch (error) { invalid("amount", error.message); }
    const date = $("transaction-date").value;
    if (!rules.isValidDate(date)) invalid("date", "Informe uma data válida.");
    const type = $("transaction-form").querySelector('input[name="transaction-type"]:checked').value;
    const categoryId = $("transaction-category").value;
    if (categories.get(categoryId)?.type !== type) invalid("category", "Escolha uma categoria para este lançamento.");
    if (firstInvalid) {
      showError("transaction-form-error", "Revise os campos indicados antes de salvar.");
      firstInvalid.focus();
      return;
    }
    const button = $("save-transaction");
    button.disabled = true;
    $("transaction-form").setAttribute("aria-busy", "true");
    try {
      const next = cloneState();
      const transaction = rules.validateTransaction({ id: editingId || newId(), type, description, amountCents, date, categoryId });
      const index = next.transactions.findIndex((item) => item.id === transaction.id);
      if (editingId && index < 0) throw new Error("O lançamento não foi encontrado. Recarregue a página.");
      if (index >= 0) next.transactions[index] = transaction;
      else next.transactions.push(transaction);
      commit(next);
      selectedMonth = date.slice(0, 7);
      $("filter-form").reset();
      page = 1;
      render();
      closeDialog($("transaction-dialog"));
      notify(editingId ? "Lançamento atualizado e salvo neste navegador." : "Lançamento adicionado e salvo neste navegador.");
    } catch (error) { showError("transaction-form-error", error.message); }
    finally { button.disabled = readOnly; $("transaction-form").removeAttribute("aria-busy"); }
  }

  function openConfirmation(title, message, actionLabel, action, dangerous = true) {
    confirmation = action;
    $("confirm-title").textContent = title;
    $("confirm-message").textContent = message;
    $("confirm-action").textContent = actionLabel;
    $("confirm-action").className = `button ${dangerous ? "button-danger" : "button-primary"}`;
    $("confirm-action").disabled = readOnly;
    showError("confirm-error", "");
    showDialog($("confirm-dialog"));
  }

  function deleteTransaction(transaction) {
    openConfirmation("Excluir lançamento?", `“${transaction.description}”, no valor de ${formatMoney(transaction.amountCents)}, será removido. Esta ação não pode ser desfeita.`, "Excluir lançamento", () => {
      const next = cloneState();
      next.transactions = next.transactions.filter((item) => item.id !== transaction.id);
      commit(next);
      render();
      notify("Lançamento excluído. Os totais foram atualizados.");
    });
  }

  function openBudget() {
    if (readOnly) return;
    if (!selectedMonth) {
      selectedMonth = today().slice(0, 7);
      page = 1;
      render();
    }
    const budget = state.budgets[selectedMonth] || { totalCents: 0, categories: {} };
    $("budget-total").value = budget.totalCents ? decimal.format(budget.totalCents / 100) : "";
    $("budget-total").removeAttribute("aria-invalid");
    $("budget-dialog-period").textContent = `Planejamento para ${monthLabel(selectedMonth)}. Os limites usam as despesas de todo o mês, independentemente dos filtros da lista.`;
    showError("budget-form-error", "");
    const fields = rules.categoriesForType("expense").map((category) => {
      const field = element("div", "field");
      const label = element("label", "", `${category.label} (R$)`);
      label.htmlFor = `budget-${category.id}`;
      const input = element("input");
      input.id = label.htmlFor;
      input.type = "text";
      input.inputMode = "decimal";
      input.placeholder = "Sem limite";
      input.dataset.categoryId = category.id;
      input.setAttribute("aria-describedby", "budget-help budget-form-error");
      input.value = budget.categories[category.id] ? decimal.format(budget.categories[category.id] / 100) : "";
      field.append(label, input);
      return field;
    });
    $("category-budget-fields").replaceChildren(...fields);
    $("budget-dialog").querySelector("details").open = Boolean(Object.keys(budget.categories).length);
    showDialog($("budget-dialog"));
    $("budget-total").focus();
  }

  function submitBudget(event) {
    event.preventDefault();
    showError("budget-form-error", "");
    const button = $("save-budget");
    const next = cloneState();
    const budget = { totalCents: 0, categories: {} };
    let firstInvalid;
    const errors = [];
    for (const input of [$("budget-total"), ...$("category-budget-fields").querySelectorAll("input")]) {
      input.removeAttribute("aria-invalid");
      if (!input.value.trim()) continue;
      try {
        const value = rules.parseAmount(input.value);
        if (input.dataset.categoryId) budget.categories[input.dataset.categoryId] = value;
        else budget.totalCents = value;
      } catch (error) {
        input.setAttribute("aria-invalid", "true");
        firstInvalid ||= input;
        errors.push(`${input.dataset.categoryId ? categories.get(input.dataset.categoryId).label : "Limite total"}: ${error.message}`);
      }
    }
    if (errors.length) {
      if (firstInvalid.closest("details")) firstInvalid.closest("details").open = true;
      showError("budget-form-error", errors.join(" "));
      firstInvalid.focus();
      return;
    }
    button.disabled = true;
    $("budget-form").setAttribute("aria-busy", "true");
    try {
      if (budget.totalCents || Object.keys(budget.categories).length) next.budgets[selectedMonth] = budget;
      else delete next.budgets[selectedMonth];
      commit(next);
      render();
      closeDialog($("budget-dialog"));
      notify("Orçamento atualizado e salvo neste navegador.");
    } catch (error) { showError("budget-form-error", error.message); }
    finally { button.disabled = readOnly; $("budget-form").removeAttribute("aria-busy"); }
  }

  function download(content, filename, mime) {
    const url = URL.createObjectURL(new Blob([content], { type: mime }));
    const link = element("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  function exportBackup() {
    try {
      if (!loaded) {
        const raw = repository.exportRaw();
        if (raw === null) throw new Error("Não há dados salvos disponíveis para recuperação.");
        download(raw, `expense-tracker-recuperacao-${today()}.json`, "application/json;charset=utf-8");
        notify("Arquivo de recuperação preparado com o conteúdo original do armazenamento.");
        return;
      }
      download(storage.serializeBackup(state), `expense-tracker-backup-${today()}.json`, "application/json;charset=utf-8");
      notify("Backup preparado. Confira o arquivo na pasta de downloads.");
    } catch (error) { notify(error.message, true); }
  }

  async function importBackup(event) {
    const file = event.target.files[0];
    event.target.value = "";
    if (!file || readOnly) return;
    const button = $("import-backup");
    button.disabled = true;
    button.textContent = "Lendo backup…";
    button.setAttribute("aria-busy", "true");
    try {
      if (file.size > storage.MAX_BACKUP_BYTES) throw new Error("O backup deve ter no máximo 20 MiB.");
      const restored = storage.parseBackup(await file.text());
      if (readOnly) throw new Error("Os dados foram alterados em outra aba. Recarregue antes de restaurar.");
      openConfirmation("Restaurar este backup?", `O arquivo contém ${restored.transactions.length} lançamento(s) e ${Object.keys(restored.budgets).length} orçamento(s) mensal(is). A restauração substituirá todos os dados atuais deste navegador. Baixe um backup dos dados atuais antes de continuar.`, "Substituir e restaurar", () => {
        commit(restored);
        selectedMonth = restored.transactions.length ? [...restored.transactions].sort((a, b) => b.date.localeCompare(a.date))[0].date.slice(0, 7) : today().slice(0, 7);
        $("filter-form").reset();
        page = 1;
        render();
        notify("Backup restaurado. Seus dados já estão salvos neste navegador.");
      });
    } catch (error) { notify(error.message, true); }
    finally { button.disabled = readOnly; button.textContent = "Restaurar backup"; button.removeAttribute("aria-busy"); }
  }

  function bindEvents() {
    document.querySelectorAll("[data-new-transaction]").forEach((button) => button.addEventListener("click", () => openTransaction()));
    document.querySelectorAll("[data-close-dialog]").forEach((button) => button.addEventListener("click", () => closeDialog(button.closest("dialog"))));
    document.querySelectorAll("dialog").forEach((dialog) => {
      dialog.addEventListener("close", () => {
        if (dialog.id === "confirm-dialog") confirmation = null;
        const origin = dialogOrigins.get(dialog);
        if (origin?.isConnected) origin.focus({ preventScroll: true });
        else { $("transactions-title").tabIndex = -1; $("transactions-title").focus({ preventScroll: true }); }
      });
    });
    $("transaction-form").addEventListener("submit", submitTransaction);
    $("transaction-form").querySelectorAll('input[name="transaction-type"]').forEach((radio) => radio.addEventListener("change", () => renderFormCategories(radio.value)));
    $("month-filter").addEventListener("change", (event) => { selectedMonth = event.target.value; page = 1; render(); });
    $("filter-form").addEventListener("submit", (event) => event.preventDefault());
    $("filter-form").addEventListener("input", () => { page = 1; renderTransactions(); });
    $("filter-form").addEventListener("change", () => { page = 1; renderTransactions(); });
    $("filter-form").addEventListener("reset", () => { page = 1; setTimeout(renderTransactions, 0); });
    $("previous-page").addEventListener("click", () => { page--; renderTransactions(); });
    $("next-page").addEventListener("click", () => { page++; renderTransactions(); });
    $("transaction-rows").addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button || readOnly) return;
      const transaction = state.transactions.find((item) => item.id === button.dataset.id);
      if (!transaction) return;
      if (button.dataset.action === "edit") openTransaction(transaction);
      else deleteTransaction(transaction);
    });
    $("confirm-action").addEventListener("click", () => {
      if (!confirmation || readOnly) return;
      $("confirm-action").disabled = true;
      try { confirmation(); closeDialog($("confirm-dialog")); }
      catch (error) { showError("confirm-error", error.message); }
      finally { $("confirm-action").disabled = readOnly; }
    });
    $("manage-budgets").addEventListener("click", openBudget);
    $("budget-form").addEventListener("submit", submitBudget);
    $("export-backup").addEventListener("click", exportBackup);
    $("import-backup").addEventListener("click", () => $("backup-file").click());
    $("backup-file").addEventListener("change", importBackup);
    $("export-csv").addEventListener("click", () => {
      try { download(storage.toCsv(filteredTransactions()), `expense-tracker-${selectedMonth || "todos-periodos"}-${today()}.csv`, "text/csv;charset=utf-8"); notify("CSV preparado com todos os lançamentos dos filtros atuais."); }
      catch (error) { notify(error.message, true); }
    });
    $("reload-app").addEventListener("click", () => globalThis.location.reload());
    globalThis.addEventListener("storage", (event) => {
      if (event.key === storage.STORAGE_KEY || event.key === null) {
        setReadOnly("Os dados foram alterados em outra aba. Recarregue para ver a versão mais recente e continuar salvando. Os valores exibidos abaixo são da versão anterior.");
        render();
      }
    });
    document.querySelectorAll(".nav-link").forEach((link) => link.addEventListener("click", () => {
      document.querySelectorAll(".nav-link").forEach((item) => { item.classList.remove("active"); item.removeAttribute("aria-current"); });
      link.classList.add("active"); link.setAttribute("aria-current", "location");
    }));
  }

  $("category-filter").append(...rules.CATEGORY_DEFINITIONS.map((category) => option(category.id, category.label)));
  bindEvents();
  try { state = repository.load(); loaded = true; }
  catch (error) {
    setReadOnly(error.message);
    $("export-backup").textContent = "Baixar recuperação";
  }
  render();
})();
