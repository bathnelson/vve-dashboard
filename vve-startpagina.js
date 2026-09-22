// VvE-startpagina — tegels op thema, zelf te herschikken met slepen.
// De inhoud komt uit startpagina_config.js (lokaal, naast de HTML); dit bestand
// bevat alleen de logica en staat op GitHub Pages.
(function () {
  'use strict';

  var OPSLAG = 'vve-startpagina-indeling-v1';
  var app = document.getElementById('startpagina');
  if (!app) return;

  // ── favicon (zelfde als het dashboard) ──────────────────────────────────
  (function () {
    try {
      if (document.querySelector('link[rel~="icon"]')) return;
      var l = document.createElement('link');
      l.rel = 'icon'; l.type = 'image/svg+xml';
      l.href = 'data:image/svg+xml,' + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='6' fill='#c8102e'/><path d='M15.35 2.2h1.3v1.9h1.9v1.3h-1.9v3.1h-1.3V5.4h-1.9V4.1h1.9z' fill='#fff'/><path d='M11.5 25V11.5L16 9.5l4.5 2V25z' fill='#fff'/><g fill='#c8102e'><rect x='13' y='13.5' width='2.2' height='2.2'/><rect x='16.8' y='13.5' width='2.2' height='2.2'/><rect x='13' y='17.5' width='2.2' height='2.2'/><rect x='16.8' y='17.5' width='2.2' height='2.2'/><rect x='13' y='21.5' width='2.2' height='2.2'/><rect x='16.8' y='21.5' width='2.2' height='2.2'/></g><rect x='8' y='25' width='16' height='2.4' rx='1.2' fill='#f2b705'/><rect x='14.8' y='27.4' width='2.4' height='2.6' fill='#f2b705'/><path d='M6.30,9.40L5.65,10.87L4.05,10.70L5.00,12.00L4.05,13.30L5.65,13.13L6.30,14.60L6.95,13.13L8.55,13.30L7.60,12.00L8.55,10.70L6.95,10.87Z M6.30,17.40L5.65,18.87L4.05,18.70L5.00,20.00L4.05,21.30L5.65,21.13L6.30,22.60L6.95,21.13L8.55,21.30L7.60,20.00L8.55,18.70L6.95,18.87Z M25.70,9.40L25.05,10.87L23.45,10.70L24.40,12.00L23.45,13.30L25.05,13.13L25.70,14.60L26.35,13.13L27.95,13.30L27.00,12.00L27.95,10.70L26.35,10.87Z M25.70,17.40L25.05,18.87L23.45,18.70L24.40,20.00L23.45,21.30L25.05,21.13L25.70,22.60L26.35,21.13L27.95,21.30L27.00,20.00L27.95,18.70L26.35,18.87Z' fill='#fff'/></svg>");
      document.head.appendChild(l);
    } catch (e) {}
  })();

  if (typeof STARTPAGINA === 'undefined' || !STARTPAGINA || !Array.isArray(STARTPAGINA.groepen)) {
    app.innerHTML = '<div class="sp-melding"><strong>Geen tegels gevonden</strong>'
      + 'Zet <code>startpagina_config.js</code> in dezelfde map als deze pagina en ververs.</div>';
    return;
  }

  // ── iconen ──────────────────────────────────────────────────────────────
  var P = {
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 6 8.5-6"/>',
    agenda: '<rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
    chat: '<path d="M20 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z"/>',
    map: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    word: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="m8 8 1.6 8L12 10l2.4 6L16 8"/>',
    excel: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="m9 8 6 8M15 8l-6 8"/>',
    formulier: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/>',
    zoek: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    tabel: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16"/>',
    kaart: '<path d="m9 4-6 2v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
    reken: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01"/>',
    grafiek: '<path d="M4 20V4M4 20h16"/><path d="m7 15 4-4 3 3 5-6"/>',
    euro: '<path d="M17 6.5A7 7 0 1 0 17 17.5"/><path d="M4.5 10.5h9M4.5 13.5h9"/>',
    portaal: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    hulp: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.7M12 17h.01"/>',
    leren: '<path d="m2 9 10-5 10 5-10 5z"/><path d="M6 11v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5"/>',
    boek: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/>',
    video: '<rect x="3" y="5" width="13" height="14" rx="2"/><path d="m16 10 5-3v10l-5-3z"/>',
    web: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    greep: '<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>',
    potlood: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
    kruis: '<path d="M6 6l12 12M18 6 6 18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    persoon: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    terug: '<path d="M9 7 4 12l5 5"/><path d="M4 12h11a5 5 0 0 1 0 10h-2"/>',
    weergave: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><path d="M3 15h18M3 20h18"/>'
  };
  var KLEUR = {
    dashboard: 'rood', mail: 'blauw', agenda: 'blauw', chat: 'paars', map: 'goud', word: 'blauw', excel: 'groen',
    formulier: 'teal', zoek: 'teal', tabel: 'groen', kaart: 'teal', reken: 'oranje', grafiek: 'oranje',
    euro: 'groen', portaal: 'rood', hulp: 'oranje', leren: 'paars', boek: 'grijs', video: 'paars', web: 'grijs'
  };
  function svg(naam) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[naam] || P.web) + '</svg>';
  }
  function raadIcoon(url) {
    var u = (url || '').toLowerCase();
    if (/vve_dashboard/.test(u)) return 'dashboard';
    if (/:w:\/|\.docx?(\b|&|$)/.test(u)) return 'word';
    if (/:x:\/|\.xlsx?(\b|&|$)/.test(u)) return 'excel';
    if (/outlook.*\/mail|^mailto:/.test(u)) return 'mail';
    if (/calendar|agenda/.test(u)) return 'agenda';
    if (/forms\.(cloud|office)/.test(u)) return 'formulier';
    if (/sharepoint\.com.*(forms\/|[?&]id=)/.test(u)) return 'map';
    if (/kaart|\/map\//.test(u)) return 'kaart';
    if (/subsid|lening|warmtefonds/.test(u)) return 'euro';
    return 'web';
  }
  var SOORT = { word: 'Word-document', excel: 'Excel-bestand', map: 'Map op SharePoint', formulier: 'Formulier', mail: 'Outlook', agenda: 'Agenda' };
  function sub(t) {
    if (t.sub) return t.sub;
    var soort = SOORT[t.icoon || raadIcoon(t.url)];
    if (soort) return soort;
    try {
      var u = new URL(t.url, location.href);
      if (u.protocol === 'file:' || u.origin === location.origin) return 'Lokaal bestand';
      return u.hostname.replace(/^www\./, '');
    } catch (e) { return ''; }
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ── indeling: config, eventueel overschreven door lokale aanpassingen ───
  function kopie(o) { return JSON.parse(JSON.stringify(o)); }
  function vingerafdruk(groepen) {
    var s = JSON.stringify(groepen), h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return String(h);
  }
  var bron = vingerafdruk(STARTPAGINA.groepen);
  var groepen = kopie(STARTPAGINA.groepen);
  var eigenIndeling = false, configNieuwer = false;
  try {
    var bewaard = JSON.parse(localStorage.getItem(OPSLAG) || 'null');
    if (bewaard && Array.isArray(bewaard.groepen)) {
      groepen = bewaard.groepen; eigenIndeling = true;
      configNieuwer = bewaard.bron !== bron;
    }
  } catch (e) {}
  function bewaar() {
    eigenIndeling = true;
    try { localStorage.setItem(OPSLAG, JSON.stringify({ bron: bron, groepen: groepen })); } catch (e) {}
  }
  function herstel() {
    try { localStorage.removeItem(OPSLAG); } catch (e) {}
    groepen = kopie(STARTPAGINA.groepen); eigenIndeling = false; configNieuwer = false;
    teken();
  }

  var bewerken = false, zoekterm = '';

  // ── kop ─────────────────────────────────────────────────────────────────
  function groet() {
    var u = new Date().getHours();
    var dagdeel = u < 6 ? 'Goedenacht' : u < 12 ? 'Goedemorgen' : u < 18 ? 'Goedemiddag' : 'Goedenavond';
    var naam = '';
    try { naam = (localStorage.getItem('vve_dashboard_username') || '').trim(); } catch (e) {}
    if (naam) naam = naam.charAt(0).toUpperCase() + naam.slice(1);
    return dagdeel + (naam ? ', ' + naam : '');
  }
  function datum() {
    try {
      return new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) { return ''; }
  }

  // ── tekenen ─────────────────────────────────────────────────────────────
  function past(t) {
    if (!zoekterm) return true;
    var z = zoekterm.toLowerCase();
    return (t.titel + ' ' + sub(t) + ' ' + (SOORT[t.icoon || raadIcoon(t.url)] || '') + ' ' + t.url).toLowerCase().indexOf(z) !== -1;
  }
  function tegelHtml(t, gi, ti) {
    var icoon = t.icoon || raadIcoon(t.url);
    var kleur = KLEUR[icoon] || 'grijs';
    var doel = STARTPAGINA.nieuwTabblad === false ? '' : ' target="_blank" rel="noopener"';
    return '<a class="sp-tegel" href="' + esc(t.url) + '"' + doel
      + ' data-g="' + gi + '" data-t="' + ti + '"' + (bewerken ? ' draggable="true"' : '')
      + ' title="' + esc(t.titel + '\n' + t.url) + '" style="--kleur:var(--i-' + kleur + ')">'
      + '<span class="sp-icoon">' + svg(icoon) + '</span>'
      + '<span class="sp-tekst"><span class="sp-naam">' + esc(t.titel) + '</span>'
      + '<span class="sp-sub">' + esc(sub(t)) + '</span></span>'
      + '<span class="sp-tegel-knoppen">'
      + '<button class="sp-mini" data-actie="tegel-wijzig" title="Wijzigen">' + svg('potlood') + '</button>'
      + '<button class="sp-mini" data-actie="tegel-weg" title="Verwijderen">' + svg('kruis') + '</button>'
      + '</span></a>';
  }
  var WEERGAVEN = ['tegels', 'compact', 'lijst'];
  var WEERGAVE_NAAM = { tegels: 'Tegels', compact: 'Compact', lijst: 'Lijst' };
  function weergave(g, gi) { return WEERGAVEN.indexOf(g.weergave) >= 0 ? g.weergave : (gi === 0 ? 'tegels' : 'compact'); }
  function initialen() {
    var naam = '';
    try { naam = (localStorage.getItem('vve_dashboard_username') || '').trim(); } catch (e) {}
    return naam ? naam.charAt(0).toUpperCase() : '';
  }
  function logoTekst() {
    if (STARTPAGINA.afkorting) return STARTPAGINA.afkorting;
    var w = (STARTPAGINA.titel || 'Start').split(/\s+/).filter(function (x) { return !/^start$/i.test(x); });
    return (w[0] || 'S').slice(0, 3);
  }
  function teken() {
    var titel = STARTPAGINA.titel || 'Start';
    var ini = initialen();
    var html = '<div class="sp' + (bewerken ? ' is-bewerken' : '') + '" style="--thema:' + esc(STARTPAGINA.themaKleur || '#0078d4') + '">'
      // bovenbalk
      + '<div class="sp-suite"><a class="sp-waffle" href="https://www.microsoft365.com/" title="Apps" aria-label="Apps">'
      + '<svg viewBox="0 0 16 16" aria-hidden="true">' + [2, 7, 12].map(function (y) { return [2, 7, 12].map(function (x) { return '<rect x="' + x + '" y="' + y + '" width="2.2" height="2.2"/>'; }).join(''); }).join('') + '</svg></a>'
      + '<span class="sp-suite-naam">' + esc(titel) + '</span>'
      + '<div class="sp-suite-zoek"><input class="sp-zoek" type="search" placeholder="Zoeken op deze site" aria-label="Zoeken op deze site" value="' + esc(zoekterm) + '"></div>'
      + '<span class="sp-avatar" title="' + esc(groet()) + '">' + (ini ? esc(ini) : svg('persoon')) + '</span></div>'
      // sitekop
      + '<header class="sp-site"><div class="sp-in sp-site-in"><span class="sp-logo">' + esc(logoTekst()) + '</span>'
      + '<div class="sp-site-tekst"><h1 class="sp-sitetitel">' + esc(titel) + '</h1><nav class="sp-nav" aria-label="Site">'
      + '<a href="#" class="is-actief">Start</a>'
      + groepen.map(function (g, gi) { return '<a href="#g' + gi + '">' + esc(g.naam) + '</a>'; }).join('')
      + '</nav></div></div></header>'
      // opdrachtbalk
      + '<div class="sp-cmd"><div class="sp-in sp-cmd-in">';
    if (bewerken) {
      html += '<button class="sp-cmd-knop is-primair" data-actie="bewerken">Opslaan en sluiten</button>'
        + '<button class="sp-cmd-knop" data-actie="groep-nieuw">' + svg('plus') + 'Sectie</button>'
        + '<button class="sp-cmd-knop" data-actie="download">' + svg('download') + 'Config downloaden</button>'
        + (eigenIndeling ? '<button class="sp-cmd-knop" data-actie="herstel">' + svg('terug') + 'Terug naar config</button>' : '')
        + '<span class="sp-cmd-hint">Sleep tegels of secties (aan het greepje) naar een andere plek. Wordt in deze browser bewaard.</span>';
    } else {
      html += '<span class="sp-cmd-tekst">' + esc(groet()) + ' · ' + esc(datum()) + '</span>'
        + '<button class="sp-cmd-knop" data-actie="bewerken">' + svg('potlood') + 'Bewerken</button>';
    }
    html += '</div></div>';

    if (!bewerken && configNieuwer) {
      html += '<div class="sp-in"><div class="sp-balk"><span>De config is gewijzigd sinds je de indeling hier aanpaste. Je ziet nog je eigen indeling.</span>'
        + '<button class="sp-cmd-knop" data-actie="herstel">Nieuwe config gebruiken</button></div></div>';
    }

    html += '<main class="sp-in sp-groepen">';
    var zichtbaar = 0;
    groepen.forEach(function (g, gi) {
      var tegels = (g.tegels || []).map(function (t, ti) { return { t: t, ti: ti }; }).filter(function (x) { return past(x.t); });
      if (zoekterm && !tegels.length) return;
      zichtbaar += tegels.length;
      var w = weergave(g, gi);
      html += '<section class="sp-groep w-' + w + '" id="g' + gi + '" data-g="' + gi + '">'
        + '<div class="sp-groep-kop"><span class="sp-greep" draggable="true" data-g="' + gi + '" title="Sleep om de sectie te verplaatsen">' + svg('greep') + '</span>'
        + '<h2>' + esc(g.naam) + '</h2>'
        + '<span class="sp-groep-knoppen">'
        + '<button class="sp-cmd-knop klein" data-actie="groep-weergave" data-g="' + gi + '" title="Weergave wisselen">' + svg('weergave') + WEERGAVE_NAAM[w] + '</button>'
        + '<button class="sp-mini" data-actie="groep-wijzig" data-g="' + gi + '" title="Naam wijzigen">' + svg('potlood') + '</button>'
        + '<button class="sp-mini" data-actie="groep-weg" data-g="' + gi + '" title="Sectie verwijderen">' + svg('kruis') + '</button>'
        + '</span></div>'
        + '<div class="sp-tegels" data-g="' + gi + '">'
        + tegels.map(function (x) { return tegelHtml(x.t, gi, x.ti); }).join('')
        + '<button class="sp-toevoegen" data-actie="tegel-nieuw" data-g="' + gi + '">' + svg('plus') + ' Koppeling</button>'
        + '</div></section>';
    });
    if (zoekterm && !zichtbaar) html += '<p class="sp-leeg">Geen resultaten voor “' + esc(zoekterm) + '” op deze site.</p>';
    html += '</main><footer class="sp-in sp-voet"><span><kbd>/</kbd> zoeken</span><span><kbd>Enter</kbd> eerste resultaat openen</span>'
      + '<span><kbd>Esc</kbd> zoekveld leegmaken</span></footer></div>';
    app.innerHTML = html;
  }

  // ── acties ──────────────────────────────────────────────────────────────
  function vraagTegel(t) {
    var titel = prompt('Titel van de tegel:', t ? t.titel : '');
    if (titel === null || !titel.trim()) return null;
    var url = prompt('Link (adres):', t ? t.url : 'https://');
    if (url === null || !url.trim()) return null;
    var onder = prompt('Tweede regel (mag leeg):', t ? (t.sub || '') : '');
    var n = { titel: titel.trim(), url: url.trim() };
    if (onder && onder.trim()) n.sub = onder.trim();
    if (t && t.icoon) n.icoon = t.icoon;
    return n;
  }
  function download() {
    var cfg = {}; Object.keys(STARTPAGINA).forEach(function (k) { if (k !== 'groepen') cfg[k] = STARTPAGINA[k]; }); cfg.groepen = groepen;
    var tekst = '// startpagina_config.js - de tegels van de VvE-startpagina\n'
      + '// Gedownload vanaf de startpagina op ' + new Date().toLocaleString('nl-NL') + '.\n'
      + '// Vervang het bestand naast vve_startpagina.html hiermee. Niet naar GitHub zetten.\n\n'
      + 'const STARTPAGINA = ' + JSON.stringify(cfg, null, 2) + ';\n';
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([tekst], { type: 'text/javascript;charset=utf-8' }));
    a.download = 'startpagina_config.js';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  app.addEventListener('click', function (e) {
    var k = e.target.closest('[data-actie]');
    var nav = e.target.closest('.sp-nav a');
    if (nav) {
      e.preventDefault();
      var doelId = nav.getAttribute('href').slice(1);
      var doelEl = doelId && document.getElementById(doelId);
      if (doelEl) doelEl.scrollIntoView({ behavior: 'smooth', block: 'start' }); else window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (!k) { if (bewerken && e.target.closest('.sp-tegel')) e.preventDefault(); return; }
    var actie = k.getAttribute('data-actie');
    var tegel = k.closest('.sp-tegel');
    var gi = +(k.getAttribute('data-g') || (tegel && tegel.getAttribute('data-g')) || 0);
    var ti = tegel ? +tegel.getAttribute('data-t') : -1;
    e.preventDefault();
    if (actie === 'bewerken') { bewerken = !bewerken; teken(); return; }
    if (actie === 'download') { download(); return; }
    if (actie === 'herstel') {
      if (!bewerken || confirm('Je eigen indeling in deze browser vervangen door die uit de config?')) herstel();
      return;
    }
    if (actie === 'groep-nieuw') {
      var naam = prompt('Naam van de nieuwe groep:');
      if (naam && naam.trim()) { groepen.push({ naam: naam.trim(), tegels: [] }); bewaar(); teken(); }
    } else if (actie === 'groep-weergave') {
      var huidig = weergave(groepen[gi], gi);
      groepen[gi].weergave = WEERGAVEN[(WEERGAVEN.indexOf(huidig) + 1) % WEERGAVEN.length];
      bewaar(); teken();
    } else if (actie === 'groep-wijzig') {
      var nieuw = prompt('Naam van de groep:', groepen[gi].naam);
      if (nieuw && nieuw.trim()) { groepen[gi].naam = nieuw.trim(); bewaar(); teken(); }
    } else if (actie === 'groep-weg') {
      var n = groepen[gi].tegels.length;
      if (confirm('Groep "' + groepen[gi].naam + '"' + (n ? ' met ' + n + ' tegel' + (n === 1 ? '' : 's') : '') + ' verwijderen?')) {
        groepen.splice(gi, 1); bewaar(); teken();
      }
    } else if (actie === 'tegel-nieuw') {
      var t = vraagTegel(null);
      if (t) { groepen[gi].tegels.push(t); bewaar(); teken(); }
    } else if (actie === 'tegel-wijzig') {
      var w = vraagTegel(groepen[gi].tegels[ti]);
      if (w) { groepen[gi].tegels[ti] = w; bewaar(); teken(); }
    } else if (actie === 'tegel-weg') {
      if (confirm('Tegel "' + groepen[gi].tegels[ti].titel + '" verwijderen?')) { groepen[gi].tegels.splice(ti, 1); bewaar(); teken(); }
    }
  });

  // zoeken
  app.addEventListener('input', function (e) {
    if (!e.target.classList.contains('sp-zoek')) return;
    zoekterm = e.target.value.trim();
    var pos = e.target.selectionStart;
    teken();
    var z = app.querySelector('.sp-zoek'); z.focus(); try { z.setSelectionRange(pos, pos); } catch (x) {}
  });
  app.addEventListener('keydown', function (e) {
    if (!e.target.classList.contains('sp-zoek')) return;
    if (e.key === 'Enter') {
      var eerste = app.querySelector('.sp-tegel');
      if (eerste) { e.preventDefault(); eerste.click(); }
    } else if (e.key === 'Escape') {
      zoekterm = ''; teken(); app.querySelector('.sp-zoek').focus();
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === '/' && !/input|textarea/i.test(document.activeElement.tagName)) {
      e.preventDefault(); app.querySelector('.sp-zoek').focus();
    }
  });

  // ── slepen ──────────────────────────────────────────────────────────────
  var sleep = null;   // { soort: 'tegel', g, t } of { soort: 'groep', g }
  function wisMarkering() {
    app.querySelectorAll('.voor,.na,.doel,.is-sleep').forEach(function (el) { el.classList.remove('voor', 'na', 'doel', 'is-sleep'); });
  }
  app.addEventListener('dragstart', function (e) {
    if (!bewerken) return;
    var greep = e.target.closest && e.target.closest('.sp-greep');
    var tegel = e.target.closest && e.target.closest('.sp-tegel');
    if (greep) {
      sleep = { soort: 'groep', g: +greep.getAttribute('data-g') };
      greep.closest('.sp-groep').classList.add('is-sleep');
    } else if (tegel) {
      sleep = { soort: 'tegel', g: +tegel.getAttribute('data-g'), t: +tegel.getAttribute('data-t') };
      tegel.classList.add('is-sleep');
    } else return;
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', ''); } catch (x) {}
  });
  function doelVan(e) {
    if (!sleep) return null;
    if (sleep.soort === 'groep') {
      var gr = e.target.closest('.sp-groep');
      if (!gr) return null;
      var r = gr.getBoundingClientRect();
      return { el: gr, g: +gr.getAttribute('data-g'), na: e.clientY > r.top + r.height / 2 };
    }
    var tegel = e.target.closest('.sp-tegel');
    if (tegel) {
      var rt = tegel.getBoundingClientRect();
      return { el: tegel, g: +tegel.getAttribute('data-g'), t: +tegel.getAttribute('data-t'), na: e.clientX > rt.left + rt.width / 2 };
    }
    var rij = e.target.closest('.sp-tegels');
    if (rij) return { el: rij, g: +rij.getAttribute('data-g'), t: null };
    return null;
  }
  app.addEventListener('dragover', function (e) {
    var d = doelVan(e);
    if (!d) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    app.querySelectorAll('.voor,.na,.doel').forEach(function (el) { el.classList.remove('voor', 'na', 'doel'); });
    if (d.t === null) d.el.classList.add('doel');
    else d.el.classList.add(d.na ? 'na' : 'voor');
  });
  app.addEventListener('drop', function (e) {
    var d = doelVan(e);
    if (!d) return;
    e.preventDefault();
    if (sleep.soort === 'groep') {
      var groep = groepen.splice(sleep.g, 1)[0];
      var gi = d.g + (d.na ? 1 : 0);
      if (sleep.g < gi) gi--;
      groepen.splice(gi, 0, groep);
    } else {
      var tegel = groepen[sleep.g].tegels.splice(sleep.t, 1)[0];
      var lijst = groepen[d.g].tegels;
      var ti = d.t === null ? lijst.length : d.t + (d.na ? 1 : 0);
      if (sleep.g === d.g && d.t !== null && sleep.t < ti) ti--;
      lijst.splice(ti, 0, tegel);
    }
    sleep = null; bewaar(); teken();
  });
  app.addEventListener('dragend', function () { sleep = null; wisMarkering(); });

  teken();
})();
