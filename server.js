const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_PATH = path.join(__dirname, 'data', 'materials.json');

// lai varam sūtīt un saņemt JSON
app.use(express.json());

// servē visus statiskos failus no projekta saknes (index.html, assets, admin, utt.)
app.use(express.static(__dirname));

// ielādējam materiālus atmiņā
let materialsData = require(DATA_PATH);

// API: nolasīt materiālus
app.get('/api/materials', (req, res) => {
  res.json(materialsData);
});

// API: saglabāt materiālus (admin daļa)
app.put('/api/materials', (req, res) => {
  const newData = req.body;

  if (!newData || !Array.isArray(newData.materials)) {
    return res.status(400).json({ error: 'Nekorekti dati: trūkst materials masīvs' });
  }

  materialsData = newData;

  fs.writeFile(DATA_PATH, JSON.stringify(materialsData, null, 2), (err) => {
    if (err) {
      console.error('Kļūda saglabājot materials.json', err);
      return res.status(500).json({ error: 'Neizdevās saglabāt materials.json' });
    }

    res.json({ ok: true });
  });
});

// Fallback: ja kāds atver / vai citu ceļu, dodam index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Serveris klausās uz porta ${PORT}`);
});
