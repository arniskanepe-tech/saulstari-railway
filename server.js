// server.js – Express serveris ar PostgreSQL (Railway)

const express = require("express");
const path = require("path");
const fs = require("fs/promises");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 8080;

// ==== PostgreSQL pieslēgums ===========================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

// ==== Palīgfunkcijas DB sākotnējai sagatavošanai ======

async function initDb() {
  // 1) Izveido tabulas, ja nav
  await pool.query(`
    CREATE TABLE IF NOT EXISTS materials (
      id SERIAL PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category TEXT,
      price NUMERIC(10,2),
      unit TEXT,
      available BOOLEAN DEFAULT true,
      status TEXT,
      note TEXT,
      order_index INT DEFAULT 0
    );
  `);

  // Ja materials tabula jau eksistē bez status kolonnas – pievienojam
  await pool.query(`
    ALTER TABLE materials
    ADD COLUMN IF NOT EXISTS status TEXT;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS materials_updates (
      id SERIAL PRIMARY KEY,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // 2) Ja tabula tukša – ieimportē no data/materials.json
  const { rows } = await pool.query(
    "SELECT COUNT(*)::int AS count FROM materials"
  );
  if (rows[0].count === 0) {
    console.log("materials tabula tukša – importējam no JSON...");

    const filePath = path.join(__dirname, "data", "materials.json");
    const raw = await fs.readFile(filePath, "utf8");
    const data = JSON.parse(raw);

    const items = Array.isArray(data)
      ? data
      : data.materials || data.items || [];

    for (let i = 0; i < items.length; i++) {
      const m = items[i];

      await pool.query(
        `
        INSERT INTO materials
          (slug, name, category, price, unit, available, status, note, order_index)
        VALUES
          ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        ON CONFLICT (slug) DO NOTHING
      `,
        [
          m.slug || m.id || String(i + 1),
          m.name || "",
          m.category || "",
          m.price != null ? m.price : null,
          m.unit || m.mervienība || m.measure || "",
          // Ja vecajos datos bija availability/status, mēģinām to izmantot,
          // bet available boolean turam kā pamatvērtību
          m.available !== false,
          (m.status || m.availability || "").toString().trim(),
          m.note || m.comment || m.piezime || "",
          i,
        ]
      );
    }

    await pool.query(
      `INSERT INTO materials_updates (updated_at) VALUES (now())`
    );

    console.log("Sākotnējie dati ieimportēti datubāzē.");
  }
}

// palaidam inicializāciju (bez panikas, ja Railway restartējas)
initDb().catch((err) => {
  console.error("DB inicializācijas kļūda:", err);
});

// ==== Vidus slānis / statiskie faili ===================

app.use(express.json());

// statiskie faili – lai darbojas index.html, materials.html utt.
app.use(express.static(path.join(__dirname)));

// ==== API: nolasīt materiālus =========================

app.get("/api/materials", async (req, res) => {
  try {
    const mats = await pool.query(
      "SELECT * FROM materials ORDER BY order_index, id"
    );
    const upd = await pool.query(
      "SELECT updated_at FROM materials_updates ORDER BY id DESC LIMIT 1"
    );

    res.json({
      materials: mats.rows,
      lastUpdate: upd.rows[0]?.updated_at ?? null,
    });
  } catch (err) {
    console.error("GET /api/materials kļūda:", err);
    res.status(500).json({ error: "db_error" });
  }
});

// ==== API: saglabāt VISU materiālu sarakstu no admin ======
// admin.js sūta:
//  { materials: [...], lastUpdate: "2025-10-28 13:46" }

app.put("/api/materials", async (req, res) => {
  const { materials, lastUpdate } = req.body || {};

  if (!Array.isArray(materials)) {
    return res.status(400).json({ error: "invalid_payload" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM materials");

    for (let i = 0; i < materials.length; i++) {
      const m = materials[i];

      await client.query(
        `
        INSERT INTO materials
          (slug, name, category, price, unit, available, status, note, order_index)
        VALUES
          ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      `,
        [
          m.slug || m.id || String(i + 1),
          m.name || "",
          m.category || "",
          m.price != null ? m.price : null,
          m.unit || m.mervienība || m.measure || "",
          m.available !== false,
          (m.status || m.availability || "").toString().trim(),
          m.note || m.comment || m.piezime || "",
          i,
        ]
      );
    }

    // saglabā jauno "atjaunots" laiku
    const updatedAt = lastUpdate ? new Date(lastUpdate) : new Date();
    await client.query(
      "INSERT INTO materials_updates (updated_at) VALUES ($1)",
      [updatedAt]
    );

    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("PUT /api/materials kļūda:", err);
    res.status(500).json({ error: "db_error" });
  } finally {
    client.release();
  }
});

// =========================================================

app.listen(PORT, () => {
  console.log(`Saulstari serveris klausās uz porta ${PORT}`);
});
