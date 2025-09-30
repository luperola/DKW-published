import express from "express";
import cors from "cors";
import ExcelJS from "exceljs";
import path from "path";
import { fileURLToPath } from "url";
import { loadCatalog } from "./catalogLoader.js";
import multer from "multer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

let catalog = loadCatalog();
const upload = multer({ storage: multer.memoryStorage() });

// Endpoint base esistenti
app.get("/api/catalog/tubes", (req, res) => {
  res.json({ items: catalog.tubes || [] });
});

app.get("/api/catalog/fittings", (req, res) => {
  const { type, angle, OD, TH } = req.query;
  let items = catalog.fittings || [];
  if (type) items = items.filter((r) => r.itemType === type);
  if (angle) items = items.filter((r) => String(r.angle) === String(angle));
  if (OD) items = items.filter((r) => String(r.OD) === String(OD));
  if (TH) items = items.filter((r) => String(r.TH || "") === String(TH || ""));
  res.json({ items });
});

// NUOVO: Tees & Reducers (doppio diametro)
app.get("/api/catalog/complex", (req, res) => {
  const { type, OD1, TH1, OD2, TH2 } = req.query; // tutti opzionali
  let items = (catalog.complex || []).slice();

  if (type) items = items.filter((r) => r.itemType === type);

  // se passati, filtra anche per diametri/spessori
  if (OD1) items = items.filter((r) => String(r.OD1) === String(OD1));
  if (TH1)
    items = items.filter((r) => String(r.TH1 || "") === String(TH1 || ""));
  if (OD2) items = items.filter((r) => String(r.OD2) === String(OD2));
  if (TH2)
    items = items.filter((r) => String(r.TH2 || "") === String(TH2 || ""));

  res.json({ items });
});

// Export Excel

// Coassiali
app.get("/api/catalog/coaxial", (req, res) => {
  const { subtype, OD1, TH1, OD2, TH2 } = req.query;
  let items = (catalog.coaxial || []).slice();
  if (subtype) items = items.filter((r) => r.subtype === subtype);
  if (OD1) items = items.filter((r) => String(r.OD1) === String(OD1));
  if (TH1)
    items = items.filter((r) => String(r.TH1 || "") === String(TH1 || ""));
  if (OD2) items = items.filter((r) => String(r.OD2) === String(OD2));
  if (TH2)
    items = items.filter((r) => String(r.TH2 || "") === String(TH2 || ""));
  res.json({ items });
});

app.post("/api/export", async (req, res) => {
  try {
    const {
      rows = [],
      currency = "EUR",
      discountPercent = 0,
      transport,
      meta = {},
    } = req.body || {};
    const dp = Math.min(100, Math.max(0, Number(discountPercent) || 0)); // 0..100
    const tp = Math.max(0, Number(transport?.percent ?? 0)); // % trasporto

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Offerta");

    // Intestazioni base (A..K) - le mettiamo alla RIGA 2 (riga 1 riservata a meta/Sconto)
    ws.columns = [
      { header: "POS", key: "pos", width: 8 }, // A
      { header: "Descrizione e misura", key: "descr", width: 45 }, // B
      { header: "Codice", key: "code", width: 18 }, // C
      { header: "U.M.", key: "um", width: 8 }, // D
      { header: "Quantità", key: "qty", width: 10 }, // E
      { header: "Prezzo unitario base €/m o €/pz", key: "base", width: 24 }, // F
      { header: "Peso tubo", key: "peso", width: 12 }, // G
      { header: "Alloy surcharge in €/kg", key: "asKg", width: 20 }, // H
      { header: "Alloy surcharge in €/mt", key: "asM", width: 20 }, // I
      { header: "Prezzo unitario", key: "pu", width: 16 }, // J
      { header: "Valore riga", key: "tot", width: 16 }, // K
    ];

    // Larghezze specifiche
    ws.getColumn(1).width = 5.27; // A ≈ 65px
    ws.getColumn(2).width = 29.18; // B ≈ 328px
    ws.getColumn(3).width = 10.27; // C ≈ 120px
    ws.getColumn(4).width = 5.91; // D ≈ 72px
    for (let c = 6; c <= 10; c++) ws.getColumn(c).width = 9; // F..J ≈ 106px

    // Inseriamo una riga sopra le intestazioni (diventerà la riga 1)
    ws.spliceRows(1, 0, []);

    // --- RIGA 1: metadati opzionali in celle contigue da B1 + sconto in O1 ---
    const richiesta = (meta.richiesta || "").trim();
    const cliente = (meta.cliente || "").trim();
    const cantiere = (meta.cantiere || "").trim();

    const pieces = [];
    if (richiesta) pieces.push(`Richiesta: ${richiesta}`);
    if (cliente) pieces.push(`Cliente: ${cliente}`);
    if (cantiere) pieces.push(`Cantiere: ${cantiere}`);

    let metaCol = 2; // B
    for (const txt of pieces) {
      ws.getCell(1, metaCol).value = txt;
      metaCol++;
    }

    // SCONTO sempre in O1
    ws.getCell(1, 15).value = `SCONTO: ${dp.toFixed(2)}%`; // O1
    ws.getCell(1, 15).font = { bold: true, color: { argb: "FFFF0000" } };

    // Header (ora alla riga 2): centrato + wrap + altezza 11.09 (~96.75pt)
    const headerRow = ws.getRow(2);
    headerRow.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true,
    };
    headerRow.height = 96.75;

    // === Dati: da riga 3 in poi
    rows.forEach((item, idx) => {
      const isTube =
        item.itemType === "Tubes" || item.itemType === "Coassiali Tubes";

      const pos = (idx + 1) * 100;
      const descr = item.description || "";
      const code = item.code || "";
      const um = isTube ? "mt" : "pz";
      const qty = Number(item.quantity || 0);

      const base = Number(
        (isTube ? item.basePricePerM : item.basePricePerPc) || 0
      );
      const peso = isTube ? Number(item.pesoKgM || 0) : null;
      const asKg = isTube ? Number(item.alloySurchargePerKg || 0) : null;
      const asM = isTube ? Number((asKg || 0) * (peso || 0)) : null;
      const pu = isTube ? base + (asM || 0) : base;
      const tot = pu * qty;

      ws.addRow({
        pos,
        descr,
        code,
        um,
        qty,
        base,
        peso: isTube ? peso : "-",
        asKg: isTube ? asKg : "-",
        asM: isTube ? asM : "-",
        pu,
        tot,
      });
    });

    // Allineamenti/arrotondamenti iniziali (F..K) + E e D — RIGHE 3..rowCount
    for (let i = 3; i <= ws.rowCount; i++) {
      ws.getCell(i, 5).alignment = { horizontal: "right" }; // E Quantità
      ws.getCell(i, 4).alignment = { horizontal: "center" }; // D U.M.
      for (let j = 6; j <= 11; j++) {
        // F..K
        const cell = ws.getCell(i, j);
        if (typeof cell.value === "number") {
          cell.value = Math.round((cell.value + Number.EPSILON) * 100) / 100;
          // € su F, J, K
          cell.numFmt =
            j === 6 || j === 10 || j === 11 ? "€ #,##0.00" : "#,##0.00";
          cell.alignment = { horizontal: "right" };
        } else if (cell.value === "-") {
          cell.alignment = { horizontal: "center" };
        }
      }
    }

    // === Nuove colonne M/N ===
    // Header M/N (riga 2)
    ws.getCell(2, 13).value = "Prezzo Unitario Base DA LISTINO (€/m o €/pz)"; // M
    ws.getCell(2, 14).value = "TOTALE LORDO DA LISTINO"; // N
    // Larghezze: M come F, N come K
    ws.getColumn(13).width = ws.getColumn(6).width; // M = F
    ws.getColumn(14).width = ws.getColumn(11).width; // N = K

    // Copia F -> M (rosso) e K -> N (rosso) per righe dati (3..rowCount)
    for (let i = 3; i <= ws.rowCount; i++) {
      const fVal = Number(ws.getCell(i, 6).value || 0); // F
      const kVal = Number(ws.getCell(i, 11).value || 0); // K

      const m = ws.getCell(i, 13);
      m.value = Math.round((fVal + Number.EPSILON) * 100) / 100;
      m.numFmt = "#,##0.00";
      m.alignment = { horizontal: "right" };
      m.font = { color: { argb: "FFFF0000" } };

      const n = ws.getCell(i, 14);
      n.value = Math.round((kVal + Number.EPSILON) * 100) / 100;
      n.numFmt = "#,##0.00";
      n.alignment = { horizontal: "right" };
      n.font = { color: { argb: "FFFF0000" } };
    }

    // === Applica sconto: M -> F scontato, poi ricalcoli J e K ===
    for (let i = 3; i <= ws.rowCount; i++) {
      const um = String(ws.getCell(i, 4).value || "").toLowerCase(); // "mt" => tubo
      const qty = Number(ws.getCell(i, 5).value || 0);

      // Nuova F = M * (1 - dp)
      const mVal = Number(ws.getCell(i, 13).value || 0);
      const fNew =
        Math.round((mVal * (1 - dp / 100) + Number.EPSILON) * 100) / 100;
      const cellF = ws.getCell(i, 6);
      cellF.value = fNew;
      cellF.numFmt = "€ #,##0.00";
      cellF.alignment = { horizontal: "right" };

      let jNew = fNew; // non tubi
      if (um === "mt") {
        // tubo: J = F (scontato) + I (AS €/mt)
        const iVal = Number(ws.getCell(i, 9).value || 0); // I
        jNew = fNew + iVal;
      }
      jNew = Math.round((jNew + Number.EPSILON) * 100) / 100;
      const cellJ = ws.getCell(i, 10);
      cellJ.value = jNew;
      cellJ.numFmt = "€ #,##0.00";
      cellJ.alignment = { horizontal: "right" };

      const kNew = Math.round((jNew * qty + Number.EPSILON) * 100) / 100;
      const cellK = ws.getCell(i, 11);
      cellK.value = kNew;
      cellK.numFmt = "€ #,##0.00";
      cellK.alignment = { horizontal: "right" };
    }

    // === Totali finali (senza ulteriori sconti) ===
    const dataStartRow = 3;
    const dataLastRow = ws.rowCount;

    // Altezza POS (3..dataLastRow): 31.5pt (~42px)
    for (let r = dataStartRow; r <= dataLastRow; r++)
      ws.getRow(r).height = 31.5;

    // helper bordo sottile nero
    const thinSide = { style: "thin", color: { argb: "FF000000" } };
    const setThinBorder = (cell) => {
      cell.border = {
        top: thinSide,
        left: thinSide,
        bottom: thinSide,
        right: thinSide,
      };
    };

    // === BORDI sulle INTESTAZIONI (riga 2): A..K + M..N ===
    for (let c = 1; c <= 11; c++) setThinBorder(ws.getCell(2, c)); // A..K
    setThinBorder(ws.getCell(2, 13)); // M
    setThinBorder(ws.getCell(2, 14)); // N

    // === BORDI: tutte le celle delle righe POS (A..K) ===
    for (let r = dataStartRow; r <= dataLastRow; r++) {
      for (let c = 1; c <= 11; c++) {
        setThinBorder(ws.getCell(r, c));
      }
    }

    // 1) Totale Items ex works (I..J uniti)
    const r1 = dataLastRow + 1;
    ws.mergeCells(r1, 9, r1, 10); // I..J
    const cellIJ1 = ws.getCell(r1, 9);
    cellIJ1.value = "Totale Items\nex works";
    cellIJ1.font = { bold: true };
    cellIJ1.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true,
    };
    ws.getRow(r1).height = 45; // ~60px

    // K r1: SOMMA K3..K{dataLastRow} (con €)
    const cellK1 = ws.getCell(r1, 11);
    cellK1.value = { formula: `SUM(K${dataStartRow}:K${dataLastRow})` };
    cellK1.numFmt = "€ #,##0.00";
    cellK1.font = { bold: true };
    cellK1.alignment = { horizontal: "right", vertical: "middle" };

    // N r1: SOMMA N3..N{dataLastRow} (rosso)
    const cellN1 = ws.getCell(r1, 14);
    cellN1.value = { formula: `SUM(N${dataStartRow}:N${dataLastRow})` };
    cellN1.numFmt = "#,##0.00";
    cellN1.alignment = { horizontal: "right", vertical: "middle" };
    cellN1.font = { color: { argb: "FFFF0000" } };

    // 2) Imballo e trasporto (I..J uniti) — K = K(r1) * trasporto%
    const r2 = r1 + 1;
    ws.mergeCells(r2, 9, r2, 10);
    const cellIJ2 = ws.getCell(r2, 9);
    cellIJ2.value = "Imballo e trasporto";
    cellIJ2.font = { bold: true };
    cellIJ2.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(r2).height = 45;

    const cellK2 = ws.getCell(r2, 11);
    const tpFrac = (tp / 100).toString().replace(",", "."); // es. 0.095
    cellK2.value = { formula: `${tpFrac}*K${r1}` };
    cellK2.numFmt = "€ #,##0.00";
    cellK2.alignment = { horizontal: "right", vertical: "middle" };
    cellK2.font = { bold: true }; // valore in grassetto

    // 3) Totale f.co destino (I..J uniti) — K = K(r1) + K(r2)
    const r3 = r2 + 1;
    ws.mergeCells(r3, 9, r3, 10);
    const cellIJ3 = ws.getCell(r3, 9);
    cellIJ3.value = "Totale f.co destino";
    cellIJ3.font = { bold: true };
    cellIJ3.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(r3).height = 45;

    const cellK3 = ws.getCell(r3, 11);
    cellK3.value = { formula: `K${r1}+K${r2}` };
    cellK3.numFmt = "€ #,##0.00";
    cellK3.alignment = { horizontal: "right", vertical: "middle" };
    cellK3.font = { bold: true }; // valore in grassetto

    // === BORDI: celle dei totali (I..J merge + K) per r1, r2, r3 ===
    for (const rr of [r1, r2, r3]) {
      for (let c = 9; c <= 10; c++) setThinBorder(ws.getCell(rr, c)); // I..J
      setThinBorder(ws.getCell(rr, 11)); // K
    }

    // Output
    const buf = await wb.xlsx.writeBuffer();
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", 'attachment; filename="Offerta.xlsx"');
    return res.send(Buffer.from(buf));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Errore in esportazione" });
  }
});

// Utility per ricaricare il catalogo (se cambi gli xlsx)
app.post("/api/reload", (req, res) => {
  catalog = loadCatalog();
  res.json({
    ok: true,
    counts: {
      tubes: catalog.tubes?.length || 0,
      fittings: catalog.fittings?.length || 0,
      complex: catalog.complex?.length || 0,
      coaxial: catalog.coaxial?.length || 0,
    },
  });
});

app.listen(3000, () => console.log("Server su http://localhost:3000"));

// ===== Import Excel per ripopolare la tabella =================================
app.post("/api/import", upload.single("file"), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).send("Nessun file caricato.");
    }
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(req.file.buffer);
    const ws = wb.getWorksheet("Offerta") || wb.worksheets[0];
    if (!ws) return res.json({ rows: [] });

    const rows = [];
    for (let r = 3; r <= ws.rowCount; r++) {
      const descr = ws.getCell(r, 2).value; // B
      const um = String(ws.getCell(r, 4).value || "")
        .trim()
        .toLowerCase(); // D
      const qty = ws.getCell(r, 5).value; // E
      const base = ws.getCell(r, 6).value; // F
      const peso = ws.getCell(r, 7).value; // G
      const asKg = ws.getCell(r, 8).value; // H
      const pu = ws.getCell(r, 10).value; // J
      const tot = ws.getCell(r, 11).value; // K
      const cellIJ = String(ws.getCell(r, 9).value || "").toLowerCase(); // I as text for 'Totale Items'

      const emptyDescr = descr == null || String(descr).trim() === "";
      const numbersAllZero =
        Number(qty || 0) === 0 &&
        Number(pu || 0) === 0 &&
        Number(tot || 0) === 0;

      if ((emptyDescr && numbersAllZero) || cellIJ.includes("totale items"))
        break;

      const code = ws.getCell(r, 3).value; // C
      const prezzoPieno = ws.getCell(r, 13).value; // M = Prezzo pieno (prima dello sconto)

      rows.push({
        description: descr ? String(descr) : "",
        code: code ? String(code) : "",
        um,
        quantity: Number(qty || 0),
        base: Number(base || 0),
        peso: um === "mt" ? Number(peso || 0) : null,
        asKg: um === "mt" ? Number(asKg || 0) : null,
        unitPrice: Number(prezzoPieno || 0), // usa SEMPRE colonna M come base
        pu_file: Number(pu || 0),
        tot_file: Number(tot || 0),
        prezzoPienoM: Number(prezzoPieno || 0),
        tot: Number(tot || 0),
        itemType: um === "mt" ? "Tubes" : "Imported",
      });
    }
    return res.json({ rows });
  } catch (err) {
    console.error(err);
    return res.status(500).send("Errore durante l'import.");
  }
});
