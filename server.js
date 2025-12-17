// server.js – Express serveris ar PostgreSQL (Railway)

const express = require("express");
const path = require("path");
const fs = require("fs/promises");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 8080;

// ==== Admin autentifikācija =============================

// Lietotājvārdi/paroles tiek ņemti no vides mainīgajiem
const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASS = process.env.ADMIN_PASS;

// Jaunais (ierobežotais) lietotājs
const STAFF_USER = process.env.STAFF_USER;
const STAFF_PASS = process.env.STAFF_PASS;

function parseBasicAuth(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Basic ")) return null;

  const base64Credentials = authHeader.split(" ")[1];
  const credentials = Buffer.from(base64Credentials, "base64").toString("utf8");
  const [user, pass] = credentials.split(":");
  if (!user) return null;

  return { user, pass };
}

// Middleware, kas prasa Basic Auth (admin VAI staff)
// + uzliek req.userRole = "admin" | "staff"
function requireAdminAuth(req, res, next) {
  const creds = parseBasicAuth(req);

  if (!creds) {
    res.set("WWW-Authenticate", 'Basic realm="Saulstari Admin"');
    return res.status(401).send("Nepieciešama autorizācija");
  }

  const { user, pass } = creds;

  // admin
  if (user === ADMIN_USER && pass === ADMIN_PASS) {
    req.userRole = "admin";
    req.authUser = user;
    return next();
  }

  // staff
  if (user === STAFF_USER && pass === STAFF_PASS) {
    req.userRole = "staff";
    req.authUser = user;
    return next();
  }

  res.set("WWW-Authenticate", 'Basic realm="Saulstari Admin"');
  return res.status(401).send("Nepareizs lietotājvārds vai parole");
}

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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS materials_updates (
      id SERIAL PRIMARY KEY,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // gadījumam, ja tabula jau bija izveidota bez status
  await pool.query(`
    ALTER TABLE materials
    ADD COLUMN IF NOT EXISTS status TEXT;
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

      const statusRaw = (m.status || m.availability || "").toString().trim();
      let available = m.available;

      // ja available nav, atvasinām no status teksta
      if (available === undefined || available === null) {
        if (!statusRaw) {
          available = true;
        } else if (statusRaw.toLowerCase() === "nav pieejams") {
          available = false;
        } else {
          available = true;
        }
      }

      const note =
        m.note ||
        m.notes ||
        m.comment ||
        m.piezime ||
        "";

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
          available,
          statusRaw,
          note,
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

// palaidam inicializāciju (bez panikas, ja Railway/Render restartējas)
initDb().catch((err) => {
  console.error("DB inicializācijas kļūda:", err);
});

// ==== Vidus slānis / statiskie faili ===================

app.use(express.json());

// Vispirms aizsargājam /admin ar paroli
app.use("/admin", requireAdminAuth);

// statiskie faili – lai darbojas index.html, materials.html utt.
app.use(express.static(path.join(__dirname)));

// ==== API: kas es esmu (loma) ==========================
// Lai admin panelis zinātu, vai lietotājs ir "admin" vai "staff"
app.get("/api/me", requireAdminAuth, (req, res) => {
  res.json({ role: req.userRole || "staff" });
});

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

// ==== API: saglabāt materiālus no admin ======
// admin.js sūta:
//  { materials: [...], lastUpdate: "..." }

app.put("/api/materials", requireAdminAuth, async (req, res) => {
  const { materials, lastUpdate } = req.body || {};

  if (!Array.isArray(materials)) {
    return res.status(400).json({ error: "invalid_payload" });
  }

  // ===== STAFF režīms: drīkst mainīt tikai status + note (piezīmes) =====
  if (req.userRole === "staff") {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      for (let i = 0; i < materials.length; i++) {
        const m = materials[i];

        // Identificējam rindu pēc DB id (admin tabulā tas ir paslēptajā ID laukā)
        const idNum = Number(m.id);
        if (!Number.isFinite(idNum)) continue;

        const statusRaw = (m.status || m.availability || "").toString().trim();
        const note =
          (m.note || m.notes || m.comment || m.piezime || "").toString();

        // available atvasinām no status
        let available = true;
        if (statusRaw && statusRaw.toLowerCase() === "nav pieejams") {
          available = false;
        } else {
          available = true;
        }

        await client.query(
          `UPDATE materials SET status = $1, note = $2, available = $3 WHERE id = $4`,
          [statusRaw, note, available, idNum]
        );
      }

      const updatedAt = lastUpdate ? new Date(lastUpdate) : new Date();
      await client.query(
        "INSERT INTO materials_updates (updated_at) VALUES ($1)",
        [updatedAt]
      );

      await client.query("COMMIT");
      return res.json({ ok: true, role: "staff" });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("PUT /api/materials (staff) kļūda:", err);
      return res.status(500).json({ error: "db_error" });
    } finally {
      client.release();
    }
  }

  // ===== ADMIN režīms: esošā loģika (pilna rediģēšana) =====
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM materials");

    for (let i = 0; i < materials.length; i++) {
      const m = materials[i];

      const statusRaw = (m.status || m.availability || "").toString().trim();
      let available = m.available;

      // ja admin nedeva available, atvasinām no status
      if (available === undefined || available === null) {
        if (!statusRaw) {
          available = true;
        } else if (statusRaw.toLowerCase() === "nav pieejams") {
          available = false;
        } else {
          available = true;
        }
      }

      const note =
        m.note ||
        m.notes ||
        m.comment ||
        m.piezime ||
        "";

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
          available,
          statusRaw,
          note,
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
    res.json({ ok: true, role: "admin" });
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
