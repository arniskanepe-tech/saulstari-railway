// materials.js – sākumlapa lasa datus no /api/materials
document.addEventListener("DOMContentLoaded", () => {
  const updatedEl = document.getElementById("home-materials-updated");
  const cards = document.querySelectorAll(".vitem[data-material-id]");

  if (!cards.length) return;

  fetch("/api/materials")
    .then(res => res.json())
    .then(data => {
      const lastUpdate = data.lastUpdate;
      const materials = data.materials || [];

      if (updatedEl && lastUpdate) {
        updatedEl.textContent = "Dati atjaunoti: " + lastUpdate;
      }

      cards.forEach(card => {
        const id = card.dataset.materialId;
        const mat = materials.find(m => m.id === id);
        if (!mat) return;

        const priceEl = card.querySelector(".js-price");
        const statusEl = card.querySelector(".js-status");
        const notesEl = card.querySelector(".js-notes");
        const dotEl = card.querySelector(".dot");
        const actionEl = card.querySelector(".avail-action");

        const availability = (mat.availability || "").toLowerCase();
        const isOOS = availability === "nav pieejams";
        const isLow = availability.includes("neliels");

        // Cena + mērvienība
        if (priceEl) {
          priceEl.textContent = mat.price + " " + (mat.unit || "");
        }

        // Pieejamības teksts
        if (statusEl) {
          statusEl.textContent = mat.availability || "";
        }

        // Gaismiņa
        if (dotEl) {
          dotEl.classList.remove("green", "red", "yellow");
          if (isOOS) dotEl.classList.add("red");
          else if (isLow) dotEl.classList.add("yellow");
          else dotEl.classList.add("green");
        }

        // "interesēties" poga, ja nav pieejams
        if (actionEl) {
          if (isOOS) {
            const encodedName = encodeURIComponent(mat.name || "");
            actionEl.innerHTML = `<a href="contact.html?material=${encodedName}#fast-form">interesēties</a>`;
          } else {
            actionEl.innerHTML = "";
          }
        }

        // Piezīmes
        if (notesEl) {
          if (mat.notes && mat.notes.trim() !== "") {
            notesEl.textContent = mat.notes;
            notesEl.style.display = "";
          } else {
            notesEl.textContent = "";
            notesEl.style.display = "none";
          }
        }
      });
    })
    .catch(err => {
      console.error("Neizdevās ielādēt materiālus", err);
      if (updatedEl) {
        updatedEl.textContent = "Neizdevās ielādēt materiālu datus.";
      }
    });
});
