(function (root) {
  "use strict";

  const STORAGE_KEY = "expense-tracker:v1";
  const MAX_BACKUP_BYTES = 20 * 1024 * 1024;

  function domain() {
    if (!root.ExpenseTracker || !root.ExpenseTracker.domain) {
      throw new Error("As regras da aplicação não foram carregadas. Recarregue a página.");
    }
    return root.ExpenseTracker.domain;
  }

  function getAvailableStorage(getStorage) {
    try {
      const storage = getStorage();
      if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function") {
        throw new Error("Armazenamento indisponível.");
      }
      return storage;
    } catch (cause) {
      throw new Error("Não foi possível acessar o armazenamento do navegador. Verifique as permissões e recarregue a página.", { cause });
    }
  }

  function readRaw(storage) {
    try {
      return storage.getItem(STORAGE_KEY);
    } catch (cause) {
      throw new Error("Não foi possível ler os dados do navegador. Nenhum dado foi alterado.", { cause });
    }
  }

  function createRepository(getStorage = function () { return root.localStorage; }) {
    let loaded = false;
    let loadFailed = false;
    let snapshot;

    function load() {
      try {
        const raw = readRaw(getAvailableStorage(getStorage));
        let state;
        if (raw === null) {
          state = domain().emptyState();
        } else {
          let parsed;
          try {
            parsed = JSON.parse(raw);
          } catch (cause) {
            throw new Error("Os dados salvos não são um JSON válido. Exporte o arquivo de recuperação antes de corrigir o armazenamento.", { cause });
          }
          try {
            state = domain().validateState(parsed);
          } catch (cause) {
            throw new Error("Os dados salvos são inválidos ou pertencem a outra versão. Exporte o arquivo de recuperação; os dados originais foram preservados.", { cause });
          }
        }
        snapshot = raw;
        loaded = true;
        return state;
      } catch (error) {
        loadFailed = true;
        loaded = false;
        throw error;
      }
    }

    function save(state) {
      if (!loaded || loadFailed) {
        throw new Error("Não é seguro salvar antes de carregar os dados corretamente. Recarregue a página e tente novamente.");
      }
      const validated = domain().validateState(state);
      // Every state accepted for persistence must also produce an importable backup.
      serializeBackup(validated);
      const raw = JSON.stringify(validated);
      const storage = getAvailableStorage(getStorage);
      if (readRaw(storage) !== snapshot) {
        throw new Error("Os dados foram alterados em outra aba. Recarregue a página antes de salvar para preservar as alterações.");
      }
      try {
        storage.setItem(STORAGE_KEY, raw);
      } catch (cause) {
        throw new Error("Não foi possível salvar. O armazenamento pode estar cheio ou bloqueado. Seus dados anteriores foram preservados; exporte um backup e tente novamente.", { cause });
      }
      snapshot = raw;
      return validated;
    }

    function exportRaw() {
      return readRaw(getAvailableStorage(getStorage));
    }

    return Object.freeze({ load, save, exportRaw });
  }

  function serializeBackup(state) {
    const serialized = JSON.stringify({
      app: "expense-tracker",
      version: 1,
      exportedAt: new Date().toISOString(),
      data: domain().validateState(state)
    }, null, 2);
    assertBackupSize(serialized);
    return serialized;
  }

  function utf8ByteLength(text) {
    let bytes = 0;
    for (const character of text) {
      const codePoint = character.codePointAt(0);
      bytes += codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4;
      if (bytes > MAX_BACKUP_BYTES) return bytes;
    }
    return bytes;
  }

  function assertBackupSize(text) {
    if (text.length > MAX_BACKUP_BYTES || utf8ByteLength(text) > MAX_BACKUP_BYTES) {
      throw new Error("O backup ultrapassa o limite de 20 MiB.");
    }
  }

  function parseBackup(text) {
    if (typeof text !== "string") {
      throw new Error("O backup precisa ser um arquivo JSON de texto.");
    }
    assertBackupSize(text);
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (cause) {
      throw new Error("O arquivo não contém um backup JSON válido.", { cause });
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) ||
        parsed.app !== "expense-tracker" || parsed.version !== 1 ||
        typeof parsed.exportedAt !== "string" || !Number.isFinite(Date.parse(parsed.exportedAt)) ||
        !Object.prototype.hasOwnProperty.call(parsed, "data")) {
      throw new Error("Este arquivo não é um backup compatível do Expense Tracker.");
    }
    try {
      return domain().validateState(parsed.data);
    } catch (cause) {
      throw new Error("O backup contém dados inválidos. Os dados atuais não foram alterados.", { cause });
    }
  }

  function csvCell(value) {
    let text = String(value);
    // A planilha deve tratar texto informado pelo usuário como texto, nunca como fórmula.
    if (/^[\s]*[=+\-@]/u.test(text) || /^[\t\r\n]/u.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  }

  function toCsv(transactions) {
    const rules = domain();
    const validated = rules.validateState({ version: 1, transactions, budgets: {} });
    const categoryLabels = new Map(rules.CATEGORY_DEFINITIONS.map(function (category) {
      return [category.id, category.label];
    }));
    const rows = [["Data", "Tipo", "Descrição", "Categoria", "Valor (R$)"]];
    for (const transaction of validated.transactions) {
      const cents = transaction.amountCents;
      rows.push([
        transaction.date,
        transaction.type === "income" ? "Receita" : "Despesa",
        transaction.description,
        categoryLabels.get(transaction.categoryId),
        Math.floor(cents / 100) + "," + String(cents % 100).padStart(2, "0")
      ]);
    }
    return "\uFEFF" + rows.map(function (row) { return row.map(csvCell).join(";"); }).join("\r\n") + "\r\n";
  }

  root.ExpenseTracker = root.ExpenseTracker || {};
  root.ExpenseTracker.storage = Object.freeze({
    STORAGE_KEY,
    MAX_BACKUP_BYTES,
    createRepository,
    serializeBackup,
    parseBackup,
    toCsv
  });
})(globalThis);
