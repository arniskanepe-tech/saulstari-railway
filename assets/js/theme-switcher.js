/*! Saulstari v22 — Theme Switcher (persisted across pages) */
(function(){
  const THEMES = ["theme-mineral","theme-litholines","theme-paperlux","theme-glassrail", "theme-solidbar", "theme-slategold","theme-golden-sand"];
  const KEY = "saulstari_theme";

  function getParamTheme(){
    const p = new URLSearchParams(location.search);
    const t = p.get("theme");
    if (t && THEMES.includes(t)) return t;
    return null;
  }

  function getSavedTheme(){
    try { const t = localStorage.getItem(KEY); if (THEMES.includes(t)) return t; } catch(e){}
    return null;
  }

  function setTheme(t){
    const b = document.body;
    const prev = Array.from(b.classList).filter(c => c.startsWith("theme-"));
    prev.forEach(c => b.classList.remove(c));
    b.classList.add(t);
    try { localStorage.setItem(KEY, t); } catch(e){}
    document.querySelectorAll('[data-theme-select]').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-theme-select') === t);
    });
  }

  function ensureTheme(){
    const fromUrl = getParamTheme();
    const saved = getSavedTheme();
    const existing = (document.body.className.match(/theme-[\w-]+/) || [null])[0];
    const initial = fromUrl || saved || existing || "theme-mineral";
    setTheme(initial);
  }

  function injectUI(){
    const wrap = document.createElement('div');
    wrap.className = 'saulstari-theme-toggle';
    wrap.innerHTML = `
      <button class="tt-btn" data-theme-select="theme-mineral" title="Mineral">Mineral</button>
      <button class="tt-btn" data-theme-select="theme-litholines" title="LithoLines">Litho</button>
      <button class="tt-btn" data-theme-select="theme-paperlux" title="PaperLux">Paper</button>
      <button class="tt-btn" data-theme-select="theme-glassrail" title="GlassRail">Glass</button>
      <button class="tt-btn" data-theme-select="theme-solidbar" title="Solidbar">Solid</button>
      <button class="tt-btn" data-theme-select="theme-slategold" title="SlateGold">Slate</button>
      <button class="tt-btn" data-theme-select="theme-golden-sand" title="GoldenSand">Sand</button>
      <button class="tt-close" title="Paslēpt">×</button>
    `;
    document.body.appendChild(wrap);
    wrap.addEventListener('click', (e)=>{
      const t = e.target.getAttribute('data-theme-select');
      if (t && THEMES.includes(t)) setTheme(t);
      if (e.target.classList.contains('tt-close')) wrap.remove();
    });
  }

  function onReady(fn){
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  onReady(function(){
    ensureTheme();
    injectUI();
  });
})();
