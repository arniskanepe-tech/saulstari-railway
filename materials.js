// materials.js
document.addEventListener('DOMContentLoaded', () => {
  const materialsRoot = document.querySelector('#materials-root');
  const updatedEl = document.querySelector('#materials-updated');

  if (!materialsRoot) return;

  fetch('./data/materials.json')
    .then(res => res.json())
    .then(data => {
      const { lastUpdate, materials } = data;

      // Atjaunošanas datums vienā vietā
      if (updatedEl && lastUpdate) {
        updatedEl.textContent = `Dati atjaunoti: ${lastUpdate}`;
      }

      // Notīram konteineru
      materialsRoot.innerHTML = '';

      materials.forEach(material => {
        const {
          title,
          price,
          unit,
          availability,
          notes
        } = material;

        const card = document.createElement('article');
        card.className = 'material-card';

        const isUnavailable = availability && availability.toLowerCase() === 'nav pieejams';

        card.innerHTML = `
          <div class="material-card-header">
            <h3 class="material-title">${title || ''}</h3>
            <div class="material-meta">
              ${!isUnavailable && price != null && unit ? `
                <span class="material-price">${price} <span class="material-unit">${unit}</span></span>
              ` : ''}
              ${isUnavailable ? `
                <span class="material-status material-status-interest">INTERESĒTIES</span>
              ` : `
                <span class="material-status">${availability || ''}</span>
              `}
            </div>
          </div>
          ${notes && notes.trim() !== '' ? `
            <p class="material-notes">${notes}</p>
          ` : ''}
        `;

        materialsRoot.appendChild(card);
      });
    })
    .catch(err => {
      console.error('Neizdevās ielādēt materials.json', err);
      if (materialsRoot) {
        materialsRoot.innerHTML = '<p>Neizdevās ielādēt materiālu datus.</p>';
      }
    });
});
