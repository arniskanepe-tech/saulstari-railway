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

  // Helper teksta šūnām
  function textCell(extraClass, text) {
    const el = document.createElement('div');
    el.className = 'vcell ' + extraClass;
    el.textContent = text;
    return el;
  }

  // 1. kolonna – materiāls
  const nameCell = textCell('vcell-name', name);

  // 2. kolonna – cena/mērvienība
  const basePrice =
    price !== undefined && price !== null && price !== ''
      ? trimPrice(price)
      : '';
  let priceText = basePrice;
  if (unit) priceText += ' ' + unit;
  const priceCell = textCell('vcell-price', priceText);

  // 3. kolonna – piezīme
  const noteCell = textCell('vcell-note', note || '');

  // 4. kolonna – aplītis
  const dotCell = document.createElement('div');
  dotCell.className = 'vcell vcell-dot';
  const dotSpan = document.createElement('span');
  dotSpan.className = 'dot ' + dotClass;
  dotCell.appendChild(dotSpan);

  // 5. kolonna – statuss
  const statusCell = textCell('vcell-status', statusText);

  // 6. kolonna – interesēties
  const interestCell = document.createElement('div');
  interestCell.className = 'vcell vcell-interest';
  if (showInterest) {
    const link = document.createElement('a');
    link.href = 'contact.html#fast-form';
    link.textContent = 'interesēties';
    interestCell.appendChild(link);
  }

  // Pievienojam šūnas precīzā secībā
  row.appendChild(nameCell);
  row.appendChild(priceCell);
  row.appendChild(noteCell);
  row.appendChild(dotCell);
  row.appendChild(statusCell);
  row.appendChild(interestCell);

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
