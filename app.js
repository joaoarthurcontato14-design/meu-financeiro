/* =========================================================
   JOÃO ARTHUR — FINANÇAS
   Versão 100% estática / GitHub Pages / sem API externa.

   IMPORTANTE:
   - Os dados ficam somente no navegador (localStorage).
   - A senha abaixo é apenas uma barreira visual.
   - Como este site é estático, a senha NÃO é segurança real.
   ========================================================= */

const PASSWORD = "10102008";
const STORAGE_KEY = "joaoArthurFinancas_v1";

let debts = loadDebts();
let selectedDebtId = null;

/* ---------- UTILITÁRIOS ---------- */

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function money(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(Number(value) || 0);
}

function parseMoney(text) {
  if (!text) return 0;

  let cleaned = String(text)
    .replace(/\s/g, "")
    .replace(/R\$/gi, "")
    .replace(/[^\d,.-]/g, "");

  if (!cleaned) return 0;

  // 1.234,56 -> 1234.56
  if (cleaned.includes(",") && cleaned.includes(".")) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (cleaned.includes(",")) {
    cleaned = cleaned.replace(",", ".");
  }

  const result = Number(cleaned);
  return Number.isFinite(result) ? result : 0;
}

function formatInputMoney(value) {
  const n = parseMoney(value);
  return n ? money(n) : "";
}

function nowBrasilia() {
  return new Date().toISOString();
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(iso));
}

function formatDateShort(iso) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(iso));
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function saveDebts() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(debts));
}

function loadDebts() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function getPaid(debt) {
  return (debt.payments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);
}

function getRemaining(debt) {
  return Math.max(0, Number(debt.amount) - getPaid(debt));
}

function isPaid(debt) {
  return getRemaining(debt) <= 0.009;
}

function getOpenDebts() {
  return debts.filter(d => !isPaid(d));
}

function getHistoryDebts() {
  return debts.filter(d => isPaid(d)).sort((a, b) => {
    const aDate = a.completedAt || a.updatedAt || a.createdAt;
    const bDate = b.completedAt || b.updatedAt || b.createdAt;
    return new Date(bDate) - new Date(aDate);
  });
}

/* ---------- INTERPRETAÇÃO DA FRASE ---------- */

/*
  Esta é uma "mini inteligência" local, feita para funcionar
  sem servidor e sem API.

  Ela entende vários formatos comuns, por exemplo:
  "Estou devendo R$ 100 para minha mãe..."
  "Minha mãe me deve 80 reais."
  "Devo 50 para João."
  "João deve R$ 30 para mim."
*/

function normalizeText(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractAmount(text) {
  const patterns = [
    /r\$\s*([\d.]+(?:,\d{1,2})?)/i,
    /([\d.]+(?:,\d{1,2})?)\s*(?:reais|real)\b/i,
    /\b([\d]+(?:[.,]\d{1,2})?)\b/
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const value = parseMoney(match[1]);
      if (value > 0) return value;
    }
  }

  return 0;
}

function cleanPersonName(raw) {
  if (!raw) return "";

  let name = raw
    .replace(/[.,!?;:]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const stopWords = [
    "pois", "porque", "que", "quando", "para", "por", "no", "na",
    "e", "mas", "amanha", "hoje", "ontem", "com", "de", "do", "da",
    "eu", "vou", "peguei", "usei", "gastei", "fui", "irei"
  ];

  const words = name.split(" ");
  while (words.length && stopWords.includes(normalizeText(words[words.length - 1]))) {
    words.pop();
  }

  return words.join(" ").trim();
}

function extractAfterPattern(text, regex) {
  const match = text.match(regex);
  if (!match) return "";
  return cleanPersonName(match[1]);
}

function parseDebt(text) {
  const original = text.trim();
  const normalized = normalizeText(original);
  const amount = extractAmount(original);

  let payer = "Eu";
  let payee = "";
  let direction = "eu-devo"; // eu-devo | me-devem

  // "estou devendo 100 para minha mãe"
  let person = extractAfterPattern(
    normalized,
    /(?:estou\s+)?devendo\s+(?:r\$\s*)?[\d.,]+\s*(?:reais|real)?\s+(?:para|a)\s+(.+)$/i
  );

  if (person) {
    payer = "Eu";
    payee = person;
    direction = "eu-devo";
  }

  // "devo 100 para João"
  if (!payee) {
    person = extractAfterPattern(
      normalized,
      /\bdevo\s+(?:r\$\s*)?[\d.,]+\s*(?:reais|real)?\s+(?:para|a)\s+(.+)$/i
    );
    if (person) {
      payer = "Eu";
      payee = person;
      direction = "eu-devo";
    }
  }

  // "João me deve 100"
  if (!payee) {
    const match = normalized.match(/^(.+?)\s+me\s+deve\s+(?:r\$\s*)?[\d.,]+/i);
    if (match) {
      payer = cleanPersonName(match[1]);
      payee = "Eu";
      direction = "me-devem";
    }
  }

  // "minha mãe me deve 100"
  if (!payee) {
    const match = normalized.match(/(.+?)\s+me\s+deve\s+(?:r\$\s*)?[\d.,]+/i);
    if (match) {
      payer = cleanPersonName(match[1]);
      payee = "Eu";
      direction = "me-devem";
    }
  }

  // "100 reais para João" / "paguei 100 para João"
  if (!payee) {
    const match = normalized.match(
      /(?:r\$\s*)?[\d.,]+\s*(?:reais|real)?\s+(?:para|a)\s+(.+?)(?:\s+(?:pois|porque|para|no|na|amanha|hoje)\b|$)/i
    );
    if (match) {
      payer = "Eu";
      payee = cleanPersonName(match[1]);
      direction = "eu-devo";
    }
  }

  // "João pagou com meu dinheiro" / "João usou meu dinheiro"
  if (!payee && /(usou|pegou|gastou).*(meu|minha)\s+dinheiro/i.test(normalized)) {
    const match = normalized.match(/^(.+?)\s+(?:usou|pegou|gastou)/i);
    if (match) {
      payer = cleanPersonName(match[1]);
      payee = "Eu";
      direction = "me-devem";
    }
  }

  // Se não conseguiu identificar, tenta achar "para X"
  if (!payee) {
    const generic = normalized.match(/\bpara\s+([a-zà-ÿ][a-zà-ÿ\s]{1,40})/i);
    if (generic) {
      payer = "Eu";
      payee = cleanPersonName(generic[1]);
      direction = "eu-devo";
    }
  }

  // Tratamento de pronomes comuns
  if (payee === "minha mae") payee = "Minha mãe";
  if (payee === "meu pai") payee = "Meu pai";
  if (payee === "meu irmao") payee = "Meu irmão";
  if (payee === "minha irma") payee = "Minha irmã";
  if (payer === "minha mae") payer = "Minha mãe";
  if (payer === "meu pai") payer = "Meu pai";
  if (payer === "meu irmao") payer = "Meu irmão";
  if (payer === "minha irma") payer = "Minha irmã";

  if (!payee) {
    payee = direction === "eu-devo" ? "A definir" : "Eu";
  }

  if (!payer) {
    payer = direction === "eu-devo" ? "Eu" : "A definir";
  }

  return {
    amount,
    payer,
    payee,
    direction,
    description: original
  };
}

function updateParserPreview() {
  const text = document.getElementById("debt-input").value.trim();
  const preview = document.getElementById("parser-preview");

  if (!text) {
    preview.textContent = "O sistema vai interpretar o valor, quem paga e quem recebe.";
    return;
  }

  const result = parseDebt(text);

  if (!result.amount) {
    preview.textContent = "Não consegui encontrar um valor. Tente escrever, por exemplo: R$ 100.";
    return;
  }

  preview.textContent =
    `${money(result.amount)} · ${result.payer} paga · ${result.payee} recebe`;
}

/* ---------- RENDER ---------- */

function updateSummary() {
  const open = getOpenDebts();

  const youOwe = open
    .filter(d => d.payer.toLowerCase() === "eu")
    .reduce((sum, d) => sum + getRemaining(d), 0);

  const owedToYou = open
    .filter(d => d.payee.toLowerCase() === "eu")
    .reduce((sum, d) => sum + getRemaining(d), 0);

  document.getElementById("summary-you-owe").textContent = money(youOwe);
  document.getElementById("summary-owed-to-you").textContent = money(owedToYou);
  document.getElementById("summary-open-count").textContent = open.length;
}

function renderDebts() {
  const body = document.getElementById("debt-table-body");
  const empty = document.getElementById("empty-state");
  const wrap = document.getElementById("debt-table-wrap");
  const search = normalizeText(document.getElementById("search-input").value);

  let list = getOpenDebts();

  if (search) {
    list = list.filter(d =>
      normalizeText(`${d.payer} ${d.payee} ${d.description}`).includes(search)
    );
  }

  body.innerHTML = "";

  if (!list.length) {
    wrap.classList.add("hidden");
    empty.classList.remove("hidden");
    if (search && getOpenDebts().length) {
      empty.querySelector("h3").textContent = "Nada encontrado";
      empty.querySelector("p").textContent = "Tente outro termo de pesquisa.";
    } else {
      empty.querySelector("h3").textContent = "Nenhuma dívida em aberto";
      empty.querySelector("p").textContent = "Quando você registrar uma, ela aparecerá aqui.";
    }
  } else {
    empty.classList.add("hidden");
    wrap.classList.remove("hidden");

    list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    for (const debt of list) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${money(getRemaining(debt))}</td>
        <td>${escapeHTML(debt.payer)}</td>
        <td>${escapeHTML(debt.payee)}</td>
        <td>${formatDate(debt.createdAt)}</td>
        <td>
          <button class="info-button" type="button" data-debt-id="${debt.id}" aria-label="Ver detalhes">i</button>
        </td>
      `;
      body.appendChild(tr);
    }

    body.querySelectorAll("[data-debt-id]").forEach(button => {
      button.addEventListener("click", () => openDetail(button.dataset.debtId));
    });
  }

  updateSummary();
}

function renderHistory() {
  const body = document.getElementById("history-table-body");
  const empty = document.getElementById("history-empty");
  const wrap = document.getElementById("history-table-wrap");

  const list = getHistoryDebts();
  body.innerHTML = "";

  if (!list.length) {
    wrap.classList.add("hidden");
    empty.classList.remove("hidden");
    return;
  }

  empty.classList.add("hidden");
  wrap.classList.remove("hidden");

  for (const debt of list) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${money(debt.amount)}</td>
      <td>${escapeHTML(debt.payer)}</td>
      <td>${escapeHTML(debt.payee)}</td>
      <td>${formatDate(debt.completedAt || debt.updatedAt)}</td>
      <td>
        <button class="info-button" type="button" data-history-id="${debt.id}" aria-label="Ver detalhes">i</button>
      </td>
    `;
    body.appendChild(tr);
  }

  body.querySelectorAll("[data-history-id]").forEach(button => {
    button.addEventListener("click", () => openDetail(button.dataset.historyId));
  });
}

function renderPayments(debt) {
  const list = document.getElementById("payment-list");
  list.innerHTML = "";

  if (!debt.payments?.length) {
    list.innerHTML = `<div class="payment-item"><div class="payment-item-main"><span>Nenhum pagamento registrado.</span></div></div>`;
    return;
  }

  const methodNames = {
    pix: "Pix",
    dinheiro: "Dinheiro físico",
    uso: "Compra/uso do dinheiro da outra pessoa"
  };

  for (const payment of debt.payments) {
    const item = document.createElement("div");
    item.className = "payment-item";
    item.innerHTML = `
      <div class="payment-item-main">
        <strong>${escapeHTML(methodNames[payment.method] || payment.method)}</strong>
        <span>${formatDate(payment.date)}${payment.note ? ` · ${escapeHTML(payment.note)}` : ""}</span>
      </div>
      <div class="payment-item-amount">${money(payment.amount)}</div>
    `;
    list.appendChild(item);
  }
}

function openDetail(id) {
  const debt = debts.find(d => d.id === id);
  if (!debt) return;

  selectedDebtId = id;

  document.getElementById("detail-title").textContent = `${debt.payer} → ${debt.payee}`;
  document.getElementById("detail-amount").textContent = money(debt.amount);
  document.getElementById("detail-payer").textContent = debt.payer;
  document.getElementById("detail-payee").textContent = debt.payee;
  document.getElementById("detail-date").textContent = formatDate(debt.createdAt);
  document.getElementById("detail-remaining").textContent = money(getRemaining(debt));
  document.getElementById("detail-description").textContent = debt.description;

  renderPayments(debt);

  const paid = isPaid(debt);
  document.getElementById("payment-form").classList.toggle("hidden", paid);
  document.getElementById("payments-area").classList.toggle("hidden", false);
  document.getElementById("paid-message").classList.toggle("hidden", !paid);

  document.getElementById("detail-modal").classList.remove("hidden");
  document.getElementById("detail-modal").setAttribute("aria-hidden", "false");
}

function closeDetail() {
  document.getElementById("detail-modal").classList.add("hidden");
  document.getElementById("detail-modal").setAttribute("aria-hidden", "true");
  selectedDebtId = null;
}

/* ---------- HISTÓRICO ---------- */

function openHistory() {
  renderHistory();
  document.getElementById("history-modal").classList.remove("hidden");
  document.getElementById("history-modal").setAttribute("aria-hidden", "false");
}

function closeHistory() {
  document.getElementById("history-modal").classList.add("hidden");
  document.getElementById("history-modal").setAttribute("aria-hidden", "true");
}

/* ---------- LOGIN ---------- */

function startLoading() {
  const bar = document.getElementById("loader-bar");
  let progress = 0;

  const timer = setInterval(() => {
    progress += Math.random() * 15 + 5;

    if (progress >= 100) {
      progress = 100;
      clearInterval(timer);

      setTimeout(() => {
        document.getElementById("loading-screen").classList.add("hidden");
        document.getElementById("password-screen").classList.remove("hidden");
        document.getElementById("password-input").focus();
      }, 350);
    }

    bar.style.width = `${progress}%`;
  }, 110);
}

function login(event) {
  event.preventDefault();

  const value = document.getElementById("password-input").value;
  const error = document.getElementById("password-error");

  if (value === PASSWORD) {
    error.classList.add("hidden");
    document.getElementById("password-screen").classList.add("hidden");
    document.getElementById("app").classList.remove("hidden");
    document.getElementById("password-input").value = "";
    renderDebts();
    updateClock();
    return;
  }

  error.classList.remove("hidden");
  document.getElementById("password-input").value = "";
  document.getElementById("password-input").focus();
}

function logout() {
  document.getElementById("app").classList.add("hidden");
  document.getElementById("password-screen").classList.remove("hidden");
  document.getElementById("password-input").focus();
}

/* ---------- TOAST ---------- */

let toastTimer;

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.remove("hidden");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add("hidden"), 2600);
}

/* ---------- NOVA DÍVIDA ---------- */

function addDebt(event) {
  event.preventDefault();

  const input = document.getElementById("debt-input");
  const text = input.value.trim();

  if (!text) return;

  const parsed = parseDebt(text);

  if (!parsed.amount || parsed.amount <= 0) {
    showToast("Não encontrei um valor nessa frase.");
    return;
  }

  const debt = {
    id: uid(),
    amount: parsed.amount,
    payer: parsed.payer,
    payee: parsed.payee,
    direction: parsed.direction,
    description: parsed.description,
    createdAt: nowBrasilia(),
    updatedAt: nowBrasilia(),
    completedAt: null,
    payments: []
  };

  debts.push(debt);
  saveDebts();

  input.value = "";
  updateParserPreview();
  renderDebts();
  showToast("Registro adicionado.");
}

/* ---------- PAGAMENTO ---------- */

function addPayment(event) {
  event.preventDefault();

  const debt = debts.find(d => d.id === selectedDebtId);
  if (!debt) return;

  const amountInput = document.getElementById("payment-amount");
  const method = document.getElementById("payment-method").value;
  const note = document.getElementById("payment-note").value.trim();

  const amount = parseMoney(amountInput.value);
  const remaining = getRemaining(debt);

  if (!amount || amount <= 0) {
    showToast("Digite um valor de pagamento.");
    return;
  }

  if (amount > remaining + 0.009) {
    showToast(`O pagamento não pode passar de ${money(remaining)}.`);
    return;
  }

  debt.payments = debt.payments || [];
  debt.payments.push({
    id: uid(),
    amount,
    method,
    note,
    date: nowBrasilia()
  });

  debt.updatedAt = nowBrasilia();

  if (getRemaining(debt) <= 0.009) {
    debt.completedAt = nowBrasilia();
  }

  saveDebts();
  renderDebts();
  renderHistory();
  openDetail(debt.id);

  amountInput.value = "";
  document.getElementById("payment-note").value = "";

  showToast(isPaid(debt) ? "Dívida quitada e enviada ao histórico." : "Pagamento registrado.");
}

/* ---------- EXCLUIR ---------- */

function deleteSelectedDebt() {
  if (!selectedDebtId) return;

  const debt = debts.find(d => d.id === selectedDebtId);
  if (!debt) return;

  const confirmed = window.confirm(
    "Excluir este registro? Essa ação não pode ser desfeita."
  );

  if (!confirmed) return;

  debts = debts.filter(d => d.id !== selectedDebtId);
  saveDebts();

  closeDetail();
  renderDebts();
  renderHistory();
  showToast("Registro excluído.");
}

/* ---------- BACKUP ---------- */

function exportBackup() {
  const payload = {
    app: "João Arthur — finanças",
    version: 1,
    exportedAt: nowBrasilia(),
    debts
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `joao-arthur-financas-backup-${new Date().toISOString().slice(0,10)}.json`;
  link.click();
  URL.revokeObjectURL(url);

  showToast("Backup exportado.");
}

function importBackup(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = () => {
    try {
      const payload = JSON.parse(reader.result);

      if (!Array.isArray(payload.debts)) {
        throw new Error("Formato inválido");
      }

      const confirmed = window.confirm(
        "Importar este backup substituirá os registros atuais neste navegador. Continuar?"
      );

      if (!confirmed) return;

      debts = payload.debts;
      saveDebts();
      renderDebts();
      renderHistory();
      showToast("Backup importado.");
    } catch {
      showToast("Não foi possível importar esse arquivo.");
    } finally {
      event.target.value = "";
    }
  };

  reader.readAsText(file);
}

/* ---------- RELÓGIO BRASÍLIA ---------- */

function updateClock() {
  const now = new Date();

  document.getElementById("clock").textContent =
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }).format(now);
}

/* ---------- EVENTOS ---------- */

document.addEventListener("DOMContentLoaded", () => {
  startLoading();

  document.getElementById("password-form").addEventListener("submit", login);

  document.getElementById("debt-form").addEventListener("submit", addDebt);
  document.getElementById("debt-input").addEventListener("input", updateParserPreview);

  document.getElementById("search-input").addEventListener("input", renderDebts);

  document.getElementById("history-button").addEventListener("click", openHistory);
  document.getElementById("logout-button").addEventListener("click", logout);

  document.getElementById("payment-form").addEventListener("submit", addPayment);
  document.getElementById("delete-debt-button").addEventListener("click", deleteSelectedDebt);

  document.getElementById("export-button").addEventListener("click", exportBackup);
  document.getElementById("import-input").addEventListener("change", importBackup);

  document.querySelectorAll("[data-close-modal]").forEach(el => {
    el.addEventListener("click", closeDetail);
  });

  document.querySelectorAll("[data-close-history]").forEach(el => {
    el.addEventListener("click", closeHistory);
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      closeDetail();
      closeHistory();
    }
  });

  setInterval(updateClock, 1000);
});
