// main.js — Tubes + Fittings + Complex + Coassiali + Sconto + Trasporto/Imballaggio + FileName

// ---- Helpers DOM ---------------------------------------------------------
const $ = (id) => document.getElementById(id);
const firstEl = (...ids) => ids.map((i) => $(i)).find((n) => n);
const fmt = (n) =>
  Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const uniq = (arr) => [...new Set(arr.map((x) => String(x)))];
const normTH = (v) => {
  const s = String(v ?? "").trim();
  return s === "-" || s === "–" ? "" : s;
};

// ---- Descrizione: upper-casing parole chiave ------------------------------
function descUpper(s) {
  if (!s) return s;
  let out = String(s);

  // COAX / brand
  out = out
    .replace(/coassiali?/gi, "COAX")
    .replace(/coaxial/gi, "COAX")
    .replace(/\bcoax\b/gi, "COAX")
    .replace(/\bultron\b/gi, "ULTRON");

  // composti
  out = out
    .replace(/\btee purge\b/gi, "TEE PURGE")
    .replace(/\bend cap\b/gi, "END CAP")
    .replace(/\bsleeve\b/gi, "SLEEVE")
    .replace(/\bterminator\b/gi, "TERMINATOR");

  // singolari/plurali
  out = out
    .replace(/\belbows?\b/gi, (m) =>
      m.toLowerCase() === "elbow" ? "ELBOW" : "ELBOWS"
    )
    .replace(/\breducers?\b/gi, (m) =>
      m.toLowerCase() === "reducer" ? "REDUCER" : "REDUCERS"
    )
    .replace(/\btees?\b/gi, (m) => (m.toLowerCase() === "tee" ? "TEE" : "TEES"))
    .replace(/\btube\b/gi, "TUBE");

  return out;
}

// ---- Stato ----------------------------------------------------------------
const state = { catalog: [], cart: [] };

// ---- Riferimenti UI -------------------------------------------------------
let itemTypeEl,
  odEl,
  thEl,
  brandEl,
  asEl,
  qtyEl,
  qtyLabelEl,
  addBtn,
  tableBody,
  grandTotalEl;
// Dual (per tees/reducers/coassiali)
let od1El, th1El, od2El, th2El, dualWrap, singleWrap;

// Modal sconto + trasporto + file name
let discountModal,
  discountSuggested,
  discountSuggestedValue,
  discountNone,
  discountOther,
  discountOtherValue,
  discountConfirmBtn,
  transportSelect,
  fileNameInput;

// ---- Wire DOM -------------------------------------------------------------
function wireDom() {
  itemTypeEl = firstEl("itemType");
  // single
  odEl = firstEl("odSelect", "od");
  thEl = firstEl("thSelect", "th");
  // dual
  od1El = $("od1Select");
  th1El = $("th1Select");
  od2El = $("od2Select");
  th2El = $("th2Select");
  dualWrap = $("dualBlock");
  singleWrap = $("singleBlock");

  brandEl = firstEl("brandSelect", "brand");
  asEl = firstEl("alloySurcharge", "asInput", "as");
  qtyEl = firstEl("qtyInput", "qty");
  qtyLabelEl = firstEl("qtyLabel");
  addBtn = firstEl("addBtn", "addRow");
  tableBody = firstEl("tableBody") || document.querySelector("table tbody");
  grandTotalEl = firstEl("grandTotal", "grandTotalValue");

  // Modal sconto/trasporto/file
  const dm = $("discountModal");
  discountModal = dm && window.bootstrap ? new bootstrap.Modal(dm) : null;
  discountSuggested = $("discountSuggested");
  discountSuggestedValue = $("discountSuggestedValue");
  discountNone = $("discountNone");
  discountOther = $("discountOther");
  discountOtherValue = $("discountOtherValue");
  discountConfirmBtn = $("discountConfirmBtn");
  transportSelect = $("transportSelect");
  fileNameInput = $("fileNameInput");

  // Abilita/disabilita input "Altro"
  if (discountOther && discountOtherValue) {
    discountOther.addEventListener("change", () => {
      discountOtherValue.disabled = !discountOther.checked;
      if (discountOther.checked) discountOtherValue.focus();
    });
  }
  if (discountSuggested && discountOtherValue) {
    discountSuggested.addEventListener("change", () => {
      discountOtherValue.disabled = true;
    });
  }
  if (discountNone && discountOtherValue) {
    discountNone.addEventListener("change", () => {
      discountOtherValue.disabled = true;
    });
  }
}

// ---- Brand options (Ultron primo) ----------------------------------------
function updateBrandOptions(kind) {
  if (!brandEl) return;

  // kind: "Tubes" | "Fittings" | "Coaxial-Tubes" | "Coaxial-Elbows" | "Coaxial-Tees" | "Coaxial-Other"
  let wanted = [];
  if (kind === "Tubes") {
    wanted = ["Ultron", "VSR", "TCC", "TCC.1", "Finetron"]; // Ultron primo
  } else if (kind === "Fittings") {
    wanted = ["Ultron", "TCC", "TCC.1", "Finetron"]; // Ultron primo
  } else if (
    kind === "Coaxial-Tubes" ||
    kind === "Coaxial-Elbows" ||
    kind === "Coaxial-Tees"
  ) {
    wanted = ["Ultron", "TCC"]; // Tubes/Elbows/Tees: Ultron o TCC
  } else if (kind === "Coaxial-Other") {
    wanted = ["TCC"]; // Sleeve / Terminator / Tee Purge: solo TCC
  } else {
    wanted = ["Ultron", "TCC"]; // fallback
  }

  brandEl.innerHTML = wanted
    .map((v) => `<option value="${v}">${v}</option>`)
    .join("");
  brandEl.value = wanted[0]; // Ultron se presente
}

// ---- popolamento select TH (single) ----
function odChangedSingle() {
  const selectedOD = odEl.value;
  const ths = uniq(
    state.catalog
      .filter((r) => String(r.OD) === String(selectedOD))
      .map((r) => normTH(r.TH))
  );
  thEl.innerHTML = ths
    .map((th) => `<option value="${th}">${th || "-"}</option>`)
    .join("");
}

// ---- popolamento select (dual) ----
function refreshDualFromCatalog() {
  const od1s = uniq(state.catalog.map((r) => r.OD1));
  od1El.innerHTML = od1s
    .map((od) => `<option value="${od}">${od}</option>`)
    .join("");
  od1Changed();
}
function od1Changed() {
  const od1 = od1El.value;
  const th1s = uniq(
    state.catalog
      .filter((r) => String(r.OD1) === String(od1))
      .map((r) => normTH(r.TH1))
  );
  th1El.innerHTML = th1s
    .map((th) => `<option value="${th}">${th || "-"}</option>`)
    .join("");
  refreshOD2();
}
function refreshOD2() {
  const od1 = od1El.value;
  const th1 = th1El.value;
  const od2s = uniq(
    state.catalog
      .filter(
        (r) =>
          String(r.OD1) === String(od1) &&
          String(normTH(r.TH1)) === String(normTH(th1))
      )
      .map((r) => r.OD2)
  );
  od2El.innerHTML = od2s
    .map((od) => `<option value="${od}">${od}</option>`)
    .join("");
  od2Changed();
}
function od2Changed() {
  const od1 = od1El.value;
  const th1 = th1El.value;
  const od2 = od2El.value;

  const th2s = uniq(
    state.catalog
      .filter(
        (r) =>
          String(r.OD1) === String(od1) &&
          String(normTH(r.TH1)) === String(normTH(th1)) &&
          String(r.OD2) === String(od2)
      )
      .map((r) => normTH(r.TH2))
  );

  // Se non trova nulla, mostra comunque l’opzione vuota "-"
  const list = th2s.length ? th2s : [""];
  th2El.innerHTML = list
    .map((th) => `<option value="${th}">${th || "-"}</option>`)
    .join("");
}

// ---- Loader: Coassiali ----------------------------------------------------
async function loadCoaxial(subtype) {
  const params = new URLSearchParams({ subtype });
  const { items = [] } = await (
    await fetch(`/api/catalog/coaxial?${params}`)
  ).json();
  state.catalog = items || [];
  refreshDualFromCatalog(); // usa i selettori dual (OD1/TH1/OD2/TH2)
}

// ---- Loader: Tubes --------------------------------------------------------
async function loadTubes() {
  const res = await fetch("/api/catalog/tubes");
  const { items } = await res.json();
  state.catalog = items || [];
  const ods = uniq(state.catalog.map((r) => r.OD));
  odEl.innerHTML = ods
    .map((od) => `<option value="${od}">${od}</option>`)
    .join("");
  odChangedSingle();
}

// ---- Loader: Fittings (Elbows/Caps) ---------------------------------------
async function loadFittingsDirect(itemTypeRaw) {
  const v = String(itemTypeRaw || "")
    .trim()
    .toLowerCase();
  let type = "",
    angle = "";
  if (v.includes("elbows90") || v.includes("elbows 90")) {
    type = "Elbows";
    angle = "90";
  } else if (v.includes("elbows45") || v.includes("elbows 45")) {
    type = "Elbows";
    angle = "45";
  } else if (v.includes("caps") || v.includes("end caps")) {
    type = "Caps";
  } else {
    state.catalog = [];
    return;
  }

  const params = new URLSearchParams({ type });
  if (angle) params.set("angle", angle);
  const { items = [] } = await (
    await fetch(`/api/catalog/fittings?${params}`)
  ).json();

  let data = items.filter((r) => r && r.itemType);
  if (type === "Elbows")
    data = data.filter(
      (r) => r.itemType === "Elbows" && String(r.angle) === String(angle)
    );
  else data = data.filter((r) => r.itemType === type);

  state.catalog = data;
  const ods = uniq(state.catalog.map((r) => r.OD));
  odEl.innerHTML = ods
    .map((od) => `<option value="${od}">${od}</option>`)
    .join("");
  odChangedSingle();
}

// ---- Loader: Complex (Tees / Reducers) -----------------------------------
async function loadComplex(type) {
  const params = new URLSearchParams({ type }); // "Tees" | "Reducers"
  const { items = [] } = await (
    await fetch(`/api/catalog/complex?${params}`)
  ).json();
  state.catalog = items || [];
  refreshDualFromCatalog();
}

// ---- Tabella --------------------------------------------------------------
function recomputeGrandTotal() {
  const sum = state.cart.reduce((a, r) => a + (Number(r.lineTotal) || 0), 0);
  if (grandTotalEl) grandTotalEl.textContent = fmt(sum);
}

// ---- Tabella --------------------------------------------------------------
function recomputeGrandTotal() {
  const sum = state.cart.reduce((a, r) => a + (Number(r.lineTotal) || 0), 0);
  if (grandTotalEl) grandTotalEl.textContent = fmt(sum);
}

function renderTable() {
  tableBody.innerHTML = "";

  state.cart.forEach((r, idx) => {
    const isTube = r.itemType === "Tubes" || r.itemType === "Coassiali Tubes";
    const base = Number(r.basePricePerM ?? r.basePricePerPc ?? 0);
    const peso = Number(r.pesoKgM ?? 0);
    const alloy = Number(r.alloySurchargePerKg ?? 0);
    const canEditAlloy =
      isTube ||
      Number.isFinite(r.pesoKgM) ||
      Number.isFinite(r.alloySurchargePerKg);
    // ricalcola pu/tot in base allo stato attuale
    const unit = canEditAlloy ? base + alloy * peso : base;
    const qty = Math.max(0, Number(r.quantity ?? 0));
    const lineTotal = unit * qty;
    // salva nello state (mantiene sempre coerenti i numeri)
    r.unitPrice = unit;
    r.lineTotal = lineTotal;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${(idx + 1) * 100}</td>
      <td>${r.itemType || ""}</td>
      <td>${r.description || ""}</td>
      <td>${r.code || ""}</td>
      <td>${fmt(base)}</td>
      <td>
        ${
          canEditAlloy
            ? `<input type="number" class="form-control form-control-sm"
                   step="0.01" data-edit="alloy" data-idx="${idx}"
                   value="${Number.isFinite(alloy) ? alloy : 0}">`
            : `-`
        }
      </td>
      <td>${fmt(unit)}</td>
      <td>
      <input type="number" class="form-control form-control-sm"
               step="1" min="0" data-edit="qty" data-idx="${idx}"
               value="${qty}">
      </td>
      <td>${fmt(lineTotal)}</td>
      <td><button class="btn btn-sm btn-outline-danger" data-idx="${idx}">X</button></td>
    `;
    tableBody.appendChild(tr);
  });

  // Cancella riga
  tableBody.querySelectorAll("button[data-idx]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const i = Number(e.currentTarget.dataset.idx);
      state.cart.splice(i, 1);
      renderTable();
      recomputeGrandTotal();
    });
  });

  // Edit: Qty & Alloy
  tableBody.querySelectorAll('input[data-edit="qty"]').forEach((inp) => {
    inp.addEventListener("input", (e) => {
      const i = Number(e.currentTarget.dataset.idx);
      const raw = e.currentTarget.value;
      if (raw === "") return; // consenti di cancellare e riscrivere

      const v = Math.max(0, Number(raw || 0));
      state.cart[i].quantity = v;
      renderTable();
      recomputeGrandTotal();
    });
  });
  tableBody.querySelectorAll('input[data-edit="alloy"]').forEach((inp) => {
    inp.addEventListener("input", (e) => {
      const i = Number(e.currentTarget.dataset.idx);
      const raw = e.currentTarget.value;
      if (raw === "") return; // consenti di cancellare e riscrivere

      const v = Number(raw || 0);
      state.cart[i].alloySurchargePerKg = v;
      renderTable();
      recomputeGrandTotal();
    });
  });

  recomputeGrandTotal();
}

/* function renderTable() {
  tableBody.innerHTML = "";
  state.cart.forEach((r, idx) => {
    const base = r.basePricePerM ?? r.basePricePerPc ?? 0;
    const alloyDisplay =
      r.itemType === "Tubes" || r.itemType === "Coassiali Tubes"
        ? fmt(r.alloySurchargePerKg || 0)
        : "-";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${(idx + 1) * 100}</td>
      <td>${r.itemType}</td>
      <td>${r.description || ""}</td>
      <td>${r.code || ""}</td>
      <td>${fmt(base)}</td>
      <td>${alloyDisplay}</td>
      <td>${fmt(r.unitPrice || 0)}</td>
      <td>${fmt(r.quantity || 0)}</td>
      <td>${fmt(r.lineTotal || 0)}</td>
      <td><button class="btn btn-sm btn-outline-danger" data-idx="${idx}">X</button></td>
    `;
    tableBody.appendChild(tr);
  });

  // cancella riga
  tableBody.querySelectorAll("button[data-idx]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const i = Number(e.currentTarget.dataset.idx);
      state.cart.splice(i, 1);
      renderTable();
      recomputeGrandTotal();
    });
  });
} */

// ---- Add Row --------------------------------------------------------------
function attachAddHandler() {
  addBtn.addEventListener("click", () => {
    const typeSel = itemTypeEl.value || "Tubes";
    const qty = Math.max(1, Number(qtyEl.value || 0));

    // ===== COASSIALI =====
    if (typeSel.startsWith("Coassiali")) {
      const OD1 = od1El.value,
        TH1 = normTH(th1El.value);
      const OD2 = od2El.value,
        TH2 = normTH(th2El.value);
      const uiBrand = brandEl.value;

      const row = state.catalog.find(
        (r) =>
          String(r.OD1) === String(OD1) &&
          String(normTH(r.TH1)) === String(TH1) &&
          String(r.OD2) === String(OD2) &&
          String(normTH(r.TH2)) === String(TH2)
      );
      if (!row) return alert("Combinazione non trovata (Coassiali).");

      const avail = Object.keys(row.brands || {});
      // Tubes/Elbows/Tees -> Ultron/TCC ; Others -> TCC
      let allowed =
        typeSel === "Coassiali Tubes" ||
        typeSel.includes("Elbows") ||
        typeSel === "Coassiali Tees"
          ? ["Ultron", "TCC"]
          : ["TCC"];
      allowed = allowed.filter((b) => avail.includes(b));

      const effBrand = allowed.includes(uiBrand)
        ? uiBrand
        : allowed[0] || avail[0];
      const info = (row.brands || {})[effBrand] || {};

      if (typeSel === "Coassiali Tubes") {
        const base = Number(info.pricePerM || 0);
        const as = Number(asEl.value || 0);
        const peso = Number(row.pesoKgM || 0);
        const unit = base + as * peso;
        const lineTotal = unit * qty;

        // mm + spazio prima delle dimensioni
        const descrRaw = `${effBrand} coax tube mm ${OD1}${
          TH1 ? "x" + TH1 : ""
        } - ${OD2}${TH2 ? "x" + TH2 : ""}`;
        const descr = descUpper(descrRaw);

        state.cart.push({
          itemType: "Coassiali Tubes",
          brand: effBrand,
          description: descr,
          code: info.code || "",
          OD1,
          TH1,
          OD2,
          TH2,
          pesoKgM: peso,
          basePricePerM: base,
          alloySurchargePerKg: as,
          unitPrice: unit,
          quantity: qty,
          lineTotal,
        });
      } else {
        // NON-TUBES (Elbows / Tees / Sleeve / Terminator / Tee Purge) — niente alloy
        const base = Number(info.pricePerPc || 0);
        const unit = base;
        const lineTotal = unit * qty;

        // Label + angolo per elbows + lunghezza fissa per sleeve
        let label = typeSel.replace("Coassiali ", "").toLowerCase();
        let angle = "";
        if (typeSel === "Coassiali Elbows 90") {
          label = "elbow";
          angle = " 90°";
        } else if (typeSel === "Coassiali Elbows 45") {
          label = "elbow";
          angle = " 45°";
        }
        if (typeSel === "Coassiali Tees") label = "tee";

        const fixedLen = typeSel === "Coassiali Sleeve" ? " (L=101.60 mm)" : "";

        // mm + spazio prima delle dimensioni
        const descrRaw = `${effBrand} coax ${label}${angle} mm ${OD1}${
          TH1 ? "x" + TH1 : ""
        } - ${OD2}${TH2 ? "x" + TH2 : ""}${fixedLen}`;
        const descr = descUpper(descrRaw);

        state.cart.push({
          itemType: typeSel,
          brand: effBrand || "TCC",
          description: descr,
          code: info.code || "",
          OD1,
          TH1,
          OD2,
          TH2,
          basePricePerPc: base,
          alloySurchargePerKg: 0,
          unitPrice: unit,
          quantity: qty,
          lineTotal,
        });
      }

      renderTable();
      recomputeGrandTotal();
      return;
    }

    // ===== ORIGINALI =====
    if (typeSel === "Tubes") {
      const OD = odEl.value;
      const TH = thEl.value;
      const brand = brandEl.value;
      const row = state.catalog.find(
        (r) =>
          r.itemType === "Tubes" &&
          String(r.OD) === String(OD) &&
          String(r.TH) === String(TH)
      );
      if (!row) return alert("Combinazione OD/TH non trovata (Tubes).");
      const avail = Object.keys(row.brands || {});
      const effBrand = avail.includes(brand) ? brand : avail[0] || brand;
      const info = row.brands?.[effBrand] || {};
      const base = Number(info.pricePerM || 0);
      const as = Number(asEl.value || 0);
      const peso = Number(row.pesoKgM || 0);
      const unit = base + as * peso;
      const lineTotal = unit * qty;

      const descr = descUpper(`${effBrand} tube mm ${OD}x${TH}`);

      state.cart.push({
        itemType: "Tubes",
        brand: effBrand,
        description: descr,
        code: info.code || "",
        OD,
        TH,
        pesoKgM: peso,
        basePricePerM: base,
        alloySurchargePerKg: as,
        unitPrice: unit,
        quantity: qty,
        lineTotal,
      });
    } else if (
      typeSel === "Elbows90" ||
      typeSel === "Elbows45" ||
      typeSel === "Caps"
    ) {
      const OD = odEl.value;
      const TH = normTH(thEl.value);
      const brand = brandEl.value;
      const row = state.catalog.find(
        (r) =>
          String(r.OD) === String(OD) && String(normTH(r.TH)) === String(TH)
      );
      if (!row) return alert("Combinazione non trovata (fittings).");
      const avail = Object.keys(row.brands || {});
      const effBrand = avail.includes(brand) ? brand : avail[0] || brand;
      const info = row.brands?.[effBrand] || {};
      const base = Number(info.pricePerPc || 0);
      const unit = base; // Alloy zero
      const lineTotal = unit * qty;

      let descr = "";
      if (row.itemType === "Elbows")
        descr = descUpper(
          `${effBrand} elbow ${row.angle}° mm ${OD}${TH ? "x" + TH : ""}`
        );
      else if (row.itemType === "Caps")
        descr = descUpper(`${effBrand} end cap mm ${OD}${TH ? "x" + TH : ""}`);

      state.cart.push({
        itemType: row.itemType,
        brand: effBrand,
        description: descr,
        code: info.code || "",
        OD,
        TH,
        basePricePerPc: base,
        alloySurchargePerKg: 0,
        unitPrice: unit,
        quantity: qty,
        lineTotal,
      });
    } else if (typeSel === "Tees" || typeSel === "Reducers") {
      const OD1 = od1El.value,
        TH1 = normTH(th1El.value);
      const OD2 = od2El.value,
        TH2 = normTH(th2El.value);
      const brand = brandEl.value;

      const row = state.catalog.find(
        (r) =>
          String(r.OD1) === String(OD1) &&
          String(normTH(r.TH1)) === String(TH1) &&
          String(r.OD2) === String(OD2) &&
          String(normTH(r.TH2)) === String(TH2)
      );
      if (!row) return alert("Combinazione non trovata (Tees/Reducers).");

      const avail = Object.keys(row.brands || {});
      const effBrand = avail.includes(brand) ? brand : avail[0] || brand;
      const info = row.brands?.[effBrand] || {};
      const base = Number(info.pricePerPc || 0);
      const unit = base; // Alloy zero
      const lineTotal = unit * qty;

      const descr =
        row.itemType === "Tees"
          ? descUpper(
              `${effBrand} tee mm ${OD1}${TH1 ? "x" + TH1 : ""} - ${OD2}${
                TH2 ? "x" + TH2 : ""
              }`
            )
          : descUpper(
              `${effBrand} reducer mm ${OD1}${TH1 ? "x" + TH1 : ""} → ${OD2}${
                TH2 ? "x" + TH2 : ""
              }`
            );

      state.cart.push({
        itemType: row.itemType,
        brand: effBrand,
        description: descr,
        code: info.code || "",
        OD1,
        TH1,
        OD2,
        TH2,
        basePricePerPc: base,
        alloySurchargePerKg: 0,
        unitPrice: unit,
        quantity: qty,
        lineTotal,
      });
    }

    renderTable();
    recomputeGrandTotal();
  });
}

// ---- Sconto & Trasporto: helper ------------------------------------------
function computeCartTotal() {
  return state.cart.reduce((sum, r) => sum + (Number(r.lineTotal) || 0), 0);
}
function suggestedDiscountPercent(total) {
  if (total <= 20000) return 35.83;
  if (total <= 50000) return 41.18;
  if (total <= 100000) return 46.52;
  return 51.87;
}
function readTransportChoice() {
  const raw = transportSelect?.value || "nord|4";
  const [id, pctStr] = raw.split("|");
  const percent = Number(pctStr);
  let label = "";
  switch (id) {
    case "nord":
      label = "Nord Italia";
      break;
    case "centro":
      label = "Centro Italia";
      break;
    case "sud":
      label = "Sud Italia e Isole";
      break;
    case "sapioNord":
      label = 'Sapio "Nord"';
      break;
    default:
      label = "Nord Italia";
  }
  return { id, label, percent };
}

// ---- File name helpers ----------------------------------------------------
function defaultFileName() {
  return `Offerta_${new Date().toISOString().split("T")[0]}.xlsx`;
}
function readFileName() {
  const raw = (fileNameInput?.value || "").trim();
  const base = raw || `Offerta_${new Date().toISOString().split("T")[0]}`;
  const safe = base.replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, "_");
  return safe.toLowerCase().endsWith(".xlsx") ? safe : `${safe}.xlsx`;
}

// ---- Export con scelta sconto + trasporto + nome file ---------------------
async function doExport(discountPercent, transport, fileName) {
  try {
    const res = await fetch("/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rows: state.cart,
        currency: "EUR",
        discountPercent, // es. 41.18
        transport, // es. { id: "nord", label: "Nord Italia", percent: 4 }
      }),
    });
    if (!res.ok) throw new Error(await res.text());
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName || defaultFileName();
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error(err);
    alert("Errore export.");
  }
}

async function exportExcel() {
  if (!state.cart.length) return alert("La tabella è vuota.");

  const total = computeCartTotal();
  const suggested = suggestedDiscountPercent(total);

  // Se non c'è il modal, procede con default (sconto 0, Nord 4%, nome default)
  if (!discountModal) {
    const transport = readTransportChoice();
    const fileName = defaultFileName();
    return doExport(0, transport, fileName);
  }

  if (discountSuggestedValue)
    discountSuggestedValue.textContent = `${suggested.toFixed(2)}%`;
  if (discountSuggested) discountSuggested.checked = true;
  if (discountOtherValue) {
    discountOtherValue.value = "";
    discountOtherValue.disabled = true;
  }

  if (discountConfirmBtn) {
    const handler = async () => {
      let percent = 0;
      if (discountSuggested && discountSuggested.checked) {
        percent = suggested;
      } else if (discountNone && discountNone.checked) {
        percent = 0;
      } else if (discountOther && discountOther.checked) {
        const v = Number(discountOtherValue?.value || 0);
        if (isNaN(v) || v < 0 || v > 100) {
          alert("Inserisci una percentuale valida (0–100).");
          return;
        }
        percent = v;
      }
      const transport = readTransportChoice();
      const fileName = readFileName();
      discountConfirmBtn.removeEventListener("click", handler);
      discountModal.hide();
      await doExport(percent, transport, fileName);
    };
    discountConfirmBtn.addEventListener("click", handler, { once: true });
  }

  discountModal.show();
}

// ---- Init -----------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  wireDom();

  // Mostra/nasconde blocchi single/dual
  function setMode(mode) {
    if (mode === "dual") {
      dualWrap.style.display = "";
      singleWrap.style.display = "none";
    } else {
      dualWrap.style.display = "none";
      singleWrap.style.display = "";
    }
  }

  // Inizializza in base al tipo selezionato
  function loadByType() {
    const raw = itemTypeEl.value || "";
    const v = raw.toLowerCase();

    // ----- Coassiali -----
    if (raw.startsWith("Coassiali")) {
      if (raw === "Coassiali Tubes") {
        setMode("dual");
        updateBrandOptions("Coaxial-Tubes");
        qtyLabelEl.textContent = "Qty (m)";
        asEl.disabled = false;
        brandEl.disabled = false; // Ultron/TCC
        loadCoaxial("Tubes");
        return;
      }
      if (raw === "Coassiali Elbows 90") {
        setMode("dual");
        updateBrandOptions("Coaxial-Elbows");
        qtyLabelEl.textContent = "Qty (pcs)";
        asEl.disabled = true;
        brandEl.disabled = false; // Ultron/TCC
        loadCoaxial("Elbows 90");
        return;
      }
      if (raw === "Coassiali Elbows 45") {
        setMode("dual");
        updateBrandOptions("Coaxial-Elbows");
        qtyLabelEl.textContent = "Qty (pcs)";
        asEl.disabled = true;
        brandEl.disabled = false; // Ultron/TCC
        loadCoaxial("Elbows 45");
        return;
      }
      if (raw === "Coassiali Tees") {
        setMode("dual");
        updateBrandOptions("Coaxial-Tees");
        qtyLabelEl.textContent = "Qty (pcs)";
        asEl.disabled = true;
        brandEl.disabled = false; // Ultron/TCC
        loadCoaxial("Tees");
        return;
      }
      if (raw === "Coassiali Sleeve") {
        setMode("dual");
        updateBrandOptions("Coaxial-Other");
        qtyLabelEl.textContent = "Qty (pcs)";
        asEl.disabled = true;
        brandEl.disabled = true; // Solo TCC
        loadCoaxial("Sleeve");
        return;
      }
      if (raw === "Coassiali Terminator") {
        setMode("dual");
        updateBrandOptions("Coaxial-Other");
        qtyLabelEl.textContent = "Qty (pcs)";
        asEl.disabled = true;
        brandEl.disabled = true; // Solo TCC
        loadCoaxial("Terminator");
        return;
      }
      if (raw === "Coassiali Tee Purge") {
        setMode("dual");
        updateBrandOptions("Coaxial-Other");
        qtyLabelEl.textContent = "Qty (pcs)";
        asEl.disabled = true;
        brandEl.disabled = true; // Solo TCC
        loadCoaxial("Tee Purge");
        return;
      }
    }

    // ----- Originali -----
    if (v === "tubes") {
      setMode("single");
      updateBrandOptions("Tubes");
      qtyLabelEl.textContent = "Qty (m)";
      asEl.disabled = false;
      brandEl.disabled = false;
      loadTubes();
    } else if (
      v.includes("elbows90") ||
      v.includes("elbows 90") ||
      v.includes("elbows45") ||
      v.includes("elbows 45") ||
      v.includes("caps")
    ) {
      setMode("single");
      updateBrandOptions("Fittings");
      qtyLabelEl.textContent = "Qty (pcs)";
      asEl.disabled = true;
      brandEl.disabled = false;
      loadFittingsDirect(itemTypeEl.value);
    } else if (v === "tees" || v === "reducers") {
      setMode("dual");
      updateBrandOptions("Fittings");
      qtyLabelEl.textContent = "Qty (pcs)";
      asEl.disabled = true;
      brandEl.disabled = false;
      loadComplex(v === "tees" ? "Tees" : "Reducers");
    }
  }

  // Wire
  if (odEl) odEl.addEventListener("change", odChangedSingle);
  if (od1El) od1El.addEventListener("change", od1Changed);
  if (th1El) th1El.addEventListener("change", refreshOD2);
  if (od2El) od2El.addEventListener("change", od2Changed);

  attachAddHandler();
  itemTypeEl.addEventListener("change", loadByType);

  // Start
  loadByType();

  // Export con sconto + trasporto + nome file (mostra modal, poi POST)
  const exportBtn = $("exportBtn") || $("downloadBtn");
  if (exportBtn) exportBtn.addEventListener("click", exportExcel);
});

// ===== Importa Excel (ripopolare tabella e poi aggiungere nuove righe) =====
(function setupExcelImport() {
  const importBtn = document.getElementById("importBtn");
  const fileInput = document.getElementById("excelFileInput");
  if (!importBtn || !fileInput) return;

  importBtn.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/import", { method: "POST", body: fd });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const rows = Array.isArray(data.rows) ? data.rows : [];
      if (!rows.length) {
        alert("Nessuna riga trovata nel file.");
        fileInput.value = "";
        return;
      }

      // ripopola la tabella con i dati importati (poi puoi aggiungere nuove righe)
      state.cart = rows.map((r) => ({
        itemType:
          r.itemType ||
          (String(r.um || "").toLowerCase() === "mt" ? "Tubes" : "Imported"),
        description: r.description || r.descr || "",
        code: r.code || "",

        // IMPORTANTISSIMO: prezzo di listino (colonna M) come base
        basePricePerM: r.prezzoPienoM ?? null, // tubi €/m da M
        basePricePerPc: r.prezzoPienoM ?? null, // pezzi €/pc da M

        // altri campi tecnici se presenti
        pesoKgM:
          r.pesoKgM != null || r.peso != null
            ? Number(r.pesoKgM ?? r.peso)
            : null,
        alloySurchargePerKg:
          r.alloySurchargePerKg != null || r.asKg != null
            ? Number(r.alloySurchargePerKg ?? r.asKg)
            : null,

        // P.U. = prezzo pieno (M)
        unitPrice: r.prezzoPienoM ?? r.unitPrice ?? r.pu ?? null,

        quantity: Number(r.quantity ?? r.qty ?? 1) || 0,

        // ricalcoleremo i totali a renderTable(); se vuoi mantenerli:
        lineTotal: r.lineTotal ?? r.tot ?? null,

        // opzionali per item selection
        OD: r.OD || null,
        TH: r.TH || null,
        OD1: r.OD1 || null,
        TH1: r.TH1 || null,
        OD2: r.OD2 || null,
        TH2: r.TH2 || null,
      }));

      renderTable();
      recomputeGrandTotal();
      alert("Import completato. La tabella è stata ripopolata.");
    } catch (e) {
      console.error(e);
      alert("Errore durante l'import.");
    } finally {
      fileInput.value = "";
    }
  });
})();
