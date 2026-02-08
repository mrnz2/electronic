const fs = require('fs');
const path = require('path');
const { stringify } = require('csv-stringify/sync');
const express = require('express');

const PORT = 5000;
const PARTS_JSON_PATH = path.join(__dirname, 'parts.json');
const CSV_PATH = path.join(__dirname, 'ElectronicParts.csv');
/** Kolumny eksportu CSV – bez pola image (link do zdjęcia nie jest eksportowany). */
const CSV_HEADERS = ['XX', 'Name', 'Quantity', 'Rodzaj', 'Description'];

const app = express();
app.use(express.json());
app.use('/img', express.static(path.join(__dirname, 'img')));

/** Tablica kategorii z parts.json: [ { rodzaj, items: [...] }, ... ] */
function loadPartsData() {
  const raw = fs.readFileSync(PARTS_JSON_PATH, 'utf-8');
  return JSON.parse(raw);
}

/** Płaska lista wszystkich elementów (do badge’y na stronie głównej). */
function getPartsFlat(data) {
  return data.flatMap((c) => c.items);
}

function savePartsJson(data) {
  fs.writeFileSync(PARTS_JSON_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

/** Usuwa z tablicy kategorie, które nie mają żadnych elementów. */
function removeEmptyCategories(data) {
  for (let i = data.length - 1; i >= 0; i--) {
    if (!data[i].items || data[i].items.length === 0) {
      data.splice(i, 1);
    }
  }
}

app.get('/', (req, res) => {
  const data = loadPartsData();
  const categories = data.map((c) => c.rodzaj);
  const partsFlat = getPartsFlat(data);
  const html = renderIndex(categories, partsFlat);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

app.get('/category/:name', (req, res) => {
  const categoryName = decodeURIComponent(req.params.name);
  const data = loadPartsData();
  const category = data.find((c) => c.rodzaj === categoryName);
  if (!category || !category.items.length) {
    return res.status(404).send(renderNotFound(categoryName));
  }
  const categories = data.map((c) => c.rodzaj);
  const html = renderCategory(categoryName, category.items, categories);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

app.get('/api/category/:name', (req, res) => {
  const categoryName = decodeURIComponent(req.params.name);
  const data = loadPartsData();
  const category = data.find((c) => c.rodzaj === categoryName);
  if (!category || !category.items.length) {
    return res.status(404).json({ error: 'Nie znaleziono kategorii' });
  }
  res.json({ categoryName: category.rodzaj, items: category.items });
});

app.get('/api/category/:name/rows', (req, res) => {
  const categoryName = decodeURIComponent(req.params.name);
  const data = loadPartsData();
  const category = data.find((c) => c.rodzaj === categoryName);
  if (!category || !category.items.length) {
    return res.status(404).send('');
  }
  const html = renderCategoryRows(category.items);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

app.post('/api/part/quantity', (req, res) => {
  const { xx, quantity } = req.body || {};
  const qty = Number(quantity);
  if (xx == null || String(xx).trim() === '' || !Number.isInteger(qty) || qty < 0) {
    return res.status(400).json({ ok: false, error: 'Nieprawidłowe xx lub ilość' });
  }
  const data = loadPartsData();
  let item = null;
  for (const cat of data) {
    item = cat.items.find((p) => String(p.xx).trim() === String(xx).trim());
    if (item) break;
  }
  if (!item) {
    return res.status(404).json({ ok: false, error: 'Nie znaleziono elementu' });
  }
  item.quantity = String(qty);
  savePartsJson(data);
  res.json({ ok: true, quantity: qty });
});

app.patch('/api/part', (req, res) => {
  const { xx, description, image, rodzaj } = req.body || {};
  if (xx == null || String(xx).trim() === '') {
    return res.status(400).json({ ok: false, error: 'Brak identyfikatora xx' });
  }
  const data = loadPartsData();
  let sourceCatIndex = -1;
  let itemIndex = -1;
  let item = null;
  for (let i = 0; i < data.length; i++) {
    const idx = data[i].items.findIndex((p) => String(p.xx).trim() === String(xx).trim());
    if (idx !== -1) {
      sourceCatIndex = i;
      itemIndex = idx;
      item = data[i].items[idx];
      break;
    }
  }
  if (!item) {
    return res.status(404).json({ ok: false, error: 'Nie znaleziono elementu' });
  }
  if (description !== undefined) item.description = String(description);
  if (image !== undefined) {
    const path = String(image).trim().replace(/^img[/\\]+/, '');
    item.image = path || undefined;
    if (!path) delete item.image;
  }
  const newRodzaj = rodzaj != null ? String(rodzaj).trim() : '';
  if (newRodzaj !== '' && newRodzaj !== data[sourceCatIndex].rodzaj) {
    item.rodzaj = newRodzaj;
    const moved = data[sourceCatIndex].items.splice(itemIndex, 1)[0];
    let targetCat = data.find((c) => c.rodzaj === newRodzaj);
    if (!targetCat) {
      targetCat = { rodzaj: newRodzaj, items: [] };
      data.push(targetCat);
      data.sort((a, b) => a.rodzaj.localeCompare(b.rodzaj));
    }
    targetCat.items.push(moved);
  }
  removeEmptyCategories(data);
  savePartsJson(data);
  res.json({ ok: true });
});

app.delete('/api/part', (req, res) => {
  const { xx } = req.body || {};
  if (xx == null || String(xx).trim() === '') {
    return res.status(400).json({ ok: false, error: 'Brak identyfikatora xx' });
  }
  const data = loadPartsData();
  let categoryIndex = -1;
  let itemIndex = -1;
  for (let i = 0; i < data.length; i++) {
    const idx = data[i].items.findIndex((p) => String(p.xx).trim() === String(xx).trim());
    if (idx !== -1) {
      categoryIndex = i;
      itemIndex = idx;
      break;
    }
  }
  if (categoryIndex === -1 || itemIndex === -1) {
    return res.status(404).json({ ok: false, error: 'Nie znaleziono elementu' });
  }
  const cat = data[categoryIndex];
  cat.items.splice(itemIndex, 1);
  removeEmptyCategories(data);
  savePartsJson(data);
  res.json({ ok: true });
});

app.post('/api/part', (req, res) => {
  const { name, rodzaj, description, image } = req.body || {};
  const nameTrim = name != null ? String(name).trim() : '';
  const rodzajTrim = rodzaj != null ? String(rodzaj).trim() : '';
  if (!nameTrim) {
    return res.status(400).json({ ok: false, error: 'Nazwa jest wymagana' });
  }
  if (!rodzajTrim) {
    return res.status(400).json({ ok: false, error: 'Kategoria jest wymagana' });
  }
  const data = loadPartsData();
  const allItems = data.flatMap((c) => c.items);
  if (allItems.some((p) => String(p.name).trim().toLowerCase() === nameTrim.toLowerCase())) {
    return res.status(400).json({ ok: false, error: 'Element o takiej nazwie już istnieje' });
  }
  const maxXx = Math.max(
    0,
    ...allItems.map((p) => parseInt(p.xx, 10)).filter((n) => !Number.isNaN(n))
  );
  const newXx = String(maxXx + 1);
  const imagePath =
    image != null && String(image).trim() !== ''
      ? String(image).trim().replace(/^img[/\\]+/, '')
      : undefined;
  const newItem = {
    xx: newXx,
    name: nameTrim,
    quantity: '0',
    rodzaj: rodzajTrim,
    description: description != null ? String(description).trim() : '',
    ...(imagePath && { image: imagePath }),
  };
  let category = data.find((c) => c.rodzaj === rodzajTrim);
  if (!category) {
    category = { rodzaj: rodzajTrim, items: [] };
    data.push(category);
    data.sort((a, b) => a.rodzaj.localeCompare(b.rodzaj));
  }
  category.items.push(newItem);
  savePartsJson(data);
  res.json({ ok: true, xx: newXx, rodzaj: rodzajTrim });
});

app.post('/api/generate-csv', (req, res) => {
  try {
    if (fs.existsSync(CSV_PATH)) {
      fs.unlinkSync(CSV_PATH);
    }
    const data = loadPartsData();
    // Eksport tylko XX, Name, Quantity, Rodzaj, Description – pole image (zdjęcie) nie jest eksportowane.
    const rows = data.flatMap((cat) =>
      cat.items.map((p) => ({
        XX: p.xx,
        Name: p.name,
        Quantity: p.quantity,
        Rodzaj: p.rodzaj,
        Description: p.description || '',
      }))
    );
    const csv = stringify(rows, { header: true, columns: CSV_HEADERS });
    fs.writeFileSync(CSV_PATH, csv, 'utf-8');
    res.json({ ok: true, path: 'ElectronicParts.csv' });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

function renderIndex(categories, parts) {
  const links = categories
    .map((c) => {
      const count = parts.filter((p) => p.rodzaj === c).length;
      return `<a href="/category/${encodeURIComponent(c)}" class="btn">${escapeHtml(c)}<span class="badge">${count}</span></a>`;
    })
    .join('\n');
  const categoryOptions = categories.map((c) => `<option value="${escapeHtmlAttr(c)}">`).join('');
  return `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Kategorie części – Electronic Parts</title>
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <div class="wrap">
    <header>
      <h1>Kategorie części elektronicznych</h1>
      <p>Wybierz kategorię, aby zobaczyć listę elementów.</p>
    </header>
    <nav class="categories">
      ${links}
    </nav>
    <div class="export-row">
      <button type="button" id="btn-add-part" class="btn btn-add">Dodaj element</button>
      <button type="button" id="btn-generate-csv" class="btn btn-export">Generuj ElectronicParts.csv</button>
      <span id="csv-msg" class="export-msg"></span>
    </div>
    <footer>
      <a href="/">← Strona główna</a>
    </footer>
  </div>
  <div id="add-modal" class="modal" aria-hidden="true">
    <div class="modal-backdrop"></div>
    <div class="modal-dialog">
      <div class="modal-header">
        <h2>Dodaj element</h2>
        <button type="button" class="modal-close" aria-label="Zamknij">&times;</button>
      </div>
      <form id="add-form" class="modal-form">
        <div class="form-group">
          <label for="add-name">Nazwa <span class="required">*</span></label>
          <input type="text" id="add-name" name="name" required placeholder="np. NE555">
        </div>
        <div class="form-group">
          <label for="add-rodzaj">Kategoria <span class="required">*</span></label>
          <input type="text" id="add-rodzaj" name="rodzaj" list="add-category-list" required placeholder="wybierz lub wpisz nową">
          <datalist id="add-category-list">${categoryOptions}</datalist>
        </div>
        <div class="form-group">
          <label for="add-description">Opis</label>
          <textarea id="add-description" name="description" placeholder="opcjonalnie"></textarea>
        </div>
        <div class="form-group">
          <label for="add-image">Nazwa pliku z obrazkiem</label>
          <input type="text" id="add-image" name="image" placeholder="np. NE555.jpg">
        </div>
        <div id="add-form-err" class="form-err" role="alert"></div>
        <div class="modal-actions">
          <button type="submit" class="btn btn-save">Zapisz</button>
          <button type="button" id="add-cancel" class="btn btn-cancel">Anuluj</button>
        </div>
      </form>
    </div>
  </div>
  <script>
    (function(){
      var btn = document.getElementById('btn-generate-csv');
      var msg = document.getElementById('csv-msg');
      if (btn) {
        btn.addEventListener('click', function(){
          msg.textContent = '';
          btn.disabled = true;
          fetch('/api/generate-csv', { method: 'POST', headers: { 'Content-Type': 'application/json' } })
            .then(function(r){ return r.json(); })
            .then(function(data){
              if (data.ok) {
                msg.textContent = 'Plik ElectronicParts.csv wygenerowany.';
                msg.className = 'export-msg ok';
              } else {
                msg.textContent = data.error || 'Błąd';
                msg.className = 'export-msg err';
              }
            })
            .catch(function(){
              msg.textContent = 'Błąd połączenia';
              msg.className = 'export-msg err';
            })
            .finally(function(){ btn.disabled = false; });
        });
      }
      var addModal = document.getElementById('add-modal');
      var addOpen = document.getElementById('btn-add-part');
      var addForm = document.getElementById('add-form');
      var addErr = document.getElementById('add-form-err');
      var addBackdrop = addModal && addModal.querySelector('.modal-backdrop');
      var addCloseBtn = addModal && addModal.querySelector('.modal-close');
      var addCancel = document.getElementById('add-cancel');
      function openAddModal() {
        if (!addModal) return;
        addErr.textContent = '';
        addForm.reset();
        addModal.classList.add('modal-open');
        addModal.setAttribute('aria-hidden', 'false');
      }
      function closeAddModal() {
        if (!addModal) return;
        addModal.classList.remove('modal-open');
        addModal.setAttribute('aria-hidden', 'true');
      }
      if (addOpen) addOpen.addEventListener('click', openAddModal);
      if (addBackdrop) addBackdrop.addEventListener('click', closeAddModal);
      if (addCloseBtn) addCloseBtn.addEventListener('click', closeAddModal);
      if (addCancel) addCancel.addEventListener('click', closeAddModal);
      if (addForm) {
        addForm.addEventListener('submit', function(e){
          e.preventDefault();
          addErr.textContent = '';
          var nameVal = (document.getElementById('add-name') && document.getElementById('add-name').value || '').trim();
          var rodzajVal = (document.getElementById('add-rodzaj') && document.getElementById('add-rodzaj').value || '').trim();
          if (!nameVal) { addErr.textContent = 'Nazwa jest wymagana.'; return; }
          if (!rodzajVal) { addErr.textContent = 'Kategoria jest wymagana.'; return; }
          var submitBtn = addForm.querySelector('button[type="submit"]');
          if (submitBtn) submitBtn.disabled = true;
          fetch('/api/part', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: nameVal,
              rodzaj: rodzajVal,
              description: (document.getElementById('add-description') && document.getElementById('add-description').value || '').trim(),
              image: (document.getElementById('add-image') && document.getElementById('add-image').value || '').trim()
            })
          })
            .then(function(r){ return r.json(); })
            .then(function(data){
              if (data.ok) {
                closeAddModal();
                location.reload();
              } else {
                addErr.textContent = data.error || 'Błąd zapisu';
              }
            })
            .catch(function(){
              addErr.textContent = 'Błąd połączenia';
            })
            .finally(function(){ if (submitBtn) submitBtn.disabled = false; });
        });
      }
    })();
  </script>
</body>
</html>`;
}

function renderCategoryRows(items) {
  return items
    .map(
      (p) => `
    <tr data-xx="${escapeHtml(p.xx)}" data-rodzaj="${escapeHtmlAttr(p.rodzaj || '')}" data-description="${escapeHtmlAttr(p.description || '')}" data-image="${escapeHtmlAttr(p.image || '')}">
      <td class="thumb">
        <img src="${p.image ? '/img/' + escapeHtml(p.image) : '/img/placeholder.png'}" alt="" width="80" height="80" loading="lazy">
      </td>
      <td class="name">${escapeHtml(p.name)}</td>
      <td class="rodzaj">${escapeHtml(p.rodzaj)}</td>
      <td class="qty">
        <form class="qty-form" data-xx="${escapeHtml(p.xx)}" method="post" action="#">
          <input type="number" min="0" value="${escapeHtml(p.quantity)}" name="qty" aria-label="Ilość">
          <button type="submit">Zapisz</button>
          <span class="qty-msg"></span>
        </form>
      </td>
      <td class="desc">${escapeHtml(p.description)}</td>
      <td class="actions">
        <button type="button" class="btn btn-edit">Edytuj</button>
        <button type="button" class="btn btn-delete">Usuń</button>
      </td>
    </tr>`
    )
    .join('');
}

function renderCategory(categoryName, items, categories) {
  const rows = renderCategoryRows(items);
  const categoryOptions = (categories || []).map((c) => `<option value="${escapeHtmlAttr(c)}">`).join('');
  return `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(categoryName)} – Electronic Parts</title>
  <link rel="stylesheet" href="/style.css">
</head>
<body data-category="${escapeHtmlAttr(categoryName)}">
  <div class="wrap">
    <header>
      <h1>Kategoria: ${escapeHtml(categoryName)}</h1>
      <p>Liczba elementów: ${items.length}</p>
    </header>
    <main>
      <table class="parts-table">
        <thead>
          <tr>
            <th>Obraz</th>
            <th>Nazwa</th>
            <th>Kategoria</th>
            <th>Ilość</th>
            <th>Opis</th>
            <th>Akcje</th>
          </tr>
        </thead>
        <tbody>${rows}
        </tbody>
      </table>
    </main>
    <footer>
      <a href="/">← Wróć do kategorii</a>
    </footer>
  </div>

  <div id="delete-modal" class="modal" aria-hidden="true">
    <div class="modal-backdrop"></div>
    <div class="modal-dialog">
      <div class="modal-header">
        <h2>Usuń element</h2>
        <button type="button" class="modal-close" aria-label="Zamknij">&times;</button>
      </div>
      <div class="modal-form">
        <p id="delete-confirm-msg" class="delete-confirm-msg"></p>
        <div class="modal-actions">
          <button type="button" id="delete-confirm-btn" class="btn btn-delete-confirm">Usuń</button>
          <button type="button" id="delete-cancel-btn" class="btn btn-cancel">Anuluj</button>
        </div>
      </div>
    </div>
  </div>

  <div id="edit-modal" class="modal" aria-hidden="true">
    <div class="modal-backdrop"></div>
    <div class="modal-dialog">
      <div class="modal-header">
        <h2>Edytuj element</h2>
        <button type="button" class="modal-close" aria-label="Zamknij">&times;</button>
      </div>
      <form id="edit-form" class="modal-form">
        <input type="hidden" name="xx" id="edit-xx">
        <div class="form-group">
          <label for="edit-description">Opis elementu</label>
          <textarea id="edit-description" name="description" rows="4"></textarea>
        </div>
        <div class="form-group">
          <label for="edit-rodzaj">Kategoria</label>
          <input type="text" id="edit-rodzaj" name="rodzaj" list="edit-category-list" placeholder="wybierz z listy lub wpisz nową">
          <datalist id="edit-category-list">${categoryOptions}</datalist>
        </div>
        <div class="form-group">
          <label for="edit-image">Ścieżka do obrazka</label>
          <input type="text" id="edit-image" name="image" placeholder="np. NE555.jpg lub img/rezystor_10k.jpg">
        </div>
        <div class="modal-actions">
          <button type="submit" class="btn btn-save">Zapisz</button>
          <button type="button" class="btn btn-cancel">Anuluj</button>
        </div>
      </form>
    </div>
  </div>

  <script>
    (function() {
      var categoryName = document.body.getAttribute('data-category');
      var modal = document.getElementById('edit-modal');
      var form = document.getElementById('edit-form');
      var editXx = document.getElementById('edit-xx');
      var editDesc = document.getElementById('edit-description');
      var editRodzaj = document.getElementById('edit-rodzaj');
      var editImage = document.getElementById('edit-image');
      var backdrop = modal && modal.querySelector('.modal-backdrop');
      var btnClose = modal && modal.querySelector('.modal-close');
      var btnCancel = form && form.querySelector('.btn-cancel');

      function openModal(row) {
        if (!modal) return;
        editXx.value = row.getAttribute('data-xx') || '';
        editDesc.value = row.getAttribute('data-description') || '';
        if (editRodzaj) editRodzaj.value = row.getAttribute('data-rodzaj') || '';
        editImage.value = row.getAttribute('data-image') || '';
        modal.classList.add('modal-open');
        modal.setAttribute('aria-hidden', 'false');
      }

      function closeModal() {
        if (!modal) return;
        modal.classList.remove('modal-open');
        modal.setAttribute('aria-hidden', 'true');
      }

      function refreshList() {
        if (!categoryName) return;
        fetch('/api/category/' + encodeURIComponent(categoryName) + '/rows')
          .then(function(r) {
            if (r.status === 404) { location.href = '/'; return null; }
            return r.text();
          })
          .then(function(html) {
            if (html === null) return;
            var tbody = document.querySelector('.parts-table tbody');
            if (tbody) {
              tbody.innerHTML = html;
              bindCategoryEvents();
            }
          });
      }

      function bindCategoryEvents() {
        document.querySelectorAll('.qty-form').forEach(function(form) {
          form.addEventListener('submit', function(e) {
            e.preventDefault();
            var msg = form.querySelector('.qty-msg');
            var btn = form.querySelector('button[type="submit"]');
            var qty = form.qty.value;
            msg.textContent = '';
            btn.disabled = true;
            fetch('/api/part/quantity', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ xx: form.dataset.xx, quantity: parseInt(qty, 10) })
            })
            .then(function(r) { return r.json().then(function(data) { return { ok: r.ok, data: data }; }); })
            .then(function(result) {
              if (result.ok) { msg.textContent = 'Zapisano'; msg.className = 'qty-msg ok'; }
              else { msg.textContent = result.data.error || 'Błąd'; msg.className = 'qty-msg err'; }
            })
            .catch(function() { msg.textContent = 'Błąd połączenia'; msg.className = 'qty-msg err'; })
            .finally(function() { btn.disabled = false; });
          });
        });
        document.querySelectorAll('.btn-edit').forEach(function(btn) {
          btn.addEventListener('click', function() {
            var row = btn.closest('tr');
            if (row) openModal(row);
          });
        });
        document.querySelectorAll('.btn-delete').forEach(function(btn) {
          btn.addEventListener('click', function() {
            var row = btn.closest('tr');
            if (row) openDeleteModal(row);
          });
        });
      }

      var deleteModal = document.getElementById('delete-modal');
      var deleteMsg = document.getElementById('delete-confirm-msg');
      var deleteConfirmBtn = document.getElementById('delete-confirm-btn');
      var deleteCancelBtn = document.getElementById('delete-cancel-btn');
      var deleteBackdrop = deleteModal && deleteModal.querySelector('.modal-backdrop');
      var deleteCloseBtn = deleteModal && deleteModal.querySelector('.modal-close');
      var pendingDeleteXx = null;

      function openDeleteModal(row) {
        if (!deleteModal || !deleteMsg) return;
        var xx = row.getAttribute('data-xx') || '';
        var nameCell = row.querySelector('.name');
        var name = nameCell ? nameCell.textContent.trim() : xx;
        pendingDeleteXx = xx;
        deleteMsg.textContent = 'Czy na pewno chcesz usunąć element „' + name + '”?';
        deleteModal.classList.add('modal-open');
        deleteModal.setAttribute('aria-hidden', 'false');
      }

      function closeDeleteModal() {
        if (!deleteModal) return;
        deleteModal.classList.remove('modal-open');
        deleteModal.setAttribute('aria-hidden', 'true');
        pendingDeleteXx = null;
      }

      if (deleteBackdrop) deleteBackdrop.addEventListener('click', closeDeleteModal);
      if (deleteCloseBtn) deleteCloseBtn.addEventListener('click', closeDeleteModal);
      if (deleteCancelBtn) deleteCancelBtn.addEventListener('click', closeDeleteModal);
      if (deleteConfirmBtn) {
        deleteConfirmBtn.addEventListener('click', function() {
          if (pendingDeleteXx == null) return;
          deleteConfirmBtn.disabled = true;
          fetch('/api/part', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ xx: pendingDeleteXx })
          })
          .then(function(r) { return r.json(); })
          .then(function(data) {
            if (data.ok) {
              closeDeleteModal();
              refreshList();
            } else {
              alert(data.error || 'Błąd usuwania');
            }
          })
          .catch(function() { alert('Błąd połączenia'); })
          .finally(function() { deleteConfirmBtn.disabled = false; });
        });
      }

      if (backdrop) backdrop.addEventListener('click', closeModal);
      if (btnClose) btnClose.addEventListener('click', closeModal);
      if (btnCancel) btnCancel.addEventListener('click', closeModal);

      if (form) {
        form.addEventListener('submit', function(e) {
          e.preventDefault();
          var xx = editXx.value;
          var description = editDesc.value;
          var rodzajVal = editRodzaj ? editRodzaj.value.trim() : '';
          var image = editImage.value.trim();
          fetch('/api/part', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ xx: xx, description: description, rodzaj: rodzajVal || undefined, image: image || undefined })
          })
          .then(function(r) { return r.json(); })
          .then(function(data) {
            if (data.ok) {
              closeModal();
              refreshList();
            } else {
              alert(data.error || 'Błąd zapisu');
            }
          })
          .catch(function() { alert('Błąd połączenia'); });
        });
      }

      bindCategoryEvents();
    })();
  </script>
</body>
</html>`;
}

function renderNotFound(categoryName) {
  return `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <title>Nie znaleziono – Electronic Parts</title>
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <div class="wrap">
    <header>
      <h1>Brak kategorii: ${escapeHtml(categoryName)}</h1>
    </header>
    <footer>
      <a href="/">← Strona główna</a>
    </footer>
  </div>
</body>
</html>`;
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeHtmlAttr(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/\r/g, '')
    .replace(/\n/g, ' ');
}

// Plik CSS wbudowany (bez osobnego serwowania plików)
const STYLE = `
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; margin: 0; background: #1a202c; color: #e2e8f0; min-height: 100vh; }
  .wrap { max-width: 960px; margin: 0 auto; padding: 1.5rem; }
  header { margin-bottom: 2rem; }
  header h1 { font-size: 1.75rem; margin: 0 0 0.5rem; color: #f7fafc; }
  header p { margin: 0; color: #a0aec0; }
  .categories { display: flex; flex-wrap: wrap; gap: 0.75rem; margin: 1.5rem 0; }
  .btn { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.6rem 1.2rem; background: #4a5568; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 500; transition: background .15s; }
  .btn:hover { background: #2b6cb0; }
  .btn .badge { display: inline-flex; align-items: center; justify-content: center; min-width: 1.5rem; padding: 0.15rem 0.4rem; font-size: 0.8rem; font-weight: 600; background: #2d3748; color: #a0aec0; border-radius: 999px; }
  .btn:hover .badge { background: #1a365d; color: #90cdf4; }
  footer { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #2d3748; }
  footer a { color: #63b3ed; text-decoration: none; }
  footer a:hover { text-decoration: underline; }
  .parts-table { width: 100%; border-collapse: collapse; background: #2d3748; border-radius: 8px; overflow: hidden; }
  .parts-table th, .parts-table td { padding: 0.75rem 1rem; text-align: left; border-bottom: 1px solid #4a5568; }
  .parts-table th { background: #2d3748; color: #a0aec0; font-weight: 600; }
  .parts-table tr:hover { background: #374151; }
  .parts-table .thumb img { border-radius: 6px; object-fit: cover; background: #1a202c; }
  .parts-table .name { font-weight: 500; color: #f7fafc; }
  .parts-table .rodzaj { color: #90cdf4; }
  .parts-table .qty { color: #68d391; }
  .parts-table .desc { font-size: 0.9rem; color: #a0aec0; max-width: 320px; }
  .qty-form { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
  .qty-form input[type="number"] { width: 4.5rem; padding: 0.35rem 0.5rem; border: 1px solid #4a5568; border-radius: 4px; background: #1a202c; color: #e2e8f0; font-size: 1rem; }
  .qty-form button { padding: 0.35rem 0.75rem; background: #2b6cb0; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9rem; }
  .qty-form button:hover { background: #2c5282; }
  .qty-form button:disabled { opacity: 0.6; cursor: not-allowed; }
  .qty-msg { font-size: 0.85rem; margin-left: 0.25rem; }
  .qty-msg.ok { color: #68d391; }
  .qty-msg.err { color: #fc8181; }
  .export-row { display: flex; align-items: center; gap: 0.75rem; margin: 1.5rem 0; flex-wrap: wrap; }
  .btn-add { background: #2b6cb0; }
  .btn-add:hover { background: #2c5282; }
  .btn-export { background: #276749; }
  .btn-export:hover { background: #22543d; }
  .form-err { font-size: 0.9rem; color: #fc8181; margin-bottom: 0.5rem; min-height: 1.25rem; }
  .form-group label .required { color: #fc8181; }
  .export-msg { font-size: 0.9rem; }
  .export-msg.ok { color: #68d391; }
  .export-msg.err { color: #fc8181; }
  .parts-table .actions { white-space: nowrap; }
  .btn-edit { padding: 0.4rem 0.8rem; font-size: 0.85rem; background: #4a5568; }
  .btn-edit:hover { background: #2b6cb0; }
  .btn-delete { padding: 0.4rem 0.8rem; font-size: 0.85rem; background: #742a2a; margin-left: 0.35rem; }
  .btn-delete:hover { background: #c53030; }
  .delete-confirm-msg { margin: 0 0 1rem; color: #e2e8f0; }
  .btn-delete-confirm { background: #c53030; }
  .btn-delete-confirm:hover { background: #9b2c2c; }
  .modal { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 1rem; visibility: hidden; opacity: 0; transition: visibility 0.2s, opacity 0.2s; }
  .modal.modal-open { visibility: visible; opacity: 1; }
  .modal-backdrop { position: absolute; inset: 0; background: rgba(0,0,0,0.6); cursor: pointer; }
  .modal-dialog { position: relative; width: 100%; max-width: 480px; background: #2d3748; border-radius: 12px; box-shadow: 0 20px 60px rgba(0,0,0,0.4); overflow: hidden; }
  .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 1rem 1.25rem; border-bottom: 1px solid #4a5568; }
  .modal-header h2 { margin: 0; font-size: 1.25rem; color: #f7fafc; }
  .modal-close { background: none; border: none; color: #a0aec0; font-size: 1.5rem; line-height: 1; cursor: pointer; padding: 0.25rem; }
  .modal-close:hover { color: #fff; }
  .modal-form { padding: 1.25rem; }
  .form-group { margin-bottom: 1rem; }
  .form-group label { display: block; margin-bottom: 0.35rem; font-size: 0.9rem; color: #a0aec0; }
  .form-group textarea, .form-group input[type="text"] { width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #4a5568; border-radius: 6px; background: #1a202c; color: #e2e8f0; font-family: inherit; font-size: 1rem; }
  .form-group textarea { min-height: 80px; resize: vertical; }
  .form-group input[type="text"] { box-sizing: border-box; }
  .modal-actions { display: flex; gap: 0.75rem; margin-top: 1.25rem; }
  .btn-save { background: #276749; }
  .btn-save:hover { background: #22543d; }
  .btn-cancel { background: #4a5568; }
  .btn-cancel:hover { background: #2d3748; }
`;

app.get('/style.css', (req, res) => {
  res.setHeader('Content-Type', 'text/css; charset=utf-8');
  res.send(STYLE.trim());
});

app.listen(PORT, () => {
  console.log(`Aplikacja działa pod adresem: http://localhost:${PORT}`);
});
