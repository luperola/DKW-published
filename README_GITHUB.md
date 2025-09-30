# Come pubblicare su GitHub nascondendo i file sensibili

## 1) Aggiungi il `.gitignore`
Il file `.gitignore` incluso in questo pacchetto **esclude** automaticamente:
- i cataloghi Excel `Straight_Items.xlsx`, `Coaxial.xlsx`, `Tees.xlsx` (root)
- qualsiasi Excel in `data/` (consigliato spostare lì i cataloghi)
- file `.env` con variabili sensibili
- `runtime-data/` e file temporanei

> Verifica che i tuoi cataloghi siano **fuori** dal versionamento prima del commit.

## 2) Usa `.env` locale (non committato) e committa solo `.env.example`
Crea `.env` (con gli stessi nomi variabili del file `.env.example`) e NON committarlo.
Esempio:
```
PORT=3000
NODE_ENV=development
CATALOGS_DIR=./data
```

## 3) Commit & push su GitHub
```bash
git init
git add .
git commit -m "Prima versione (senza dati sensibili)"
git branch -M main
git remote add origin https://github.com/tuo-utente/tuo-repo.git
git push -u origin main
```

## 4) Note sul codice attuale
- Il progetto è Node/Express con ESM e dipendenze in `package.json`.
- Gli endpoint e l'export Excel sono in `app.js`.
- Il loader dei cataloghi sta in `catalogLoader.js` e usa `fs.existsSync(...)` per gestire file mancanti senza crash (stampa un warning e restituisce array vuoti). Tieni i cataloghi **fuori** dal repo, ma nella cartella specificata da `CATALOGS_DIR` o in `data/`.
- Front-end: `index.html` + `main.js`.

## 5) Suggerimenti
- Se devi condividere struttura dati senza i prezzi reali, crea in `samples/` dei fogli Excel **dummy** con poche righe e valori fittizi (non sensibili) e NON usare i nomi reali dei clienti/codici.
- Se in futuro userai storage cloud (S3/Drive) per i cataloghi, mantieni le chiavi solo in variabili d'ambiente e continua a ignorare i file veri nel repo.
