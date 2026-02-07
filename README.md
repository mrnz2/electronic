# Electronic Parts – Web App & Scripts

A small Node.js web app to browse electronic parts by category, edit quantities, and manage part images. Data is stored in `parts.json`; CSV export is optional and not tracked in Git.

---

## Requirements

- **Node.js** 16 or newer (`node --version`)

---

## Installation

From the project root:

```bash
npm install
```

---

## Running the Web App

```bash
npm start
```

Then open **http://localhost:5000** in your browser.

- **Home (/)**: List of categories with item counts. Use **“Generuj ElectronicParts.csv”** to create/overwrite `ElectronicParts.csv` from current `parts.json` (the file is not in Git).
- **Category (/category/&lt;name&gt;)**: Table of parts (thumbnail, name, category, quantity with edit form, description). Thumbnails come only from **parts.json**: each item’s optional **`image`** field is a filename in **img/** (e.g. `NE555.jpg`). If `image` is missing, a placeholder is shown.

---

## Data Files

| File | Role |
|------|------|
| **parts.json** | Main data: categories and items (name, quantity, rodzaj, description, optional **image** = filename in `img/`). The only source of image info. |
| **ElectronicParts.csv** | Optional export. Generated from the app (button on home). Ignored by Git. Do not commit. |
| **img/** | Folder for part images. Served at `/img/`. Add images here and run `link-images-to-parts.js` to set `image` in **parts.json**. |

---

## Scripts (command line)

All scripts are run from the **project root**.

### 1. Generate `parts.json` from CSV

If you have or create an `ElectronicParts.csv` with columns: `XX`, `Name`, `Quantity`, `Rodzaj`, `Description`:

```bash
node scripts/generate-parts-json.js
```

- Reads `ElectronicParts.csv`.
- Groups rows by `Rodzaj`.
- Writes **parts.json** (overwrites existing). Does not add or change `image` fields.

Use this when you want to (re)build `parts.json` from a CSV. The app itself uses only `parts.json`.

---

### 2. Link images to parts (`image` field in `parts.json`)

After you add image files to **img/** (filenames should match part names, e.g. sanitized: spaces → `_`, no special chars):

```bash
node scripts/link-images-to-parts.js
```

- Scans **img/** for image files.
- For each part in **parts.json**, matches by sanitized name and sets **`image`** to the matching filename (e.g. `"image": "NE555.jpg"`).
- Saves **parts.json**.

The web app uses **`/img/<image>`** for items that have **`image`** set. Re-run this script after adding or renaming images in `img/`.

---

## Generating `ElectronicParts.csv` from the app

1. Run the app (`npm start`) and open http://localhost:5000.
2. Click **“Generuj ElectronicParts.csv”**.
3. The server will:
   - Delete existing `ElectronicParts.csv` if present.
   - Build CSV from **parts.json** (columns: XX, Name, Quantity, Rodzaj, Description only).
   - Save **ElectronicParts.csv** in the project root.

**The `image` field (link to photo) is not exported to CSV** by design.

---

## Typical workflows

**Start from CSV:**

1. Put your data in `ElectronicParts.csv` (columns as above).
2. `node scripts/generate-parts-json.js`
3. Add images to **img/** and run `node scripts/link-images-to-parts.js` to fill **`image`** in **parts.json**.
4. `npm start` and use the app.

**Start from existing `parts.json`:**

1. Edit **parts.json** or use the app to change quantities.
2. To get a CSV: run the app and click “Generuj ElectronicParts.csv”.
3. To refresh image links: add or rename files in **img/** then run `node scripts/link-images-to-parts.js`.

---

## npm scripts (package.json)

| Command | Action |
|--------|--------|
| `npm start` | Run the web app (http://localhost:5000). |

Other scripts are run directly with `node scripts/<name>.js`.
