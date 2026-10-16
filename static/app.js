
"use strict";

const $ = (id) => document.getElementById(id);
const state = {
  authenticated: false,
  csrf: "",
  vaultKey: null,
  vaultSalt: null,
  companies: [],
  data: { companies: [], notes: [], analyses: [] },
  currentAnalysis: null,
  activeTab: "grants",
};

const DB_NAME = "impacto-fund-privado";
const DB_VERSION = 1;
const DB_STORE = "private-vault";
const DB_KEY = "encrypted-data";
const COMPANIES_KEY = "impacto-fund-privado-companies-v1";

function message(id, text = "", type = "") {
  const el = $(id);
  if (!el) return;
  el.textContent = text;
  el.className = "message" + (type ? " " + type : "");
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers,
  });
  const contentType = response.headers.get("content-type") || "";
  const result = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const detail = typeof result === "object" && result
      ? result.detail || "La solicitud no pudo completarse."
      : "La solicitud no pudo completarse.";
    throw new Error(detail);
  }
  return result;
}

/* EMPRESAS: almacenamiento local independiente de la libreta. */
function loadLocalCompanies() {
  try {
    const raw = localStorage.getItem(COMPANIES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    state.companies = Array.isArray(parsed)
      ? parsed.filter((company) => company && company.id && company.name)
      : [];
  } catch (error) {
    console.error("No se pudieron cargar las empresas locales.", error);
    state.companies = [];
  }
}

function saveLocalCompanies() {
  try {
    localStorage.setItem(COMPANIES_KEY, JSON.stringify(state.companies));
    return true;
  } catch (error) {
    console.error("No se pudieron guardar las empresas locales.", error);
    return false;
  }
}

function mergeLocalCompanies(companies) {
  if (!Array.isArray(companies) || !companies.length) return true;

  const merged = new Map(state.companies.map((company) => [company.id, company]));

  for (const item of companies) {
    if (!item || !item.name) continue;
    const id = item.id || makeId();
    merged.set(id, {
      id,
      name: String(item.name),
      location: String(item.location || ""),
      type: item.type || "",
      naics: String(item.naics || ""),
      description: String(item.description || ""),
      goals: String(item.goals || ""),
      updatedAt: item.updatedAt || new Date().toISOString(),
    });
  }

  const previous = state.companies;
  state.companies = Array.from(merged.values());

  if (!saveLocalCompanies()) {
    state.companies = previous;
    return false;
  }
  return true;
}

function currentCompany() {
  const id = $("companySelect")?.value;
  return state.companies.find((company) => company.id === id) || null;
}

function makeId() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function setAuthenticated(isAuthenticated) {
  state.authenticated = isAuthenticated;
  $("loginPanel").classList.toggle("hidden", isAuthenticated);
  $("appPanel").classList.toggle("hidden", !isAuthenticated);
  $("logoutBtn").classList.toggle("hidden", !isAuthenticated);
}

async function checkSession() {
  try {
    const result = await api("/api/me");
    state.csrf = result.csrf || "";
    setAuthenticated(true);
    renderCompanies();
    await loadPortals();
  } catch {
    setAuthenticated(false);
  }
}

$("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  message("loginMessage", "Verificando acceso...");
  try {
    const result = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({
        username: $("username").value,
        password: $("password").value,
      }),
    });
    state.csrf = result.csrf || "";
    $("password").value = "";
    setAuthenticated(true);
    message("loginMessage", "");
    renderCompanies();
    await loadPortals();
  } catch (error) {
    message("loginMessage", error.message, "error");
  }
});

$("logoutBtn").addEventListener("click", async () => {
  try {
    await api("/api/logout", { method: "POST" });
  } catch {
    // Se cierra la sesión visual aunque falle la petición.
  }
  lockVault(false);
  setAuthenticated(false);
  message("loginMessage", "Has salido de la aplicación.");
});

/* ALMACENAMIENTO CIFRADO: reservado para notas y análisis privados. */
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("No se pudo abrir el almacenamiento local."));
  });
}

async function dbGet() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(DB_STORE, "readonly");
    const request = transaction.objectStore(DB_STORE).get(DB_KEY);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(new Error("No se pudieron leer los datos locales."));
    transaction.oncomplete = () => db.close();
  });
}

async function dbPut(value) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(DB_STORE, "readwrite");
    transaction.objectStore(DB_STORE).put(value, DB_KEY);
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(new Error("No se pudieron guardar los datos. Comprueba el espacio disponible."));
    };
  });
}

async function deriveKey(password, salt) {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 310000,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

function toBase64(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(text) {
  const binary = atob(text);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function encryptData(data) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(data));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    state.vaultKey,
    plaintext
  );
  return {
    version: 1,
    salt: toBase64(state.vaultSalt),
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(encrypted)),
  };
}

async function decryptRecord(record, password) {
  if (!record || record.version !== 1 || !record.salt || !record.iv || !record.ciphertext) {
    throw new Error("La copia cifrada no tiene un formato reconocido.");
  }
  const salt = fromBase64(record.salt);
  const iv = fromBase64(record.iv);
  const ciphertext = fromBase64(record.ciphertext);
  const key = await deriveKey(password, salt);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );
  return {
    key,
    salt,
    data: JSON.parse(new TextDecoder().decode(plaintext)),
  };
}

async function persistVault() {
  if (!state.vaultKey) throw new Error("Primero abre la libreta.");
  // Las empresas ya no se guardan dentro de la libreta cifrada.
  const privateData = {
    companies: [],
    notes: state.data.notes || [],
    analyses: state.data.analyses || [],
  };
  await dbPut(await encryptData(privateData));
}

$("unlockVaultBtn").addEventListener("click", async () => {
  const password = $("vaultPassword").value;
  if (password.length < 10) {
    message("vaultMessage", "Usa una contraseña de al menos 10 caracteres.", "error");
    return;
  }
  if (!window.crypto?.subtle || !window.indexedDB) {
    message("vaultMessage", "Este navegador no admite el almacenamiento cifrado requerido.", "error");
    return;
  }

  message("vaultMessage", "Abriendo la libreta...");
  try {
    const record = await dbGet();

    if (record) {
      const opened = await decryptRecord(record, password);

      // Migración: conserva las empresas de las libretas creadas anteriormente.
      const legacyCompanies = Array.isArray(opened.data.companies)
        ? opened.data.companies
        : [];

      if (!mergeLocalCompanies(legacyCompanies)) {
        throw new Error("No se pudieron migrar las empresas al almacenamiento local. No se ha modificado la copia cifrada.");
      }

      state.vaultKey = opened.key;
      state.vaultSalt = opened.salt;
      state.data = {
        companies: [],
        notes: Array.isArray(opened.data.notes) ? opened.data.notes : [],
        analyses: Array.isArray(opened.data.analyses) ? opened.data.analyses : [],
      };

      // Solo después de guardar las empresas localmente se actualiza la libreta.
      if (legacyCompanies.length) await persistVault();
    } else {
      state.vaultSalt = crypto.getRandomValues(new Uint8Array(16));
      state.vaultKey = await deriveKey(password, state.vaultSalt);
      state.data = { companies: [], notes: [], analyses: [] };
      await persistVault();
    }

    $("vaultPassword").value = "";
    $("vaultPanel").classList.remove("hidden");
    $("lockVaultBtn").classList.remove("hidden");
    $("unlockVaultBtn").classList.add("hidden");
    message("vaultMessage", "Libreta abierta. Las notas se guardan cifradas en este navegador.", "success");
    renderCompanies();
    renderNotes();
    renderSavedAnalyses();
  } catch (error) {
    state.vaultKey = null;
    state.vaultSalt = null;
    state.data = { companies: [], notes: [], analyses: [] };
    message(
      "vaultMessage",
      error instanceof DOMException
        ? "No se pudo descifrar la libreta. Comprueba la contraseña o la integridad de la copia."
        : error.message,
      "error"
    );
  }
});

function lockVault(showMessage = true) {
  state.vaultKey = null;
  state.vaultSalt = null;
  // Las empresas permanecen disponibles aunque se cierre la libreta.
  state.data = { companies: [], notes: [], analyses: [] };
  $("vaultPanel").classList.add("hidden");
  $("unlockVaultBtn").classList.remove("hidden");
  $("lockVaultBtn").classList.add("hidden");
  $("vaultPassword").value = "";
  $("notesList").innerHTML = "";
  $("results").innerHTML = "";
  $("analysisOutput").textContent = "";
  $("analysisResult").classList.add("hidden");
  renderCompanies();
  if (showMessage) message("vaultMessage", "Libreta cerrada. Las empresas siguen disponibles.");
}

$("lockVaultBtn").addEventListener("click", () => lockVault());

/* EMPRESAS: crear, seleccionar, editar y eliminar sin desbloquear la libreta. */
function renderCompanies(selectedId = "") {
  const select = $("companySelect");
  const previous = selectedId || select.value;
  select.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = state.companies.length
    ? "Selecciona una empresa"
    : "Añade tu primera empresa";
  select.appendChild(placeholder);

  for (const company of state.companies) {
    const option = document.createElement("option");
    option.value = company.id;
    option.textContent = company.name;
    select.appendChild(option);
  }

  if (state.companies.some((company) => company.id === previous)) {
    select.value = previous;
  } else if (state.companies.length) {
    select.value = state.companies[0].id;
  }

  fillCompanySearchFields();
  updateCompanyEditButton();
}

function fillCompanySearchFields() {
  const company = currentCompany();
  if (!company) return;

  if (!$("grantKeyword").value.trim()) {
    $("grantKeyword").value = company.description || company.name;
  }
  if (!$("contractKeyword").value.trim()) {
    $("contractKeyword").value = company.description || company.name;
  }
  if (!$("contractNaics").value.trim() && company.naics) {
    $("contractNaics").value = company.naics;
  }
}

function updateCompanyEditButton() {
  const row = $("newCompanyBtn")?.parentElement;
  if (!row) return;

  let button = $("editCompanyBtn");
  if (!button) {
    button = document.createElement("button");
    button.id = "editCompanyBtn";
    button.type = "button";
    button.className = "button button-light";
    button.textContent = "Editar empresa seleccionada";
    button.addEventListener("click", editSelectedCompany);
    row.insertBefore(button, $("newCompanyBtn"));
  }
  button.disabled = !currentCompany();
  button.classList.toggle("hidden", state.companies.length === 0);
}

$("companySelect").addEventListener("change", () => {
  fillCompanySearchFields();
  updateCompanyEditButton();
  if (state.vaultKey) renderNotes();
});

function resetCompanyForm() {
  $("companyForm").reset();
  $("companyId").value = "";
  $("companyFormTitle").textContent = "Datos de la empresa";
  $("deleteCompanyBtn").classList.add("hidden");
  $("companyForm").classList.add("hidden");
}

function editSelectedCompany() {
  const company = currentCompany();
  if (!company) return;

  $("companyId").value = company.id;
  $("companyName").value = company.name || "";
  $("companyLocation").value = company.location || "";
  $("companyType").value = company.type || "small_business";
  $("companyNaics").value = company.naics || "";
  $("companyDescription").value = company.description || "";
  $("companyGoals").value = company.goals || "";
  $("companyFormTitle").textContent = "Editar empresa";
  $("deleteCompanyBtn").classList.remove("hidden");
  $("companyForm").classList.remove("hidden");
  $("companyName").focus();
  message("companyMessage", "");
}

$("newCompanyBtn").addEventListener("click", () => {
  resetCompanyForm();
  $("companyFormTitle").textContent = "Nueva empresa";
  $("companyForm").classList.remove("hidden");
  $("companyName").focus();
});

$("cancelCompanyBtn").addEventListener("click", resetCompanyForm);

$("companyForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = $("companyName").value.trim();
  if (!name) {
    message("companyMessage", "Escribe el nombre de la empresa.", "error");
    return;
  }

  const id = $("companyId").value || makeId();
  const company = {
    id,
    name,
    location: $("companyLocation").value.trim(),
    type: $("companyType").value,
    naics: $("companyNaics").value.trim(),
    description: $("companyDescription").value.trim(),
    goals: $("companyGoals").value.trim(),
    updatedAt: new Date().toISOString(),
  };

  const previous = state.companies;
  const index = state.companies.findIndex((item) => item.id === id);
  state.companies = [...state.companies];

  if (index >= 0) state.companies[index] = company;
  else state.companies.push(company);

  if (!saveLocalCompanies()) {
    state.companies = previous;
    message("companyMessage", "No se pudo guardar la empresa en este navegador. Comprueba el almacenamiento disponible.", "error");
    return;
  }

  renderCompanies(id);
  resetCompanyForm();
  message("companyMessage", "Empresa guardada en este navegador.", "success");
});

$("companySelect").addEventListener("dblclick", editSelectedCompany);

$("deleteCompanyBtn").addEventListener("click", () => {
  const id = $("companyId").value;
  const company = state.companies.find((item) => item.id === id);
  if (!company) return;

  if (!confirm(`¿Eliminar la ficha "${company.name}"? Las notas privadas no se borrarán automáticamente.`)) return;

  const previous = state.companies;
  state.companies = state.companies.filter((item) => item.id !== id);

  if (!saveLocalCompanies()) {
    state.companies = previous;
    message("companyMessage", "No se pudo eliminar la ficha del almacenamiento local.", "error");
    return;
  }

  renderCompanies();
  resetCompanyForm();
  message("companyMessage", "Ficha eliminada.", "success");
});

/* RESULTADOS: se conserva el formato original de las búsquedas. */
function renderOpportunityResults(items) {
  const results = $("results");
  results.innerHTML = "";

  if (!items.length) {
    results.textContent = "No se encontraron resultados. Prueba con otras palabras clave.";
    return;
  }

  for (const item of items) {
    const card = document.createElement("article");
    card.className = "result-card";
    const title = document.createElement("h3");
    title.textContent = item.title || "Oportunidad sin título";
    const description = document.createElement("p");
    description.textContent = [
      item.agency ? `Entidad: ${item.agency}` : "",
      item.number ? `Número: ${item.number}` : "",
      item.status ? `Estado: ${item.status}` : "",
      item.close_date ? `Fecha de cierre: ${item.close_date}` : "",
    ].filter(Boolean).join(" · ") || "Ver detalles en la fuente oficial.";

    const meta = document.createElement("div");
    meta.className = "result-meta";
    const pill = document.createElement("span");
    pill.className = "pill";
    pill.textContent = item.source || "Fuente oficial";
    meta.appendChild(pill);

    const link = document.createElement("a");
    const safeUrl = safeExternalUrl(item.url);
    link.href = safeUrl || "https://www.grants.gov/";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Abrir fuente oficial";

    const save = document.createElement("button");
    save.type = "button";
    save.className = "button button-secondary";
    save.textContent = "Guardar referencia en mi libreta";
    save.addEventListener("click", async () => {
      if (!state.vaultKey) {
        message("searchMessage", "Abre la libreta para guardar referencias.", "error");
        return;
      }
      const note = {
        id: makeId(),
        companyId: currentCompany()?.id || "",
        title: item.title || "Oportunidad",
        text: [
          `Fuente: ${item.source || ""}`,
          `Entidad: ${item.agency || "Por confirmar"}`,
          `Número: ${item.number || "Por confirmar"}`,
          `Estado: ${item.status || "Por confirmar"}`,
          `Fecha de cierre: ${item.close_date || "Por confirmar"}`,
          `Enlace: ${safeUrl || ""}`,
        ].join("\n"),
        createdAt: new Date().toISOString(),
      };
      state.data.notes.unshift(note);
      try {
        await persistVault();
        renderNotes();
        message("searchMessage", "Referencia guardada en la libreta cifrada.", "success");
      } catch (error) {
        message("searchMessage", error.message, "error");
      }
    });

    card.append(title, description, meta, link, document.createTextNode(" "), save);
    results.appendChild(card);
  }
}

function safeExternalUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && !url.username && !url.password) return url.href;
  } catch {
    return "";
  }
  return "";
}

$("grantsForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const keyword = $("grantKeyword").value.trim();
  if (!keyword) return;
  $("results").innerHTML = "";
  message("searchMessage", "Buscando en Grants.gov...");
  try {
    const data = await api("/api/grants/search", {
      method: "POST",
      body: JSON.stringify({
        keyword,
        status: $("grantStatus").value,
        rows: Number($("grantRows").value),
      }),
    });
    renderOpportunityResults(data.opportunities || []);
    message("searchMessage", `${data.count} resultado(s). ${data.notice || ""}`, "success");
  } catch (error) {
    message("searchMessage", error.message, "error");
  }
});

$("contractsForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!$("contractKeyword").value.trim() && !$("contractNaics").value.trim()) {
    message("searchMessage", "Escribe palabras clave o un NAICS.", "error");
    return;
  }
  $("results").innerHTML = "";
  message("searchMessage", "Consultando SAM.gov...");
  try {
    const data = await api("/api/contracts/search", {
      method: "POST",
      body: JSON.stringify({
        keyword: $("contractKeyword").value.trim(),
        naics: $("contractNaics").value.trim(),
        state: $("contractState").value.trim(),
        days_back: Number($("contractDays").value),
        limit: 10,
      }),
    });
    renderOpportunityResults(data.opportunities || []);
    message("searchMessage", `${data.count} resultado(s). ${data.notice || ""}`, "success");
  } catch (error) {
    message("searchMessage", error.message, "error");
  }
});

/* PESTAÑAS: comportamiento original. */
document.querySelectorAll("[data-tab]").forEach((button) => {
  button.addEventListener("click", () => {
    state.activeTab = button.dataset.tab;
    document.querySelectorAll("[data-tab]").forEach((tab) => {
      tab.classList.toggle("active", tab === button);
    });
    for (const name of ["grants", "contracts", "work"]) {
      const panelId = name === "work" ? "workPanel" : `${name}Panel`;
      const panel = $(panelId);
      if (panel) panel.classList.toggle("hidden", name !== state.activeTab);
    }
    $("results").innerHTML = "";
    message("searchMessage", "");
  });
});

async function loadPortals() {
  try {
    const data = await api("/api/portals");
    renderPortalList($("portalLinks"), data.portals || []);
    renderPortalList($("workLinks"), (data.portals || []).filter((portal) =>
      ["Empleo", "Empleo federal", "Apoyo empresarial"].includes(portal.type)
    ));
  } catch (error) {
    message("searchMessage", error.message, "error");
  }
}

function renderPortalList(container, portals) {
  if (!container) return;
  container.innerHTML = "";
  for (const portal of portals) {
    const card = document.createElement("article");
    card.className = "link-card";
    const title = document.createElement("h3");
    title.textContent = portal.name;
    const description = document.createElement("p");
    description.textContent = portal.description;
    const link = document.createElement("a");
    link.href = safeExternalUrl(portal.url) || "https://www.grants.gov/";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Abrir portal oficial";
    card.append(title, description, link);
    container.appendChild(card);
  }
}

/* ANÁLISIS CON IA: conserva el endpoint y el formato original. */
$("analyzeBtn").addEventListener("click", async () => {
  const text = $("analysisText").value.trim();
  const company = currentCompany();

  if (text.length < 20) {
    message("analysisMessage", "Pega al menos 20 caracteres del texto que deseas analizar.", "error");
    return;
  }
  if (!$("aiConsent").checked) {
    message("analysisMessage", "Lee y marca la autorización antes de enviar el texto a la IA.", "error");
    return;
  }

  const button = $("analyzeBtn");
  button.disabled = true;
  button.textContent = "Analizando...";
  $("analysisResult").classList.add("hidden");
  message("analysisMessage", "El texto autorizado se está enviando al servicio de IA configurado.");

  try {
    const result = await api("/api/ai/analyze", {
      method: "POST",
      body: JSON.stringify({
        text,
        business: company
          ? [
              `Nombre: ${company.name}`,
              `Ubicación: ${company.location || "No indicada"}`,
              `Tipo: ${company.type || "No indicado"}`,
              `NAICS actual: ${company.naics || "No confirmado"}`,
              `Actividad: ${company.description || "No indicada"}`,
              `Objetivos: ${company.goals || "No indicados"}`,
            ].join("\n")
          : "",
        task: $("analysisTask").value,
        language: $("language").value,
      }),
    });

    state.currentAnalysis = {
      provider: result.provider || "IA",
      task: $("analysisTask").value,
      text: result.answer || "",
      companyId: company?.id || "",
      createdAt: new Date().toISOString(),
    };
    $("analysisProvider").textContent = `Proveedor: ${state.currentAnalysis.provider}`;
    $("analysisOutput").textContent = state.currentAnalysis.text;
    $("analysisResult").classList.remove("hidden");
    message("analysisMessage", "Análisis terminado. Revisa los datos y verifica las fuentes.", "success");
  } catch (error) {
    message("analysisMessage", error.message, "error");
  } finally {
    button.disabled = false;
    button.textContent = "Analizar texto autorizado";
    $("aiConsent").checked = false;
  }
});

$("saveAnalysisBtn").addEventListener("click", async () => {
  if (!state.vaultKey) {
    message("analysisMessage", "Abre la libreta antes de guardar el análisis.", "error");
    return;
  }
  if (!state.currentAnalysis?.text) return;

  const note = {
    id: makeId(),
    companyId: state.currentAnalysis.companyId,
    title: `Análisis: ${new Date().toLocaleDateString()}`,
    text: state.currentAnalysis.text,
    createdAt: new Date().toISOString(),
  };
  state.data.notes.unshift(note);
  state.data.analyses.unshift({
    id: makeId(),
    task: state.currentAnalysis.task,
    text: state.currentAnalysis.text,
    companyId: state.currentAnalysis.companyId,
    createdAt: new Date().toISOString(),
  });

  try {
    await persistVault();
    renderNotes();
    renderSavedAnalyses();
    message("analysisMessage", "Análisis guardado en la libreta cifrada.", "success");
  } catch (error) {
    message("analysisMessage", error.message, "error");
  }
});

/* NOTAS PRIVADAS: requieren que la libreta esté abierta. */
$("saveNoteBtn").addEventListener("click", async () => {
  if (!state.vaultKey) {
    message("vaultMessage", "Abre primero la libreta.", "error");
    return;
  }
  const title = $("noteTitle").value.trim();
  const text = $("noteText").value.trim();

  if (!title || !text) {
    message("vaultMessage", "Escribe un título y el contenido de la nota.", "error");
    return;
  }

  state.data.notes.unshift({
    id: makeId(),
    companyId: currentCompany()?.id || "",
    title,
    text,
    createdAt: new Date().toISOString(),
  });

  try {
    await persistVault();
    $("noteTitle").value = "";
    $("noteText").value = "";
    renderNotes();
    message("vaultMessage", "Nota guardada cifrada.", "success");
  } catch (error) {
    message("vaultMessage", error.message, "error");
  }
});

function renderNotes() {
  const container = $("notesList");
  container.innerHTML = "";
  if (!state.vaultKey) return;

  const companyId = currentCompany()?.id || "";
  const notes = state.data.notes.filter((note) =>
    !note.companyId || !companyId || note.companyId === companyId
  );

  if (!notes.length) {
    container.textContent = "Todavía no hay notas para mostrar en esta empresa.";
    return;
  }

  for (const note of notes) {
    const card = document.createElement("article");
    card.className = "note-card";

    const title = document.createElement("h3");
    title.textContent = note.title;
    const dateLine = document.createElement("p");
    dateLine.className = "small-note";
    dateLine.textContent = note.createdAt
      ? new Date(note.createdAt).toLocaleString()
      : "";
    const body = document.createElement("pre");
    body.textContent = note.text;
    const actions = document.createElement("div");
    actions.className = "note-actions";

    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "button button-light";
    edit.textContent = "Editar";
    edit.addEventListener("click", async () => {
      const newTitle = prompt("Título de la nota:", note.title);
      if (newTitle === null) return;
      const newText = prompt("Contenido de la nota:", note.text);
      if (newText === null) return;

      if (!newTitle.trim() || !newText.trim()) {
        message("vaultMessage", "El título y el contenido no pueden quedar vacíos.", "error");
        return;
      }

      const oldTitle = note.title;
      const oldText = note.text;
      note.title = newTitle.trim();
      note.text = newText.trim();

      try {
        await persistVault();
        renderNotes();
        message("vaultMessage", "Nota actualizada.", "success");
      } catch (error) {
        note.title = oldTitle;
        note.text = oldText;
        message("vaultMessage", error.message, "error");
      }
    });

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "button button-danger";
    remove.textContent = "Eliminar";
    remove.addEventListener("click", async () => {
      if (!confirm(`¿Eliminar la nota "${note.title}"?`)) return;

      const previous = state.data.notes;
      state.data.notes = previous.filter((item) => item.id !== note.id);
      try {
        await persistVault();
        renderNotes();
        message("vaultMessage", "Nota eliminada.", "success");
      } catch (error) {
        state.data.notes = previous;
        message("vaultMessage", error.message, "error");
      }
    });

    actions.append(edit, remove);
    card.append(title, dateLine, body, actions);
    container.appendChild(card);
  }
}

function renderSavedAnalyses() {
  // Los análisis permanecen guardados dentro de los datos cifrados.
}

/* COPIAS DE SEGURIDAD: se conserva el formato cifrado original. */
$("exportNotesBtn").addEventListener("click", async () => {
  if (!state.vaultKey) {
    message("vaultMessage", "Abre la libreta antes de exportar.", "error");
    return;
  }

  try {
    const record = await dbGet();
    if (!record) throw new Error("No existe una copia para exportar.");

    const blob = new Blob([JSON.stringify(record, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `impacto-libreta-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    message("vaultMessage", "Copia cifrada exportada. Guárdala en un lugar seguro.", "success");
  } catch (error) {
    message("vaultMessage", error.message, "error");
  }
});

$("importNotesFile").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;

  if (!state.vaultKey) {
    message("vaultMessage", "Abre la libreta antes de importar una copia.", "error");
    return;
  }

  try {
    const record = JSON.parse(await file.text());
    const password = prompt("Introduce la contraseña con la que se creó esta copia cifrada:");
    if (password === null) return;

    const imported = await decryptRecord(record, password);

    if (!confirm("Las empresas del archivo se combinarán con las actuales. Las notas privadas actuales serán reemplazadas. ¿Continuar?")) return;

    if (!mergeLocalCompanies(imported.data.companies || [])) {
      throw new Error("No se pudieron guardar las empresas importadas. La libreta actual no se ha reemplazado.");
    }

    const previousKey = state.vaultKey;
    const previousSalt = state.vaultSalt;
    const previousData = state.data;

    state.vaultKey = imported.key;
    state.vaultSalt = imported.salt;
    state.data = {
      companies: [],
      notes: Array.isArray(imported.data.notes) ? imported.data.notes : [],
      analyses: Array.isArray(imported.data.analyses) ? imported.data.analyses : [],
    };

    try {
      await persistVault();
    } catch (error) {
      state.vaultKey = previousKey;
      state.vaultSalt = previousSalt;
      state.data = previousData;
      throw error;
    }

    renderCompanies();
    renderNotes();
    renderSavedAnalyses();
    message("vaultMessage", "Copia cifrada importada. Las empresas se conservaron y combinaron.", "success");
  } catch (error) {
    message("vaultMessage", error.message || "No se pudo importar la copia. Comprueba el archivo y su contraseña.", "error");
  }
});

/* IDIOMAS: se conservan las etiquetas básicas originales. */
const languageLabels = {
  es: {
    logoutBtn: "Salir",
    newCompanyBtn: "+ Nueva empresa",
    analyzeBtn: "Analizar texto autorizado",
    saveNoteBtn: "Guardar nota",
    exportNotesBtn: "Exportar copia cifrada",
  },
  en: {
    logoutBtn: "Log out",
    newCompanyBtn: "+ New business",
    analyzeBtn: "Analyze authorized text",
    saveNoteBtn: "Save note",
    exportNotesBtn: "Export encrypted backup",
  },
  pt: {
    logoutBtn: "Sair",
    newCompanyBtn: "+ Nova empresa",
    analyzeBtn: "Analisar texto autorizado",
    saveNoteBtn: "Guardar nota",
    exportNotesBtn: "Exportar cópia cifrada",
  },
};

const originalLabels = {};
for (const id of Object.keys(languageLabels.es)) {
  if ($(id)) originalLabels[id] = $(id).textContent;
}

$("language").addEventListener("change", () => {
  const language = $("language").value;
  const labels = languageLabels[language] || languageLabels.es;
  for (const id of Object.keys(originalLabels)) {
    if ($(id)) $(id).textContent = labels[id] || originalLabels[id];
  }
  document.documentElement.lang = language;
});

loadLocalCompanies();
renderCompanies();
checkSession();
