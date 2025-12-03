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

// Inicializācija
initAdmin();

function initAdmin() {
  if (reloadBtn) reloadBtn.addEventListener('click', loadFromServer);
  if (saveBtn) saveBtn.addEventListener('click', handleSave);
  if (addRowBtn) addRowBtn.addEventListener('click', handleAddRow);

  // Dzēšanas poga (event delegation)
  if (tableBody) {
    tableBody.addEventListener('click', (e) => {
      const btn = e.target.closest('.delete-material-btn');
      if (!btn) return;
      const row = btn.closest('tr');
      const index = Number(row.dataset.index);
      if (Number.isNaN(index)) return;

      if (confirm('Vai tiešām dzēst šo materiālu?')) {
        materialsData.materials.splice(index, 1);
        renderTable();
        setSaveStatus('Materiāls izdzēsts (neaizmirsti nospiest "Saglabāt izmaiņas").', 'info');
      }
    });
  }

  loadFromServer();
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
        lastUpdateInput.value = materialsData.lastUpdate || '';
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
    notesArea.value = mat.notes || '';
    notesTd.appendChild(notesArea);
    tr.appendChild(notesTd);

    // ID — PASLĒPTS
    const idTd = document.createElement('td');
    idTd.className = 'visually-hidden';   // ← ŠEIT ID tiek paslēpts
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
    deleteTd.appendChild(deleteBtn);
    tr.appendChild(deleteTd);

    tableBody.appendChild(tr);
  });
}

function handleAddRow() {
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

  setSaveStatus('Pievienots jauns materiāls (neaizmirsti nospiest "Saglabāt izmaiņas").', 'info');
}

function handleSave() {
  if (!tableBody) return;

  const rows = Array.from(tableBody.querySelectorAll('tr'));

  materialsData.materials = rows.map((row, index) => {
    const [nameTd, priceTd, unitTd, statusTd, notesTd, idTd] = Array.from(row.children);

    const name = nameTd.querySelector('input').value.trim();
    const priceStr = priceTd.querySelector('input').value.trim();
    const unit = unitTd.querySelector('select').value;
    const availability = statusTd.querySelector('select').value;
    const notes = notesTd.querySelector('textarea').value.trim();
    const id =
      idTd.querySelector('.admin-id-pill').textContent.trim() ||
      generateIdFromName(name, index);

    const price = priceStr === '' ? '' : Number(priceStr);

    return { id, name, price, unit, availability, notes };
  });

  const now = new Date().toLocaleString('lv-LV', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  materialsData.lastUpdate = now;
  if (lastUpdateInput) lastUpdateInput.value = now;

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
