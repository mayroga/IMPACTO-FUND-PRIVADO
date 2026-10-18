
"use strict";

const $ = id => document.getElementById(id);
const KEYS = {
  profile: "ifp-profile-v5",
  crm: "ifp-crm-v5",
  projects: "ifp-projects-v5",
  parts: "ifp-parts-v5",
  history: "ifp-history-v5",
  searches: "ifp-searches-v5"
};
const MAX_INPUT = 115000;
const MAX_SAVED_SEARCHES = 20;
const state = {
  authenticated: false,
  csrf: "",
  profile: null,
  portals: [],
  opportunities: [],
  filter: "all",
  analysis: "",
  parts: [],
  currentSearch: null,
  editingPart: null
};
const read = (key, fallback = []) => {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return value === null ? fallback : value;
  } catch {
    return fallback;
  }
};
const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    alert("No hay espacio suficiente en este navegador. Descarga una copia de seguridad y elimina datos antiguos.");
    return false;
  }
};
const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[char]);
const makeId = () => globalThis.crypto?.randomUUID
  ? crypto.randomUUID()
  : Date.now().toString(36) + Math.random().toString(36).slice(2);
const lang = () => $("language")?.value || "es";
const msg = (elementId, text, type = "") => {
  const element = $(elementId);
  if (element) {
    element.textContent = text;
    element.className = "message " + type;
  }
};
const translations = {
  en: {
    "Acceso privado": "Private access",
    "Inicia sesión para trabajar con la información de tu negocio.": "Sign in to work with your business information.",
    "Usuario": "Username",
    "Contraseña": "Password",
    "Entrar": "Sign in",
    "Salir": "Sign out",
    "Mi negocio o proyecto": "My business or project",
    "Completa estos datos una sola vez. Puedes editarlos cuando cambien.": "Complete these details once. You can edit them whenever they change.",
    "Nombre del negocio o proyecto *": "Business or project name *",
    "Ubicación": "Location",
    "Tipo de organización": "Organization type",
    "Pequeña empresa": "Small business",
    "Empresa nueva": "Startup",
    "Organización sin fines de lucro": "Nonprofit organization",
    "Persona / empleo": "Individual / employment",
    "Otro tipo": "Other",
    "¿Qué hace tu negocio? *": "What does your business do? *",
    "¿Qué quieres conseguir?": "What do you want to achieve?",
    "Opcional": "Optional",
    "Guardar perfil y buscar oportunidades": "Save profile and find opportunities",
    "Editar perfil": "Edit profile",
    "Oportunidades para mi negocio": "Opportunities for my business",
    "Todas": "All",
    "Subvenciones": "Grants",
    "Contratos": "Contracts",
    "Empleo y recursos": "Jobs and resources",
    "Propuestas, pitch y análisis": "Proposals, pitches and analysis",
    "Crear pitch": "Create pitch",
    "Crear propuesta": "Create proposal",
    "Lista de documentos": "Document checklist",
    "Planificar proyecto": "Plan a project",
    "¿Qué necesitas?": "What do you need?",
    "Explicar la información": "Explain the information",
    "Comparar requisitos con mi negocio": "Compare requirements with my business",
    "Preparar lista de documentos y pasos": "Prepare a document and action checklist",
    "Preparar borrador de propuesta": "Draft a proposal",
    "Preparar pitch empresarial": "Create a business pitch",
    "Analizar códigos NAICS candidatos": "Review possible NAICS codes",
    "Organizar un proyecto": "Organize a project",
    "Analizar información": "Analyze information",
    "Borrar texto del análisis": "Clear analysis text",
    "Preguntas y respuestas": "Questions and answers",
    "¿Qué necesitas aclarar?": "What would you like clarified?",
    "Responder pregunta": "Answer question",
    "Mi CRM y seguimiento": "My saved opportunities and follow-up",
    "Guardar registro": "Save record",
    "Proyectos y fechas límite": "Projects and deadlines",
    "Guardar proyecto": "Save project",
    "Documentos y textos largos": "Documents and long text",
    "Añadir parte": "Add section",
    "Guardar cambios de parte": "Save section changes",
    "Reunir partes en el análisis": "Combine sections for analysis",
    "Borrar todas las partes": "Delete all sections",
    "Historial de análisis": "Analysis history",
    "Privacidad y borrado de datos": "Privacy and data deletion",
    "Crear copia de seguridad": "Create backup",
    "Borrar información": "Delete information",
    "Fuentes oficiales": "Official sources",
    "Abrir sitio": "Open website",
    "Abrir fuente oficial": "Open official source",
    "Entender esta oportunidad": "Understand this opportunity",
    "Guardar en CRM": "Save opportunity",
    "Cierre:": "Deadline:",
    "Códigos NAICS candidatos": "Possible NAICS codes",
    "Consultar NAICS en Census.gov": "Check NAICS on Census.gov",
    "Sin resultados en esta vista": "No results in this view",
    "Aún no hay registros. Guarda oportunidades o añade un contacto manualmente.": "No records yet. Save an opportunity or add a contact.",
    "Aún no hay proyectos registrados.": "No projects saved yet.",
    "Aún no hay análisis guardados.": "No saved analyses yet.",
    "Pendiente": "Pending",
    "En curso": "In progress",
    "Enviado": "Submitted",
    "Ganado": "Won",
    "Descartado": "Discarded",
    "Prioridad": "Priority",
    "Estado": "Status",
    "Fecha límite": "Deadline",
    "Por definir": "Not set",
    "Borrar registro": "Delete record",
    "Borrar proyecto": "Delete project",
    "Borrar parte": "Delete section",
    "Ver respuesta": "View answer",
    "Leer PDF con texto seleccionable": "Read a PDF with selectable text",
    "Guardar una parte": "Save a section",
    "Nombre de la parte": "Section name",
    "Contenido de la parte": "Section content",
    "Idioma / Language": "Language",
    "Acceso privado": "Private access"
  },
  pt: {
    "Acceso privado": "Acesso privado",
    "Inicia sesión para trabajar con la información de tu negocio.": "Inicie sessão para trabalhar com as informações do seu negócio.",
    "Usuario": "Usuário",
    "Contraseña": "Senha",
    "Entrar": "Entrar",
    "Salir": "Sair",
    "Mi negocio o proyecto": "Meu negócio ou projeto",
    "Completa estos datos una sola vez. Puedes editarlos cuando cambien.": "Preencha estes dados uma vez. Você pode editá-los quando mudarem.",
    "Nombre del negocio o proyecto *": "Nome do negócio ou projeto *",
    "Ubicación": "Localização",
    "Tipo de organización": "Tipo de organização",
    "Pequeña empresa": "Pequena empresa",
    "Empresa nueva": "Empresa iniciante",
    "Organización sin fines de lucro": "Organização sem fins lucrativos",
    "Persona / empleo": "Pessoa / emprego",
    "Otro tipo": "Outro tipo",
    "¿Qué hace tu negocio? *": "O que seu negócio faz? *",
    "¿Qué quieres conseguir?": "O que você deseja alcançar?",
    "Opcional": "Opcional",
    "Guardar perfil y buscar oportunidades": "Salvar perfil e buscar oportunidades",
    "Editar perfil": "Editar perfil",
    "Oportunidades para mi negocio": "Oportunidades para meu negócio",
    "Todas": "Todas",
    "Subvenciones": "Subsídios",
    "Contratos": "Contratos",
    "Empleo y recursos": "Empregos e recursos",
    "Propuestas, pitch y análisis": "Propostas, apresentação e análise",
    "Crear pitch": "Criar apresentação",
    "Crear propuesta": "Criar proposta",
    "Lista de documentos": "Lista de documentos",
    "Planificar proyecto": "Planejar projeto",
    "¿Qué necesitas?": "Do que você precisa?",
    "Explicar la información": "Explicar as informações",
    "Comparar requisitos con mi negocio": "Comparar requisitos com meu negócio",
    "Preparar lista de documentos y pasos": "Preparar lista de documentos e etapas",
    "Preparar borrador de propuesta": "Preparar rascunho de proposta",
    "Preparar pitch empresarial": "Preparar apresentação empresarial",
    "Analizar códigos NAICS candidatos": "Analisar possíveis códigos NAICS",
    "Organizar un proyecto": "Organizar um projeto",
    "Analizar información": "Analisar informações",
    "Borrar texto del análisis": "Apagar texto da análise",
    "Preguntas y respuestas": "Perguntas e respostas",
    "¿Qué necesitas aclarar?": "O que você precisa esclarecer?",
    "Responder pregunta": "Responder pergunta",
    "Mi CRM y seguimiento": "Minhas oportunidades e acompanhamento",
    "Guardar registro": "Salvar registro",
    "Proyectos y fechas límite": "Projetos e prazos",
    "Guardar proyecto": "Salvar projeto",
    "Documentos y textos largos": "Documentos e textos longos",
    "Añadir parte": "Adicionar parte",
    "Guardar cambios de parte": "Salvar alterações da parte",
    "Reunir partes en el análisis": "Reunir partes para análise",
    "Borrar todas las partes": "Apagar todas as partes",
    "Historial de análisis": "Histórico de análises",
    "Privacidad y borrado de datos": "Privacidade e exclusão de dados",
    "Crear copia de seguridad": "Criar cópia de segurança",
    "Borrar información": "Apagar informações",
    "Fuentes oficiales": "Fontes oficiais",
    "Abrir sitio": "Abrir site",
    "Abrir fuente oficial": "Abrir fonte oficial",
    "Entender esta oportunidad": "Entender esta oportunidade",
    "Guardar en CRM": "Salvar oportunidade",
    "Códigos NAICS candidatos": "Possíveis códigos NAICS",
    "Consultar NAICS en Census.gov": "Consultar NAICS no Census.gov",
    "Sin resultados en esta vista": "Sem resultados nesta visualização",
    "Pendiente": "Pendente",
    "En curso": "Em andamento",
    "Enviado": "Enviado",
    "Ganado": "Conquistado",
    "Descartado": "Descartado",
    "Prioridad": "Prioridade",
    "Estado": "Status",
    "Fecha límite": "Prazo",
    "Por definir": "A definir",
    "Borrar registro": "Apagar registro",
    "Borrar proyecto": "Apagar projeto",
    "Borrar parte": "Apagar parte",
    "Ver respuesta": "Ver resposta",
    "Leer PDF con texto seleccionable": "Ler PDF com texto selecionável",
    "Guardar una parte": "Salvar uma parte",
    "Nombre de la parte": "Nome da parte",
    "Contenido de la parte": "Conteúdo da parte",
    "Idioma / Language": "Idioma",
    "Acceso privado": "Acesso privado"
  }
};
const originalText = new WeakMap();

function translatePage() {
  const language = lang();
  document.documentElement.lang = language;
  const dictionary = translations[language];
  if (!dictionary) return;

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);

  for (const node of nodes) {
    if (!originalText.has(node)) originalText.set(node, node.nodeValue);
    const original = originalText.get(node);
    const trimmed = original.trim();
    if (dictionary[trimmed]) {
      const leading = original.match(/^\s*/)?.[0] || "";
      const trailing = original.match(/\s*$/)?.[0] || "";
      node.nodeValue = leading + dictionary[trimmed] + trailing;
    } else if (language === "es") {
      node.nodeValue = original;
    }
  }

  document.querySelectorAll("[placeholder]").forEach(element => {
    if (!element.dataset.originalPlaceholder) {
      element.dataset.originalPlaceholder = element.placeholder;
    }
    const original = element.dataset.originalPlaceholder;
    element.placeholder = dictionary[original] || original;
  });
}

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body) headers["Content-Type"] = "application/json";
  if (options.method && options.method.toUpperCase() !== "GET" && path !== "/api/login" && state.csrf) {
    headers["X-CSRF-Token"] = state.csrf;
  }
  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers
  });
  let data;
  try {
    data = await response.json();
  } catch {
    data = { detail: "El servidor devolvió una respuesta que no se pudo leer." };
  }
  if (!response.ok) {
    if (response.status === 401 && path !== "/api/login") auth(false);
    throw new Error(data.detail || "No se pudo completar la operación.");
  }
  if (data.csrf) state.csrf = data.csrf;
  return data;
}

function auth(on) {
  state.authenticated = on;
  $("loginPanel").classList.toggle("hidden", on);
  $("appPanel").classList.toggle("hidden", !on);
  $("logoutBtn").classList.toggle("hidden", !on);
}

async function initializeApp() {
  translatePage();
  try {
    await api("/api/me");
    auth(true);
    await loadWorkspace();
  } catch {
    auth(false);
  }
}

async function loadWorkspace() {
  loadProfile();
  await loadPortals();
  renderCRM();
  renderProjects();
  renderParts();
  renderHistory();
  renderSavedSearches();
}

$("loginForm").addEventListener("submit", async event => {
  event.preventDefault();
  msg("loginMessage", "Verificando acceso...");
  const button = $("loginForm").querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    const data = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({
        username: $("username").value.trim(),
        password: $("password").value
      })
    });
    state.csrf = data.csrf || "";
    $("password").value = "";
    auth(true);
    await loadWorkspace();
    msg("loginMessage", "");
  } catch (error) {
    msg("loginMessage", error.message, "error");
  } finally {
    button.disabled = false;
  }
});

$("logoutBtn").addEventListener("click", async () => {
  try {
    await api("/api/logout", { method: "POST", body: JSON.stringify({}) });
  } catch (error) {
    msg("loginMessage", error.message, "error");
  } finally {
    state.csrf = "";
    auth(false);
  }
});

function profileForm() {
  return {
    id: $("companyId").value || makeId(),
    name: $("companyName").value.trim(),
    location: $("companyLocation").value.trim(),
    type: $("companyType").value,
    description: $("companyDescription").value.trim(),
    goals: $("companyGoals").value.trim(),
    updatedAt: new Date().toISOString()
  };
}

function validProfile(profile) {
  return Boolean(profile && profile.name && profile.description &&
    profile.name.length <= 160 && profile.description.length <= 6000);
}

function loadProfile() {
  const profile = read(KEYS.profile, null);
  if (validProfile(profile)) {
    state.profile = profile;
    fillProfile(profile);
    showProfile();
  } else {
    state.profile = null;
    editProfile();
  }
}

function fillProfile(profile = {}) {
  const fields = {
    id: "companyId",
    name: "companyName",
    location: "companyLocation",
    type: "companyType",
    description: "companyDescription",
    goals: "companyGoals"
  };
  for (const [key, field] of Object.entries(fields)) {
    $(field).value = profile[key] || "";
  }
}

function showProfile() {
  if (!state.profile) return;
  $("profileForm").classList.add("hidden");
  $("savedProfileSummary").classList.remove("hidden");
  $("editProfileBtn").classList.remove("hidden");
  $("savedProfileSummary").innerHTML =
    `<strong>${esc(state.profile.name)}</strong>
    <p>${esc(state.profile.description)}</p>
    <p>${esc(state.profile.location)} · ${esc(state.profile.type)}</p>
    <p>${esc(state.profile.goals)}</p>`;
}

function editProfile() {
  fillProfile(state.profile || {});
  $("profileForm").classList.remove("hidden");
  $("savedProfileSummary").classList.add("hidden");
  $("editProfileBtn").classList.add("hidden");
}

$("editProfileBtn").addEventListener("click", editProfile);

$("profileForm").addEventListener("submit", async event => {
  event.preventDefault();
  const profile = profileForm();
  if (!validProfile(profile)) {
    msg("companyMessage", "Escribe el nombre y explica qué hace tu negocio.", "warning");
    return;
  }
  if (!write(KEYS.profile, profile)) return;
  state.profile = profile;
  showProfile();
  msg("companyMessage", "Perfil guardado en este navegador.", "success");
  await searchOpportunities();
});

function businessText() {
  const profile = state.profile;
  if (!profile) return "Perfil del negocio no proporcionado.";
  return [
    `Nombre: ${profile.name}`,
    `Ubicación: ${profile.location}`,
    `Tipo de organización: ${profile.type}`,
    `Actividad: ${profile.description}`,
    `Objetivo: ${profile.goals}`
  ].join("\n");
}

function setSearchBusy(busy) {
  $("searchProgress").classList.toggle("hidden", !busy);
  $("searchOpportunitiesBtn").disabled = busy;
}

async function searchOpportunities() {
  if (!state.profile) {
    msg("searchMessage", "Completa primero el nombre y la actividad del negocio.", "warning");
    return;
  }
  setSearchBusy(true);
  msg("searchMessage", "Buscando en las fuentes disponibles. Esto puede tardar un poco...");
  try {
    const data = await api("/api/opportunities/search", {
      method: "POST",
      body: JSON.stringify({ profile: state.profile, language: lang(), limit: 10 })
    });
    state.opportunities = Array.isArray(data.opportunities) ? data.opportunities : [];
    state.currentSearch = {
      id: makeId(),
      date: new Date().toISOString(),
      count: state.opportunities.length,
      summary: data.summary || "",
      classification: data.classification || {},
      sources: data.sources || [],
      opportunities: state.opportunities
    };
    saveSearch(state.currentSearch);
    renderResults();
    renderSearchSummary(data);
    renderSources(data.sources || []);
    renderSavedSearches();
    msg(
      "searchMessage",
      state.opportunities.length
        ? `Encontramos ${state.opportunities.length} resultado(s). Revisa los requisitos antes de decidir.`
        : "La búsqueda terminó, pero no devolvió oportunidades. Esto no demuestra que no existan.",
      state.opportunities.length ? "success" : "warning"
    );
  } catch (error) {
    msg("searchMessage", error.message, "error");
    $("searchSummary").classList.remove("hidden");
    $("searchSummary").textContent = "No pudimos completar la búsqueda. Puedes abrir las fuentes oficiales o intentarlo de nuevo.";
  } finally {
    setSearchBusy(false);
  }
}

function saveSearch(search) {
  const searches = read(KEYS.searches, []);
  searches.unshift(search);
  const unique = [];
  const seen = new Set();
  for (const item of searches) {
    const key = item.id || `${item.date}-${item.count}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(item);
    }
  }
  write(KEYS.searches, unique.slice(0, MAX_SAVED_SEARCHES));
}

function renderSearchSummary(data) {
  $("searchSummary").classList.remove("hidden");
  $("searchSummary").innerHTML =
    `<strong>${Number(data.count || 0)} resultado(s)</strong>
    <p>${esc(data.summary || "La clasificación es preliminar.")}</p>
    <p>${esc(data.notice || "Comprueba los requisitos en la fuente oficial.")}</p>`;

  const classification = data.classification || {};
  const codes = classification.naics_candidates || [];
  $("naicsResults").innerHTML =
    `<h3>Códigos NAICS candidatos</h3>
    <p>Son sugerencias preliminares, no una certificación. Comprueba la descripción y el código en la fuente oficial.</p>
    ${codes.length
      ? codes.map(code => `<span class="pill">${esc(code)}</span>`).join(" ")
      : "<p>No se encontró un código candidato fiable. No se inventó ninguno.</p>"}
    <p><a href="https://www.census.gov/naics/" target="_blank" rel="noopener noreferrer">Consultar NAICS en Census.gov</a></p>
    <p>Términos de búsqueda: ${esc((classification.keywords || []).join(", "))}</p>`;
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

function renderResults() {
  const list = $("results");
  const items = state.opportunities.filter(item =>
    state.filter === "all" ||
    item.category === state.filter ||
    (state.filter === "work" && item.category === "work")
  );
  if (!items.length) {
    list.innerHTML = '<div class="empty-state"><h3>Sin resultados en esta vista</h3><p>Prueba otra categoría o consulta una búsqueda guardada.</p></div>';
    return;
  }

  list.innerHTML = items.map((item, index) => {
    const url = safeUrl(item.url);
    const category = item.category === "grant" ? "Subvención" :
      item.category === "contract" ? "Contrato" : "Recurso";
    return `<article class="result-card">
      <h3>${esc(item.title)}</h3>
      <p>${esc(item.agency || item.source || "Fuente no indicada")}</p>
      <p>${esc(item.description || item.match_reason || "Abre la fuente oficial para revisar los detalles.")}</p>
      <div class="result-meta">
        <span class="pill">${category}</span>
        ${item.close_date ? `<span class="pill">Cierre: ${esc(item.close_date)}</span>` : ""}
        ${item.number ? `<span class="pill">${esc(item.number)}</span>` : ""}
      </div>
      <div class="result-actions">
        ${url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Abrir fuente oficial</a>` : ""}
        <button class="button button-secondary" data-understand="${index}" type="button">Entender esta oportunidad</button>
        <button class="button button-light" data-save="${index}" type="button">Guardar oportunidad</button>
      </div>
    </article>`;
  }).join("");

  list.querySelectorAll("[data-understand]").forEach(button => {
    button.addEventListener("click", () => {
      const item = items[Number(button.dataset.understand)];
      $("analysisTask").value = "eligibility";
      $("analysisText").value = [
        "Ayúdame a entender esta oportunidad. Distingue los requisitos confirmados de los que debo verificar.",
        `Título: ${item.title || ""}`,
        `Entidad: ${item.agency || ""}`,
        `Número: ${item.number || ""}`,
        `Estado publicado: ${item.status || "No indicado"}`,
        `Fecha límite publicada: ${item.close_date || "No indicada"}`,
        `Fuente: ${item.url || ""}`,
        `Descripción disponible: ${item.description || ""}`
      ].join("\n");
      $("analysisPanel").scrollIntoView({ behavior: "smooth" });
    });
  });

  list.querySelectorAll("[data-save]").forEach(button => {
    button.addEventListener("click", () => saveCRM(items[Number(button.dataset.save)]));
  });
}

function renderSources(sources) {
  $("sourceStatus").innerHTML = sources.map(source => {
    const statusClass = source.status === "ok" ? "status-ok" : "status-warning";
    return `<p class="${statusClass}"><strong>${esc(source.name)}:</strong> ${esc(source.message)}</p>`;
  }).join("");
}

document.querySelectorAll("[data-filter]").forEach(button => {
  button.addEventListener("click", () => {
    state.filter = button.dataset.filter;
    document.querySelectorAll("[data-filter]").forEach(tab => {
      const active = tab === button;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
    });
    renderResults();
  });
});

function renderSavedSearches() {
  const container = $("historyList");
  if (!container) return;
  const analyses = read(KEYS.history, []);
  const searches = read(KEYS.searches, []);
  const combined = [
    ...searches.map(item => ({ ...item, kind: "search" })),
    ...analyses.map(item => ({ ...item, kind: "analysis" }))
  ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 20);

  container.innerHTML = combined.length ? combined.map(item => {
    if (item.kind === "search") {
      return `<article class="record-card">
        <strong>Búsqueda guardada · ${esc(new Date(item.date).toLocaleString())}</strong>
        <p>${Number(item.count || 0)} resultado(s)</p>
        <p>${esc(item.summary || "Búsqueda de oportunidades")}</p>
        <button class="button button-light" data-loadsearch="${esc(item.id)}" type="button">Volver a ver resultados</button>
      </article>`;
    }
    return `<article class="record-card">
      <strong>Análisis · ${esc(item.task || "")} · ${esc(new Date(item.date).toLocaleString())}</strong>
      <p>${esc((item.input || "").slice(0, 180))}</p>
      <button class="button button-light" data-history="${esc(item.id)}" type="button">Ver respuesta</button>
    </article>`;
  }).join("") : "<p>Aún no hay búsquedas ni análisis guardados.</p>";

  container.querySelectorAll("[data-loadsearch]").forEach(button => {
    button.addEventListener("click", () => {
      const saved = read(KEYS.searches, []).find(item => item.id === button.dataset.loadsearch);
      if (!saved) return;
      state.currentSearch = saved;
      state.opportunities = saved.opportunities || [];
      state.filter = "all";
      document.querySelectorAll("[data-filter]").forEach(tab => {
        const active = tab.dataset.filter === "all";
        tab.classList.toggle("active", active);
        tab.setAttribute("aria-selected", active ? "true" : "false");
      });
      renderResults();
      renderSearchSummary({
        count: saved.count,
        summary: saved.summary,
        classification: saved.classification,
        notice: "Estos son resultados guardados. Comprueba de nuevo las fechas y condiciones en el portal oficial."
      });
      renderSources(saved.sources || []);
      $("opportunitiesPanel").scrollIntoView({ behavior: "smooth" });
    });
  });

  container.querySelectorAll("[data-history]").forEach(button => {
    button.addEventListener("click", () => {
      const saved = read(KEYS.history, []).find(item => item.id === button.dataset.history);
      if (!saved) return;
      state.analysis = saved.answer || "";
      $("analysisOutput").textContent = state.analysis;
      $("analysisProvider").textContent = "Análisis guardado localmente. Comprueba que la información siga vigente.";
      $("analysisResult").classList.remove("hidden");
      $("analysisPanel").scrollIntoView({ behavior: "smooth" });
    });
  });
}

async function loadPortals() {
  try {
    const data = await api("/api/portals");
    state.portals = data.portals || [];
    $("portalLinks").innerHTML = state.portals.map(portal => {
      const url = safeUrl(portal.url);
      return `<article class="link-card">
        <strong>${esc(portal.name)}</strong>
        <p>${esc(portal.description)}</p>
        ${url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Abrir sitio</a>` : ""}
      </article>`;
    }).join("");
  } catch (error) {
    $("portalLinks").textContent = error.message;
  }
}

$("analyzeBtn").addEventListener("click", runAnalysis);

async function runAnalysis() {
  const text = $("analysisText").value.trim();
  if (text.length < 3) {
    msg("analysisMessage", "Escribe o incorpora el texto que quieres entender.", "warning");
    return;
  }
  if (!$("aiConsent").checked) {
    msg("analysisMessage", "Autoriza el envío al proveedor de IA antes de continuar.", "warning");
    return;
  }
  const button = $("analyzeBtn");
  button.disabled = true;
  msg("analysisMessage", "Analizando la información. Espera a que termine...");
  try {
    const data = await api("/api/ai/analyze", {
      method: "POST",
      body: JSON.stringify({
        text,
        business: businessText(),
        task: $("analysisTask").value,
        language: lang()
      })
    });
    state.analysis = data.answer || "";
    $("analysisOutput").textContent = state.analysis;
    $("analysisProvider").textContent =
      `Proveedor: ${data.provider || "No indicado"}. Verifica los datos importantes antes de actuar.`;
    $("analysisResult").classList.remove("hidden");
    msg("analysisMessage", "Análisis terminado. Revísalo antes de utilizarlo.", "success");
    saveHistory($("analysisTask").value, text, state.analysis);
  } catch (error) {
    msg("analysisMessage", error.message, "error");
  } finally {
    button.disabled = false;
  }
}

$("copyAnalysisBtn").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(state.analysis);
    msg("analysisMessage", "Resultado copiado.", "success");
  } catch {
    msg("analysisMessage", "No se pudo copiar automáticamente. Selecciona el resultado y cópialo.");
  }
});

$("askBtn").addEventListener("click", async () => {
  const question = $("questionText").value.trim();
  if (question.length < 2) {
    msg("questionMessage", "Escribe la pregunta que quieres aclarar.", "warning");
    return;
  }
  if (!$("questionConsent").checked) {
    msg("questionMessage", "Autoriza el envío de la pregunta y del perfil al proveedor de IA.", "warning");
    return;
  }
  const button = $("askBtn");
  button.disabled = true;
  msg("questionMessage", "Preparando la respuesta...");
  try {
    const data = await api("/api/ai/ask", {
      method: "POST",
      body: JSON.stringify({
        text: question,
        business: businessText(),
        task: "ask",
        language: lang()
      })
    });
    $("questionAnswer").textContent = data.answer || "";
    $("questionResult").classList.remove("hidden");
    msg("questionMessage", `Respuesta generada con ${data.provider || "IA"}. Verifica los datos críticos.`, "success");
    saveHistory("ask", question, data.answer || "");
  } catch (error) {
    msg("questionMessage", error.message, "error");
  } finally {
    button.disabled = false;
  }
});

$("makePitchBtn").addEventListener("click", () => {
  $("analysisTask").value = "pitch";
  $("analysisText").value = `Prepara un pitch empresarial con el perfil siguiente. No inventes información y señala lo que falta.\n${businessText()}`;
  $("analysisPanel").scrollIntoView({ behavior: "smooth" });
});

$("makeProposalBtn").addEventListener("click", () => {
  $("analysisTask").value = "proposal";
  $("analysisText").value = `Prepara un borrador editable basado en esta información. Marca los datos ausentes como [POR COMPLETAR].\n${businessText()}\n\nConvocatoria y requisitos:\n`;
  $("analysisPanel").scrollIntoView({ behavior: "smooth" });
  $("analysisText").focus();
});

$("makeChecklistBtn").addEventListener("click", () => {
  $("analysisTask").value = "checklist";
  $("analysisText").value = "";
  $("analysisPanel").scrollIntoView({ behavior: "smooth" });
  $("analysisText").focus();
  msg("analysisMessage", "Pega los requisitos o la convocatoria para preparar una lista adaptada.");
});

$("projectPlanBtn").addEventListener("click", () => {
  $("analysisTask").value = "project";
  const parts = read(KEYS.parts, []);
  $("analysisText").value = `Organiza este material en tareas priorizadas. No inventes fechas ni responsables.\n${businessText()}\n\nMaterial del proyecto:\n${parts.map(part => `${part.title}\n${part.content}`).join("\n\n")}`;
  $("analysisPanel").scrollIntoView({ behavior: "smooth" });
});

function saveHistory(task, input, answer) {
  const history = read(KEYS.history, []);
  history.unshift({
    id: makeId(),
    date: new Date().toISOString(),
    task,
    input: String(input || "").slice(0, 5000),
    answer: String(answer || "").slice(0, 12000)
  });
  write(KEYS.history, history.slice(0, 100));
  renderSavedSearches();
}

function saveCRM(item) {
  const entries = read(KEYS.crm, []);
  const url = safeUrl(item.url);
  const duplicate = entries.some(entry =>
    (item.number && entry.number === item.number) ||
    (url && entry.url === url && entry.title === item.title)
  );
  if (duplicate) {
    msg("crmMessage", "Esta oportunidad ya está guardada.", "warning");
    $("crmPanel").scrollIntoView({ behavior: "smooth" });
    return;
  }
  entries.unshift({
    id: makeId(),
    date: new Date().toISOString(),
    title: item.title || "Oportunidad",
    agency: item.agency || item.source || "",
    number: item.number || "",
    status: "Pendiente",
    notes: "",
    url,
    type: item.category || "opportunity"
  });
  if (write(KEYS.crm, entries)) {
    renderCRM();
    msg("crmMessage", "Oportunidad guardada. Puedes añadir notas y cambiar su estado.", "success");
  }
}

$("crmForm").addEventListener("submit", event => {
  event.preventDefault();
  const title = $("crmTitle").value.trim();
  if (!title) return;
  const entries = read(KEYS.crm, []);
  entries.unshift({
    id: makeId(),
    date: new Date().toISOString(),
    title,
    agency: $("crmAgency").value.trim(),
    status: $("crmStatus").value,
    notes: $("crmNotes").value.trim(),
    url: safeUrl($("crmUrl").value),
    type: "contact"
  });
  if (write(KEYS.crm, entries)) {
    $("crmForm").reset();
    renderCRM();
    msg("crmMessage", "Registro guardado en este navegador.", "success");
  }
});

function renderCRM() {
  const entries = read(KEYS.crm, []);
  $("crmList").innerHTML = entries.length ? entries.map(entry => `
    <article class="record-card">
      <strong>${esc(entry.title)}</strong>
      <p>${esc(entry.agency)} · ${esc(entry.status)} · ${esc(new Date(entry.date).toLocaleDateString())}</p>
      ${entry.number ? `<p>Referencia: ${esc(entry.number)}</p>` : ""}
      ${entry.notes ? `<p>${esc(entry.notes)}</p>` : ""}
      ${safeUrl(entry.url) ? `<p><a href="${esc(safeUrl(entry.url))}" target="_blank" rel="noopener noreferrer">Abrir enlace</a></p>` : ""}
      <div class="button-row">
        <select data-status="${esc(entry.id)}" aria-label="Estado de ${esc(entry.title)}">
          <option ${entry.status === "Pendiente" ? "selected" : ""}>Pendiente</option>
          <option ${entry.status === "En curso" ? "selected" : ""}>En curso</option>
          <option ${entry.status === "Enviado" ? "selected" : ""}>Enviado</option>
          <option ${entry.status === "Ganado" ? "selected" : ""}>Ganado</option>
          <option ${entry.status === "Descartado" ? "selected" : ""}>Descartado</option>
        </select>
        <button class="button button-danger" data-delcrm="${esc(entry.id)}" type="button">Borrar registro</button>
      </div>
    </article>`).join("") : "<p>Aún no hay registros. Guarda una oportunidad o añade un contacto.</p>";

  $("crmList").querySelectorAll("[data-status]").forEach(select => {
    select.addEventListener("change", () => {
      const records = read(KEYS.crm, []);
      const entry = records.find(item => item.id === select.dataset.status);
      if (entry) {
        entry.status = select.value;
        write(KEYS.crm, records);
        renderCRM();
      }
    });
  });

  $("crmList").querySelectorAll("[data-delcrm]").forEach(button => {
    button.addEventListener("click", () => {
      if (!confirm("¿Borrar este registro?")) return;
      write(KEYS.crm, read(KEYS.crm, []).filter(item => item.id !== button.dataset.delcrm));
      renderCRM();
    });
  });
}

$("projectForm").addEventListener("submit", event => {
  event.preventDefault();
  const title = $("projectTitle").value.trim();
  if (!title) return;
  const projects = read(KEYS.projects, []);
  projects.unshift({
    id: makeId(),
    title,
    description: $("projectDescription").value.trim(),
    deadline: $("projectDeadline").value,
    priority: $("projectPriority").value,
    status: "Pendiente",
    createdAt: new Date().toISOString()
  });
  if (write(KEYS.projects, projects)) {
    $("projectForm").reset();
    renderProjects();
    msg("projectMessage", "Proyecto guardado localmente.", "success");
  }
});

function renderProjects() {
  const projects = read(KEYS.projects, []);
  const rank = { Alta: 0, Media: 1, Baja: 2 };
  projects.sort((a, b) =>
    (rank[a.priority] ?? 1) - (rank[b.priority] ?? 1) ||
    (a.deadline || "9999").localeCompare(b.deadline || "9999")
  );
  $("projectList").innerHTML = projects.length ? projects.map(project => `
    <article class="record-card">
      <strong>${esc(project.title)}</strong>
      <p>Prioridad: ${esc(project.priority)} · Estado: ${esc(project.status)} · Fecha límite: ${esc(project.deadline || "Por definir")}</p>
      <p>${esc(project.description)}</p>
      <div class="button-row">
        <select data-projectstatus="${esc(project.id)}" aria-label="Estado de ${esc(project.title)}">
          <option ${project.status === "Pendiente" ? "selected" : ""}>Pendiente</option>
          <option ${project.status === "En curso" ? "selected" : ""}>En curso</option>
          <option ${project.status === "Bloqueado" ? "selected" : ""}>Bloqueado</option>
          <option ${project.status === "Completado" ? "selected" : ""}>Completado</option>
        </select>
        <button class="button button-danger" data-delproject="${esc(project.id)}" type="button">Borrar proyecto</button>
      </div>
    </article>`).join("") : "<p>Aún no hay proyectos registrados.</p>";

  $("projectList").querySelectorAll("[data-projectstatus]").forEach(select => {
    select.addEventListener("change", () => {
      const list = read(KEYS.projects, []);
      const project = list.find(item => item.id === select.dataset.projectstatus);
      if (project) {
        project.status = select.value;
        write(KEYS.projects, list);
        renderProjects();
      }
    });
  });

  $("projectList").querySelectorAll("[data-delproject]").forEach(button => {
    button.addEventListener("click", () => {
      if (!confirm("¿Borrar este proyecto?")) return;
      write(KEYS.projects, read(KEYS.projects, []).filter(item => item.id !== button.dataset.delproject));
      renderProjects();
    });
  });
}

function resetPartEditor() {
  state.editingPart = null;
  $("partTitle").value = "";
  $("partText").value = "";
  $("addPartBtn").textContent = "Añadir parte";
  $("addPartBtn").classList.remove("hidden");
  $("updatePartBtn").classList.add("hidden");
  delete $("updatePartBtn").dataset.editid;
}

$("addPartBtn").addEventListener("click", () => {
  if (state.editingPart) {
    msg("partsMessage", "Estás editando una parte. Pulsa «Guardar cambios de parte» o cancela la edición.", "warning");
    return;
  }
  const content = $("partText").value.trim();
  if (!content) {
    msg("partsMessage", "Pega o escribe el contenido de esta parte.", "warning");
    return;
  }
  const parts = read(KEYS.parts, []);
  if (parts.length >= 10) {
    msg("partsMessage", "Ya tienes 10 partes. Edita una o elimina una antes de añadir otra.", "warning");
    return;
  }
  parts.push({
    id: makeId(),
    title: $("partTitle").value.trim() || `Parte ${parts.length + 1}`,
    content,
    updatedAt: new Date().toISOString()
  });
  if (write(KEYS.parts, parts)) {
    resetPartEditor();
    renderParts();
    msg("partsMessage", `Parte guardada. Total: ${parts.length} de 10.`, "success");
  }
});

function renderParts() {
  state.parts = read(KEYS.parts, []);
  $("partsList").innerHTML = state.parts.length ? state.parts.map((part, index) => `
    <article class="record-card">
      <strong>${index + 1}. ${esc(part.title)}</strong>
      <p>${part.content.length.toLocaleString()} caracteres</p>
      <div class="button-row">
        <button class="button button-light" data-editpart="${esc(part.id)}" type="button">Editar</button>
        <button class="button button-danger" data-delpart="${esc(part.id)}" type="button">Borrar parte</button>
      </div>
    </article>`).join("") : "<p>No hay partes guardadas en este navegador.</p>";

  $("partsList").querySelectorAll("[data-editpart]").forEach(button => {
    button.addEventListener("click", () => {
      const part = state.parts.find(item => item.id === button.dataset.editpart);
      if (!part) return;
      state.editingPart = part.id;
      $("partTitle").value = part.title;
      $("partText").value = part.content;
      $("addPartBtn").classList.add("hidden");
      $("updatePartBtn").classList.remove("hidden");
      $("updatePartBtn").dataset.editid = part.id;
      $("partText").focus();
      msg("partsMessage", "Edita el contenido y pulsa «Guardar cambios de parte».");
    });
  });

  $("partsList").querySelectorAll("[data-delpart]").forEach(button => {
    button.addEventListener("click", () => {
      if (!confirm("¿Borrar esta parte?")) return;
      const remaining = state.parts.filter(item => item.id !== button.dataset.delpart);
      if (write(KEYS.parts, remaining)) {
        if (state.editingPart === button.dataset.delpart) resetPartEditor();
        renderParts();
      }
    });
  });

  $("partsCount").textContent =
    `${state.parts.length} de 10 partes guardadas · ${state.parts.reduce((sum, part) => sum + part.content.length, 0).toLocaleString()} caracteres`;
  $("addPartBtn").disabled = state.parts.length >= 10 && !state.editingPart;
}

$("updatePartBtn").addEventListener("click", () => {
  const partId = $("updatePartBtn").dataset.editid;
  const content = $("partText").value.trim();
  if (!partId || !content) {
    msg("partsMessage", "La parte necesita contenido antes de guardarse.", "warning");
    return;
  }
  const parts = read(KEYS.parts, []);
  const part = parts.find(item => item.id === partId);
  if (!part) {
    msg("partsMessage", "No encontramos esa parte. Actualiza la lista e inténtalo de nuevo.", "error");
    resetPartEditor();
    return;
  }
  part.title = $("partTitle").value.trim() || part.title;
  part.content = content;
  part.updatedAt = new Date().toISOString();
  if (write(KEYS.parts, parts)) {
    resetPartEditor();
    renderParts();
    msg("partsMessage", "Parte actualizada.", "success");
  }
});

$("combinePartsBtn").addEventListener("click", () => {
  const parts = read(KEYS.parts, []);
  if (!parts.length) {
    msg("partsMessage", "Añade al menos una parte antes de reunirlas.", "warning");
    return;
  }
  const combined = parts.map((part, index) =>
    `===== ${part.title || `Parte ${index + 1}`} =====\n${part.content}`
  ).join("\n\n");
  if (combined.length > MAX_INPUT) {
    msg("partsMessage", "El texto combinado supera el límite. Analiza las partes en grupos más pequeños.", "warning");
    return;
  }
  $("analysisText").value = combined;
  $("analysisPanel").scrollIntoView({ behavior: "smooth" });
  msg("partsMessage", "Partes reunidas en el análisis. Las originales siguen guardadas.", "success");
});

$("clearPartsBtn").addEventListener("click", () => {
  if (!confirm("¿Borrar todas las partes guardadas en este navegador?")) return;
  localStorage.removeItem(KEYS.parts);
  resetPartEditor();
  renderParts();
  msg("partsMessage", "Partes borradas.", "success");
});

$("pdfInput").addEventListener("change", async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  if (file.type !== "application/pdf") {
    msg("pdfMessage", "Selecciona un archivo PDF.", "error");
    event.target.value = "";
    return;
  }
  if (file.size > 25 * 1024 * 1024) {
    msg("pdfMessage", "El PDF supera 25 MB. Usa una versión más pequeña.", "error");
    event.target.value = "";
    return;
  }
  if (!window.pdfjsLib) {
    msg("pdfMessage", "No se cargó el lector PDF. Comprueba tu conexión e inténtalo de nuevo.", "error");
    event.target.value = "";
    return;
  }

  msg("pdfMessage", "Leyendo el texto del PDF...");
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    let text = "";
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      text += `\n\n--- Página ${pageNumber} ---\n` +
        content.items.map(item => item.str || "").join(" ");
      if (text.length > MAX_INPUT) break;
    }
    if (!text.trim()) {
      throw new Error("No encontramos texto seleccionable. Puede ser un PDF escaneado como imagen.");
    }
    $("analysisText").value = text.slice(0, MAX_INPUT);
    $("analysisPanel").scrollIntoView({ behavior: "smooth" });
    msg("pdfMessage", `Texto extraído de ${pdf.numPages} página(s). Comprueba que esté completo antes de analizarlo.`, "success");
  } catch (error) {
    msg("pdfMessage", error.message || "No se pudo leer el PDF.", "error");
  } finally {
    event.target.value = "";
  }
});

$("clearPdfBtn").addEventListener("click", () => {
  $("pdfInput").value = "";
  msg("pdfMessage", "Se limpió la selección del archivo. Para quitar el texto extraído, pulsa «Borrar texto del análisis».");
});

$("removeAnalysisTextBtn").addEventListener("click", () => {
  $("analysisText").value = "";
  msg("analysisMessage", "Se borró el texto del área de análisis.");
});

$("exportDataBtn").addEventListener("click", () => {
  const data = {
    exportedAt: new Date().toISOString(),
    profile: read(KEYS.profile, null),
    crm: read(KEYS.crm, []),
    projects: read(KEYS.projects, []),
    parts: read(KEYS.parts, []),
    history: read(KEYS.history, []),
    searches: read(KEYS.searches, [])
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "impacto-fund-privado-backup.json";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  msg("deleteMessage", "Copia de seguridad descargada en tu dispositivo.", "success");
});

$("deleteDataBtn").addEventListener("click", () => {
  const mode = $("deleteMode").value;
  const labels = {
    work: "registros, proyectos, partes, búsquedas y análisis guardados",
    all: "todos los datos locales de esta aplicación, incluido el perfil"
  };
  if (!confirm(`¿Confirmas que quieres borrar ${labels[mode]} de este navegador? Esta acción no se puede deshacer.`)) return;

  const keysToDelete = mode === "all"
    ? Object.values(KEYS)
    : [KEYS.crm, KEYS.projects, KEYS.parts, KEYS.history, KEYS.searches];

  keysToDelete.forEach(key => localStorage.removeItem(key));

  if (mode === "all") {
    state.profile = null;
    state.opportunities = [];
    state.currentSearch = null;
    state.analysis = "";
    editProfile();
    $("results").innerHTML = "";
    $("naicsResults").innerHTML = "";
    $("sourceStatus").innerHTML = "";
    $("searchSummary").classList.add("hidden");
    $("analysisText").value = "";
    $("questionText").value = "";
    $("questionAnswer").textContent = "";
    $("questionResult").classList.add("hidden");
  }

  renderCRM();
  renderProjects();
  renderParts();
  renderSavedSearches();
  msg("deleteMessage", mode === "all"
    ? "Se borraron los datos locales de esta aplicación en este navegador."
    : "Se borraron los datos de trabajo seleccionados.", "success");
});

$("language").addEventListener("change", translatePage);
initializeApp();
