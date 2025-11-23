// ====== KONFIGS ======
const DATA_URL = "/api/materials";

// ====== ELEMENTI ======
const tableBody = document.querySelector("#materialsTableBody");
const saveStatus = document.querySelector("#saveStatus");
const saveBtn = document.querySelector("#saveBtn");
const reloadBtn = document.querySelector("#reloadBtn");
const addRowBtn = document.querySelector("#addRowBtn");

// ========================
// ====== IELĀDĒ DATUS ======
// ========================
async function loadMaterials() {
    saveStatus.textContent = "Ielādēju datus...";
    saveStatus.style.color = "black";

    const res = await fetch(DATA_URL);
    const data = await res.json();

    tableBody.innerHTML = "";
    data.materials.forEach(addMaterialRow);

    saveStatus.textContent = "Dati ielādēti no servera.";
    saveStatus.style.color = "green";
}

// =============================
// ====== PIEVIENOT RINDU ======
// =============================
function addMaterialRow(material) {
    const row = document.createElement("tr");
    row.classList.add("material-row");
    row.dataset.id = material.id;

    row.innerHTML = `
        <td><input type="text" class="name" value="${material.name}"></td>
        <td><input type="number" step="0.1" class="price" value="${material.price}"></td>
        <td>
            <select class="unit">
                <option value="m3" ${material.unit === "m3" ? "selected" : ""}>€/m3</option>
                <option value="t" ${material.unit === "t" ? "selected" : ""}>€/t</option>
            </select>
        </td>
        <td>
            <select class="status">
                <option value="available" ${material.status === "available" ? "selected" : ""}>pieejams</option>
                <option value="oos" ${material.status === "oos" ? "selected" : ""}>nav pieejams</option>
                <option value="low" ${material.status === "low" ? "selected" : ""}>neliels daudzums</option>
            </select>
        </td>
        <td><textarea class="notes">${material.notes || ""}</textarea></td>
        <td><input type="text" class="id" value="${material.id}" readonly></td>
    `;

    tableBody.appendChild(row);
}

// =====================================================
// ====== SAGLABĀT IZMAIŅAS (PUT uz /api/materials) ======
// =====================================================
async function saveChanges() {
    saveStatus.textContent = "Saglabāju...";
    saveStatus.style.color = "black";

    const rows = document.querySelectorAll(".material-row");

    const materials = [];

    rows.forEach(row => {
        materials.push({
            name: row.querySelector(".name").value,
            price: parseFloat(row.querySelector(".price").value),
            unit: row.querySelector(".unit").value,
            status: row.querySelector(".status").value,
            notes: row.querySelector(".notes").value,
            id: row.querySelector(".id").value,
            updated_at: new Date().toISOString().slice(0, 16).replace("T", " ")
        });
    });

    const res = await fetch(DATA_URL, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ materials })
    });

    if (res.ok) {
        saveStatus.textContent = "Izmaiņas saglabātas!";
        saveStatus.style.color = "green";
    } else {
        saveStatus.textContent = "Kļūda saglabājot!";
        saveStatus.style.color = "red";
    }
}

// ======================================
// ====== PIEVIENOT JAUNU MATERIĀLU ======
// ======================================
function addEmptyRow() {
    const newMaterial = {
        name: "",
        price: 0,
        unit: "m3",
        status: "available",
        notes: "",
        id: "material-" + Math.random().toString(36).substring(2, 8)
    };

    addMaterialRow(newMaterial);
    saveStatus.textContent = "Jauna rinda pievienota.";
    saveStatus.style.color = "black";
}

// ============================
// ====== EVENT LISTENERI ======
// ============================
saveBtn.addEventListener("click", saveChanges);
reloadBtn.addEventListener("click", loadMaterials);
addRowBtn.addEventListener("click", addEmptyRow);

// Ielādējam datus sākumā
loadMaterials();
