// main.js — Tubes + Fittings + Complex + Coassiali + Sconto + Trasporto/Imballaggio + FileName

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------
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

function splitDescrAndMeasure(txt) {
  const s = (txt || "").toString().trim();
  if (!s) return { descr: "", misura: "" };

  const mmIdx = s.toLowerCase().lastIndexOf(" mm ");
  if (mmIdx > -1) {
    return {
      descr: s.slice(0, mmIdx).trim(),
      misura: s.slice(mmIdx + 4).trim(),
    };
  }

  const m = s.match(/(.*)\s(\d+(?:[.,]\d+)?x\d+(?:[.,]\d+)?)\s*$/);
  if (m) return { descr: m[1].trim(), misura: m[2].trim() };
  return { descr: s, misura: "" };
}

// Descrizione: upper-casing parole chiave
function descUpper(s) {
  if (!s) return s;
  let out = String(s);
  out = out
    .replace(/coassiali?/gi, "COAX")
    .replace(/coaxial/gi, "COAX")
    .replace(/\bcoax\b/gi, "COAX")
    .replace(/\bultron\b/gi, "ULTRON");
  out = out
    .replace(/\btee purge\b/gi, "TEE PURGE")
    .replace(/\bend cap\b/gi, "END CAP")
    .replace(/\bsleeve\b/gi, "SLEEVE")
    .replace(/\bterminator\b/gi, "TERMINATOR");
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

// -----------------------------------------------------------------------------
// Stato + riferimenti DOM
// -----------------------------------------------------------------------------
const state = { catalog: [], cart: [] };

const dom = {
  itemTypeEl: null,
  // single
  odEl: null,
  thEl: null,
  // dual
  od1El: null,
  th1El: null,
  od2El: null,
  th2El: null,
  dualWrap: null,
  singleWrap: null,
  // shared
  brandEl: null,
  asEl: null,
  qtyEl: null,
  qtyLabelEl: null,
  addBtn: null,
  tableBody: null,
  grandTotalEl: null,
  // modal
  discountModal: null,
  discountSuggested: null,
  discountSuggestedValue: null,
  discountNone: null,
  discountOther: null,
  discountOtherValue: null,
  discountConfirmBtn: null,
  transportSelect: null,
  fileNameInput: null,
};

function wireDom() {
  dom.itemTypeEl = firstEl("itemType");

  dom.odEl = firstEl("odSelect", "od");
  dom.thEl = firstEl("thSelect", "th");

  dom.od1El = $("od1Select");
  dom.th1El = $("th1Select");
  dom.od2El = $("od2Select");
  dom.th2El = $("th2Select");
  dom.dualWrap = $("dualBlock");
  dom.singleWrap = $("singleBlock");

  dom.brandEl = firstEl("brandSelect", "brand");
  dom.asEl = firstEl("alloySurcharge", "asInput", "as");
  dom.qtyEl = firstEl("qtyInput", "qty");
  dom.qtyLabelEl = firstEl("qtyLabel");
  dom.addBtn = firstEl("addBtn", "addRow");
  dom.tableBody = firstEl("tableBody") || document.querySelector("table tbody");
  dom.grandTotalEl = firstEl("grandTotal", "grandTotalValue");
  const dm = $("discountModal");
  dom.discountModal = dm && window.bootstrap ? new bootstrap.Modal(dm) : null;
  dom.discountSuggested = $("discountSuggested");
  dom.discountSuggestedValue = $("discountSuggestedValue");
  dom.discountNone = $("discountNone");
  dom.discountOther = $("discountOther");
  dom.discountOtherValue = $("discountOtherValue");
  dom.discountConfirmBtn = $("discountConfirmBtn");
  dom.transportSelect = $("transportSelect");
  dom.fileNameInput = $("fileNameInput");
  if (dom.discountOther && dom.discountOtherValue) {
    dom.discountOther.addEventListener("change", () => {
      dom.discountOtherValue.disabled = !dom.discountOther.checked;
      if (dom.discountOther.checked) dom.discountOtherValue.focus();
    });
  }
  if (dom.discountSuggested && dom.discountOtherValue) {
    dom.discountSuggested.addEventListener("change", () => {
      dom.discountOtherValue.disabled = true;
    });
  }
  if (dom.discountNone && dom.discountOtherValue) {
    dom.discountNone.addEventListener("change", () => {
      dom.discountOtherValue.disabled = true;
    });
  }
}
// -----------------------------------------------------------------------------
// Brand options
// -----------------------------------------------------------------------------
function updateBrandOptions(kind) {
  if (!dom.brandEl) return;
  let wanted = [];
  if (kind === "Tubes") {
    wanted = ["Ultron", "VSR", "TCC", "TCC.1", "Finetron"];
  } else if (kind === "Fittings") {
    wanted = ["Ultron", "TCC", "TCC.1", "Finetron"];
  } else if (
    kind === "Coaxial-Tubes" ||
    kind === "Coaxial-Elbows" ||
    kind === "Coaxial-Tees"
  ) {
    wanted = ["Ultron", "TCC"];
  } else if (kind === "Coaxial-Other") {
    wanted = ["TCC"];
  } else {
    wanted = ["Ultron", "TCC"];
  }
  dom.brandEl.innerHTML = wanted
    .map((v) => `<option value="${v}">${v}</option>`)
    .join("");
  dom.brandEl.value = wanted[0];
}
// -----------------------------------------------------------------------------
// Selettori dimensioni
// -----------------------------------------------------------------------------
function odChangedSingle() {
  const selectedOD = dom.odEl.value;
  const ths = uniq(
    state.catalog
      .filter((r) => String(r.OD) === String(selectedOD))
      .map((r) => normTH(r.TH))
  );
  dom.thEl.innerHTML = ths
    .map((th) => `<option value="${th}">${th || "-"}</option>`)
    .join("");
}
function refreshDualFromCatalog() {
  const od1s = uniq(state.catalog.map((r) => r.OD1));
  dom.od1El.innerHTML = od1s
    .map((od) => `<option value="${od}">${od}</option>`)
    .join("");
  od1Changed();
}

function od1Changed() {
  const od1 = dom.od1El.value;
  const th1s = uniq(
    state.catalog
      .filter((r) => String(r.OD1) === String(od1))
      .map((r) => normTH(r.TH1))
  );
  dom.th1El.innerHTML = th1s
    .map((th) => `<option value="${th}">${th || "-"}</option>`)
    .join("");
  refreshOD2();
}

function refreshOD2() {
  const od1 = dom.od1El.value;
  const th1 = dom.th1El.value;
  const od2s = uniq(
    state.catalog
      .filter(
        (r) =>
          String(r.OD1) === String(od1) &&
          String(normTH(r.TH1)) === String(normTH(th1))
      )
      .map((r) => r.OD2)
  );
  dom.od2El.innerHTML = od2s
    .map((od) => `<option value="${od}">${od}</option>`)
    .join("");
  od2Changed();
}

function od2Changed() {
  const od1 = dom.od1El.value;
  const th1 = dom.th1El.value;
  const od2 = dom.od2El.value;

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

  const list = th2s.length ? th2s : [""];
  dom.th2El.innerHTML = list
    .map((th) => `<option value="${th}">${th || "-"}</option>`)
    .join("");
}

// -----------------------------------------------------------------------------
// Loader API
// -----------------------------------------------------------------------------
async function loadCoaxial(subtype) {
  const params = new URLSearchParams({ subtype });
  const { items = [] } = await (
    await fetch(`/api/catalog/coaxial?${params}`)
  ).json();
  state.catalog = items || [];
  refreshDualFromCatalog();
}

async function loadTubes() {
  const res = await fetch("/api/catalog/tubes");
  const { items } = await res.json();
  state.catalog = items || [];
  const ods = uniq(state.catalog.map((r) => r.OD));
  dom.odEl.innerHTML = ods
    .map((od) => `<option value="${od}">${od}</option>`)
    .join("");
  odChangedSingle();
}

async function loadFittingsDirect(itemTypeRaw) {
  const v = String(itemTypeRaw || "")
    .trim()
    .toLowerCase();
  let type = "";
  let angle = "";

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
  dom.odEl.innerHTML = ods
    .map((od) => `<option value="${od}">${od}</option>`)
    .join("");
  odChangedSingle();
}

async function loadComplex(type) {
  const params = new URLSearchParams({ type });
  const { items = [] } = await (
    await fetch(`/api/catalog/complex?${params}`)
  ).json();
  state.catalog = items || [];
  refreshDualFromCatalog();
}

// -----------------------------------------------------------------------------
// Tabella
// -----------------------------------------------------------------------------
function recomputeGrandTotal() {
  const sum = state.cart.reduce((a, r) => a + (Number(r.lineTotal) || 0), 0);
  if (dom.grandTotalEl) dom.grandTotalEl.textContent = fmt(sum);
}

function renderTable() {
  dom.tableBody.innerHTML = "";

  state.cart.forEach((r, idx) => {
    const isTube = r.itemType === "Tubes" || r.itemType === "Coassiali Tubes";
    const base = Number(r.basePricePerM ?? r.basePricePerPc ?? 0);
    const peso = Number(r.pesoKgM ?? 0);
    const alloy = Number(r.alloySurchargePerKg ?? 0);

    const unit = isTube ? base + alloy * peso : base;
    const qty = Number(r.quantity ?? 0);
    const lineTotal = unit * qty;

    r.unitPrice = unit;
    r.lineTotal = lineTotal;

    const { descr, misura } = splitDescrAndMeasure(r.description || "");

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${(idx + 1) * 100}</td>
      <td>${r.itemType || ""}</td>
      <td>${descr || ""}</td>
      <td>${misura ? "mm " + misura : ""}</td>
      <td>${r.code || ""}</td>
      <td>${fmt(base)}</td>
      <td>
        ${
          isTube
            ? `<input type="number" class="form-control form-control-sm" step="0.1" data-edit="alloy" data-idx="${idx}" value="${alloy}">`
            : `-`
        }
      </td>
      <td>${fmt(unit)}</td>
      <td>
        <input type="number" class="form-control form-control-sm" step="1" min="1" data-edit="qty" data-idx="${idx}" value="${qty}">
      </td>
      <td>${fmt(lineTotal)}</td>
      <td><button class="btn btn-sm btn-outline-danger" data-idx="${idx}">X</button></td>
    `;
    dom.tableBody.appendChild(tr);
  });

  dom.tableBody.querySelectorAll("button[data-idx]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const i = Number(e.currentTarget.dataset.idx);
      state.cart.splice(i, 1);
      renderTable();
      recomputeGrandTotal();
    });
  });

  dom.tableBody.querySelectorAll('input[data-edit="qty"]').forEach((inp) => {
    inp.addEventListener("input", (e) => {
      const i = Number(e.currentTarget.dataset.idx);
      const v = Math.max(1, Number(e.currentTarget.value || 1));
      state.cart[i].quantity = v;
      renderTable();
      recomputeGrandTotal();
    });
  });

  dom.tableBody.querySelectorAll('input[data-edit="alloy"]').forEach((inp) => {
    inp.addEventListener("input", (e) => {
      const i = Number(e.currentTarget.dataset.idx);
      const v = Number(e.currentTarget.value || 0);
      state.cart[i].alloySurchargePerKg = v;
      renderTable();
      recomputeGrandTotal();
    });
  });

  recomputeGrandTotal();
}

// -----------------------------------------------------------------------------
// Add row helpers
// -----------------------------------------------------------------------------
function chooseBrand(avail = [], requested) {
  return avail.includes(requested) ? requested : avail[0] || requested;
}

function addCoaxialRow(typeSel, qty) {
  const OD1 = dom.od1El.value;
  const TH1 = normTH(dom.th1El.value);
  const OD2 = dom.od2El.value;
  const TH2 = normTH(dom.th2El.value);
  const uiBrand = dom.brandEl.value;

  const row = state.catalog.find(
    (r) =>
      String(r.OD1) === String(OD1) &&
      String(normTH(r.TH1)) === String(TH1) &&
      String(r.OD2) === String(OD2) &&
      String(normTH(r.TH2)) === String(TH2)
  );
  if (!row) {
    alert("Combinazione non trovata (Coassiali).");
    return;
  }

  const avail = Object.keys(row.brands || {});
  let allowed =
    typeSel === "Coassiali Tubes" ||
    typeSel.includes("Elbows") ||
    typeSel === "Coassiali Tees"
      ? ["Ultron", "TCC"]
      : ["TCC"];
  allowed = allowed.filter((b) => avail.includes(b));

  const effBrand = allowed.includes(uiBrand) ? uiBrand : allowed[0] || avail[0];
  const info = (row.brands || {})[effBrand] || {};

  if (typeSel === "Coassiali Tubes") {
    const base = Number(info.pricePerM || 0);
    const as = Number(dom.asEl.value || 0);
    const peso = Number(row.pesoKgM || 0);
    const unit = base + as * peso;
    const lineTotal = unit * qty;

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
    const base = Number(info.pricePerPc || 0);
    const unit = base;
    const lineTotal = unit * qty;

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
}

function addStandardRow(typeSel, qty) {
  if (typeSel === "Tubes") {
    const OD = dom.odEl.value;
    const TH = dom.thEl.value;
    const brand = dom.brandEl.value;
    const row = state.catalog.find(
      (r) =>
        r.itemType === "Tubes" &&
        String(r.OD) === String(OD) &&
        String(r.TH) === String(TH)
    );
    if (!row) {
      alert("Combinazione OD/TH non trovata (Tubes).");
      return;
    }

    const effBrand = chooseBrand(Object.keys(row.brands || {}), brand);
    const info = row.brands?.[effBrand] || {};
    const base = Number(info.pricePerM || 0);
    const as = Number(dom.asEl.value || 0);
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
    return;
  }

  if (typeSel === "Elbows90" || typeSel === "Elbows45" || typeSel === "Caps") {
    const OD = dom.odEl.value;
    const TH = normTH(dom.thEl.value);
    const brand = dom.brandEl.value;
    const row = state.catalog.find(
      (r) => String(r.OD) === String(OD) && String(normTH(r.TH)) === String(TH)
    );
    if (!row) {
      alert("Combinazione non trovata (fittings).");
      return;
    }

    const effBrand = chooseBrand(Object.keys(row.brands || {}), brand);
    const info = row.brands?.[effBrand] || {};
    const base = Number(info.pricePerPc || 0);
    const unit = base;
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
    return;
  }

  if (typeSel === "Tees" || typeSel === "Reducers") {
    const OD1 = dom.od1El.value;
    const TH1 = normTH(dom.th1El.value);
    const OD2 = dom.od2El.value;
    const TH2 = normTH(dom.th2El.value);
    const brand = dom.brandEl.value;

    const row = state.catalog.find(
      (r) =>
        String(r.OD1) === String(OD1) &&
        String(normTH(r.TH1)) === String(TH1) &&
        String(r.OD2) === String(OD2) &&
        String(normTH(r.TH2)) === String(TH2)
    );
    if (!row) {
      alert("Combinazione non trovata (Tees/Reducers).");
      return;
    }

    const effBrand = chooseBrand(Object.keys(row.brands || {}), brand);
    const info = row.brands?.[effBrand] || {};
    const base = Number(info.pricePerPc || 0);
    const unit = base;
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
}

function attachAddHandler() {
  if (!dom.addBtn) return;
  dom.addBtn.addEventListener("click", () => {
    const typeSel = dom.itemTypeEl.value || "Tubes";
    const qty = Math.max(1, Number(dom.qtyEl.value || 0));

    if (typeSel.startsWith("Coassiali")) {
      addCoaxialRow(typeSel, qty);
    } else {
      addStandardRow(typeSel, qty);
    }

    renderTable();
    recomputeGrandTotal();
  });
}

// -----------------------------------------------------------------------------
// Sconto & Trasporto
// -----------------------------------------------------------------------------
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
  const raw = dom.transportSelect?.value || "nord|4";
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

// -----------------------------------------------------------------------------
// File name helpers
// -----------------------------------------------------------------------------
function defaultFileName() {
  return `Offerta_${new Date().toISOString().split("T")[0]}.xlsx`;
}

function readFileName() {
  const raw = (dom.fileNameInput?.value || "").trim();
  const base = raw || `Offerta_${new Date().toISOString().split("T")[0]}`;
  const safe = base.replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, "_");
  return safe.toLowerCase().endsWith(".xlsx") ? safe : `${safe}.xlsx`;
}

// -----------------------------------------------------------------------------
// Export
// -----------------------------------------------------------------------------
async function doExport(discountPercent, transport, fileName) {
  try {
    const res = await fetch("/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rows: state.cart,
        currency: "EUR",
        discountPercent,
        transport,
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
  if (!state.cart.length) {
    alert("La tabella è vuota.");
    return;
  }

  const total = computeCartTotal();
  const suggested = suggestedDiscountPercent(total);

  if (!dom.discountModal) {
    const transport = readTransportChoice();
    const fileName = defaultFileName();
    return doExport(0, transport, fileName);
  }

  if (dom.discountSuggestedValue)
    dom.discountSuggestedValue.textContent = `${suggested.toFixed(2)}%`;
  if (dom.discountSuggested) dom.discountSuggested.checked = true;
  if (dom.discountOtherValue) {
    dom.discountOtherValue.value = "";
    dom.discountOtherValue.disabled = true;
  }

  if (dom.discountConfirmBtn) {
    const handler = async () => {
      let percent = 0;
      if (dom.discountSuggested && dom.discountSuggested.checked) {
        percent = suggested;
      } else if (dom.discountNone && dom.discountNone.checked) {
        percent = 0;
      } else if (dom.discountOther && dom.discountOther.checked) {
        const v = Number(dom.discountOtherValue?.value || 0);
        if (Number.isNaN(v) || v < 0 || v > 100) {
          alert("Inserisci una percentuale valida (0–100).");
          return;
        }
        percent = v;
      }
      const transport = readTransportChoice();
      const fileName = readFileName();
      await doExport(percent, transport, fileName);
    };

    dom.discountConfirmBtn.addEventListener("click", handler, { once: true });
  }

  dom.discountModal.show();
}

// -----------------------------------------------------------------------------
// Init
// -----------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  wireDom();

  function setMode(mode) {
    if (mode === "dual") {
      dom.dualWrap.style.display = "";
      dom.singleWrap.style.display = "none";
    } else {
      dom.dualWrap.style.display = "none";
      dom.singleWrap.style.display = "";
    }
  }

  function loadByType() {
    const raw = dom.itemTypeEl.value || "";
    const v = raw.toLowerCase();

    if (raw.startsWith("Coassiali")) {
      if (raw === "Coassiali Tubes") {
        setMode("dual");
        updateBrandOptions("Coaxial-Tubes");
        dom.qtyLabelEl.textContent = "Qty (m)";
        dom.asEl.disabled = false;
        dom.brandEl.disabled = false;
        loadCoaxial("Tubes");
        return;
      }
      if (raw === "Coassiali Elbows 90") {
        setMode("dual");
        updateBrandOptions("Coaxial-Elbows");
        dom.qtyLabelEl.textContent = "Qty (pcs)";
        dom.asEl.disabled = true;
        dom.brandEl.disabled = false;
        loadCoaxial("Elbows 90");
        return;
      }
      if (raw === "Coassiali Elbows 45") {
        setMode("dual");
        updateBrandOptions("Coaxial-Elbows");
        dom.qtyLabelEl.textContent = "Qty (pcs)";
        dom.asEl.disabled = true;
        dom.brandEl.disabled = false;
        loadCoaxial("Elbows 45");
        return;
      }
      if (raw === "Coassiali Tees") {
        setMode("dual");
        updateBrandOptions("Coaxial-Tees");
        dom.qtyLabelEl.textContent = "Qty (pcs)";
        dom.asEl.disabled = true;
        dom.brandEl.disabled = false;
        loadCoaxial("Tees");
        return;
      }
      if (raw === "Coassiali Sleeve") {
        setMode("dual");
        updateBrandOptions("Coaxial-Other");
        dom.qtyLabelEl.textContent = "Qty (pcs)";
        dom.asEl.disabled = true;
        dom.brandEl.disabled = true;
        loadCoaxial("Sleeve");
        return;
      }
      if (raw === "Coassiali Terminator") {
        setMode("dual");
        updateBrandOptions("Coaxial-Other");
        dom.qtyLabelEl.textContent = "Qty (pcs)";
        dom.asEl.disabled = true;
        dom.brandEl.disabled = true;
        loadCoaxial("Terminator");
        return;
      }
      if (raw === "Coassiali Tee Purge") {
        setMode("dual");
        updateBrandOptions("Coaxial-Other");
        dom.qtyLabelEl.textContent = "Qty (pcs)";
        dom.asEl.disabled = true;
        dom.brandEl.disabled = true;
        loadCoaxial("Tee Purge");
        return;
      }
    }

    if (v === "tubes") {
      setMode("single");
      updateBrandOptions("Tubes");
      dom.qtyLabelEl.textContent = "Qty (m)";
      dom.asEl.disabled = false;
      dom.brandEl.disabled = false;
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
      dom.qtyLabelEl.textContent = "Qty (pcs)";
      dom.asEl.disabled = true;
      dom.brandEl.disabled = false;
      loadFittingsDirect(dom.itemTypeEl.value);
    } else if (v === "tees" || v === "reducers") {
      setMode("dual");
      updateBrandOptions("Fittings");
      dom.qtyLabelEl.textContent = "Qty (pcs)";
      dom.asEl.disabled = true;
      dom.brandEl.disabled = false;
      loadComplex(v === "tees" ? "Tees" : "Reducers");
    }
  }

  if (dom.odEl) dom.odEl.addEventListener("change", odChangedSingle);
  if (dom.od1El) dom.od1El.addEventListener("change", od1Changed);
  if (dom.th1El) dom.th1El.addEventListener("change", refreshOD2);
  if (dom.od2El) dom.od2El.addEventListener("change", od2Changed);

  attachAddHandler();
  dom.itemTypeEl.addEventListener("change", loadByType);

  loadByType();

  const exportBtn = $("exportBtn") || $("downloadBtn");
  if (exportBtn) exportBtn.addEventListener("click", exportExcel);
});

// -----------------------------------------------------------------------------
// Importa Excel
// -----------------------------------------------------------------------------
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

      state.cart = rows.map((r) => ({
        itemType:
          r.itemType ||
          (String(r.um || "").toLowerCase() === "mt" ? "Tubes" : "Imported"),
        description: r.description || r.descr || "",
        code: r.code || "",
        basePricePerM: r.prezzoPienoM ?? null,
        basePricePerPc: r.prezzoPienoM ?? null,
        pesoKgM: r.pesoKgM ?? r.peso ?? null,
        alloySurchargePerKg: r.alloySurchargePerKg ?? r.asKg ?? null,
        unitPrice: r.prezzoPienoM ?? r.unitPrice ?? r.pu ?? null,
        quantity: Number(r.quantity ?? r.qty ?? 1),
        lineTotal: r.lineTotal ?? r.tot ?? null,
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
