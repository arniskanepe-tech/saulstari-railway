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
        updatedEl.textContent = 'Dati atjaunoti: ' + data.lastUpdate;
      }

      // Notīram sarakstu un ieliekam rindas
      listEl.innerHTML = '';

      materials.forEach((m, index) => {
        listEl.appendChild(createMaterialRow(m, index));
      });
    })
    .catch(err => {
      console.error('Neizdevās ielādēt mater­iālus no API', err);
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
  const note = (material.notes || '').toString().trim();

  // Pieejamība (no availability vai status)
  const availability = (material.availability || material.status || '')
    .toString()
    .trim()
    .toLowerCase();

  let dotClass = 'grey';
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
      dotClass = 'grey';
      statusText = '';
  }

  // === Galvenais konteiners ===
  const row = document.createElement('div');
  row.className = 'vitem';
  row.dataset.materialId = id;

  // === Kreisā puse: nosaukums + cena + piezīme A variantā ===
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
  if (note) priceText += ' ' + note; // A variants – piezīme tajā pašā rindā

  priceEl.textContent = priceText;

  nameLine.appendChild(nameEl);
  nameLine.appendChild(priceEl);
  leftWrap.appendChild(nameLine);

  // var palikt vmeta bloks, ja gribas, bet šobrīd neizmantojam
  const metaEl = document.createElement('div');
  metaEl.className = 'vmeta';
  leftWrap.appendChild(metaEl);

  // === Labā puse: pieejamība + interesēties ===
  const rightWrap = document.createElement('div');
  rightWrap.className = 'avail-grid';

  const labelEl = document.createElement('div');
  labelEl.className = 'avail-label';
  labelEl.textContent = 'Pieejamība:';

  const dotEl = document.createElement('span');
  dotEl.className = 'dot ' + dotClass;

  const statusEl = document.createElement('div');
  statusEl.className = 'avail-text';
  statusEl.textContent = statusText;

  const actionEl = document.createElement('div');
  actionEl.className = 'avail-action';

  if (showInterest) {
    const link = document.createElement('a');
    link.href = 'contact.html#fast-form';
    link.textContent = 'interesēties';
    actionEl.appendChild(link);
  }

  rightWrap.appendChild(labelEl);
  rightWrap.appendChild(dotEl);
  rightWrap.appendChild(statusEl);
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
