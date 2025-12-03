// materials.js – ģenerē materiālu sarakstu sākumlapā no /api/materials

document.addEventListener('DOMContentLoaded', () => {
  const listEl = document.querySelector('[data-materials-list]');
  const updatedEl = document.getElementById('home-materials-updated');

  if (!listEl) {
    console.error('Nav atrasts [data-materials-list] konteiners.');
    return;
  }

  fetch('/api/materials?_=' + Date.now())
    .then(r => r.json())
    .then(data => {
      const materials = Array.isArray(data)
        ? data
        : (data.materials || data.items || []);

      // Kopējais atjaunošanas datums
      if (updatedEl && data.lastUpdate) {
      const date = new Date(data.lastUpdate);
      const formatted = date.toLocaleString('lv-LV').replace(',', '');
      updatedEl.textContent = 'Dati atjaunoti: ' + formatted;
      }

      // Alfabētiska kārtošana pēc nosaukuma
      const sorted = [...materials].sort((a, b) => {
        const nameA = (a.name || '').toString().trim().toLocaleLowerCase('lv');
        const nameB = (b.name || '').toString().trim().toLocaleLowerCase('lv');

        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;
        return 0;
      });

      // Notīram sarakstu un ieliekam rindas
      listEl.innerHTML = '';

      sorted.forEach((m, index) => {
        listEl.appendChild(createMaterialRow(m, index));
      });
    })
    .catch(err => {
      console.error('Neizdevās ielādēt materiālus no API', err);
      if (updatedEl) {
        updatedEl.textContent = 'Kļūda ielādējot materiālu datus.';
      }
    });
});

function createMaterialRow(material, index) {
  const id = material.id || generateId(material.name, index);
  const name = material.name || '';
  const price = material.price;
  const unit = material.unit || '';

  // ņemam vērā gan note, gan veco notes
  const note = (material.note || material.notes || '').toString().trim();

  // Pieejamība
  let availability = (material.availability || material.status || '')
    .toString()
    .trim()
    .toLowerCase();

  const isAvailable = material.available; // boolean no DB

  // ja status/availability nav, atvasinām no available
  if (!availability) {
    if (isAvailable === false) {
      availability = 'nav pieejams';
    } else if (isAvailable === true) {
      availability = 'pieejams';
    }
  }

  let dotClass = 'gray';
  let statusText = '';
  let showInterest = false;

  switch (availability) {
    case 'pieejams':
      dotClass = 'green';
      statusText = 'Pieejams';
      break;
    case 'neliels daudzums':
      dotClass = 'yellow';
      statusText = 'Neliels daudzums';
      break;
    case 'nav pieejams':
      dotClass = 'red';
      statusText = 'Nav pieejams';
      showInterest = true;
      break;
    default:
      dotClass = 'gray';
      statusText = '';
  }

  // === Galvenais konteiners ===
  const row = document.createElement('div');
  row.className = 'vitem';
  row.dataset.materialId = id;

  // === Kreisā puse: nosaukums + cena, piezīme atsevišķā rindiņā ===
  const leftWrap = document.createElement('div');

  const nameLine = document.createElement('div');
  nameLine.className = 'vname-line';

  const nameEl = document.createElement('div');
  nameEl.className = 'vname';
  nameEl.textContent = name;

  const priceEl = document.createElement('div');
  priceEl.className = 'vprice';

  const basePrice =
    price !== undefined && price !== null && price !== ''
      ? trimPrice(price)
      : '';

  let priceText = basePrice;
  if (unit) priceText += ' ' + unit;

  priceEl.textContent = priceText;

  // meta rindiņa – šeit rādām piezīmi, ja ir
  const metaEl = document.createElement('div');
  metaEl.className = 'vmeta';
  if (note) {
    metaEl.textContent = note;
  }

  // Visi trīs blakus vienā rindā (layout kontrolē CSS)
  nameLine.appendChild(nameEl);
  nameLine.appendChild(priceEl);
  nameLine.appendChild(metaEl);

  leftWrap.appendChild(nameLine);

  // === Labā puse: pieejamība + interesēties ===
  const rightWrap = document.createElement('div');
  rightWrap.className = 'avail-grid';

  // Punkts
  const dotEl = document.createElement('span');
  dotEl.className = 'dot ' + dotClass;

  // Teksts
  const statusEl = document.createElement('div');
  statusEl.className = 'avail-text';
  statusEl.textContent = statusText;

  // Kopējais konteineris punktam + tekstam (lai tie IR vienā rindā)
  const statusWrap = document.createElement('div');
  statusWrap.className = 'avail-status-wrap';
  statusWrap.appendChild(dotEl);
  statusWrap.appendChild(statusEl);

  // Tukšais "spacers" – flex variantā paslēpts ar CSS
  const spacerEl = document.createElement('div');
  spacerEl.className = 'avail-spacer';

  // Interesēties
  const actionEl = document.createElement('div');
  actionEl.className = 'avail-action';
  if (showInterest) {
    const link = document.createElement('a');
    link.href = 'contact.html#fast-form';
    link.textContent = 'interesēties';
    actionEl.appendChild(link);
  }

  // Pievienojam 3 elementus pareizā secībā
  rightWrap.appendChild(statusWrap);
  rightWrap.appendChild(spacerEl);
  rightWrap.appendChild(actionEl);

  row.appendChild(leftWrap);
  row.appendChild(rightWrap);

  return row;
}

function trimPrice(value) {
  if (value === '' || value == null) return '';
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.00$/, '');
}

function generateId(name, index) {
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
