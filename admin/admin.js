// admin.js – admin/index.html tabulai, strādā ar /api/materials

const STATUS_OPTIONS = [
  { value: 'pieejams', label: 'pieejams' },
  { value: 'neliels daudzums', label: 'neliels daudzums' },
  { value: 'nav pieejams', label: 'nav pieejams' },
];

const UNIT_OPTIONS = ['€/m3', '€/t'];

const lastUpdateInput = document.querySelector('#lastUpdate');
const adminStatusEl = document.querySelector('#adminStatus');
const tableBody = document.querySelector('#materialsTableBody');
const saveBtn = document.querySelector('#saveBtn');
const reloadBtn = document.querySelector('#reloadBtn');
const addRowBtn = document.querySelector('#addRowBtn');
const saveStatusEl = document.querySelector('#saveStatus');

let materialsData = {
  lastUpdate: '',
  materials: [],
};

// Jaunais: loma (admin/staff)
let CURRENT_ROLE = 'admin';

// Palīgfunkcija datuma attēlošanai "03.12.2025 11:44" formātā
function formatLastUpdateForDisplay(value) {
  if (!value) return '';

  const dateObj = value instanceof Date ? value : new Date(value);
  if (isNaN(dateObj)) {
    // ja neizdodas parsēt, atstājam, kā ir
    return String(value);
  }

  return dateObj.toLocaleString('lv-LV', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Inicializācija
initAdmin();

async function initAdmin() {
  // Ielādējam lomu no servera (admin vai staff)
  await loadRole();

  if (reloadBtn) reloadBtn.addEventListener('click', loadFromServer);
  if (saveBtn) saveBtn.addEventListener('click', handleSave);

  // staff režīmā neliekam pat klausītāju pie "Pievienot materiālu"
  if (addRowBtn && CURRENT_ROLE !== 'staff') {
    addRowBtn.addEventListener('click', handleAddRow);
  }

  // Dzēšanas poga (event delegation)
  if (tableBody) {
    tableBody.addEventListener('click', (e) => {
      // staff nedrīkst dzēst
      if (CURRENT_ROLE === 'staff') return;

      const btn = e.target.closest('.delete-material-btn');
      if (!btn) return;
      const row = btn.closest('tr');
      const index = Number(row.dataset.index);
      if (Number.isNaN(index)) return;

      if (confirm('Vai tiešām dzēst šo materiālu?')) {
        materialsData.materials.splice(index, 1);
        renderTable();
        setSaveStatus(
          'Materiāls izdzēsts (neaizmirsti nospiest "Saglabāt izmaiņas").',
          'info'
        );
      }
    });
  }

  // UI: staff režīmā paslēpjam "Pievienot materiālu"
  if (CURRENT_ROLE === 'staff' && addRowBtn) {
    addRowBtn.style.display = 'none';
  }

  loadFromServer();
}

function loadRole() {
  // Šis izmanto to pašu Basic Auth, ko pārlūks jau iedod /admin lapai
  return fetch('/api/me', { cache: 'no-store' })
    .then((r) => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then((data) => {
      CURRENT_ROLE = (data && data.role) ? data.role : 'admin';

      // staff režīmā: nelabojam "Kopējais atjaunošanas datums" lauku
      if (CURRENT_ROLE === 'staff' && lastUpdateInput) {
        lastUpdateInput.disabled = true;
      }
    })
    .catch(() => {
      // ja kas noiet greizi, uzvedamies kā admin (nekā nelaužam)
      CURRENT_ROLE = 'admin';
    });
}

function loadFromServer() {
  setAdminStatus('Ielādēju datus no servera...', 'info');

  fetch('/api/materials?_=' + Date.now())
    .then((r) => r.json())
    .then((data) => {
      materialsData = {
        lastUpdate: data.lastUpdate || '',
        materials: Array.isArray(data.materials) ? data.materials : [],
      };

      // sakārtojam materiālus alfabētiski
      sortMaterialsByName();

      if (lastUpdateInput) {
        lastUpdateInput.value = formatLastUpdateForDisplay(materialsData.lastUpdate);
      }

      renderTable();
      setAdminStatus('Dati ielādēti no servera.', 'ok');
      setSaveStatus('Izmaiņas nav saglabātas.', 'info');
    })
    .catch((err) => {
      console.error('Neizdevās ielādēt /api/materials', err);
      setAdminStatus('Kļūda ielādējot datus no servera.', 'error');
    });
}

function renderTable() {
  if (!tableBody) return;
  tableBody.innerHTML = '';

  materialsData.materials.forEach((mat, index) => {
    const tr = document.createElement('tr');
    tr.dataset.index = index;

    // Nosaukums
    const nameTd = document.createElement('td');
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = mat.name || '';
    if (CURRENT_ROLE === 'staff') nameInput.disabled = true;
    nameTd.appendChild(nameInput);
    tr.appendChild(nameTd);

    // Cena
    const priceTd = document.createElement('td');
    const priceInput = document.createElement('input');
    priceInput.type = 'number';
    priceInput.step = '0.1';
    priceInput.min = '0';
    priceInput.value =
      mat.price !== undefined && mat.price !== null ? String(mat.price) : '';
    if (CURRENT_ROLE === 'staff') priceInput.disabled = true;
    priceTd.appendChild(priceInput);
    tr.appendChild(priceTd);

    // Mērvienība
    const unitTd = document.createElement('td');
    const unitSelect = document.createElement('select');
    UNIT_OPTIONS.forEach((u) => {
      const opt = document.createElement('option');
      opt.value = u;
      opt.textContent = u;
      if (mat.unit === u) opt.selected = true;
      unitSelect.appendChild(opt);
    });
    if (CURRENT_ROLE === 'staff') unitSelect.disabled = true;
    unitTd.appendChild(unitSelect);
    tr.appendChild(unitTd);

    // Statuss
    const statusTd = document.createElement('td');
    const statusSelect = document.createElement('select');
    STATUS_OPTIONS.forEach((s) => {
      const opt = document.createElement('option');
      opt.value = s.value;
      opt.textContent = s.label;
      if ((mat.availability || mat.status) === s.value) opt.selected = true;
      statusSelect.appendChild(opt);
    });
    statusTd.appendChild(statusSelect);
    tr.appendChild(statusTd);

    // Piezīmes
    const notesTd = document.createElement('td');
    const notesArea = document.createElement('textarea');
    notesArea.rows = 1;
    notesArea.value = (mat.note || mat.notes || '').toString();
    notesTd.appendChild(notesArea);
    tr.appendChild(notesTd);

    // ID — PASLĒPTS
    const idTd = document.createElement('td');
    idTd.className = 'visually-hidden';
    const idSpan = document.createElement('span');
    idSpan.className = 'admin-id-pill';
    idSpan.textContent = mat.id || generateIdFromName(mat.name, index);
    idTd.appendChild(idSpan);
    tr.appendChild(idTd);

    // Dzēst
    const deleteTd = document.createElement('td');
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn btn-danger delete-material-btn';
    deleteBtn.textContent = 'Dzēst';
    if (CURRENT_ROLE === 'staff') {
      deleteBtn.style.display = 'none';
    }
    deleteTd.appendChild(deleteBtn);
    tr.appendChild(deleteTd);

    tableBody.appendChild(tr);
  });
}

function handleAddRow() {
  // staff drošībai: ja tomēr kaut kā izsauc
  if (CURRENT_ROLE === 'staff') return;

  materialsData.materials.push({
    id: '',
    name: 'Jauns materiāls',
    price: '',
    unit: '€/m3',
    availability: 'pieejams',
    notes: '',
  });

  sortMaterialsByName();
  renderTable();

  setSaveStatus(
    'Pievienots jauns materiāls (neaizmirsti nospiest "Saglabāt izmaiņas").',
    'info'
  );
}

function handleSave() {
  if (!tableBody) return;

  const rows = Array.from(tableBody.querySelectorAll('tr'));

  materialsData.materials = rows.map((row, index) => {
    const [nameTd, priceTd, unitTd, statusTd, notesTd, idTd] = Array.from(
      row.children
    );

    const name = nameTd.querySelector('input').value.trim();
    const priceStr = priceTd.querySelector('input').value.trim();
    const unit = unitTd.querySelector('select').value;
    const availability = statusTd.querySelector('select').value;
    const notes = notesTd.querySelector('textarea').value.trim();
    const id =
      idTd.querySelector('.admin-id-pill').textContent.trim() ||
      generateIdFromName(name, index);

    const price = priceStr === '' ? '' : Number(priceStr);

    return { id, name, price, unit, availability, note: notes };
  });

  // Jauns datums
  const now = new Date();

  // → uz serveri glabājam ISO formātā
  materialsData.lastUpdate = now.toISOString();

  // → admin laukā rādām skaisto formātu (staff režīmā lauks ir disabled, bet vērtību var uzlikt)
  if (lastUpdateInput) {
    lastUpdateInput.value = formatLastUpdateForDisplay(now);
  }

  setSaveStatus('Saglabāju izmaiņas...', 'info');

  fetch('/api/materials', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(materialsData),
  })
    .then((r) => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(() => {
      setSaveStatus('Izmaiņas saglabātas serverī.', 'ok');
      setAdminStatus('Dati ielādēti un saglabāti.', 'ok');
    })
    .catch((err) => {
      console.error('Neizdevās saglabāt /api/materials', err);
      setSaveStatus('Kļūda saglabājot izmaiņas.', 'error');
    });
}

function sortMaterialsByName() {
  materialsData.materials.sort((a, b) => {
    const nameA = (a.name || '').toString().trim().toLocaleLowerCase('lv');
    const nameB = (b.name || '').toString().trim().toLocaleLowerCase('lv');

    if (nameA < nameB) return -1;
    if (nameA > nameB) return 1;
    return 0;
  });
}

function generateIdFromName(name, index) {
  if (!name) return 'material-' + (index + 1);
  return (
    name
      .toLowerCase()
      .replace(/[\/\s]+/g, '-')
      .replace(/[^a-z0-9\-]/g, '')
      .replace(/\-+/g, '-')
      .replace(/^\-+|\-+$/g, '') || 'material-' + (index + 1)
  );
}

function setAdminStatus(msg, mode) {
  if (!adminStatusEl) return;
  adminStatusEl.textContent = msg;
  adminStatusEl.style.color =
    mode === 'ok' ? '#1f3b2d' : mode === 'error' ? '#b03030' : '#455449';
}

function setSaveStatus(msg, mode) {
  if (!saveStatusEl) return;
  saveStatusEl.textContent = msg;
  saveStatusEl.style.color =
    mode === 'ok' ? '#1f3b2d' : mode === 'error' ? '#b03030' : '#455449';
}
