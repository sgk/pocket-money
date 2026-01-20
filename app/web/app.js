const state = {
  assets: [],
  categories: [],
  transactions: [],
  settings: {
    baseUrl: "",
    token: "",
  },
};

const fmt = new Intl.NumberFormat("ja-JP");

const qs = (id) => document.getElementById(id);

const statusEl = qs("status");
const signInHintEl = qs("signinHint");
const googleSignInEl = qs("googleSignIn");
const authScreenEl = qs("authScreen");
const appShellEl = qs("appShell");
const userEmailEl = qs("userEmail");
const userAvatarEl = qs("userAvatar");
const userAvatarFallbackEl = qs("userAvatarFallback");
const userTriggerEl = qs("userTrigger");
const userDropdownEl = qs("userDropdown");
const settingsNavEl = qs("settingsNav");
const settingsBackEl = qs("settingsBack");
const mainContentEl = qs("mainContent");
const settingsScreenEl = qs("settingsScreen");

const assetsList = qs("assetsList");
const categoriesList = qs("categoriesList");
const transactionsList = qs("transactionsList");
const summaryGrid = qs("summaryGrid");

const assetSelects = [qs("expenseAsset"), qs("incomeAsset"), qs("transferFrom"), qs("transferTo")];
const categorySelects = [qs("expenseCategory"), qs("incomeCategory")];

function setStatus(message, tone = "default") {
  statusEl.textContent = message;
  statusEl.dataset.tone = tone;
}

function setAuthRequired(required) {
  authScreenEl.classList.toggle("visible", required);
  appShellEl.classList.toggle("hidden", required);
}

function isAuthError(message) {
  if (!message) {
    return false;
  }
  return (
    message.includes("Authorization header required") ||
    message.includes("Invalid ID token") ||
    message.includes("Token missing sub")
  );
}

function decodeJwt(token) {
  try {
    const payload = token.split(".")[1];
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((char) => `%${`00${char.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join("")
    );
    return JSON.parse(json);
  } catch (err) {
    return null;
  }
}

function updateUserProfile() {
  const token = state.settings.token;
  const payload = token ? decodeJwt(token) : null;
  const email = payload?.email || "local-user";
  const picture = payload?.picture || "";
  userEmailEl.textContent = email;
  if (picture) {
    userAvatarEl.style.backgroundImage = `url(${picture})`;
    userAvatarEl.style.display = "block";
    userAvatarFallbackEl.style.display = "none";
  } else {
    userAvatarEl.style.backgroundImage = "";
    userAvatarEl.style.display = "none";
    userAvatarFallbackEl.textContent = email[0]?.toUpperCase() || "U";
    userAvatarFallbackEl.style.display = "grid";
  }
}

function setView(view) {
  const isSettings = view === "settings";
  settingsScreenEl.classList.toggle("hidden", !isSettings);
  mainContentEl.classList.toggle("hidden", isSettings);
}

function loadSettings() {
  const saved = localStorage.getItem("pm.settings");
  if (saved) {
    try {
      state.settings = { ...state.settings, ...JSON.parse(saved) };
    } catch (err) {
      console.warn("settings parse failed", err);
    }
  }
  if (!state.settings.baseUrl) {
    state.settings.baseUrl = window.location.origin;
  }
}

function saveSettings() {
  localStorage.setItem("pm.settings", JSON.stringify(state.settings));
}

async function loadGoogleClientId() {
  try {
    const data = await api("/api/config", { method: "GET" });
    return data.googleClientId;
  } catch (err) {
    console.warn("config fetch failed", err);
    return "";
  }
}

function initGoogleSignIn(clientId) {
  if (!clientId) {
    signInHintEl.textContent = "GOOGLE_CLIENT_ID が設定されていません";
    return;
  }
  signInHintEl.textContent = "ログイン後、ID トークンが保存されます。";

  const tryInit = () => {
    if (!window.google || !window.google.accounts || !window.google.accounts.id) {
      return false;
    }
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: async (response) => {
        state.settings.token = response.credential;
        saveSettings();
        updateUserProfile();
        try {
          await refreshAll();
          setAuthRequired(false);
          setStatus("Google ログイン完了", "ok");
        } catch (err) {
          setStatus(`ログイン後の取得に失敗: ${err.message}`, "error");
        }
      },
    });
    window.google.accounts.id.renderButton(googleSignInEl, {
      theme: "outline",
      size: "large",
      text: "signin_with",
      shape: "pill",
    });
    return true;
  };

  if (tryInit()) {
    return;
  }

  const timer = setInterval(() => {
    if (tryInit()) {
      clearInterval(timer);
    }
  }, 200);
}

function loadGoogleScript() {
  if (window.google && window.google.accounts && window.google.accounts.id) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src*="accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("Google スクリプトの読み込みに失敗しました"))
      );
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google スクリプトの読み込みに失敗しました"));
    document.head.appendChild(script);
  });
}

async function api(path, options = {}) {
  const base = state.settings.baseUrl || window.location.origin;
  const headers = { "Content-Type": "application/json" };
  if (state.settings.token) {
    headers.Authorization = `Bearer ${state.settings.token}`;
  }
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
  });
  if (!response.ok) {
    let detail = "";
    try {
      const data = await response.json();
      detail = data?.error?.message || JSON.stringify(data);
    } catch {
      detail = await response.text();
    }
    throw new Error(detail || response.statusText);
  }
  return response.json();
}

function renderAssets() {
  if (!state.assets.length) {
    assetsList.innerHTML = "<p class=\"hint\">資産がまだありません</p>";
    return;
  }
  assetsList.innerHTML = state.assets
    .map(
      (asset) => `
        <div class="list-item">
          <div>
            <strong>${asset.name}</strong>
            <small>${asset.type || ""}</small>
          </div>
          <div>
            <strong>${fmt.format(asset.currentBalance || 0)} 円</strong>
            <small>${asset.isActive ? "稼働中" : "非アクティブ"}</small>
          </div>
        </div>
      `
    )
    .join("");
}

function renderCategories() {
  if (!state.categories.length) {
    categoriesList.innerHTML = "<p class=\"hint\">費目がまだありません</p>";
    return;
  }
  categoriesList.innerHTML = state.categories
    .map(
      (category) => `
        <div class="list-item">
          <div>
            <strong>${category.name}</strong>
            <small>並び順 ${category.sortOrder ?? 0}</small>
          </div>
          <div>
            <small>${category.isActive ? "稼働中" : "非アクティブ"}</small>
          </div>
        </div>
      `
    )
    .join("");
}

function renderSelectOptions() {
  assetSelects.forEach((select) => {
    select.innerHTML = state.assets
      .filter((asset) => asset.isActive)
      .map((asset) => `<option value="${asset.id}">${asset.name}</option>`)
      .join("");
  });
  categorySelects.forEach((select) => {
    select.innerHTML = state.categories
      .filter((category) => category.isActive)
      .map((category) => `<option value="${category.id}">${category.name}</option>`)
      .join("");
  });
}

function renderTransactions() {
  if (!state.transactions.length) {
    transactionsList.innerHTML = "<p class=\"hint\">取引がまだありません</p>";
    return;
  }
  transactionsList.innerHTML = state.transactions
    .map((tx) => {
      const when = tx.occurredAt ? new Date(tx.occurredAt).toLocaleString("ja-JP") : "";
      let detail = "";
      if (tx.type === "transfer") {
        detail = `${lookupAsset(tx.fromAssetId)} → ${lookupAsset(tx.toAssetId)}`;
      } else {
        detail = `${lookupAsset(tx.assetId)} / ${lookupCategory(tx.categoryId)}`;
      }
      return `
        <div class="list-item">
          <div>
            <strong>${labelType(tx.type)} ${fmt.format(tx.amount)} 円</strong>
            <small>${detail}</small>
          </div>
          <div>
            <small>${when}</small>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderSummary(summary) {
  if (!summary) {
    summaryGrid.innerHTML = "<p class=\"hint\">対象の月を指定してください</p>";
    return;
  }
  summaryGrid.innerHTML = `
    <div class="summary-card">
      <small>支出合計</small>
      <strong>${fmt.format(summary.expenseTotal)} 円</strong>
    </div>
    <div class="summary-card">
      <small>収入合計</small>
      <strong>${fmt.format(summary.incomeTotal)} 円</strong>
    </div>
    <div class="summary-card">
      <small>差額</small>
      <strong>${fmt.format(summary.net)} 円</strong>
    </div>
    <div class="summary-card">
      <small>振替合計</small>
      <strong>${fmt.format(summary.transferTotal)} 円</strong>
    </div>
  `;
}

function lookupAsset(id) {
  return state.assets.find((asset) => asset.id === id)?.name || "?";
}

function lookupCategory(id) {
  return state.categories.find((cat) => cat.id === id)?.name || "?";
}

function labelType(type) {
  switch (type) {
    case "expense":
      return "支出";
    case "income":
      return "収入";
    case "transfer":
      return "振替";
    default:
      return type || "";
  }
}

async function fetchAssets() {
  state.assets = await api("/api/assets");
  renderAssets();
  renderSelectOptions();
}

async function fetchCategories() {
  state.categories = await api("/api/categories");
  renderCategories();
  renderSelectOptions();
}

async function fetchTransactions() {
  const data = await api("/api/transactions?limit=25");
  state.transactions = data.items || [];
  renderTransactions();
}

async function bootstrap() {
  await api("/api/bootstrap", { method: "POST" });
  await refreshAll();
}

async function refreshAll() {
  setStatus("更新中...", "busy");
  await Promise.all([fetchAssets(), fetchCategories(), fetchTransactions()]);
  setStatus("同期完了", "ok");
}

function getDateValue(inputId) {
  const value = qs(inputId).value;
  if (!value) {
    return new Date().toISOString();
  }
  return new Date(value).toISOString();
}

async function handleAssetSubmit(event) {
  event.preventDefault();
  const payload = {
    name: qs("assetName").value.trim(),
    type: qs("assetType").value.trim() || null,
    initialBalance: Number(qs("assetBalance").value || 0),
    note: qs("assetNote").value.trim() || null,
  };
  await api("/api/assets", { method: "POST", body: JSON.stringify(payload) });
  event.target.reset();
  await fetchAssets();
}

async function handleCategorySubmit(event) {
  event.preventDefault();
  const payload = {
    name: qs("categoryName").value.trim(),
    sortOrder: Number(qs("categorySort").value || 0),
  };
  await api("/api/categories", { method: "POST", body: JSON.stringify(payload) });
  event.target.reset();
  await fetchCategories();
}

async function handleExpenseSubmit(event) {
  event.preventDefault();
  const payload = {
    occurredAt: getDateValue("expenseDate"),
    amount: Number(qs("expenseAmount").value),
    assetId: qs("expenseAsset").value,
    categoryId: qs("expenseCategory").value,
    merchant: qs("expenseMerchant").value.trim() || null,
    memo: qs("expenseMemo").value.trim() || null,
  };
  await api("/api/transactions/expense", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  event.target.reset();
  await Promise.all([fetchTransactions(), fetchAssets()]);
}

async function handleIncomeSubmit(event) {
  event.preventDefault();
  const payload = {
    occurredAt: getDateValue("incomeDate"),
    amount: Number(qs("incomeAmount").value),
    assetId: qs("incomeAsset").value,
    categoryId: qs("incomeCategory").value,
    source: qs("incomeSource").value.trim() || null,
    memo: qs("incomeMemo").value.trim() || null,
  };
  await api("/api/transactions/income", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  event.target.reset();
  await Promise.all([fetchTransactions(), fetchAssets()]);
}

async function handleTransferSubmit(event) {
  event.preventDefault();
  const fromAsset = qs("transferFrom").value;
  const toAsset = qs("transferTo").value;
  if (fromAsset === toAsset) {
    throw new Error("振替元と振替先は別の資産を選んでください");
  }
  const payload = {
    occurredAt: getDateValue("transferDate"),
    amount: Number(qs("transferAmount").value),
    fromAssetId: fromAsset,
    toAssetId: toAsset,
    fee: Number(qs("transferFee").value || 0),
    memo: qs("transferMemo").value.trim() || null,
  };
  await api("/api/transactions/transfer", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  event.target.reset();
  await Promise.all([fetchTransactions(), fetchAssets()]);
}

async function handleSummary(event) {
  event.preventDefault();
  const year = Number(qs("summaryYear").value);
  const month = Number(qs("summaryMonth").value);
  const summary = await api(`/api/summary/monthly?year=${year}&month=${month}`);
  renderSummary(summary);
}

function setupTabs() {
  qs("txTabs").addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) {
      return;
    }
    const tab = button.dataset.tab;
    document.querySelectorAll(".tab").forEach((el) => el.classList.remove("active"));
    button.classList.add("active");
    document.querySelectorAll(".panel").forEach((panel) => {
      panel.classList.toggle("active", panel.id === `${tab}Form`);
    });
  });
}

function setupForms() {
  qs("assetForm").addEventListener("submit", (event) =>
    handleForm(event, handleAssetSubmit)
  );
  qs("categoryForm").addEventListener("submit", (event) =>
    handleForm(event, handleCategorySubmit)
  );
  qs("expenseForm").addEventListener("submit", (event) =>
    handleForm(event, handleExpenseSubmit)
  );
  qs("incomeForm").addEventListener("submit", (event) =>
    handleForm(event, handleIncomeSubmit)
  );
  qs("transferForm").addEventListener("submit", (event) =>
    handleForm(event, handleTransferSubmit)
  );
  qs("summaryForm").addEventListener("submit", (event) =>
    handleForm(event, handleSummary)
  );
}

async function handleForm(event, handler) {
  setStatus("送信中...", "busy");
  try {
    await handler(event);
    setStatus("完了", "ok");
  } catch (err) {
    if (isAuthError(err.message)) {
      setAuthRequired(true);
      signInHintEl.textContent = "ログインしてください。";
    }
    setStatus(`エラー: ${err.message}`, "error");
  }
}

function setupActions() {
  if (userTriggerEl) {
    userTriggerEl.addEventListener("click", (event) => {
      event.stopPropagation();
      userDropdownEl.classList.toggle("visible");
    });
    document.addEventListener("click", () => {
      userDropdownEl.classList.remove("visible");
    });
  }

  settingsNavEl.addEventListener("click", () => {
    userDropdownEl.classList.remove("visible");
    setView("settings");
  });

  settingsBackEl.addEventListener("click", () => {
    setView("main");
  });

  qs("logout").addEventListener("click", () => {
    state.settings.token = "";
    saveSettings();
    updateUserProfile();
    setAuthRequired(true);
    setStatus("ログアウトしました", "ok");
  });
  qs("bootstrap").addEventListener("click", () =>
    handleForm(new Event("submit"), bootstrap)
  );
  qs("refreshAll").addEventListener("click", () =>
    handleForm(new Event("submit"), refreshAll)
  );
  qs("refreshAssets").addEventListener("click", () =>
    handleForm(new Event("submit"), fetchAssets)
  );
  qs("refreshCategories").addEventListener("click", () =>
    handleForm(new Event("submit"), fetchCategories)
  );
  qs("refreshTransactions").addEventListener("click", () =>
    handleForm(new Event("submit"), fetchTransactions)
  );
  qs("refreshSummary").addEventListener("click", () =>
    handleForm(new Event("submit"), async () => {
      const year = qs("summaryYear").value;
      const month = qs("summaryMonth").value;
      if (year && month) {
        await handleSummary(new Event("submit"));
      }
    })
  );
}

async function init() {
  setAuthRequired(true);
  loadSettings();
  updateUserProfile();
  setView("main");
  const clientId = await loadGoogleClientId();
  try {
    await loadGoogleScript();
    initGoogleSignIn(clientId);
  } catch (err) {
    signInHintEl.textContent = err.message;
  }
  setupTabs();
  setupForms();
  setupActions();
  const now = new Date();
  qs("summaryYear").value = now.getFullYear();
  qs("summaryMonth").value = now.getMonth() + 1;
  try {
    await refreshAll();
    setAuthRequired(false);
    updateUserProfile();
  } catch (err) {
    if (isAuthError(err.message)) {
      setAuthRequired(true);
      signInHintEl.textContent = "ログインしてください。";
      setStatus("ログインが必要です", "error");
      return;
    }
    setStatus(`接続待ち: ${err.message}`, "error");
  }
}

init();
