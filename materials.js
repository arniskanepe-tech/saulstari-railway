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
  const note = (material.notes || '').toString().trim();

  // Pieejamība (no availability vai status)
  const availability = (material.availability || material.status || '')
    .toString()
    .trim()
    .toLowerCase();

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

  // 1. kolonna – nosaukums
  const nameEl = document.createElement('div');
  nameEl.className = 'vname';
  nameEl.textContent = name;

  // 2. kolonna – cena + mērvienība
  const priceEl = document.createElement('div');
  priceEl.className = 'vprice';

  const basePrice =
    price !== undefined && price !== null && price !== ''
      ? trimPrice(price)
      : '';

  let priceText = basePrice;
  if (unit) priceText += ' ' + unit;
  priceEl.textContent = priceText;

  // 3. kolonna – piezīme
  const metaEl = document.createElement('div');
  metaEl.className = 'vmeta';
  if (note) {
    metaEl.textContent = note;
  } else {
    metaEl.textContent = '';
  }

  // 4. kolonna – aplītis
  const dotEl = document.createElement('span');
  dotEl.className = 'dot ' + dotClass;

  // 5. kolonna – statusa teksts
  const statusEl = document.createElement('div');
  statusEl.className = 'avail-text';
  statusEl.textContent = statusText;

  // 6. kolonna – interesēties
  const actionEl = document.createElement('div');
  actionEl.className = 'avail-action';
  if (showInterest) {
    const link = document.createElement('a');
    link.href = 'contact.html#fast-form';
    link.textContent = 'interesēties';
    actionEl.appendChild(link);
  }

  // Pievienojam elementus precīzā secībā, lai grid aizpildās pareizi
  row.appendChild(nameEl);
  row.appendChild(priceEl);
  row.appendChild(metaEl);
  row.appendChild(dotEl);
  row.appendChild(statusEl);
  row.appendChild(actionEl);

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
