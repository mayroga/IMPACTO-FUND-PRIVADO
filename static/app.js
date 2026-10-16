
"use strict";

const $=id=>document.getElementById(id);
const state={authenticated:false,csrf:"",profile:null,portals:[],opportunities:[],filter:"all",currentAnalysis:null,searching:false};
const PROFILE_KEY="impacto-fund-privado-profile-v2";

function message(id,text="",type=""){
  const el=$(id);if(!el)return;
  el.textContent=text;el.className="message"+(type?" "+type:"");
}
function safeExternalUrl(value){
  try{const u=new URL(value);return u.protocol==="https:"&&!u.username&&!u.password?u.href:""}catch{return ""}
}
function makeId(){
  return crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2);
}
async function api(path,options={}){
  const headers={...(options.headers||{})};
  if(options.body&&!(options.body instanceof FormData))headers["Content-Type"]="application/json";
  const response=await fetch(path,{credentials:"same-origin",...options,headers});
  const ct=response.headers.get("content-type")||"";
  const result=ct.includes("application/json")?await response.json():await response.text();
  if(!response.ok){
    const detail=typeof result==="object"&&result?result.detail||"No se pudo completar la solicitud.":"No se pudo completar la solicitud.";
    throw new Error(detail);
  }
  return result;
}
function setAuthenticated(value){
  state.authenticated=value;
  $("loginPanel").classList.toggle("hidden",value);
  $("appPanel").classList.toggle("hidden",!value);
  $("logoutBtn").classList.toggle("hidden",!value);
}
async function checkSession(){
  try{
    const result=await api("/api/me");
    state.csrf=result.csrf||"";
    setAuthenticated(true);
    loadProfile();
    await loadPortals();
  }catch{setAuthenticated(false)}
}
$("loginForm").addEventListener("submit",async e=>{
  e.preventDefault();message("loginMessage","Verificando acceso...");
  try{
    const result=await api("/api/login",{method:"POST",body:JSON.stringify({username:$("username").value.trim(),password:$("password").value})});
    state.csrf=result.csrf||"";$("password").value="";
    setAuthenticated(true);message("loginMessage","");
    loadProfile();await loadPortals();
  }catch(error){message("loginMessage",error.message,"error")}
});
$("logoutBtn").addEventListener("click",async()=>{
  try{await api("/api/logout",{method:"POST"})}catch{}
  setAuthenticated(false);message("loginMessage","Has cerrado la sesión.");
});
function readProfileForm(){
  return{
    id:$("companyId").value||makeId(),
    name:$("companyName").value.trim(),
    location:$("companyLocation").value.trim(),
    type:$("companyType").value,
    description:$("companyDescription").value.trim(),
    goals:$("companyGoals").value.trim(),
    updatedAt:new Date().toISOString()
  };
}
function profileIsValid(p){
  return Boolean(p&&p.name&&p.description&&p.name.length<=160&&p.description.length<=6000);
}
function saveProfileLocal(profile){
  try{localStorage.setItem(PROFILE_KEY,JSON.stringify(profile));return true}
  catch{return false}
}
function loadProfile(){
  try{
    const saved=JSON.parse(localStorage.getItem(PROFILE_KEY)||"null");
    if(saved&&profileIsValid(saved)){state.profile=saved;showProfileSummary();return}
  }catch{}
  state.profile=null;
  $("profileForm").classList.remove("hidden");
  $("savedProfileSummary").classList.add("hidden");
  $("editProfileBtn").classList.add("hidden");
}
function fillProfileForm(p={}){
  $("companyId").value=p.id||"";
  $("companyName").value=p.name||"";
  $("companyLocation").value=p.location||"";
  $("companyType").value=p.type||"small_business";
  $("companyDescription").value=p.description||"";
  $("companyGoals").value=p.goals||"";
}
function showProfileSummary(){
  const p=state.profile;if(!p)return;
  $("profileForm").classList.add("hidden");
  $("savedProfileSummary").classList.remove("hidden");
  $("editProfileBtn").classList.remove("hidden");
  const summary=$("savedProfileSummary");summary.replaceChildren();
  const heading=document.createElement("strong");heading.textContent=p.name;
  const description=document.createElement("p");description.textContent=p.description;
  const details=document.createElement("p");
  details.textContent=[p.location,p.type==="nonprofit"?"Organización sin fines de lucro":p.type==="startup"?"Empresa nueva":p.type==="individual"?"Persona / empleo":p.type==="small_business"?"Pequeña empresa":"Otro tipo de organización"].filter(Boolean).join(" · ");
  summary.append(heading,description,details);
}
$("profileForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const profile=readProfileForm();
  if(!profile.name||!profile.description){
    message("companyMessage","Escribe el nombre y describe la actividad de tu negocio.","error");return;
  }
  state.profile=profile;
  if(!saveProfileLocal(profile)){
    message("companyMessage","No se pudo guardar el perfil en este navegador. Comprueba el espacio disponible o la configuración de privacidad.","error");return;
  }
  showProfileSummary();
  message("companyMessage","Perfil guardado. Puedes actualizarlo cuando quieras.","success");
  await searchOpportunities();
});
$("editProfileBtn").addEventListener("click",()=>{
  fillProfileForm(state.profile||{});
  $("profileForm").classList.remove("hidden");
  $("savedProfileSummary").classList.add("hidden");
  $("editProfileBtn").classList.add("hidden");
  $("companyName").focus();
});
function setSearching(value){
  state.searching=value;
  $("searchOpportunitiesBtn").disabled=value;
  $("searchOpportunitiesBtn").textContent=value?"Buscando oportunidades...":"Encontrar oportunidades para mi negocio";
  $("searchProgress").classList.toggle("hidden",!value);
}
$("profileForm").addEventListener("submit",e=>{
  // La búsqueda se inicia tras guardar; el evento principal de guardado ya valida los datos.
});
async function searchOpportunities(){
  if(!state.profile||!profileIsValid(state.profile)){
    message("companyMessage","Completa primero los datos de tu negocio.","error");return;
  }
  if(state.searching)return;
  setSearching(true);$("results").innerHTML="";
  $("searchSummary").classList.add("hidden");
  $("sourceStatus").replaceChildren();
  message("searchMessage","Preparando búsquedas a partir de tu perfil...");
  try{
    const data=await api("/api/opportunities/search",{
      method:"POST",
      body:JSON.stringify({profile:state.profile,language:$("language").value,limit:10})
    });
    state.opportunities=Array.isArray(data.opportunities)?data.opportunities:[];
    renderSearchSummary(data);
    renderSourceStatus(data.sources||[]);
    renderFilteredResults();
    if(!state.opportunities.length){
      message("searchMessage","No se encontraron resultados en las fuentes consultadas. Puedes cambiar la descripción del negocio o revisar las fuentes oficiales.","warning");
    }else{
      message("searchMessage",`${state.opportunities.length} resultado(s) encontrados. Revisa los requisitos y confirma la información en cada fuente oficial.`,"success");
    }
  }catch(error){
    state.opportunities=[];
    renderFilteredResults();
    message("searchMessage",error.message,"error");
  }finally{setSearching(false)}
}
function renderSearchSummary(data){
  const box=$("searchSummary");box.replaceChildren();
  const title=document.createElement("strong");
  title.textContent=`Búsqueda para ${state.profile.name}`;
  const info=document.createElement("p");
  info.textContent=data.summary||"Se consultaron las fuentes disponibles con términos relacionados con tu negocio.";
  box.append(title,info);box.classList.remove("hidden");
}
function renderSourceStatus(sources){
  const container=$("sourceStatus");container.replaceChildren();
  for(const source of sources){
    const line=document.createElement("p");
    const ok=source.status==="ok";
    line.className=ok?"status-ok":"status-warning";
    line.textContent=`${source.name||"Fuente"}: ${source.message|| (ok?"Consulta completada.":"Consulta no disponible.")}`;
    container.appendChild(line);
  }
}
function renderFilteredResults(){
  const items=state.filter==="all"?state.opportunities:state.opportunities.filter(x=>x.category===state.filter);
  renderOpportunityResults(items);
}
function renderOpportunityResults(items){
  const container=$("results");container.replaceChildren();
  if(!items.length){
    const empty=document.createElement("div");empty.className="empty-state";
    const heading=document.createElement("h3");heading.textContent=state.filter==="all"?"No hay resultados para mostrar":"No hay resultados en esta categoría";
    const text=document.createElement("p");text.textContent="Prueba de nuevo más tarde, revisa tu perfil o consulta directamente los portales oficiales.";
    empty.append(heading,text);container.appendChild(empty);return;
  }
  for(const item of items){
    const card=document.createElement("article");card.className="result-card";
    const title=document.createElement("h3");title.textContent=item.title||"Oportunidad sin título";
    const match=document.createElement("p");match.className="match-label";
    match.textContent=item.match_reason||"Revisa los detalles para comprobar si esta oportunidad encaja con tu negocio.";
    const details=document.createElement("p");
    details.textContent=[
      item.agency?`Entidad: ${item.agency}`:"",
      item.number?`Referencia: ${item.number}`:"",
      item.status?`Estado publicado: ${item.status}`:"",
      item.close_date?`Fecha límite indicada: ${item.close_date}`:""
    ].filter(Boolean).join(" · ")||"Consulta la ficha oficial para ver los detalles.";
    const meta=document.createElement("div");meta.className="result-meta";
    const category=document.createElement("span");category.className="pill";
    category.textContent=item.category==="grant"?"Subvención":item.category==="contract"?"Contrato":"Recurso";
    meta.appendChild(category);
    if(item.source){const src=document.createElement("span");src.className="pill";src.textContent=item.source;meta.appendChild(src)}
    const actions=document.createElement("div");actions.className="result-actions";
    const link=document.createElement("a");const url=safeExternalUrl(item.url);
    if(url){link.href=url;link.target="_blank";link.rel="noopener noreferrer";link.textContent="Consultar fuente oficial"}
    else{link.href="https://www.grants.gov/";link.target="_blank";link.rel="noopener noreferrer";link.textContent="Consultar portal oficial"}
    const analyze=document.createElement("button");analyze.type="button";analyze.className="button button-secondary";analyze.textContent="Entender esta oportunidad";
    analyze.addEventListener("click",()=>{
      const text=[item.title,item.agency?`Entidad: ${item.agency}`:"",item.number?`Referencia: ${item.number}`:"",item.status?`Estado: ${item.status}`:"",item.close_date?`Fecha límite: ${item.close_date}`:"",item.url?`Enlace: ${item.url}`:"",item.description||""].filter(Boolean).join("\n");
      $("analysisText").value=text;
      $("analysisTask").value="eligibility";
      $("analysisPanel").scrollIntoView({behavior:"smooth",block:"start"});
    });
    actions.append(link,analyze);card.append(title,match,details,meta,actions);
    container.appendChild(card);
  }
}
document.querySelectorAll("[data-filter]").forEach(button=>{
  button.addEventListener("click",()=>{
    state.filter=button.dataset.filter;
    document.querySelectorAll("[data-filter]").forEach(tab=>{
      const active=tab===button;tab.classList.toggle("active",active);tab.setAttribute("aria-selected",String(active));
    });
    if(state.filter==="work"){renderPortalResults();return}
    renderFilteredResults();
  });
});
function renderPortalResults(){
  const container=$("results");container.replaceChildren();
  const portals=state.portals.filter(p=>["Empleo","Empleo federal","Apoyo empresarial"].includes(p.type));
  if(!portals.length){
    const empty=document.createElement("div");empty.className="empty-state";empty.textContent="Los portales de empleo y recursos no están disponibles en este momento.";container.appendChild(empty);return;
  }
  for(const portal of portals){
    const card=document.createElement("article");card.className="result-card";
    const title=document.createElement("h3");title.textContent=portal.name;
    const description=document.createElement("p");description.textContent=portal.description||"Portal oficial de recursos.";
    const link=document.createElement("a");link.href=safeExternalUrl(portal.url)||"https://www.usa.gov/";link.target="_blank";link.rel="noopener noreferrer";link.textContent="Abrir portal";
    card.append(title,description,link);container.appendChild(card);
  }
}
async function loadPortals(){
  try{
    const data=await api("/api/portals");state.portals=data.portals||[];
    renderPortalList($("portalLinks"),state.portals);
  }catch(error){message("searchMessage",error.message,"error")}
}
function renderPortalList(container,portals){
  container.replaceChildren();
  for(const portal of portals){
    const card=document.createElement("article");card.className="link-card";
    const title=document.createElement("h3");title.textContent=portal.name||"Portal oficial";
    const desc=document.createElement("p");desc.textContent=portal.description||"Consulta la fuente oficial.";
    const link=document.createElement("a");link.href=safeExternalUrl(portal.url)||"https://www.usa.gov/";link.target="_blank";link.rel="noopener noreferrer";link.textContent="Abrir portal oficial";
    card.append(title,desc,link);container.appendChild(card);
  }
}
$("analyzeBtn").addEventListener("click",async()=>{
  const text=$("analysisText").value.trim();
  if(text.length<20){message("analysisMessage","Pega al menos 20 caracteres de la oportunidad.","error");return}
  if(!$("aiConsent").checked){message("analysisMessage","Marca la autorización para enviar el texto al servicio de IA.","error");return}
  const button=$("analyzeBtn");button.disabled=true;button.textContent="Analizando...";
  $("analysisResult").classList.add("hidden");
  message("analysisMessage","Analizando el texto autorizado...");
  try{
    const p=state.profile;
    const business=p?[
      `Nombre: ${p.name}`,
      `Ubicación: ${p.location||"No indicada"}`,
      `Tipo: ${p.type||"No indicado"}`,
      `Actividad: ${p.description}`,
      `Objetivos: ${p.goals||"No indicados"}`
    ].join("\n"):"";
    const result=await api("/api/ai/analyze",{
      method:"POST",
      body:JSON.stringify({text,business,task:$("analysisTask").value,language:$("language").value})
    });
    state.currentAnalysis=result.answer||"";
    $("analysisProvider").textContent=`Servicio de análisis: ${result.provider||"IA"}`;
    $("analysisOutput").textContent=state.currentAnalysis;
    $("analysisResult").classList.remove("hidden");
    message("analysisMessage","Análisis completado. Verifica las condiciones en la fuente oficial.","success");
  }catch(error){message("analysisMessage",error.message,"error")}
  finally{button.disabled=false;button.textContent="Explicar esta oportunidad";$("aiConsent").checked=false}
});
$("copyAnalysisBtn").addEventListener("click",async()=>{
  if(!state.currentAnalysis)return;
  try{
    await navigator.clipboard.writeText(state.currentAnalysis);
    message("analysisMessage","Explicación copiada.","success");
  }catch{
    const range=document.createRange();range.selectNodeContents($("analysisOutput"));
    const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);
    message("analysisMessage","Selecciona el texto y cópialo manualmente.","warning");
  }
});
const translations={
  es:{logout:"Salir",search:"Encontrar oportunidades para mi negocio",searching:"Buscando oportunidades...",analyze:"Explicar esta oportunidad"},
  en:{logout:"Log out",search:"Find opportunities for my business",searching:"Searching for opportunities...",analyze:"Explain this opportunity"},
  pt:{logout:"Sair",search:"Encontrar oportunidades para minha empresa",searching:"Buscando oportunidades...",analyze:"Explicar esta oportunidade"}
};
$("language").addEventListener("change",()=>{
  const lang=$("language").value;document.documentElement.lang=lang;
  const labels=translations[lang]||translations.es;
  $("logoutBtn").textContent=labels.logout;
  $("searchOpportunitiesBtn").textContent=state.searching?labels.searching:labels.search;
  $("analyzeBtn").textContent=labels.analyze;
});
checkSession();
