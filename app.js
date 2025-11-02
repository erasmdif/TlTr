/* ===========
   TlTr — App
   =========== */
const ASSETS = {
  eventi:"./static/data/eventi.csv",
  comuni:"./static/data/comuni.geojson",
  luoghi:"./static/data/luoghi.geojson",          // NEW
  progetti:"./static/data/progetti.csv",
  enti:"./static/data/istituzioni.csv",
  moduliBase:"./static/moduli/",
  logosBase:"./static/images/logos/",
  projectsImgBase:"./static/images/projects/",
  iconsBase:"./static/images/icons/",
  infoBase:"./static/moduli/info/",
  erasmoLogo:"./static/images/logo_erasmo.svg"   // <— NEW
};

const IT_MONTHS=["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
const IT_DOW=["Lun","Mar","Mer","Gio","Ven","Sab","Dom"];

const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));

function openDialog(d){ d?.showModal(); }
function closeOnButtons(){ $$("[data-close]").forEach(b=>b.addEventListener("click",e=>{e.preventDefault();b.closest("dialog")?.close();})); }

/* ---------- UTIL ---------- */
function parseCSV(txt){
  const rows=[]; let i=0,cur=[],f="",q=false,s=txt;
  while(i<s.length){ const c=s[i];
    if(q){ if(c=='"'){ if(s[i+1]=='"'){ f+='"'; i+=2; continue; } q=false; i++; continue; } f+=c; i++; continue; }
    if(c=='"'){ q=true; i++; continue; }
    if(c==','){ cur.push(f); f=""; i++; continue; }
    if(c=='\n'){ cur.push(f); rows.push(cur); cur=[]; f=""; i++; continue; }
    if(c=='\r'){ i++; continue; }
    f+=c; i++;
  } cur.push(f); rows.push(cur);
  const head=rows.shift().map(h=>h.trim());
  return rows.filter(r=>r.some(x=>x && x.trim()!=="")).map(r=>{ const o={}; head.forEach((h,idx)=>o[h]=(r[idx]??"").trim()); return o; });
}
function isPdf(u){return /\.pdf(\?|#|$)/i.test(u);}
/* Normalizza per join “nome = luogo” (ignora accenti, apostrofi, spazi multipli ecc.) */
const normKey = s => (s||"")
  .toLowerCase()
  .normalize("NFD").replace(/\p{Diacritic}/gu,"")
  .replace(/[’'`"]/g,"")
  .replace(/[\s_.\-\/,;:()]+/g," ")
  .trim();

/* TXT -> HTML auto formattato (elenchi/p) */
function formatInfoText(raw){
  if(!raw) return "";
  let s = raw.replace(/\r\n/g,"\n").replace(/_{3,}/g,"");
  const lines = s.split("\n");
  const out=[]; let openUL=false, openOL=false;
  const close=()=>{ if(openUL){out.push("</ul>");openUL=false;} if(openOL){out.push("</ol>");openOL=false;} };
  for(const L of lines){
    const t=L.trim(); if(!t){ close(); continue; }
    if(/^([•\-]|o\s)/i.test(t)){ if(!openUL){close();out.push("<ul>");openUL=true;} out.push("<li>"+t.replace(/^([•\-]|o\s+)/i,"")+"</li>"); continue; }
    if(/^\d+[\.\)]\s+/.test(t)){ if(!openOL){close();out.push("<ol>");openOL=true;} out.push("<li>"+t.replace(/^\d+[\.\)]\s+/,"")+"</li>"); continue; }
    close(); out.push("<p>"+t+"</p>");
  }
  close(); return out.join("");
}

/* ---------- ENTI / ISTITUZIONI (loghi, convenzionate) ---------- */
let ENTI=[];
async function loadEnti(){
  const txt = await fetch(ASSETS.enti,{cache:"no-store"}).then(r=>r.text());
  const rows = parseCSV(txt);
  ENTI = rows.map(r=>({
    istituzione:(r.istituzione||"").trim(),
    logo:(r.logo||"").trim(),
    sedi:(r.sedi_convenzionate||"").trim(),
    link:(r.link||"#").trim()
  })).filter(e=>e.istituzione && e.logo);
}
function renderConvenzionateAccordion(){
  const wrap = $("#entiConvenzionate"); if(!wrap) return;
  const list = ENTI.filter(e=>e.sedi);
  wrap.innerHTML = list.map(e=>`
    <a class="enti-card" href="${ASSETS.logosBase+encodeURIComponent(e.logo)}" download="${e.logo}">
      <img src="${ASSETS.logosBase+encodeURIComponent(e.logo)}" alt="${e.istituzione}">
      <span>${e.sedi}</span>
    </a>`).join("");
}

/* ---------- MODULI ---------- */
const MOD_FILENAME={A:"Modulo_A.txt",R:"Modulo_R.txt",B:"Modulo_B.txt",S:"Modulo_S.txt"};
const MODULE_FILES={A:["modulo_A.docx"],R:["modulo_R.dotx","modulo_Rdotx"],B:["modulo_B.dotx"],S:["modulo_S.dotx"]};

async function loadTxt(u){ const r=await fetch(u,{cache:"no-store"}); if(!r.ok) throw 0; return r.text(); }

async function openModuleInfoByKey(k){
  const title={A:"Modulo A – Richiesta di autorizzazione preventiva",R:"Modulo R – Dati personali e sulla missione",B:"Modulo B – Rendicontazione a rientro",S:"Modulo S – Attestazione sede di servizio"}[k]||"Informazioni";
  $("#moduleInfoTitle").textContent=title;
  try{
    const [spec,generali]=await Promise.all([loadTxt(ASSETS.infoBase+MOD_FILENAME[k]), loadTxt(ASSETS.infoBase+"info_generali.txt")]);
    $("#moduleInfoBody").innerHTML = formatInfoText(spec);
    $("#generalNotes").innerHTML   = formatInfoText(generali);
  }catch{
    $("#moduleInfoBody").textContent="Impossibile caricare il testo."; $("#generalNotes").textContent="";
  }
  renderConvenzionateAccordion();
  openDialog($("#moduleInfoDialog"));
}
async function downloadModuleByKey(k){
  for(const u of (MODULE_FILES[k]||[]).map(f=>ASSETS.moduliBase+f)){
    try{ const h=await fetch(u,{method:"HEAD",cache:"no-store"}); if(h.ok){ const a=document.createElement("a"); a.href=u; a.download=""; document.body.appendChild(a); a.click(); a.remove(); return; } }catch{}
  }
  alert("File non trovato per il modulo "+k);
}
function setupModules(){
  $$(".info-btn").forEach(b=>b.addEventListener("click",()=>openModuleInfoByKey(b.dataset.module)));
  $$(".doc-button").forEach(b=>b.addEventListener("click",()=>downloadModuleByKey(b.dataset.modkey)));
}

/* ---------- LOGHI UTILI ---------- */
let logosFiltered=[], logosPage=0;
const LOGOS_PAGE_SIZE=12;

function setupLoghiUtili(){
  const search=$("#logosSearch"), prev=$("#logosPrev"), next=$("#logosNext"), count=$("#logosCount"), grid=$("#logosGrid");

  const render=()=>{
    grid.innerHTML="";
    const start = logosPage*LOGOS_PAGE_SIZE;
    const pageItems = logosFiltered.slice(start, start+LOGOS_PAGE_SIZE);
    count.textContent = logosFiltered.length
      ? `${start+1}-${Math.min(start+LOGOS_PAGE_SIZE, logosFiltered.length)} / ${logosFiltered.length}`
      : "0 / 0";
    pageItems.forEach(e=>{
      const a=document.createElement("a");
      const file = ASSETS.logosBase+encodeURIComponent(e.logo);
      a.className="logo-card"; a.href=file; a.download=e.logo;
      const img=new Image(); img.src=file; img.alt=e.istituzione;
      const span=document.createElement("span"); span.className="logo-name"; span.textContent=e.istituzione;
      a.append(img,span); grid.appendChild(a);
    });
    prev.disabled = logosPage===0;
    next.disabled = start+LOGOS_PAGE_SIZE >= logosFiltered.length;
  };

  const refilter=()=>{
    const q=(search.value||"").toLowerCase();
    logosFiltered = ENTI.filter(e=>e.istituzione.toLowerCase().includes(q));
    logosPage=0; render();
  };

  search.addEventListener("input", refilter);
  prev.addEventListener("click", ()=>{ if(logosPage>0){ logosPage--; render(); }});
  next.addEventListener("click", ()=>{ if((logosPage+1)*LOGOS_PAGE_SIZE < logosFiltered.length){ logosPage++; render(); }});

  logosFiltered=[...ENTI]; render();
}

/* ---------- CALENDARIO / GEODATI ---------- */
function parseMDY2Y(s){ if(!s) return null; const [m,d,yRaw]=s.split("/").map(x=>x?.trim()); let y=(yRaw||"").length===2?(+yRaw<=49?2000+ +yRaw:1900+ +yRaw):+yRaw; if(!m||!d||!y) return null; const dt=new Date(Date.UTC(y,+m-1,+d)); return isNaN(+dt)?null:dt; }
const dateKeyUTC=d=>d.toISOString().slice(0,10);
const addDaysUTC=(d,n)=>{ const x=new Date(d.getTime()); x.setUTCDate(x.getUTCDate()+n); return x; };

let EVENTS=[],EVENTS_BY_DAY=new Map();
let CURRENT_MONTH=(()=>{ const n=new Date(); return new Date(Date.UTC(n.getUTCFullYear(),n.getUTCMonth(),1)); })();

async function loadEventi(){
  const csv=await fetch(ASSETS.eventi,{cache:"no-store"}).then(r=>r.text());
  const rows=parseCSV(csv);
  EVENTS=rows.map(r=>{
    const from=parseMDY2Y(r.date_from), to=parseMDY2Y(r.date_to)||from;
    return {
      ...r,
      evento:r.evento||"Evento",
      tipo:(r.tipo||"evento").toLowerCase(),
      presenza:(r.presenza||"").toLowerCase(),
      orario_inizio:(r.orario_inizio||"").trim(),
      orario_fine:(r.orario_fine||"").trim(),
      città:(r.città||"").trim(),
      luogo:(r.luogo||"").trim(),
      from, to
    };
  });
  EVENTS_BY_DAY=new Map();
  for(const ev of EVENTS){
    if(!ev.from) continue; let d=ev.from; const last=ev.to||ev.from;
    while(d<=last){ const k=dateKeyUTC(d); if(!EVENTS_BY_DAY.has(k)) EVENTS_BY_DAY.set(k,[]); EVENTS_BY_DAY.get(k).push(ev); d=addDaysUTC(d,1); }
  }
}
function presenceClass(p){ const v=(p||"").toLowerCase(); if(v==="si") return "presenza-si"; if(v==="preferibile") return "presenza-preferibile"; if(v==="no") return "presenza-no"; return ""; }

let comuniCache=null, luoghiCache=null, LUOGHI_BY_NAME=null;
async function getComuni(){ if(comuniCache) return comuniCache; comuniCache=await fetch(ASSETS.comuni,{cache:"no-store"}).then(r=>r.json()); return comuniCache; }
async function getLuoghi(){
  if(luoghiCache) return luoghiCache;
  luoghiCache = await fetch(ASSETS.luoghi,{cache:"no-store"}).then(r=>r.json());
  LUOGHI_BY_NAME = new Map();
  (luoghiCache.features||[]).forEach(f=>{
    const nm = normKey(f.properties?.nome);
    if(nm) LUOGHI_BY_NAME.set(nm, f);
  });
  return luoghiCache;
}
function findLuogoByName(name){ if(!name) return null; if(!LUOGHI_BY_NAME) return null; return LUOGHI_BY_NAME.get(normKey(name))||null; }
const normalizeCity=s=>(s||"").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu,"").trim();

/* ---------- Anteprime file ---------- */
function makePreview(label,url){
  const d=document.createElement("div"); d.className="preview";
  d.innerHTML=`
    <div class="preview-title">${label}</div>
    ${isPdf(url)?`<embed src="${url}#toolbar=0&navpanes=0&scrollbar=0" type="application/pdf" />`:`<img loading="lazy" alt="${label}" src="${url}" />`}
    <div class="actions">
      <button class="btn btn-info btn-expand" type="button"><svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM11 10h2v7h-2v-7Zm0-3h2v2h-2V7Z"/></svg>Espandi</button>
      <a class="btn btn-download" href="${url}" download><svg viewBox="0 0 24 24"><path d="M12 3a1 1 0 0 1 1 1v9.586l2.293-2.293 1.414 1.414L12 17.414l-4.707-4.707 1.414-1.414L11 13.586V4a1 1 0 0 1 1-1ZM5 19h14v2H5v-2Z"/></svg>Scarica</a>
      <a class="btn btn-info" href="${url}" target="_blank" rel="noopener"><svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM11 10h2v7h-2v-7Zm0-3h2v2h-2V7Z"/></svg>Apri</a>
    </div>`;
  d.querySelector(".btn-expand").addEventListener("click",()=> d.classList.toggle("preview--expanded"));
  return d;
}

/* ---------- Scheda evento (con luogo & indirizzo) ---------- */
function buildModulistica(ev){
  const col=document.createElement("div"); col.className="modulistica-col";
  if(["convegno","evento"].includes(ev.tipo)){
    const nec=document.createElement("details"); nec.className="mod-accordion"; nec.open=true;
    nec.innerHTML=`<summary>Necessarie (per ${ev.tipo})</summary><div></div>`;
    const box=nec.querySelector("div");
    [
      { label:"Prima della partenza (Dott.ssa Settanni)", mods:["A","R"] },
      { label:"Dopo l'arrivo (Contabilità)", mods:["B"] },
      { label:"Eventuale (fuori sede)", mods:["S"] },
    ].forEach(sec=>{
      const d=document.createElement("details"); d.className="sub-accordion"; d.open=true;
      d.innerHTML=`<summary>${sec.label}</summary><div class="mod-links"></div>`;
      const links=d.querySelector(".mod-links");
      sec.mods.forEach(k=>{
        const info=document.createElement("button"); info.className="btn btn-info"; info.innerHTML=`<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z"/></svg>Info ${k}`; info.addEventListener("click",()=>openModuleInfoByKey(k));
        const down=document.createElement("button"); down.className="btn btn-download"; down.innerHTML=`<svg viewBox="0 0 24 24"><path d="M12 3a1 1 0 0 1 1 1v9.586l2.293-2.293 1.414 1.414L12 17.414l-4.707-4.707 1.414-1.414L11 13.586V4Z"/></svg>Scarica ${k}`; down.addEventListener("click",()=>downloadModuleByKey(k));
        links.append(info,down);
      });
      box.appendChild(d);
    });
    col.appendChild(nec);
  }
  const part=document.createElement("details"); part.className="mod-accordion";
  part.innerHTML=`<summary>Partecipazione</summary><div class="mod-links"></div>`;
  if(ev.link_utili){
    const a=document.createElement("a"); a.className="btn btn-info"; a.href=ev.link_utili; a.target="_blank"; a.rel="noopener";
    a.innerHTML=`<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z"/></svg>Link utili`; part.querySelector(".mod-links").appendChild(a);
  }
  col.appendChild(part);

  const alt=document.createElement("details"); alt.className="mod-accordion";
  alt.innerHTML=`<summary>Altro</summary><div class="small">—</div>`;
  col.appendChild(alt);
  return col;
}

function buildEventBody(ev,alsoList){
  const wrap=document.createElement("div"); wrap.className="event-body";
  const top=document.createElement("div"); top.className="event-top";

  const tStart = ev.orario_inizio||"";
  const tEnd   = ev.orario_fine||"";
  const timeStr = (tStart && tEnd) ? `${tStart} — ${tEnd}` : (tStart || tEnd);

  top.innerHTML=`
    <div class="event-title">${ev.evento || "Evento"}</div>
    <div class="event-meta">
      <span><strong>Tipo:</strong> ${ev.tipo||"—"}</span>
      <span><strong>Date:</strong> ${formatDateRange(ev.from, ev.to)}</span>
      ${timeStr ? `<span><strong>Orario:</strong> ${timeStr}</span>` : ""}
      ${ev.città ? `<span><strong>Città:</strong> ${ev.città}</span>` : ""}
      <span class="luogo-line" hidden></span>     <!-- riempita dopo la join -->
      ${ev.presenza ? `<span><strong>Presenza:</strong> ${ev.presenza}</span>` : ""}
      ${ev.sicuro ? `<span><strong>Sicuro:</strong> ${ev.sicuro}</span>` : ""}
    </div>`;
  const bigIcon=document.createElement("div"); bigIcon.className="event-top__icon";
  bigIcon.style.backgroundImage=`url("${ASSETS.iconsBase+encodeURIComponent(ev.tipo+".png")}")`;
  top.appendChild(bigIcon); wrap.appendChild(top);

  const left=buildModulistica(ev);
  const center=document.createElement("div"); center.className="event-map-col"; center.innerHTML=`<div id="eventMap"></div>`;
  const right=document.createElement("div"); right.className="event-right";
  const docs=document.createElement("div");
  if(ev.locandina) docs.appendChild(makePreview("Locandina", `./static/locandine_programmi/${encodeURIComponent(ev.locandina)}`));
  if(ev.programma)  docs.appendChild(makePreview("Programma",  `./static/locandine_programmi/${encodeURIComponent(ev.programma)}`));
  if(ev.link_utili && ev.tipo!=="cena"){
    const pr=document.createElement("div"); pr.className="preview";
    pr.innerHTML=`<div class="preview-title">Link utili</div><div class="actions"><a class="btn btn-info" target="_blank" rel="noopener" href="${ev.link_utili}"><svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z"/></svg>Apri link</a></div>`;
    docs.appendChild(pr);
  }
  if(!docs.children.length){ const empty=document.createElement("div"); empty.className="small"; empty.textContent="Nessuna anteprima disponibile."; docs.appendChild(empty); }
  right.appendChild(docs);
  if(alsoList && alsoList.length>1){
    const ul=document.createElement("ul"); ul.className="small"; ul.style.marginTop="8px";
    ul.innerHTML=alsoList.map(evv=>`<li><a href="#" data-ev="${evv.evento}">${evv.evento} — <em>${evv.tipo}</em></a></li>`).join("");
    ul.addEventListener("click",e=>{ const a=e.target.closest("a"); if(!a) return; e.preventDefault(); const chosen=alsoList.find(x=>x.evento===a.dataset.ev); if(chosen) openEventDetail(chosen); });
    right.appendChild(ul);
  }
  wrap.append(left,center,right);

  setTimeout(async ()=>{
    const container=$("#eventMap"); if(!container) return;
    const map=L.map(container,{zoomControl:true,scrollWheelZoom:false});
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:"&copy; OpenStreetMap",maxZoom:19}).addTo(map);

    let fit=false, luogoFeature=null;
    if(ev.luogo){
      await getLuoghi();
      luogoFeature = findLuogoByName(ev.luogo);
      if(luogoFeature){
        const [x,y] = luogoFeature.geometry.coordinates; // CRS84: [lon,lat]
        const m = L.circleMarker([y,x], {radius:8,color:"#2e7d32",weight:2,fillColor:"#a5d6a7",fillOpacity:0.9}).addTo(map);
        const addr = luogoFeature.properties?.indirizzo || "";
        m.bindPopup(`<strong style="color:#2e7d32">${luogoFeature.properties?.nome||ev.luogo}</strong><br>${addr||""}`);
        map.setView([y,x], 15);
        fit=true;
        // completa riga "Luogo: ..."
        const span = top.querySelector(".luogo-line");
        if(span){ span.hidden=false; span.innerHTML = `<strong>Luogo:</strong> ${luogoFeature.properties?.nome||ev.luogo}${addr?` (${addr})`:""}`; }
      }
    }
    if(!fit && ev.città){
      const gj=await getComuni();
      const feat=(gj.features||[]).find(f=>normalizeCity(f.properties?.nome_comune)===normalizeCity(ev.città));
      if(feat && feat.geometry){
        const layer=L.geoJSON(feat,{style:{color:"#3a7bd5",weight:2}}).addTo(map);
        try{ map.fitBounds(layer.getBounds(),{padding:[20,20]}); fit=true; }catch{}
      }
      // se avevamo “luogo” ma non trovato, mostra almeno il testo
      if(ev.luogo && !luogoFeature){
        const span = top.querySelector(".luogo-line");
        if(span){ span.hidden=false; span.innerHTML = `<strong>Luogo:</strong> ${ev.luogo}`; }
      }
    }
    if(!fit){ map.setView([41.125,16.866],6); }
    setTimeout(()=>map.invalidateSize(),150);
  },0);
  return wrap;
}
async function openEventDetail(ev,alsoList){
  $("#eventBody").innerHTML=""; $("#eventBody").appendChild(buildEventBody(ev,alsoList)); openDialog($("#eventDialog"));
}

/* ---------- Vista MAPPA calendario (comune vs luogo) ---------- */
let calendarMap=null, cityLayer=null, placeLayer=null;
async function renderCalendarMap(){
  const mapEl=$("#calendarMap");
  if(!calendarMap){
    calendarMap=L.map(mapEl,{zoomControl:true,scrollWheelZoom:true});
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:"&copy; OpenStreetMap",maxZoom:19}).addTo(calendarMap);
    cityLayer = L.layerGroup().addTo(calendarMap);
    placeLayer = L.layerGroup().addTo(calendarMap);
    const updateVisibility=()=>{
      const z = calendarMap.getZoom();
      if(z>=11){ // zoom cittadino -> mostra luoghi precisi
        calendarMap.addLayer(placeLayer); calendarMap.removeLayer(cityLayer);
      }else{
        calendarMap.addLayer(cityLayer); calendarMap.removeLayer(placeLayer);
      }
    };
    calendarMap.on("zoomend", updateVisibility);
    setTimeout(updateVisibility,0);
  }
  cityLayer.clearLayers(); placeLayer.clearLayers();

  // Marker azzurri per COMUNE (aggregati)
  const byCity=new Map();
  for(const ev of EVENTS){ const c=(ev.città||"").trim(); if(!c) continue; if(!byCity.has(c)) byCity.set(c,[]); byCity.get(c).push(ev); }
  const gj=await getComuni(); const cityMarkers=[];
  for(const [city,list] of byCity){
    const feat=(gj.features||[]).find(f=>normalizeCity(f.properties?.nome_comune)===normalizeCity(city));
    if(!feat) continue;
    const b=L.geoJSON(feat).getBounds(); 
    const m=L.circleMarker(b.getCenter(),{radius:7,color:"#3a7bd5",weight:2,fillColor:"#a7d8ff",fillOpacity:0.9}).addTo(cityLayer);
    m.bindTooltip(`${city} (${list.length})`,{direction:"top",offset:[0,-8]});
    m.on("click",()=>openCityEvents(city,list,feat));
    cityMarkers.push(m);
  }

  // Marker verdi per LUOGO (raggruppati per nome)
  await getLuoghi();
  const byPlace=new Map();
  for(const ev of EVENTS){
    if(!ev.luogo) continue;
    const key = normKey(ev.luogo);
    if(!byPlace.has(key)) byPlace.set(key, []);
    byPlace.get(key).push(ev);
  }
  const placeMarkers=[];
  for(const [k,list] of byPlace){
    const feat = LUOGHI_BY_NAME.get(k);
    if(!feat) continue;
    const [x,y]=feat.geometry.coordinates;
    const m=L.circleMarker([y,x],{radius:8,color:"#2e7d32",weight:2,fillColor:"#a5d6a7",fillOpacity:0.95}).addTo(placeLayer);
    const addr = feat.properties?.indirizzo || "";
    m.bindTooltip(`${feat.properties?.nome||""}`,{direction:"top",offset:[0,-8]});
    m.on("click",()=>openPlaceEvents(feat.properties?.nome||"", list, feat, addr));
    placeMarkers.push(m);
  }

  if(placeMarkers.length){
    calendarMap.fitBounds(L.featureGroup(placeMarkers).getBounds().pad(0.2));
  }else if(cityMarkers.length){
    calendarMap.fitBounds(L.featureGroup(cityMarkers).getBounds().pad(0.2));
  }else{
    calendarMap.setView([41.125,16.866],6);
  }
}
function openCityEvents(city,list,feat){
  const body=$("#eventBody"); body.innerHTML="";
  const wrap=document.createElement("div"); wrap.className="event-body";
  const top=document.createElement("div"); top.className="event-top";
  top.innerHTML=`<div class="event-title">${city}</div><div class="event-meta"><strong>Eventi:</strong> ${list.length}</div>`;
  const icon=document.createElement("div"); icon.className="event-top__icon"; icon.style.backgroundImage=`url('${ASSETS.iconsBase}evento.png')`; top.appendChild(icon);
  wrap.appendChild(top);
  const left=document.createElement("div"); left.className="modulistica-col";
  left.innerHTML=`<details class="mod-accordion" open><summary>Eventi di ${city}</summary><div class="small">Seleziona un evento per vedere dettagli e modulistica.</div></details>`;
  const center=document.createElement("div"); center.className="event-map-col"; center.innerHTML=`<div id="eventMap"></div>`;
  const right=document.createElement("div"); right.className="event-right";
  const docs=document.createElement("div");
  list.sort((a,b)=>(a.from||0)-(b.from||0));
  list.forEach(ev=>{
    const card=document.createElement("div"); card.className="preview";
    card.innerHTML=`<div class="preview-title">${ev.evento||"Evento"} <span class="small">(${ev.tipo})</span></div>
                    <div class="small"><strong>Date:</strong> ${formatDateRange(ev.from,ev.to)}</div>
                    <div class="actions" style="margin-top:6px;"><button class="btn btn-info" type="button"><svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z"/></svg>Dettagli</button></div>`;
    card.querySelector("button").addEventListener("click",()=>openEventDetail(ev));
    docs.appendChild(card);
  });
  right.appendChild(docs);
  wrap.append(left,center,right); body.appendChild(wrap); openDialog($("#eventDialog"));
  setTimeout(()=>{
    const container=$("#eventMap"); if(!container) return;
    const map=L.map(container,{zoomControl:true,scrollWheelZoom:false});
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:"&copy; OpenStreetMap",maxZoom:19}).addTo(map);
    if(feat){ const layer=L.geoJSON(feat,{style:{color:"#3a7bd5",weight:2}}).addTo(map); try{ map.fitBounds(layer.getBounds(),{padding:[20,20]}); }catch{ map.setView([41.125,16.866],6); } }
    else { map.setView([41.125,16.866],6); }
    setTimeout(()=>map.invalidateSize(),150);
  },0);
}
function openPlaceEvents(placeName,list,feat,addr){
  const body=$("#eventBody"); body.innerHTML="";
  const wrap=document.createElement("div"); wrap.className="event-body";
  const top=document.createElement("div"); top.className="event-top";
  top.innerHTML=`<div class="event-title">${placeName}</div>
                 <div class="event-meta"><span><strong>Indirizzo:</strong> ${addr||"—"}</span><span><strong>Eventi:</strong> ${list.length}</span></div>`;
  const icon=document.createElement("div"); icon.className="event-top__icon"; icon.style.backgroundImage=`url('${ASSETS.iconsBase}evento.png')`; top.appendChild(icon);
  wrap.appendChild(top);
  const left=document.createElement("div"); left.className="modulistica-col";
  left.innerHTML=`<details class="mod-accordion" open><summary>Eventi a ${placeName}</summary><div class="small">Seleziona un evento per i dettagli.</div></details>`;
  const center=document.createElement("div"); center.className="event-map-col"; center.innerHTML=`<div id="eventMap"></div>`;
  const right=document.createElement("div"); right.className="event-right";
  const docs=document.createElement("div");
  list.sort((a,b)=>(a.from||0)-(b.from||0));
  list.forEach(ev=>{
    const card=document.createElement("div"); card.className="preview";
    card.innerHTML=`<div class="preview-title">${ev.evento||"Evento"} <span class="small">(${ev.tipo})</span></div>
                    <div class="small"><strong>Date:</strong> ${formatDateRange(ev.from,ev.to)}</div>
                    <div class="actions" style="margin-top:6px;"><button class="btn btn-info" type="button"><svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z"/></svg>Dettagli</button></div>`;
    card.querySelector("button").addEventListener("click",()=>openEventDetail(ev));
    docs.appendChild(card);
  });
  right.appendChild(docs);
  wrap.append(left,center,right); body.appendChild(wrap); openDialog($("#eventDialog"));
  setTimeout(()=>{
    const container=$("#eventMap"); if(!container) return;
    const map=L.map(container,{zoomControl:true,scrollWheelZoom:false});
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:"&copy; OpenStreetMap",maxZoom:19}).addTo(map);
    if(feat && feat.geometry){
      const [x,y]=feat.geometry.coordinates;
      L.circleMarker([y,x],{radius:8,color:"#2e7d32",weight:2,fillColor:"#a5d6a7",fillOpacity:0.95})
        .addTo(map)
        .bindPopup(`<strong style="color:#2e7d32">${placeName}</strong><br>${addr||""}`)
        .openPopup();
      map.setView([y,x],15);
    }else{
      map.setView([41.125,16.866],6);
    }
    setTimeout(()=>map.invalidateSize(),150);
  },0);
}

/* ---------- PROGETTI UTILI (con paginazione 9) ---------- */
const KNOWN_CATS = [
  "GIS","utility","marcatura","statistica","archeologia","archeobotanica",
  "linguistica","storia","automatation","ML/AI","bibliografia","altro",
  "mio"                                           // <— NEW
];
const LOWER_MAP = Object.fromEntries(KNOWN_CATS.map(n=>[n.toLowerCase(), n]));
const CAT_COLORS = {
  "GIS":"#bfe3ff","utility":"#ccebd4","marcatura":"#ffd6a8","statistica":"#d8c7ff",
  "archeologia":"#ffcfe1","archeobotanica":"#cfe9f6","linguistica":"#ffe2b6","storia":"#bfeadf",
  "automatation":"#d8d6ff","ML/AI":"#ffd7d7","bibliografia":"#fff0b3","altro":"#dfe7ef",
  "mio":"#ffd7f0"                                // <— NEW (pastello)
};
function makeImageFilterChip(name, imgSrc, title=""){            // <— NEW
  const chip = document.createElement("button");
  chip.className = "filter-chip filter-chip--image active";
  chip.title = title || name;
  chip.setAttribute("aria-label", title || name);
  const img = new Image();
  img.src = imgSrc; img.alt = title || name;
  chip.appendChild(img);

  chip.addEventListener("click", ()=>{
    const allSelected = SELECTED.size === KNOWN_CATS.length;
    if(allSelected){ SELECTED = new Set([name]); }
    else { if(SELECTED.has(name)) SELECTED.delete(name); else SELECTED.add(name);
           if(SELECTED.size===0) SELECTED = new Set(KNOWN_CATS); }
    projectsPage=0;
    updateChips(); renderProgettiGrid();
  });
  return chip;
}
function toGroup(catRaw){ const low=(catRaw||"").trim().toLowerCase(); if(low==="ml/aibibliografia"){ return ["ML/AI","bibliografia"]; } const mapped = LOWER_MAP[low]; return mapped ? [mapped] : ["altro"]; }
function colorFor(group){ return CAT_COLORS[group] || CAT_COLORS["altro"]; }
/* mapping filename + risoluzione robusta */
function projectImageFile(name){
  if(!name) return "placeholder";
  const normalized = name.replace(/\u2044/g,'/'); // fraction slash -> slash
  if(/catch\/?me-nator!/i.test(normalized)) return "Catch-me-nator";
  let n = name.replace(/\s+/g,''); n = n.replace(/[\/\u2044]+/g,'-'); n = n.replace(/[!'",.:;?()]/g,'');
  return n || "placeholder";
}
async function firstExisting(urls){ for(const u of urls){ try{ const r=await fetch(u,{method:"HEAD",cache:"no-store"}); if(r.ok) return u; }catch{} } return null; }
async function resolveProjectImage(name){
  const base = ASSETS.projectsImgBase;
  const core = projectImageFile(name);
  const raw  = (name||"").replace(/\s+/g,'');
  const cap1 = raw ? raw[0].toUpperCase()+raw.slice(1).toLowerCase() : raw;
  const candidates = [
    `${base}${encodeURIComponent(core)}.png`,
    `${base}${encodeURIComponent(core)}.PNG`,
    `${base}${encodeURIComponent(raw)}.png`,
    `${base}${encodeURIComponent(raw)}.PNG`,
    `${base}${encodeURIComponent(cap1)}.png`,
    `${base}${encodeURIComponent(cap1)}.PNG`,
    `${base}${encodeURIComponent(raw)}.jpg`,
    `${base}${encodeURIComponent(raw)}.jpeg`,
    `${base}${encodeURIComponent(raw)}.webp`
  ];
  const ok = await firstExisting(candidates);
  return ok || `${base}placeholder.png`;
}

let PROGETTI=[], SELECTED = new Set(KNOWN_CATS);
const CHIP_NODES = {};
let projectsFiltered=[], projectsPage=0;
const PROJECTS_PAGE_SIZE=9;
let projPrev, projNext, projCount;

async function loadProgetti(){
  const txt = await fetch(ASSETS.progetti, {cache:"no-store"}).then(r=>r.text());
  const rows = parseCSV(txt);
  PROGETTI = rows.map(r=>{
    const origCats = (r.categoria||"").split(",").map(x=>x.trim()).filter(Boolean);
    const groups = [...new Set(origCats.flatMap(toGroup))];
    return { progetto: r.progetto || "", sottotitolo: r.sottotitolo || "", completo: (r.completo || "").toLowerCase(), link: r.link || "#", origCats, groups };
  });
}
function makeFilterChip(name){
  const chip = document.createElement("button");
  chip.className = "filter-chip active"; chip.textContent = name;
  const col = colorFor(name); chip.style.setProperty("--bg", col); chip.style.setProperty("--bd", col);
  chip.addEventListener("click", ()=>{
    const allSelected = SELECTED.size === KNOWN_CATS.length;
    if(allSelected){ SELECTED = new Set([name]); }
    else { if(SELECTED.has(name)) SELECTED.delete(name); else SELECTED.add(name); if(SELECTED.size===0) SELECTED = new Set(KNOWN_CATS); }
    projectsPage=0; updateChips(); renderProgettiGrid();
  });
  return chip;
}
function updateChips(){ KNOWN_CATS.forEach(cat=>{ CHIP_NODES[cat]?.classList.toggle("active", SELECTED.has(cat)); }); }
function ensureProjectsPager(){
  let pager = $("#projectsPager");
  if(!pager){
    pager = document.createElement("div");
    pager.id="projectsPager"; pager.className="logos-nav";
    pager.innerHTML = `
      <button id="projectsPrev" class="pager-arrow" type="button">‹</button>
      <span id="projectsCount" class="pager-count"></span>
      <button id="projectsNext" class="pager-arrow" type="button">›</button>`;
    $("#projectsGrid").after(pager);
  }
  projPrev = $("#projectsPrev"); projNext = $("#projectsNext"); projCount= $("#projectsCount");
  projPrev.addEventListener("click", ()=>{ if(projectsPage>0){ projectsPage--; renderProgettiGrid(true); }});
  projNext.addEventListener("click", ()=>{ if((projectsPage+1)*PROJECTS_PAGE_SIZE < projectsFiltered.length){ projectsPage++; renderProgettiGrid(true); }});
}
function setupProgettiUI(){
  const tb = $("#projectsToolbar"); tb.innerHTML="";
  KNOWN_CATS.filter(c=>c!=="mio").forEach(cat=>{           // <— escludo 'mio' dai chip testuali
    const c=makeFilterChip(cat); CHIP_NODES[cat]=c; tb.appendChild(c);
  });

  // spacer per spingere il logo a destra
  const spacer = document.createElement("span");
  spacer.className = "chip-spacer"; tb.appendChild(spacer);

  // chip immagine 'mio'
  const myChip = makeImageFilterChip("mio", ASSETS.erasmoLogo, "Progetti miei");
  CHIP_NODES["mio"] = myChip; tb.appendChild(myChip);

  const reset = document.createElement("button");
  reset.className="filter-chip"; reset.textContent="Reset";
  reset.style.setProperty("--bg","#eef3fb");
  reset.addEventListener("click", ()=>{
    SELECTED = new Set(KNOWN_CATS); projectsPage=0; updateChips(); renderProgettiGrid();
  });
  tb.appendChild(reset);

  ensureProjectsPager();
  updateChips(); renderProgettiGrid();
}
function renderProgettiGrid(keepPage=false){
  const grid = $("#projectsGrid"); grid.innerHTML = "";
  projectsFiltered = PROGETTI.filter(p => p.groups.some(g => SELECTED.has(g)));
  if(!keepPage) projectsPage = 0;
  const start = projectsPage*PROJECTS_PAGE_SIZE;
  const pageItems = projectsFiltered.slice(start, start+PROJECTS_PAGE_SIZE);
  if(projCount) projCount.textContent = projectsFiltered.length ? `${start+1}-${Math.min(start+PROJECTS_PAGE_SIZE, projectsFiltered.length)} / ${projectsFiltered.length}` : "0 / 0";
  if(projPrev) projPrev.disabled = projectsPage===0;
  if(projNext) projNext.disabled = start+PROJECTS_PAGE_SIZE >= projectsFiltered.length;

  pageItems.forEach(async p=>{
    const a = document.createElement("a"); a.className = "project-card"; a.href = p.link || "#"; a.target="_blank"; a.rel="noopener";
    const logo = document.createElement("div"); logo.className = "project-logo"; logo.classList.add(`border-${p.completo==="si"?"si":p.completo==="sni"?"sni":"no"}`);
    const img = document.createElement("img"); img.alt = p.progetto; img.decoding="async"; img.loading="lazy";
    img.src = `${ASSETS.projectsImgBase}placeholder.png`; resolveProjectImage(p.progetto).then(u=>{ img.src = u; });
    logo.appendChild(img);
    const text = document.createElement("div"); text.className = "project-text";
    const titleEl = document.createElement("div"); titleEl.className="project-title"; titleEl.textContent=p.progetto; if((p.progetto||"").length>18) titleEl.classList.add("is-long");
    const subEl = document.createElement("div"); subEl.className="project-sub"; subEl.textContent=p.sottotitolo||""; if((p.sottotitolo||"").length>28) subEl.classList.add("is-long");
    text.append(titleEl, subEl);
    const tags = document.createElement("div"); tags.className = "project-tags";
    p.origCats.forEach(c=>{ const chip = document.createElement("span"); chip.className="tag-chip"; const group = toGroup(c)[0]; const col = colorFor(group); chip.style.setProperty("--bg", col); chip.style.setProperty("--bd", col); chip.textContent = c; tags.appendChild(chip); });
    a.append(logo, text, tags); grid.appendChild(a);
  });
}

/* ---------- Calendar nav + Speed dial ---------- */
function setupCalendarNav(){
  $("#prevMonth").addEventListener("click",()=>{ CURRENT_MONTH.setUTCMonth(CURRENT_MONTH.getUTCMonth()-1); renderCalendar(); });
  $("#nextMonth").addEventListener("click",()=>{ CURRENT_MONTH.setUTCMonth(CURRENT_MONTH.getUTCMonth()+1); renderCalendar(); });

  const btnCal=$("#btnViewCalendar"), btnMap=$("#btnViewMap"), grid=$("#calendarGrid"), mapWrap=$("#calendarMapWrap");
  btnCal.addEventListener("click",()=>{ btnCal.classList.add("is-active"); btnMap.classList.remove("is-active"); grid.hidden=false; mapWrap.hidden=true; });
  btnMap.addEventListener("click",async()=>{ btnMap.classList.add("is-active"); btnCal.classList.remove("is-active"); grid.hidden=true; mapWrap.hidden=false; await renderCalendarMap(); setTimeout(()=>{ if(calendarMap) calendarMap.invalidateSize(); },50); });
}

/* ---------- Calendario grid ---------- */
function renderCalendar(){
  const grid=$("#calendarGrid"); grid.innerHTML="";
  IT_DOW.forEach(d=>{ const el=document.createElement("div"); el.className="dow"; el.textContent=d; grid.appendChild(el); });
  const y=CURRENT_MONTH.getUTCFullYear(), m=CURRENT_MONTH.getUTCMonth();
  $("#monthLabel").textContent=`${IT_MONTHS[m]} ${y}`;
  const first=new Date(Date.UTC(y,m,1)), js=first.getUTCDay(), start=addDaysUTC(first,-((js+6)%7));
  for(let i=0;i<42;i++){
    const day=addDaysUTC(start,i), inMonth=day.getUTCMonth()===m;
    const cell=document.createElement("div"); cell.className=`day ${inMonth?"":"day--other"}`;
    const num=document.createElement("div"); num.className="day__num"; num.textContent=day.getUTCDate(); cell.appendChild(num);
    const icons=document.createElement("div"); icons.className="day__icons";
    const list=(EVENTS_BY_DAY.get(dateKeyUTC(day))||[]); const toShow=list.slice(0,3);
    toShow.forEach(ev=>icons.appendChild(makeEventIcon(ev)));
    const overflow=list.length-toShow.length; if(overflow>0){ const more=document.createElement("span"); more.className="event-more"; more.textContent=`+${overflow}`; more.addEventListener("click",e=>{e.stopPropagation(); openEventListForDay(dateKeyUTC(day));}); icons.appendChild(more); }
    if(list.length){ cell.style.cursor="pointer"; cell.addEventListener("click",()=> list.length===1?openEventDetail(list[0]):openEventListForDay(dateKeyUTC(day))); }
    cell.appendChild(icons); grid.appendChild(cell);
  }
}
function makeEventIcon(ev){
  const el=document.createElement("div");
  el.className=`event-icon ${presenceClass(ev.presenza)}`.trim();
  el.style.backgroundImage=`url("${ASSETS.iconsBase+encodeURIComponent(ev.tipo+".png")}")`;
  el.title=`${ev.evento} • ${formatDateRange(ev.from,ev.to)} • ${ev.città||""}`.trim();
  el.addEventListener("click",e=>{e.stopPropagation();openEventDetail(ev);});
  return el;
}
function openEventListForDay(k){ const list=(EVENTS_BY_DAY.get(k)||[]); if(!list.length) return; openEventDetail(list[0],list); }
function formatDateRange(a,b){ if(!a) return ""; const same=(!b||+a===+b), fmt=d=>`${String(d.getUTCDate()).padStart(2,"0")}/${String(d.getUTCMonth()+1).padStart(2,"0")}/${d.getUTCFullYear()}`; return same?fmt(a):`${fmt(a)} — ${fmt(b)}`; }

const MEDIA={code:"https://www.youtube.com/watch?v=1aHjWWfMRPY&list=RD1aHjWWfMRPY&start_radio=1",write:"https://www.youtube.com/watch?v=J0shA9J-4Nc&list=RDJ0shA9J-4Nc&start_radio=1&t=5052s",just_chill:"https://www.youtube.com/watch?v=0ld5H-X8XIE&list=RD0ld5H-X8XIE&start_radio=1"};
function ytWatchToEmbed(u){try{const x=new URL(u);const id=x.searchParams.get("v");const p=new URLSearchParams();if(x.searchParams.get("list"))p.set("list",x.searchParams.get("list"));if(x.searchParams.get("t"))p.set("start",x.searchParams.get("t").replace(/\D/g,""));p.set("autoplay","1");p.set("mute","0");p.set("modestbranding","1");p.set("playsinline","1");return id?`https://www.youtube.com/embed/${id}?${p.toString()}`:u;}catch{return u;}}
function setupSpeedDial(){
  const sd=$("#speedDial"); const main=$("#sdMain"); let t=null, pinned=false;
  const open=()=>{clearTimeout(t);sd.classList.add("open");};
  const scheduleClose=()=>{if(pinned)return;clearTimeout(t);t=setTimeout(()=>sd.classList.remove("open"),1500);};
  sd.addEventListener("mouseenter",open); sd.addEventListener("mouseleave",scheduleClose);
  main.addEventListener("click",()=>{ pinned=!pinned; sd.classList.toggle("pinned", pinned); if(pinned) open(); else scheduleClose(); });
  $$(".speed-item",$("#sdFan")).forEach(b=>b.addEventListener("click",()=>{ $("#musicFrame").src=ytWatchToEmbed(MEDIA[b.dataset.key]); $("#musicDock").hidden=false; }));
  $("#musicClose").addEventListener("click",()=>{ $("#musicFrame").src="about:blank"; $("#musicDock").hidden=true; });
}

/* ---------- Boot ---------- */
async function boot(){
  closeOnButtons();
  setupModules();
  setupCalendarNav();
  setupSpeedDial();

  await loadEnti();
  setupLoghiUtili();

  await loadEventi();
  renderCalendar();

  await loadProgetti();
  setupProgettiUI();

  renderConvenzionateAccordion();
}
document.addEventListener("DOMContentLoaded", boot);
