# Electronic Parts – Web App

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
| **img/** | Folder for part images. Served at `/img/`. Set each item’s **`image`** in **parts.json** (or via the app’s edit form) to the filename in `img/`. |

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

## npm scripts (package.json)

| Command | Action |
|--------|--------|
| `npm start` | Run the web app (http://localhost:5000). |
