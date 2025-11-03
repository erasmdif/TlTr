/* =====================================================
   Logo Banner Builder (standalone component)
   - window.LogoBannerBuilder.open(logos, {base})
   - logos: [{name, file}], base: path base immagini
   ===================================================== */
(function(){
  const DEFAULT_EXCLUDED = [
    "changes",
    "italia_domani",
    "banda unita ministero/changes/italiadomani",
    "Ministero dell’Università e della ricerca",
    "fondazione unione europea",
    "banda unita ministero/changes/italiadomani",
    "PASAP-MED",
    "banda completa PASAP-MED (A2)"
  ].map(n => n.toLowerCase());

  const norm = s => (s||"").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu,"").trim();
  function cmToPx(cm, dpi=300){ return Math.round((cm/2.54)*dpi); }

  function makeDialog(){
    let dlg = document.getElementById("logoBannerDialog");
    if(dlg) return dlg;
    dlg = document.createElement("dialog");
    dlg.id="logoBannerDialog";
    dlg.innerHTML = `
      <div class="lb__wrap">
        <div class="lb__head">
          <div class="lb__title">Crea banda loghi</div>
          <button class="lb__close" aria-label="Chiudi">&times;</button>
        </div>

        <div class="lb__toolbar">
          <div class="field">
            <label>Righe</label>
            <input id="lbRows" type="number" min="1" value="2">
          </div>
          <div class="field">
            <label>Colonne (0 = auto)</label>
            <input id="lbCols" type="number" min="0" value="0">
          </div>
          <div class="field">
            <label>Larghezza</label>
            <input id="lbWcm" type="text" value="30"> <span>cm</span>
          </div>
          <div class="field">
            <label>Altezza</label>
            <input id="lbHcm" type="text" value="6"> <span>cm</span>
          </div>
          <div class="field">
            <label>Formato</label>
            <select id="lbFormat">
              <option value="png">PNG</option>
              <option value="jpg">JPG</option>
            </select>
          </div>
          <div class="field">
            <label>Sfondo</label>
            <input id="lbBg" type="color" value="#ffffff">
            <label style="margin-left:8px; display:inline-flex; align-items:center; gap:4px;">
              <input id="lbBgTransparent" type="checkbox"> Trasparente
            </label>
          </div>
          <div class="field">
            <button id="lbSelectAll" class="btn btn-sm" type="button">Seleziona tutti</button>
            <button id="lbDefaultSel" class="btn btn-sm" type="button">Default</button>
            <button id="lbClearAll" class="btn btn-sm" type="button">Nessuno</button>
          </div>
        </div>

        <details class="lb-acc" id="lbAcc">
          <summary>
            Includi/escludi loghi <span id="lbAccCount" class="lb-acc__count"></span>
          </summary>
          <div id="lbChips" class="lb__chips"></div>
        </details>

        <div class="lb__toolbar lb__toolbar--secondary">
          <div class="field">
            <label>Elemento selezionato:</label>
            <strong id="lbSelName">—</strong>
          </div>
          <div class="field">
            <label>Altezza (righe)</label>
            <input id="lbRowSpan" type="number" min="1" max="6" value="1">
          </div>
          <div class="field">
            <label>Larghezza (colonne)</label>
            <input id="lbColSpan" type="number" min="1" max="6" value="1">
          </div>
          <div class="field">
            <button id="lbResetSpan" class="btn btn-sm" type="button">Reset dimensioni</button>
          </div>
          <div class="field small-note">
            Suggerimento: trascina i loghi per cambiare ordine; puoi dare a qualcuno 2×1, 1×2, 2×2, ecc.
          </div>
        </div>

        <div class="lb__preview">
          <div id="lbGrid" class="lb-grid"></div>
        </div>

        <div class="lb__footer">
          <button id="lbExport" class="btn primary" type="button">Esporta</button>
        </div>
      </div>`;
    document.body.appendChild(dlg);
    dlg.querySelector(".lb__close").addEventListener("click", ()=>dlg.close());
    return dlg;
  }

  // Genera una disposizione con spans in C colonne; aggiunge righe se necessario.
  function layoutWithSpans(items, C){
    const occ = []; // matrice booleana [rows][C]
    const positions = new Map(); // name -> {r,c,rSpan,cSpan}
    let rows = 0;

    function ensureRows(n){
      while(rows < n){
        occ.push(Array(C).fill(false));
        rows++;
      }
    }

    for(const it of items){
      const rSpan = Math.max(1, it.rSpan|0);
      const cSpan = Math.max(1, it.cSpan|0);
      let placed = false;
      let r = 0;
      while(!placed){
        ensureRows(r + rSpan);
        for(let c=0; c <= C - cSpan; c++){
          // verifica spazio libero r..r+rSpan-1, c..c+cSpan-1
          let ok = true;
          for(let rr=0; rr<rSpan && ok; rr++){
            for(let cc=0; cc<cSpan; cc++){
              if(occ[r+rr][c+cc]){ ok=false; break; }
            }
          }
          if(ok){
            // occupa
            for(let rr=0; rr<rSpan; rr++){
              for(let cc=0; cc<cSpan; cc++){
                occ[r+rr][c+cc] = true;
              }
            }
            positions.set(it.name, {r,c,rSpan,cSpan});
            placed = true; break;
          }
        }
        if(!placed) r++;
      }
    }
    return { rows, positions };
  }

  function build(logos, opts){
    const base = (opts && opts.base) || "./";
    const dlg = makeDialog();
    const chips = dlg.querySelector("#lbChips");
    const grid  = dlg.querySelector("#lbGrid");
    const rowsEl = dlg.querySelector("#lbRows");
    const colsEl = dlg.querySelector("#lbCols");
    const wEl = dlg.querySelector("#lbWcm");
    const hEl = dlg.querySelector("#lbHcm");
    const fmtEl = dlg.querySelector("#lbFormat");
    const bgEl = dlg.querySelector("#lbBg");
    const bgTrEl = dlg.querySelector("#lbBgTransparent");
    const btnExport = dlg.querySelector("#lbExport");
    const btnSelAll = dlg.querySelector("#lbSelectAll");
    const btnDefSel = dlg.querySelector("#lbDefaultSel");
    const btnClrAll = dlg.querySelector("#lbClearAll");

    const selName = dlg.querySelector("#lbSelName");
    const rowSpanEl = dlg.querySelector("#lbRowSpan");
    const colSpanEl = dlg.querySelector("#lbColSpan");
    const btnResetSpan = dlg.querySelector("#lbResetSpan");

    // stato
    const items = logos.map((l,i)=>({
      name: l.name, file: l.file, url: base + encodeURIComponent(l.file),
      active: !DEFAULT_EXCLUDED.includes(norm(l.name)), // default: escludi indicati
      idx: i, rSpan: 1, cSpan: 1
    }));

    let order = items.map((_,i)=>i); // ordine corrente
    let selected = null;             // name selezionato per span

    function renderChips(){
      chips.innerHTML = "";
      items.forEach((it)=>{
        const b = document.createElement("span");
        b.className = "lb-chip" + (it.active ? " active": "");
        b.textContent = it.name;
        b.title = it.name;
        b.addEventListener("click", ()=>{
          it.active = !it.active; renderChips(); renderGrid();
        });
        chips.appendChild(b);
      });
         const accCount = dlg.querySelector("#lbAccCount");
         if (accCount) accCount.textContent = `(${items.filter(i=>i.active).length}/${items.length})`;

    }

    function activeItems(){
      return order.map(i=>items[i]).filter(it=>it.active);
    }

    function selectItemByName(name){
      selected = name || null;
      selName.textContent = selected || "—";
      const it = items.find(x=>x.name===selected);
      rowSpanEl.value = it ? it.rSpan : 1;
      colSpanEl.value = it ? it.cSpan : 1;
      // aggiorna highlight
      grid.querySelectorAll(".lb-item").forEach(el=>{
        el.classList.toggle("selected", el.dataset.name===selected);
      });
    }

    function renderGrid(){
    grid.innerHTML = "";

    const act = activeItems();

    // --- usa Righe scelte dall'utente (default 2) ---
    const R = Math.max(1, parseInt(rowsEl.value || "2", 10));
    const forcedC = Math.max(0, parseInt(colsEl.value || "0", 10));
    const C = forcedC > 0 ? forcedC : Math.max(1, Math.ceil(act.length / R));

    // CSS grid: colonne fisse, righe implicite; packing denso
    grid.style.gridTemplateColumns = `repeat(${C}, 1fr)`;

    act.forEach((it)=>{
        const cell = document.createElement("div");
        cell.className = "lb-item";
        cell.draggable = true;
        cell.dataset.name = it.name;

        // span personalizzati
        cell.style.gridColumn = `span ${Math.max(1, it.cSpan|0)}`;
        cell.style.gridRow = `span ${Math.max(1, it.rSpan|0)}`;

        cell.innerHTML = `<span class="cap">↕︎</span>`;
        const img = new Image();
        img.src = it.url; img.alt = it.name;
        cell.appendChild(img);
        grid.appendChild(cell);

        // selezione per cambiare span
        cell.addEventListener("click", ()=>{ selectItemByName(it.name); });

        // drag & drop riordino
        cell.addEventListener("dragstart", e=>{
        e.dataTransfer.setData("text/plain", it.name);
        cell.classList.add("dragging");
        });
        cell.addEventListener("dragend", ()=>cell.classList.remove("dragging"));
        cell.addEventListener("dragover", e=>e.preventDefault());
        cell.addEventListener("drop", e=>{
        e.preventDefault();
        const fromName = e.dataTransfer.getData("text/plain");
        const a = order.findIndex(i=>items[i].name===fromName);
        const b = order.findIndex(i=>items[i].name===it.name);
        if(a<0 || b<0 || a===b) return;
        const tmp = order[a]; order[a]=order[b]; order[b]=tmp;
        renderGrid();
        });
    });

    // mantieni evidenza dell'elemento selezionato
    if(selected) selectItemByName(selected);
    }

    function clampSpan(v){ v = Math.floor(+v||1); return Math.max(1, Math.min(6, v)); }

    rowSpanEl.addEventListener("change", ()=>{
      if(!selected) return;
      const it = items.find(x=>x.name===selected); if(!it) return;
      it.rSpan = clampSpan(rowSpanEl.value);
      renderGrid();
    });
    colSpanEl.addEventListener("change", ()=>{
      if(!selected) return;
      const it = items.find(x=>x.name===selected); if(!it) return;
      it.cSpan = clampSpan(colSpanEl.value);
      renderGrid();
    });
    btnResetSpan.addEventListener("click", ()=>{
      if(!selected) return;
      const it = items.find(x=>x.name===selected); if(!it) return;
      it.rSpan = 1; it.cSpan = 1;
      rowSpanEl.value = 1; colSpanEl.value = 1;
      renderGrid();
    });

    function hexToRGBA(hex){
      if(!hex) return {r:255,g:255,b:255,a:1};
      const m = hex.replace("#","").trim();
      const bigint = parseInt(m.length===3 ? m.split("").map(x=>x+x).join("") : m, 16);
      return { r:(bigint>>16)&255, g:(bigint>>8)&255, b:bigint&255, a:1 };
    }

    async function exportImage(){
      const act = activeItems();
      if(!act.length){ alert("Nessun logo selezionato."); return; }

      // dimensioni
      const wcm = parseFloat((wEl.value||"30").replace(",","."));
      const hcm = parseFloat((hEl.value||"6").replace(",","."));
      const dpi = 300;
      const W = cmToPx(wcm, dpi);
      const H = cmToPx(hcm, dpi);

      // colonne base
      const R = Math.max(1, parseInt(rowsEl.value || "2", 10));
      const forcedC = Math.max(0, parseInt(colsEl.value || "0", 10))
      const C = forcedC > 0 ? forcedC : Math.max(1, Math.ceil(act.length / R));

      // calcola layout preciso (con spans) per conoscere le righe finali usate
      const { rows: Rused, positions } = layoutWithSpans(act, C);

      // canvas
      const canvas = document.createElement("canvas");
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext("2d");

      // sfondo
      const fmt = fmtEl.value;
      const transparent = (fmt==="png") && bgTrEl.checked;
      if(!transparent){
        const bg = hexToRGBA(bgEl.value);
        ctx.fillStyle = `rgb(${bg.r},${bg.g},${bg.b})`;
        ctx.fillRect(0,0,W,H);
      }else{
        // trasparente: niente fill
      }

      const gap = Math.round(Math.min(W,H)*0.02); // 2% gap
      const pad = gap;
      const cellW = Math.floor((W - pad*2 - gap*(C-1)) / C);
      const cellH = Math.floor((H - pad*2 - gap*(Rused-1)) / Rused);

      // carica immagini
      const load = (url)=>new Promise((res)=>{
        const im = new Image(); im.crossOrigin="anonymous"; im.onload=()=>res(im); im.onerror=()=>res(null); im.src=url;
      });
      const imgs = await Promise.all(act.map(it=>load(it.url)));

      // disegna seguendo posizioni + spans
      for(let i=0;i<act.length;i++){
        const it = act[i];
        const pos = positions.get(it.name);
        if(!pos) continue;
        const im = imgs[i];

        const x = pad + pos.c*(cellW+gap);
        const y = pad + pos.r*(cellH+gap);
        const boxW = pos.cSpan*cellW + (pos.cSpan-1)*gap;
        const boxH = pos.rSpan*cellH + (pos.rSpan-1)*gap;

        if(im){
          // fit dentro il box mantenendo ratio con piccoli margini interni
          const margin = Math.floor(Math.min(boxW,boxH)*0.08);
          const availW = boxW - margin*2;
          const availH = boxH - margin*2;
          const scale = Math.min(availW/im.width, availH/im.height);
          const dw = Math.floor(im.width*scale);
          const dh = Math.floor(im.height*scale);
          const dx = x + Math.floor((boxW - dw)/2);
          const dy = y + Math.floor((boxH - dh)/2);
          ctx.drawImage(im, dx, dy, dw, dh);
        }else{
          ctx.strokeStyle="#cccccc"; ctx.strokeRect(x+4,y+4,boxW-8,boxH-8);
        }
      }

      const ext = fmt === "jpg" ? "image/jpeg" : "image/png";
      const url = canvas.toDataURL(ext, 0.95);
      const a = document.createElement("a");
      a.href = url;
      a.download = `banda_loghi_${act.length}_${C}col.${fmt}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }

    // toolbar buttons
    btnExport.addEventListener("click", exportImage);
    btnSelAll.addEventListener("click", ()=>{ items.forEach(i=>i.active=true); renderChips(); renderGrid(); });
    btnClrAll.addEventListener("click", ()=>{ items.forEach(i=>i.active=false); renderChips(); renderGrid(); });
    btnDefSel.addEventListener("click", ()=>{ items.forEach(i=>i.active=!DEFAULT_EXCLUDED.includes(norm(i.name))); renderChips(); renderGrid(); });

    rowsEl.addEventListener("change", renderGrid);
    colsEl.addEventListener("change", renderGrid);

    renderChips(); renderGrid();
    selectItemByName(null);
    dlg.showModal();
  }

  window.LogoBannerBuilder = {
    open(logos, opts){ build(logos, opts||{}); }
  };
})();
