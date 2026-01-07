// server.js – Express serveris ar PostgreSQL (Railway)

const express = require("express");
const path = require("path");
const fs = require("fs/promises");
const { Pool } = require("pg");

const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = process.env.PORT || 8080;

// ==== Admin autentifikācija =============================

// Lietotājvārdi/paroles tiek ņemti no vides mainīgajiem
const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASS = process.env.ADMIN_PASS;

// Jaunais (ierobežotais) lietotājs
const STAFF_USER = process.env.STAFF_USER;
const STAFF_PASS = process.env.STAFF_PASS;

// Session secret (Railway Variables)
const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
  console.error("❌ Nav uzlikts SESSION_SECRET (Railway Variables).");
  process.exit(1);
}

// ==== Cookie + JWT (iPhone PWA draudzīgi) ================

function signToken(payload) {
  return jwt.sign(payload, SESSION_SECRET, { expiresIn: "7d" });
}

function authFromCookie(req, res, next) {
  const token = req.cookies?.saulstari_token;
  if (!token) return next();

  try {
    const data = jwt.verify(token, SESSION_SECRET);
    req.userRole = data.role; // "admin" | "staff"
    req.authUser = data.user;
  } catch (e) {
    // slikts/novecojis tokens -> ignorējam
  }
  return next();
}

function requireLogin(req, res, next) {
  if (req.userRole) return next();

  const accept = (req.headers.accept || "").toLowerCase();

  // HTML lapām pāradresējam uz login formu
  if (accept.includes("text/html")) {
    return res.redirect("/admin/login.html");
  }

  // API atgriežam skaidru 401
  return res.status(401).json({ error: "auth_required" });
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
  const { rows } = await pool.query("SELECT COUNT(*)::int AS count FROM materials");
  if (rows[0].count === 0) {
    console.log("materials tabula tukša – importējam no JSON...");

    const filePath = path.join(__dirname, "data", "materials.json");
    const raw = await fs.readFile(filePath, "utf8");
    const data = JSON.parse(raw);

    const items = Array.isArray(data) ? data : data.materials || data.items || [];

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

      const note = m.note || m.notes || m.comment || m.piezime || "";

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

    await pool.query(`INSERT INTO materials_updates (updated_at) VALUES (now())`);

    console.log("Sākotnējie dati ieimportēti datubāzē.");
  }
}

// palaidam inicializāciju (bez panikas, ja Railway/Render restartējas)
initDb().catch((err) => {
  console.error("DB inicializācijas kļūda:", err);
});

// ==== Vidus slānis / statiskie faili ===================

app.use(express.json());
app.use(cookieParser());
app.use(authFromCookie);

/**
 * =======================================================
 * ROOT -> WWW + HTTP -> HTTPS pāradresācija
 * - karjerssaulstari.lv/*  -> https://www.karjerssaulstari.lv/*
 * - strādā aiz proxy (Railway), izmanto X-Forwarded-Proto
 * =======================================================
 */
const CANONICAL_HOST = "www.karjerssaulstari.lv";

app.enable("trust proxy"); // lai req.protocol pareizi strādā aiz Railway proxy

app.use((req, res, next) => {
  const host = (req.headers.host || "").toLowerCase();
  const proto = (req.headers["x-forwarded-proto"] || req.protocol || "http")
    .toString()
    .split(",")[0]
    .trim()
    .toLowerCase();

  // ja ienāk uz root (bez www), pārsūtam uz www (saglabājam path + query)
  const isRootDomain =
    host === "karjerssaulstari.lv" ||
    host === "karjerssaulstari.lv:80" ||
    host === "karjerssaulstari.lv:443";

  const needsWww = isRootDomain;
  const needsHttps = proto !== "https";

  if (needsWww || needsHttps) {
    const targetHost = CANONICAL_HOST;
    const targetProto = "https";
    return res.redirect(301, `${targetProto}://${targetHost}${req.originalUrl}`);
  }

  return next();
});

// ==== Login / Logout API =================================

// Login (saņem username/password, iedod cookie ar tokenu)
app.post("/api/login", (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: "missing_credentials" });
  }

  // admin
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    const token = signToken({ user: username, role: "admin" });
    res.cookie("saulstari_token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
    });
    return res.json({ ok: true, role: "admin" });
  }

  // staff
  if (username === STAFF_USER && password === STAFF_PASS) {
    const token = signToken({ user: username, role: "staff" });
    res.cookie("saulstari_token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
    });
    return res.json({ ok: true, role: "staff" });
  }

  return res.status(401).json({ error: "invalid_credentials" });
});

// Logout (izdzēš cookie) — 204 ir stabilākais sendBeacon/iOS gadījumā
app.post("/api/logout", (req, res) => {
  res.clearCookie("saulstari_token", { path: "/" });
  return res.sendStatus(204);
});

// ==== Admin aizsardzība (bez Basic Auth) ==================
// Atļaujam login lapu un PWA tehniskos failus bez autorizācijas
app.use("/admin", (req, res, next) => {
  if (
    req.path === "/login.html" ||
    req.path === "/manifest.json" ||
    req.path === "/sw.js" ||
    req.path.startsWith("/icons/")
  ) {
    return next();
  }
  return requireLogin(req, res, next);
});

// statiskie faili – lai darbojas index.html, materials.html utt.
app.use(express.static(path.join(__dirname)));

// ==== API: kas es esmu (loma) ==========================
// Lai admin panelis zinātu, vai lietotājs ir "admin" vai "staff"
app.get("/api/me", requireLogin, (req, res) => {
  res.json({ role: req.userRole || "staff" });
});

// ==== API: nolasīt materiālus =========================

app.get("/api/materials", async (req, res) => {
  try {
    const mats = await pool.query("SELECT * FROM materials ORDER BY order_index, id");
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

app.put("/api/materials", requireLogin, async (req, res) => {
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

        const idNum = Number(m.id);
        if (!Number.isFinite(idNum)) continue;

        const statusRaw = (m.status || m.availability || "").toString().trim();
        const note = (m.note || m.notes || m.comment || m.piezime || "").toString();

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

      if (available === undefined || available === null) {
        if (!statusRaw) {
          available = true;
        } else if (statusRaw.toLowerCase() === "nav pieejams") {
          available = false;
        } else {
          available = true;
        }
      }

      const note = m.note || m.notes || m.comment || m.piezime || "";

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
