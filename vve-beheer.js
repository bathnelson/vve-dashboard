// VvE-beheer — clusters en handmatig toegevoegde VvE's bijhouden.
// Aparte tool, los van het dashboard: hier wordt data gemaakt, daar gebruikt.
// Leest data/vve_data.inc, data/mapnamen.inc, config/vve_handmatig.inc en config/clusters.inc;
// schrijft die laatste twee als download terug.
(function () {
  'use strict';

  var VERSIE = 10;
  var app = document.getElementById('beheer');
  if (!app) return;

  // Eigen icoon: bruin vlak met een moersleutel, zodat je de beheertool in je
  // tabbladen onderscheidt van het dashboard (groen) en de startpagina (rood).
  (function zetFavicon() {
    try {
      if (document.querySelector('link[rel~="icon"]')) return;
      var svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'>"
        + "<rect width='32' height='32' rx='6' fill='#8a3b12'/>"
        + "<path d='M21.6 7.2a5.6 5.6 0 0 0-6.9 6.9L7.4 21.4a2 2 0 0 0 0 2.8l.4.4a2 2 0 0 0 2.8 0l7.3-7.3a5.6 5.6 0 0 0 6.9-6.9l-3 3-2.5-.6-.6-2.5z' fill='#fff'/>"
        + "<circle cx='9.3' cy='22.7' r='1.1' fill='#8a3b12'/></svg>";
      var l = document.createElement('link');
      l.rel = 'icon'; l.type = 'image/svg+xml';
      l.href = 'data:image/svg+xml,' + encodeURIComponent(svg);
      document.head.appendChild(l);
    } catch (e) {}
  })();

  var OPSLAG = 'vve-beheer-werk-v1';
  var OPSLAG_PANDEN = 'vve-beheer-panden-v1';
  var OPSLAG_BRON = 'vve-beheer-bron-v1';
  var OPSLAG_WOZ = 'vve-beheer-woz-v1';
  var OPSLAG_EP = 'vve-beheer-ep-v1';

  // ── data inlezen ────────────────────────────────────────────────────────
  var RIJEN = (typeof VVE_DATA !== 'undefined' && Array.isArray(VVE_DATA)) ? VVE_DATA : [];
  var MAPNAMEN = (typeof VVE_MAPNAMEN !== 'undefined') ? VVE_MAPNAMEN : {};
  var kort = id => String(id || '').replace(/^NL\.IMKAD\.Persoon\./, '');

  // Eén regel per VvE, opgebouwd uit de adresrijen.
  var VVES = (function () {
    var per = {};
    RIJEN.forEach(function (r) {
      var id = kort(r.vve_identificatie);
      if (!id) return;
      if (!per[id]) {
        per[id] = {
          id: id,
          naam: r.statutairenaam || '',
          straat: r.straatnaam || '',
          buurt: r.buurt || '',
          woningen: r.aantal_woon_adr_in_vve || 0,
          adressen: 0,
          mapnaam: MAPNAMEN[r.vve_identificatie] || MAPNAMEN[id] || ''
        };
      }
      per[id].adressen++;
    });
    return per;
  })();
  var vveLijst = Object.keys(VVES).map(function (k) { return VVES[k]; });

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function vveNaam(id) {
    var v = VVES[kort(id)];
    if (v) return v.naam || v.mapnaam || id;
    var h = handmatig.find(function (x) { return x.id === id; });
    return h ? h.naam : id;
  }

  // ── werkkopie: uit de bestanden, of uit wat nog niet opgeslagen is ──────
  function kopie(x) { return JSON.parse(JSON.stringify(x)); }
  var clusters = (typeof VVE_CLUSTERS !== 'undefined' && Array.isArray(VVE_CLUSTERS)) ? kopie(VVE_CLUSTERS) : [];
  var handmatig = (typeof VVE_HANDMATIG !== 'undefined' && Array.isArray(VVE_HANDMATIG)) ? kopie(VVE_HANDMATIG) : [];
  var vuil = false;   // zijn er wijzigingen die nog niet gedownload zijn?

  try {
    var bewaard = JSON.parse(localStorage.getItem(OPSLAG) || 'null');
    if (bewaard && bewaard.vuil) {
      clusters = bewaard.clusters || clusters;
      handmatig = bewaard.handmatig || handmatig;
      vuil = true;
    }
  } catch (e) {}

  function bewaarWerk() {
    vuil = true;
    try { localStorage.setItem(OPSLAG, JSON.stringify({ vuil: true, clusters: clusters, handmatig: handmatig })); } catch (e) {}
    teken();
  }
  function werkOpgeslagen() {
    vuil = false;
    try { localStorage.removeItem(OPSLAG); } catch (e) {}
    teken();
  }

  // ── bestanden maken ─────────────────────────────────────────────────────
  function download(naam, tekst) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([tekst], { type: 'text/plain;charset=utf-8' }));
    a.download = naam;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }
  function kopTekst(bestand, uitleg) {
    return '// ' + bestand + ' - ' + uitleg + '\n'
      + '// Gemaakt met de beheertool op ' + new Date().toLocaleString('nl-NL') + '.\n'
      + '// Zet dit bestand in de map config/ naast vve_dashboard.html. Niet naar GitHub.\n\n';
  }
  function bewaarClusters() {
    download('clusters.inc', kopTekst('config/clusters.inc', 'clusters van VvE’s die samen een proces ingaan')
      + 'const VVE_CLUSTERS = ' + JSON.stringify(clusters, null, 2) + ';\n');
    werkOpgeslagen();
  }
  function bewaarHandmatig() {
    download('vve_handmatig.inc', kopTekst('config/vve_handmatig.inc', 'VvE’s die nog niet in de centrale dataset zitten')
      + 'const VVE_HANDMATIG = ' + JSON.stringify(handmatig, null, 2) + ';\n');
    werkOpgeslagen();
  }

  // ── panddata uit de 3D BAG (grondvlak, hoogte, bouwlagen) ──────────────
  // api.3dbag.nl staat browsertoegang toe, dus we halen het rechtstreeks op.
  var BAG_URL = 'https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.';
  var panden = (typeof PAND_HOOGTE_DATA !== 'undefined') ? kopie(PAND_HOOGTE_DATA) : {};
  var pandenGewijzigd = false;
  try {
    var extra = JSON.parse(localStorage.getItem(OPSLAG_PANDEN) || 'null');
    if (extra && extra.panden) {
      Object.keys(extra.panden).forEach(function (k) { panden[k] = extra.panden[k]; });
      pandenGewijzigd = true;
    }
  } catch (e) {}

  var allePandIds = (function () {
    var set = new Set();
    RIJEN.forEach(function (r) {
      String(r.gerelateerd_pand_id || '').split(/[^0-9]+/).forEach(function (x) {
        if (x.length === 16) set.add(x);
      });
    });
    return [...set];
  })();

  var ophalenBezig = false, ophalenStop = false, ophalenGedaan = 0, ophalenTotaal = 0, ophalenFout = 0;

  function bewaarPanden() {
    try { localStorage.setItem(OPSLAG_PANDEN, JSON.stringify({ panden: panden })); } catch (e) {}
    pandenGewijzigd = true;
  }

  async function haalPandOp(id) {
    var r = await fetch(BAG_URL + id);
    if (!r.ok) throw new Error('status ' + r.status);
    var d = await r.json();
    var co = d && d.feature && d.feature.CityObjects;
    var sleutel = co && Object.keys(co)[0];
    var a = (sleutel && co[sleutel].attributes) || {};
    return {
      bouwlagen: a.b3_bouwlagen != null ? a.b3_bouwlagen : null,
      dak: a.b3_dak_type || null,
      h: (a.b3_h_nok != null && a.b3_h_maaiveld != null) ? Math.round((a.b3_h_nok - a.b3_h_maaiveld) * 100) / 100 : null,
      opp: (a.b3_opp_dak_plat != null || a.b3_opp_dak_schuin != null)
        ? Math.round(((a.b3_opp_dak_plat || 0) + (a.b3_opp_dak_schuin || 0)) * 100) / 100 : null,
      grond: a.b3_opp_grond != null ? Math.round(a.b3_opp_grond * 100) / 100 : null
    };
  }

  async function haalPandenOp(alleenOntbrekende) {
    var teDoen = allePandIds.filter(function (id) {
      return alleenOntbrekende ? (!panden[id] || panden[id].grond == null) : true;
    });
    if (!teDoen.length) { alert('Alle panden zijn al opgehaald.'); return; }
    ophalenBezig = true; ophalenStop = false; ophalenGedaan = 0; ophalenFout = 0; ophalenTotaal = teDoen.length;
    teken();
    var i = 0;
    async function werker() {
      while (i < teDoen.length && !ophalenStop) {
        var id = teDoen[i++];
        try { panden[id] = await haalPandOp(id); } catch (e) { ophalenFout++; }
        ophalenGedaan++;
        if (ophalenGedaan % 25 === 0) { bewaarPanden(); teken(); }
      }
    }
    await Promise.all(Array.from({ length: 6 }, werker));
    bewaarPanden();
    ophalenBezig = false;
    teken();
  }

  function pandenMetGrond() {
    return Object.keys(panden).filter(function (k) { return panden[k] && panden[k].grond != null; }).length;
  }

  function bewaarPandBestand() {
    var tekst = '// data/pand_hoogte.inc - gebouwgegevens uit de 3D BAG (api.3dbag.nl)\n'
      + '// grond = grondvlak in m2 (b3_opp_grond, de footprint), h = nok minus maaiveld,\n'
      + '// opp = dakoppervlak, dak = daktype, bouwlagen = aantal lagen.\n'
      + '// Opgehaald met de beheertool op ' + new Date().toLocaleString('nl-NL') + ': '
      + Object.keys(panden).length + ' panden, ' + pandenMetGrond() + ' met grondvlak.\n\n'
      + 'const PAND_HOOGTE_DATA = ' + JSON.stringify(panden) + ';\n';
    download('pand_hoogte.inc', tekst);
    try { localStorage.removeItem(OPSLAG_PANDEN); } catch (e) {}
    pandenGewijzigd = false;
    teken();
  }

  function tekenPanden() {
    var klaar = pandenMetGrond();
    var rest = allePandIds.filter(function (id) { return !panden[id] || panden[id].grond == null; }).length;
    var uit = '<div class="bh-paneel"><div class="bh-paneel-kop"><h2>Panddata uit de 3D BAG</h2></div>'
      + '<p class="bh-hint" style="margin-top:0">Het grondvlak van een pand is de footprint die het dashboard bij de '
      + 'statistieken gebruikt. Hoogte, dakoppervlak en bouwlagen komen in dezelfde ronde mee. Ophalen gaat rechtstreeks '
      + 'bij api.3dbag.nl, zes panden tegelijk; je kunt tussendoor stoppen en later verder.</p>'
      + '<div class="bh-velden" style="grid-template-columns:repeat(3,minmax(0,1fr))">'
      + '<div><div class="bh-kaart-meta">Panden in de data</div><strong>' + allePandIds.length.toLocaleString('nl-NL') + '</strong></div>'
      + '<div><div class="bh-kaart-meta">Met grondvlak</div><strong>' + klaar.toLocaleString('nl-NL') + '</strong></div>'
      + '<div><div class="bh-kaart-meta">Nog op te halen</div><strong>' + rest.toLocaleString('nl-NL') + '</strong></div>'
      + '</div>';
    if (ophalenBezig) {
      var pct = ophalenTotaal ? Math.round(ophalenGedaan / ophalenTotaal * 100) : 0;
      uit += '<h3>Bezig: ' + ophalenGedaan.toLocaleString('nl-NL') + ' van ' + ophalenTotaal.toLocaleString('nl-NL')
        + ' (' + pct + '%)' + (ophalenFout ? ' · ' + ophalenFout + ' mislukt' : '') + '</h3>'
        + '<div class="bh-voortgang"><div class="bh-voortgang-vul" style="width:' + pct + '%"></div></div>'
        + '<div class="bh-form-knoppen"><button class="bh-knop" data-actie="pand-stop">Stoppen</button></div>';
    } else {
      uit += '<div class="bh-form-knoppen" style="margin-top:14px">'
        + '<button class="bh-knop is-primair" data-actie="pand-ophalen">'
        + (rest ? 'Ontbrekende panden ophalen (' + rest.toLocaleString('nl-NL') + ')' : 'Alles is opgehaald') + '</button>'
        + '<button class="bh-knop" data-actie="pand-opnieuw">Alles opnieuw ophalen</button>'
        + (pandenGewijzigd ? '<button class="bh-knop is-primair" data-actie="pand-bewaar">pand_hoogte.inc downloaden</button>' : '')
        + '</div>';
      if (ophalenFout) uit += '<p class="bh-hint">' + ophalenFout + ' panden gaven een fout; die staan nog bij \u201cnog op te halen\u201d.</p>';
    }
    uit += '<p class="bh-hint">Na het downloaden zet je pand_hoogte.inc in de map data/ naast het dashboard. Zolang dat niet gebeurd is, '
      + 'blijft het opgehaalde in deze browser staan.</p></div>';
    return uit;
  }

  // ── brondata van de gemeente (WFS) ─────────────────────────────────────
  // De laag gemeentehaarlem:bag_adres_RD bevat per adres het energielabel, de
  // monumentale status, het warmteprogramma met tijdvak, oppervlakte, bouwjaar
  // en het nummeraanduiding-ID (nodig om later de WOZ op te halen).
  var WFS = 'https://data.haarlem.nl/geoserver/wfs?service=WFS&version=2.0.0&request=GetFeature'
    + '&typeName=gemeentehaarlem:bag_adres_RD&outputFormat=application/json'
    + '&propertyName=bag_id,nummeraanduiding_id,energielabel,monumentale_status,binnen_beschermd_gezicht,'
    + 'warmteprogramma,warmteprogramma_tijdvak,oppervlakte,bouwjaar_gerelateerd_pand,thema_brk,gebruiksdoel';
  var WFS_PAGINA = 2000;   // kleinere pagina's; de server weigert grote reeksen sneller
  var WFS_PAUZE = 1500;    // ms tussen twee pagina's
  var WFS_POGINGEN = 6;

  var bron = (typeof BRON_HAARLEM !== 'undefined') ? kopie(BRON_HAARLEM) : {};
  var bronGewijzigd = false;
  var bronOpgehaald = null;
  try {
    var bewaardeBron = JSON.parse(localStorage.getItem(OPSLAG_BRON) || 'null');
    if (bewaardeBron && bewaardeBron.bron) {
      bron = bewaardeBron.bron;
      bronOpgehaald = bewaardeBron.opgehaald || null;
      bronGewijzigd = true;
    }
  } catch (e) {}

  var bronBezig = false, bronStop = false, bronGedaan = 0, bronTotaal = 0, bronMelding = '';

  // Alleen de adressen die in onze dataset zitten; de laag bevat heel Haarlem.
  var RIJ_OP_VBO = (function () {
    var t = {};
    RIJEN.forEach(function (r) { if (r.verblijfsobject_id) t[String(r.verblijfsobject_id)] = r; });
    return t;
  })();
  var onzeAdressen = new Set(Object.keys(RIJ_OP_VBO));

  function leeg(v) { return v == null || v === '' || v === '-' || v === 'nvt'; }

  // De WFS zet het warmteprogramma in een samengesteld veld: 'MT, vve, erfgoed'.
  // Het dashboard verwacht alleen de soort ('MT') plus een losse erfgoed-vlag,
  // net zoals data/warmteprogramma.inc die altijd aanleverde.
  function warmteSoort(v) {
    if (leeg(v)) return null;
    var eerste = String(v).split(',')[0].trim();
    return (eerste === '' || eerste === 'nvt') ? null : eerste;
  }

  async function haalBronOp() {
    bronBezig = true; bronStop = false; bronGedaan = 0; bronTotaal = 0;
    var nieuw = {};
    teken();
    try {
      var start = 0;
      while (!bronStop) {
        // De server weigert soms een pagina als ze te snel achter elkaar komen;
        // even wachten en opnieuw proberen lost dat op.
        var d = null, poging = 0;
        while (d === null && !bronStop) {
          try {
            var r = await fetch(WFS + '&count=' + WFS_PAGINA + '&startIndex=' + start, { cache: 'no-store' });
            if (!r.ok) throw new Error('WFS gaf status ' + r.status);
            d = await r.json();
            bronMelding = '';
          } catch (err) {
            poging++;
            if (poging >= WFS_POGINGEN) throw new Error(err.message + ' (na ' + poging + ' pogingen op rij ' + start + ')');
            var wacht = 3000 * poging;
            bronMelding = 'rij ' + start.toLocaleString('nl-NL') + ' mislukte, nieuwe poging ' + (poging + 1)
              + ' van ' + WFS_POGINGEN + ' over ' + Math.round(wacht / 1000) + ' s';
            teken();
            await new Promise(function (res) { setTimeout(res, wacht); });
          }
        }
        if (d === null) break;
        bronTotaal = d.totalFeatures || d.numberMatched || bronTotaal;
        (d.features || []).forEach(function (f) {
          var p = f.properties || {};
          if (!p.bag_id || !onzeAdressen.has(String(p.bag_id))) return;
          nieuw[p.bag_id] = {
            na: p.nummeraanduiding_id || null,
            label: leeg(p.energielabel) ? null : p.energielabel,
            mon: leeg(p.monumentale_status) ? null : p.monumentale_status,
            besch: leeg(p.binnen_beschermd_gezicht) ? null : p.binnen_beschermd_gezicht,
            warmte: warmteSoort(p.warmteprogramma),
            tijdvak: leeg(p.warmteprogramma_tijdvak) ? null : p.warmteprogramma_tijdvak,
            erf: (p.warmteprogramma && String(p.warmteprogramma).indexOf('erfgoed') !== -1) ? 1 : null,
            opp: p.oppervlakte || null,
            bj: p.bouwjaar_gerelateerd_pand || null,
            // thema_brk noemt de eigenaar van de grond; binnen een VvE is dat
            // altijd de VvE zelf, dus daar valt geen corporatiebezit uit af te
            // leiden. De toevoeging 'Erfpacht' gaat wel over die grond.
            erfpacht: (p.thema_brk && String(p.thema_brk).indexOf('Erfpacht') !== -1) ? 1 : null,
            // BAG-gebruiksdoel, letterlijk: geeft winkels, kantoren en andere
            // eenheden zonder basiseenheidtype toch een type in het dashboard
            doel: (p.gebruiksdoel && String(p.gebruiksdoel).trim()) || null
          };
        });
        bronGedaan += (d.features || []).length;
        teken();
        if (!d.features || d.features.length < WFS_PAGINA) break;
        start += WFS_PAGINA;
        await new Promise(function (res) { setTimeout(res, WFS_PAUZE); });
      }
      bron = nieuw;
      bronOpgehaald = new Date().toISOString();
      try { localStorage.setItem(OPSLAG_BRON, JSON.stringify({ bron: bron, opgehaald: bronOpgehaald })); } catch (e) {}
      bronGewijzigd = true;
    } catch (e) {
      alert('Ophalen mislukt: ' + e.message);
    }
    bronBezig = false;
    teken();
  }

  // Wat wijkt af van wat nu in data/vve_data.inc staat?
  function bronVerschillen() {
    var kanWarmteVergelijken = (typeof getWarmteprogramma === 'function');
    var uit = { label: 0, mon: 0, warmte: kanWarmteVergelijken ? 0 : null, opp: 0 };
    RIJEN.forEach(function (r) {
      var b = bron[String(r.verblijfsobject_id)];
      if (!b) return;
      if (b.label && b.label !== r.energielabel) uit.label++;
      if (b.mon && b.mon !== r.monumentale_status) uit.mon++;
      if (b.opp && Number(b.opp) !== Number(r.oppervlakte)) uit.opp++;
      // Zonder data/warmteprogramma.inc valt er niets te vergelijken; dan
      // zou elk adres als afwijkend tellen en dat zegt niets.
      if (!kanWarmteVergelijken) return;
      var huidig = r.gerelateerd_pand_id
        ? getWarmteprogramma(String(r.gerelateerd_pand_id).split(',')[0].trim()) : null;
      if (b.warmte && (!huidig || huidig.warmte !== b.warmte)) uit.warmte++;
    });
    return uit;
  }

  function bewaarBronBestand() {
    var tekst = '// data/bron_haarlem.inc - adresgegevens uit de WFS van de gemeente Haarlem\n'
      + '// Laag gemeentehaarlem:bag_adres_RD van data.haarlem.nl.\n'
      + '// Opgehaald met de beheertool op ' + new Date().toLocaleString('nl-NL') + ': '
      + Object.keys(bron).length + ' adressen.\n'
      + '//\n'
      + '// Per verblijfsobject-ID:\n'
      + '//   na      nummeraanduiding-ID (nodig voor de WOZ)\n'
      + '//   label   energielabel          mon    monumentale status\n'
      + '//   besch   binnen beschermd gezicht\n'
      + '//   warmte  warmteprogramma       tijdvak\n'
      + '//   erf     1 als het warmteprogramma erfgoed meldt\n'
      + '//   opp     oppervlakte           bj     bouwjaar van het pand\n'
      + '//   erfpacht 1 als de grond in erfpacht is uitgegeven\n'
      + '//   doel    BAG-gebruiksdoel, bv. winkelfunctie of woonfunctie, kantoorfunctie\n'
      + '//\n'
      + '// Het dashboard zet deze waarden over die uit data/vve_data.inc heen.\n'
      + "const BRON_HAARLEM_OPGEHAALD = '" + (bronOpgehaald || '').slice(0, 10) + "';\n"
      + 'const BRON_HAARLEM = ' + JSON.stringify(bron) + ';\n';
    download('bron_haarlem.inc', tekst);
    try { localStorage.removeItem(OPSLAG_BRON); } catch (e) {}
    bronGewijzigd = false;
    teken();
  }

  function tekenBron() {
    var aantal = Object.keys(bron).length;
    var uit = '<div class="bh-paneel"><div class="bh-paneel-kop"><h2>Brondata van de gemeente</h2></div>'
      + '<p class="bh-hint" style="margin-top:0">Haalt per adres het energielabel, de monumentale status, '
      + 'het beschermd gezicht, het warmteprogramma met tijdvak, de oppervlakte, het bouwjaar, de erfpacht, het gebruiksdoel en het '
      + 'nummeraanduiding-ID op uit de open WFS van de gemeente. Alleen adressen die in het dashboard '
      + 'staan worden bewaard; de laag bevat heel Haarlem.</p>'
      + '<div class="bh-velden" style="grid-template-columns:repeat(3,minmax(0,1fr))">'
      + '<div><div class="bh-kaart-meta">Adressen in het dashboard</div><strong>' + onzeAdressen.size.toLocaleString('nl-NL') + '</strong></div>'
      + '<div><div class="bh-kaart-meta">Opgehaald</div><strong>' + aantal.toLocaleString('nl-NL') + '</strong></div>'
      + '<div><div class="bh-kaart-meta">Laatste ronde</div><strong>'
      + (bronOpgehaald ? new Date(bronOpgehaald).toLocaleDateString('nl-NL') : '\u2013') + '</strong></div></div>';

    if (bronBezig) {
      var pct = bronTotaal ? Math.min(100, Math.round(bronGedaan / bronTotaal * 100)) : 0;
      uit += '<h3>Bezig: ' + bronGedaan.toLocaleString('nl-NL') + ' van ' + (bronTotaal || '?').toLocaleString('nl-NL')
        + ' adressen in de laag (' + pct + '%)</h3>'
        + '<div class="bh-voortgang"><div class="bh-voortgang-vul" style="width:' + pct + '%"></div></div>'
        + '<div class="bh-form-knoppen"><button class="bh-knop" data-actie="bron-stop">Stoppen</button></div>';
    } else {
      uit += '<div class="bh-form-knoppen" style="margin-top:14px">'
        + '<button class="bh-knop is-primair" data-actie="bron-ophalen">' + (aantal ? 'Opnieuw ophalen' : 'Ophalen') + '</button>'
        + (bronGewijzigd ? '<button class="bh-knop is-primair" data-actie="bron-bewaar">bron_haarlem.inc downloaden</button>' : '')
        + '</div>';
      if (aantal) {
        var v = bronVerschillen();
        uit += '<h3>Afwijkend van de huidige dataset</h3><ul class="bh-leden">'
          + '<li><span class="bh-lid-naam">Energielabel</span><span class="bh-lid-meta">' + v.label.toLocaleString('nl-NL') + ' adressen</span></li>'
          + '<li><span class="bh-lid-naam">Monumentale status</span><span class="bh-lid-meta">' + v.mon.toLocaleString('nl-NL') + ' adressen</span></li>'
          + '<li><span class="bh-lid-naam">Warmteprogramma</span><span class="bh-lid-meta">'
          + (v.warmte === null ? 'niet te vergelijken, pandid_warmteprogramma ontbreekt'
                               : v.warmte.toLocaleString('nl-NL') + ' adressen') + '</span></li>'
          + '<li><span class="bh-lid-naam">Oppervlakte</span><span class="bh-lid-meta">' + v.opp.toLocaleString('nl-NL') + ' adressen</span></li>'
          + '</ul>';
      }
    }
    uit += '<p class="bh-hint">Na het downloaden zet je bron_haarlem.inc in de map data/ naast het dashboard; dat gebruikt de nieuwe '
      + 'waarden boven die uit data/vve_data.inc. WOZ-waarden haal je op het tabblad WOZ op.</p></div>';
    return uit;
  }


  // ── WOZ-waarden (Kadaster) ──────────────────────────────────────────────
  // Het wozwaardeloket geeft per nummeraanduiding alle peiljaren terug. Let op
  // de jaartelling: de WOZ-waarde van jaar N hoort bij peildatum 1 januari van
  // N-1. Die van 2026 staat dus onder peildatum 2025-01-01, net als in
  // data/vve_data.inc (woz2026 = 573.000 bij peildatum 2025).
  //
  // Het Kadaster staat 60 bevragingen per minuut toe en 5.000 per dag. Een
  // volledige ronde is dus werk van zes dagen; daarom onthoudt de tool waar hij
  // gebleven was en gaat een volgende keer verder. De limiet-headers staan niet
  // in Access-Control-Expose-Headers, dus de browser kan ze niet lezen: we
  // doseren op de klok en stoppen zodra het Kadaster 429 antwoordt.
  var WOZ_URL = 'https://api.kadaster.nl/lvwoz/wozwaardeloket-api/v1/wozwaarde/nummeraanduiding/';
  var WOZ_PAUZE = 1150;      // ms tussen twee bevragingen: ~52 per minuut
  var WOZ_DAGLIMIET = 4900;  // eigen rem, iets onder de 5.000 van het Kadaster
  // Het wozwaardeloket maakt alleen WOZ-waarden van woningen openbaar. Deze
  // eenheidtypes leveren dus gegarandeerd een 404 op; die slaan we over in
  // plaats van er bevragingen aan op te maken.
  var WOZ_GEEN_WONING = ['garage(box)', 'berging/opslag', 'trafo', 'technische ruimte'];
  function wozKanWoningZijn(r) {
    return !r || WOZ_GEEN_WONING.indexOf(String(r.basiseenheidtype)) === -1;
  }

  var woz = (typeof WOZ_DATA !== 'undefined') ? kopie(WOZ_DATA) : {};
  var wozGewijzigd = false;
  var wozOpgehaald = null;
  var wozVandaag = { datum: '', aantal: 0 };
  try {
    var bewaardeWoz = JSON.parse(localStorage.getItem(OPSLAG_WOZ) || 'null');
    if (bewaardeWoz && bewaardeWoz.woz) {
      woz = bewaardeWoz.woz;
      wozOpgehaald = bewaardeWoz.opgehaald || null;
      wozVandaag = bewaardeWoz.vandaag || wozVandaag;
      wozGewijzigd = true;
    }
  } catch (e) {}

  var wozBezig = false, wozStop = false, wozMelding = '', wozFouten = 0;
  var wozRonde = '';   // leeg = heel Haarlem

  // Zeven ronden die elk onder de dagrem blijven en geografisch bij elkaar
  // horen. Per stadsdeel lukt het niet: Noord, Zuidwest, Schalkwijk en Centrum
  // zijn alle vier te groot voor een dag. Oude Stad is in zijn eentje al 5.165
  // adressen en is daarom op buurt gesplitst.
  var WOZ_RONDEN = [
    { naam: 'Binnenstad en Vijfhoek', gebieden: ['Binnenstad', 'Vijfhoek', 'Bakenes', 'Stationsbuurt', 'Heiliglanden'] },
    { naam: 'Burgwal en Oost', gebieden: ['Burgwal', 'Amsterdamsewijk', 'Parkwijk', 'Slachthuiswijk', 'Waarder- en Veerpolder'] },
    { naam: 'Noord-oost', gebieden: ['Transvaalwijk', 'Ter Kleefkwartier', 'Te Zaanenkwartier'] },
    { naam: 'Noord-west', gebieden: ['Delftwijk', 'Indischewijk', 'Vogelenwijk', 'Vondelkwartier', 'Spaarndam'] },
    { naam: 'Haarlemmerhout en Zijlweg', gebieden: ['Haarlemmerhoutkwartier', 'Zijlwegkwartier'] },
    { naam: 'Zuid en Schalkwijk-zuid', gebieden: ['Houtvaartkwartier', 'Duinwijk', 'Boerhaavewijk', 'Meerwijk'] },
    { naam: 'Schalkwijk-noord', gebieden: ['Molenwijk', 'Europawijk'] }
  ];

  // Een ronde noemt wijken en, voor de Oude Stad, buurten; een adres hoort
  // erbij als een van de twee matcht.
  function inRonde(r, naam) {
    if (!naam) return true;
    var ronde = null;
    WOZ_RONDEN.forEach(function (x) { if (x.naam === naam) ronde = x; });
    if (!ronde) return true;
    return ronde.gebieden.indexOf(r.wijk) !== -1 || ronde.gebieden.indexOf(r.buurt) !== -1;
  }

  function wozRondeTelling() {
    var t = {};
    WOZ_RONDEN.forEach(function (x) { t[x.naam] = { totaal: 0, open: 0 }; });
    var buiten = { totaal: 0, open: 0 };
    Object.keys(RIJ_OP_VBO).forEach(function (vo) {
      var r = RIJ_OP_VBO[vo];
      var b = bron[vo];
      if (!b || !b.na || !wozKanWoningZijn(r)) return;
      var raak = null;
      WOZ_RONDEN.forEach(function (x) { if (!raak && inRonde(r, x.naam)) raak = x.naam; });
      var vak = raak ? t[raak] : buiten;
      vak.totaal++;
      if (woz[vo] === undefined) vak.open++;
    });
    var uit = WOZ_RONDEN.map(function (x) {
      return { naam: x.naam, totaal: t[x.naam].totaal, open: t[x.naam].open };
    });
    if (buiten.totaal) uit.push({ naam: 'Overig', totaal: buiten.totaal, open: buiten.open, overig: true });
    return uit;
  }

  function vandaagStr() { return new Date().toISOString().slice(0, 10); }
  function wozVandaagAantal() {
    return wozVandaag.datum === vandaagStr() ? wozVandaag.aantal : 0;
  }

  // Adressen die nog een WOZ-bevraging nodig hebben: ze hebben een
  // nummeraanduiding uit de brondata en staan nog niet in de uitkomst.
  function wozWachtrij() {
    var rij = [];
    Object.keys(RIJ_OP_VBO).forEach(function (vo) {
      var b = bron[vo];
      if (!b || !b.na) return;
      if (woz[vo] !== undefined) return;
      if (!wozKanWoningZijn(RIJ_OP_VBO[vo])) return;
      if (!inRonde(RIJ_OP_VBO[vo], wozRonde)) return;
      rij.push({ vo: vo, na: String(b.na) });
    });
    return rij;
  }
  function wozTeDoen() { return wozWachtrij().length; }
  // Hoeveel van de gekozen wijk is al gedaan? Zonder deze afbakening zou
  // 'opgehaald' over heel Haarlem gaan en 'nog te doen' over één wijk.
  function wozGedaan() {
    var n = 0;
    Object.keys(woz).forEach(function (vo) {
      var r = RIJ_OP_VBO[vo];
      if (!r) return;
      if (!inRonde(r, wozRonde)) return;
      n++;
    });
    return n;
  }
  function wozGeenWoning() {
    var n = 0;
    Object.keys(RIJ_OP_VBO).forEach(function (vo) { if (!wozKanWoningZijn(RIJ_OP_VBO[vo])) n++; });
    return n;
  }

  function bewaarWozWerk() {
    try {
      localStorage.setItem(OPSLAG_WOZ, JSON.stringify({ woz: woz, opgehaald: wozOpgehaald, vandaag: wozVandaag }));
    } catch (e) {}
  }

  async function haalWozOp() {
    var rij = wozWachtrij();
    if (!rij.length) { alert('Er is niets meer op te halen. Haal eerst de brondata op; daar komen de nummeraanduidingen vandaan.'); return; }
    wozBezig = true; wozStop = false; wozMelding = ''; wozFouten = 0;
    if (wozVandaag.datum !== vandaagStr()) wozVandaag = { datum: vandaagStr(), aantal: 0 };
    teken();

    for (var i = 0; i < rij.length && !wozStop; i++) {
      if (wozVandaag.aantal >= WOZ_DAGLIMIET) {
        wozMelding = 'De dagrem van ' + WOZ_DAGLIMIET.toLocaleString('nl-NL') + ' bevragingen is bereikt. Morgen verder.';
        break;
      }
      var post = rij[i];
      var klaar = false, poging = 0;
      while (!klaar && !wozStop) {
        try {
          var r = await fetch(WOZ_URL + post.na, { cache: 'no-store' });
          wozVandaag.aantal++;
          if (r.status === 429) {
            wozMelding = 'Het Kadaster houdt de bevragingen af (429). Waarschijnlijk is de daggrens bereikt; morgen verder.';
            wozStop = true;
            break;
          }
          if (r.status === 404) { woz[post.vo] = null; klaar = true; break; }
          if (!r.ok) throw new Error('status ' + r.status);
          var d = await r.json();
          var jaren = {};
          (d.wozWaarden || []).forEach(function (w) {
            if (!w.peildatum || w.vastgesteldeWaarde == null) return;
            // WOZ-jaar is het jaar na de peildatum
            jaren[String(Number(w.peildatum.slice(0, 4)) + 1)] = w.vastgesteldeWaarde;
          });
          woz[post.vo] = jaren;
          klaar = true;
        } catch (err) {
          poging++;
          if (poging >= 3) { wozFouten++; klaar = true; break; }
          wozMelding = post.na + ' mislukte, nieuwe poging ' + (poging + 1) + ' van 3';
          teken();
          await new Promise(function (res) { setTimeout(res, 3000 * poging); });
        }
      }
      if (i % 25 === 0) bewaarWozWerk();
      teken();
      if (!wozStop) await new Promise(function (res) { setTimeout(res, WOZ_PAUZE); });
    }

    wozOpgehaald = new Date().toISOString();
    wozGewijzigd = true;
    bewaarWozWerk();
    wozBezig = false;
    teken();
  }

  // Wat wijkt af van de WOZ-waarden in data/vve_data.inc?
  // Het loket geeft alle peiljaren terug, de dataset kent er maar een paar.
  // Vergelijken doen we daarom alleen op de jaren die in data/vve_data.inc staan;
  // de oudere jaren zijn aanwinst, geen verschil.
  function wozVerschillen() {
    var uit = { gelijk: 0, anders: 0, zonder: 0, oudste: null };
    Object.keys(woz).forEach(function (vo) {
      var r = RIJ_OP_VBO[vo], w = woz[vo];
      if (!r) return;
      if (!w || !Object.keys(w).length) { uit.zonder++; return; }
      var vergeleken = 0, afwijkend = false;
      Object.keys(w).forEach(function (jaar) {
        if (uit.oudste === null || Number(jaar) < uit.oudste) uit.oudste = Number(jaar);
        var huidig = r['woz' + jaar];
        if (huidig == null || huidig === '') return;
        vergeleken++;
        if (Number(huidig) !== Number(w[jaar])) afwijkend = true;
      });
      if (afwijkend) uit.anders++;
      else if (vergeleken) uit.gelijk++;
    });
    return uit;
  }

  function bewaarWozBestand() {
    var tekst = '// data/woz_data.inc - WOZ-waarden uit het wozwaardeloket van het Kadaster\n'
      + '// Opgehaald met de beheertool, laatste ronde ' + new Date(wozOpgehaald || Date.now()).toLocaleString('nl-NL') + '.\n'
      + '//\n'
      + '// Per verblijfsobject-ID een lijstje jaar -> vastgestelde waarde. Het jaar\n'
      + '// is het WOZ-jaar, dus peildatum 1 januari van het jaar ervoor; woz2026\n'
      + '// hoort bij peildatum 2025-01-01, net als in data/vve_data.inc.\n'
      + '// null betekent: het Kadaster kent deze nummeraanduiding niet.\n'
      + "const WOZ_DATA_OPGEHAALD = '" + (wozOpgehaald || new Date().toISOString()).slice(0, 10) + "';\n"
      + 'const WOZ_DATA = ' + JSON.stringify(woz) + ';\n';
    download('woz_data.inc', tekst);
    wozGewijzigd = false;
    teken();
  }

  function tekenWoz() {
    var gedaan = wozGedaan();
    var tedoen = wozTeDoen();
    var totaal = gedaan + tedoen;
    var zonderBron = !Object.keys(bron).length;

    var uit = '<div class="bh-paneel"><div class="bh-paneel-kop"><h2>WOZ-waarden van het Kadaster</h2></div>'
      + '<p class="bh-hint" style="margin-top:0">Vraagt per adres het wozwaardeloket, op het nummeraanduiding-ID '
      + 'uit de brondata. Het Kadaster staat 60 bevragingen per minuut toe en 5.000 per dag, dus een hele ronde '
      + 'duurt ongeveer zes dagen. De tool onthoudt waar hij gebleven was; een volgende keer gaat hij verder.</p>'
      + '<p class="bh-hint">Het loket maakt alleen WOZ-waarden van woningen openbaar. Garageboxen, bergingen, '
      + 'trafohuisjes en technische ruimtes worden daarom overgeslagen (' + wozGeenWoning().toLocaleString('nl-NL')
      + ' adressen). Bedrijfsruimtes staan niet als zodanig in de data; die leveren een lege uitkomst op.</p>';

    if (zonderBron) {
      uit += '<p class="bh-leeg">Haal eerst de brondata op: daar komen de nummeraanduidingen vandaan.</p></div>';
      return uit;
    }

    var vandaag = wozVandaagAantal();
    var dagen = Math.ceil(tedoen / WOZ_DAGLIMIET);
    var minuten = Math.round(tedoen * WOZ_PAUZE / 60000);
    uit += '<div class="bh-velden" style="grid-template-columns:repeat(4,minmax(0,1fr))">'
      + '<div><div class="bh-kaart-meta">Opgehaald</div><strong>' + gedaan.toLocaleString('nl-NL') + ' van ' + totaal.toLocaleString('nl-NL') + '</strong></div>'
      + '<div><div class="bh-kaart-meta">Vandaag</div><strong>' + vandaag.toLocaleString('nl-NL') + ' van ' + WOZ_DAGLIMIET.toLocaleString('nl-NL') + '</strong></div>'
      + '<div><div class="bh-kaart-meta">Nog te gaan</div><strong>'
      + (!tedoen ? 'niets' : dagen > 1 ? dagen + ' dagen' : minuten + ' min') + '</strong></div>'
      + '<div><div class="bh-kaart-meta">Laatste ronde</div><strong>'
      + (wozOpgehaald ? new Date(wozOpgehaald).toLocaleDateString('nl-NL') : '–') + '</strong></div></div>';

    if (!wozBezig) {
      var ronden = wozRondeTelling();
      var open = ronden.reduce(function (n, x) { return n + x.open; }, 0);
      uit += '<label class="bh-breed" style="display:grid;gap:3px;font-size:12px;color:var(--bh-zacht);margin-top:14px">Ronde'
        + '<select class="bh-veld" data-actie="woz-ronde">'
        + '<option value=""' + (wozRonde ? '' : ' selected') + '>Heel Haarlem \u2014 ' + open.toLocaleString('nl-NL')
        + ' open, ' + Math.ceil(open / WOZ_DAGLIMIET) + ' dagen</option>';
      ronden.forEach(function (x) {
        if (x.overig || (!x.open && x.naam !== wozRonde)) return;
        uit += '<option value="' + x.naam.replace(/"/g, '&quot;') + '"' + (x.naam === wozRonde ? ' selected' : '') + '>'
          + x.naam + ' \u2014 ' + x.open.toLocaleString('nl-NL') + ' open van ' + x.totaal.toLocaleString('nl-NL')
          + ' (' + Math.round(x.open * WOZ_PAUZE / 60000) + ' min)</option>';
      });
      uit += '</select></label>'
        + '<p class="bh-hint">Zeven ronden die elk in \u00e9\u00e9n dag passen. Per stadsdeel kan het niet: vier van de '
        + 'vijf zijn te groot voor de dagrem, en de Oude Stad alleen al is 5.165 adressen.</p>';
    }

    if (wozBezig) {
      var pct = totaal ? Math.round(gedaan / totaal * 100) : 0;
      uit += '<h3>Bezig: ' + gedaan.toLocaleString('nl-NL') + ' van ' + totaal.toLocaleString('nl-NL') + ' (' + pct + '%)</h3>'
        + '<div class="bh-voortgang"><div class="bh-voortgang-vul" style="width:' + pct + '%"></div></div>'
        + '<div class="bh-form-knoppen"><button class="bh-knop" data-actie="woz-stop">Stoppen</button></div>';
    } else {
      uit += '<div class="bh-form-knoppen" style="margin-top:14px">'
        + (tedoen ? '<button class="bh-knop is-primair" data-actie="woz-ophalen">' + (gedaan ? 'Verder ophalen' : 'Ophalen') + '</button>' : '')
        + (wozGewijzigd ? '<button class="bh-knop is-primair" data-actie="woz-bewaar">woz_data.inc downloaden</button>' : '')
        + (gedaan ? '<button class="bh-knop bh-gevaar" data-actie="woz-wis">Opnieuw beginnen</button>' : '')
        + '</div>';
    }
    if (wozMelding) uit += '<p class="bh-hint">' + wozMelding + '</p>';
    if (wozFouten) uit += '<p class="bh-hint">' + wozFouten.toLocaleString('nl-NL') + ' adressen zijn na drie pogingen overgeslagen; die komen bij een volgende ronde opnieuw aan de beurt.</p>';

    if (gedaan) {
      var v = wozVerschillen();
      uit += '<h3>Vergeleken met data/vve_data.inc</h3><ul class="bh-leden">'
        + '<li><span class="bh-lid-naam">Afwijkend in een jaar dat de dataset kent</span><span class="bh-lid-meta">' + v.anders.toLocaleString('nl-NL') + ' adressen</span></li>'
        + '<li><span class="bh-lid-naam">Gelijk aan de dataset</span><span class="bh-lid-meta">' + v.gelijk.toLocaleString('nl-NL') + ' adressen</span></li>'
        + '<li><span class="bh-lid-naam">Niet bekend bij het Kadaster</span><span class="bh-lid-meta">' + v.zonder.toLocaleString('nl-NL') + ' adressen</span></li>'
        + '</ul>'
        + (v.oudste ? '<p class="bh-hint">Het loket geeft de reeks terug tot ' + v.oudste
            + '; data/vve_data.inc heeft alleen de laatste jaren. Die oudere waarden komen gewoon mee in het bestand.</p>' : '');
    }
    uit += '<p class="bh-hint">Zet woz_data.inc in de map data/ naast het dashboard; dat gebruikt deze waarden boven die uit data/vve_data.inc.</p></div>';
    return uit;
  }


  // ── Energielabels (EP-Online, via de helper op adresverkenner) ──────────
  // EP-Online vraagt een sleutel, dus het loopt via ep-proxy.php; die kent het
  // BAG-verblijfsobject-ID, hetzelfde ID dat wij al hebben. Er zit geen
  // zichtbare limiet op, maar de helper praat met een sleutel namens ons, dus
  // we houden het op vier per seconde. De hele stad is dan ruim twee uur.
  var EP_URL = 'https://adresverkenner.nl/helpers/ep-proxy.php?bagid=';
  var EP_PAUZE = 250;    // ms tussen twee starts: vier per seconde
  var EP_PARALLEL = 6;   // zoveel bevragingen mogen tegelijk onderweg zijn

  var ep = (typeof EP_DATA !== 'undefined') ? kopie(EP_DATA) : {};
  var epGewijzigd = false;
  var epOpgehaald = null;
  try {
    var bewaardeEp = JSON.parse(localStorage.getItem(OPSLAG_EP) || 'null');
    if (bewaardeEp && bewaardeEp.ep) {
      ep = bewaardeEp.ep;
      epOpgehaald = bewaardeEp.opgehaald || null;
      epGewijzigd = true;
    }
  } catch (e) {}

  var epBezig = false, epStop = false, epMelding = '', epFouten = 0;

  function epWachtrij() {
    var rij = [];
    Object.keys(RIJ_OP_VBO).forEach(function (vo) {
      if (ep[vo] === undefined) rij.push(vo);
    });
    return rij;
  }

  // 'Rekenmethodiek Definitief Energielabel, versie 1.2, ...' tegenover
  // 'NTA 8800:2024 ...'. Dezelfde letter betekent bij die twee niet hetzelfde,
  // dus dat onderscheid bewaren we.
  function epMethode(v) {
    if (!v) return null;
    return String(v).indexOf('NTA') !== -1 ? 'nta8800' : 'oud';
  }

  function bewaarEpWerk() {
    try { localStorage.setItem(OPSLAG_EP, JSON.stringify({ ep: ep, opgehaald: epOpgehaald })); } catch (e) {}
  }

  // Een enkele bevraging, met twee herkansingen.
  async function epEenAdres(vo) {
    for (var poging = 1; poging <= 3; poging++) {
      try {
        var r = await fetch(EP_URL + encodeURIComponent(vo), { cache: 'no-store' });
        if (!r.ok) throw new Error('status ' + r.status);
        var d = await r.json();
        // De helper geeft de EP-status mee in _httpStatus; 404 = geen label.
        if (d._httpStatus === 404) { ep[vo] = null; return true; }
        if (d._httpStatus && d._httpStatus >= 400) throw new Error('EP-Online: ' + d._httpStatus);
        var rec = d['0'] || d;
        var letter = rec.Energieklasse || rec.energieklasse || rec.LabelLetter || null;
        ep[vo] = letter ? {
          k: letter,
          opname: (rec.Opnamedatum || '').slice(0, 10) || null,
          geldig: (rec.Geldig_tot || '').slice(0, 10) || null,
          methode: epMethode(rec.Berekeningstype),
          klasse: rec.Gebouwklasse || null,
          type: rec.Gebouwtype || null,
          kwh: rec.BerekendeEnergieverbruik || null
        } : null;
        return true;
      } catch (err) {
        if (poging === 3) { epFouten++; return false; }
        await new Promise(function (res) { setTimeout(res, 1500 * poging); });
      }
    }
    return false;
  }

  // Een voor een wachten op het antwoord en dan nog eens pauzeren kostte meer
  // tijd dan nodig: de snelheid werd de reistijd plus de pauze. Nu bepaalt
  // alleen de pauze het tempo (vier starts per seconde) en vangen een paar
  // gelijktijdige bevragingen de reistijd op.
  async function haalEpOp() {
    var rij = epWachtrij();
    if (!rij.length) { alert('Alle adressen zijn al bevraagd. Met "Opnieuw beginnen" haal je ze nog een keer op.'); return; }
    epBezig = true; epStop = false; epMelding = ''; epFouten = 0;
    teken();

    var volgende = 0;          // welk adres is aan de beurt
    var afgerond = 0;          // hoeveel er terug zijn
    var startNietVoor = 0;
    epLoopTotaal = Object.keys(ep).length + rij.length;
    epLoopGedaan = Object.keys(ep).length;

    async function werker() {
      while (!epStop) {
        var i = volgende++;
        if (i >= rij.length) return;
        // Wachten tot deze bevraging mag starten; de klok loopt door, ook als
        // een vorige nog onderweg is.
        var nu = Date.now();
        if (startNietVoor < nu) startNietVoor = nu;
        var wacht = startNietVoor - nu;
        startNietVoor += EP_PAUZE;
        if (wacht > 0) await new Promise(function (res) { setTimeout(res, wacht); });
        if (epStop) return;
        await epEenAdres(rij[i]);
        afgerond++;
        epLoopGedaan++;
        if (afgerond % 100 === 0) bewaarEpWerk();
        if (afgerond % 5 === 0) epTekenVoortgang();
      }
    }

    var ploeg = [];
    for (var w = 0; w < EP_PARALLEL; w++) ploeg.push(werker());
    await Promise.all(ploeg);

    epOpgehaald = new Date().toISOString();
    epGewijzigd = true;
    bewaarEpWerk();
    epBezig = false;
    teken();
  }

  // Wat levert het op tegenover wat we nu weten?
  function epVerschillen() {
    var uit = { gelijk: 0, anders: 0, nieuw: 0, zonder: 0, verlopen: 0, bijna: 0, oudeMethode: 0 };
    var nu = new Date();
    var over2 = new Date(nu.getTime() + 730 * 86400000);
    Object.keys(ep).forEach(function (vo) {
      var r = RIJ_OP_VBO[vo], e = ep[vo];
      if (!r) return;
      if (!e) { uit.zonder++; return; }
      var huidig = (bron[vo] && bron[vo].label) || r.energielabel;
      if (!huidig || huidig === '-') uit.nieuw++;
      else if (String(huidig).trim() !== String(e.k).trim()) uit.anders++;
      else uit.gelijk++;
      if (e.geldig) {
        var g = new Date(e.geldig);
        if (g < nu) uit.verlopen++;
        else if (g < over2) uit.bijna++;
      }
      if (e.methode === 'oud') uit.oudeMethode++;
    });
    return uit;
  }

  function bewaarEpBestand() {
    var tekst = '// data/ep_data.inc - energielabels uit EP-Online, via ep-proxy.php op adresverkenner.nl\n'
      + '// Opgehaald met de beheertool, laatste ronde ' + new Date(epOpgehaald || Date.now()).toLocaleString('nl-NL') + '.\n'
      + '//\n'
      + '// Per verblijfsobject-ID:\n'
      + '//   k        energieklasse        opname   datum van de opname\n'
      + '//   geldig   label geldig tot     methode  nta8800 of oud\n'
      + '//   klasse   woningbouw of utiliteitsbouw  type  gebouwtype\n'
      + '//   kwh      berekend verbruik. Let op: bij nta8800 is dat kWh per m2,\n'
      + '//            bij de oude methodiek het totaal in kWh. Niet vergelijkbaar.\n'
      + '// null betekent: EP-Online kent geen label voor dit adres.\n'
      + "const EP_DATA_OPGEHAALD = '" + (epOpgehaald || new Date().toISOString()).slice(0, 10) + "';\n"
      + 'const EP_DATA = ' + JSON.stringify(ep) + ';\n';
    download('ep_data.inc', tekst);
    epGewijzigd = false;
    teken();
  }

  // teken() bouwt het hele scherm opnieuw op, inclusief de tabbalk die over
  // alle panden en adressen loopt. Vier keer per seconde is dat zoveel werk dat
  // het ophalen er merkbaar door vertraagt. Tijdens een ronde werken we daarom
  // alleen de twee regels bij die veranderen.
  var epLoopGedaan = 0, epLoopTotaal = 0;   // tellers tijdens een ronde
  function epTekenVoortgang() {
    var kop = document.getElementById('ep-stand');
    var vul = document.getElementById('ep-vul');
    if (!kop || !vul) { teken(); return; }
    // Niet opnieuw de hele wachtrij uitrekenen: die loopt over alle adressen
    // en dat kost meer tijd dan de bevraging zelf.
    var gedaan = epLoopGedaan, totaal = epLoopTotaal;
    var pct = totaal ? Math.round(gedaan / totaal * 100) : 0;
    kop.textContent = 'Bezig: ' + gedaan.toLocaleString('nl-NL') + ' van ' + totaal.toLocaleString('nl-NL') + ' (' + pct + '%)';
    vul.style.width = pct + '%';
  }

  function tekenEp() {
    var gedaan = Object.keys(ep).length;
    var tedoen = epWachtrij().length;
    var totaal = gedaan + tedoen;
    var minuten = Math.round(tedoen * EP_PAUZE / 60000);

    var uit = '<div class="bh-paneel"><div class="bh-paneel-kop"><h2>Energielabels uit EP-Online</h2></div>'
      + '<p class="bh-hint" style="margin-top:0">Vraagt per adres het officiële register, via de helper op '
      + 'adresverkenner.nl die de sleutel bewaart. Naast de letter komen de opnamedatum, tot wanneer het label '
      + 'geldig is, de rekenmethodiek en het berekende verbruik mee. Er zit geen dagrem op, dus de hele stad is '
      + 'in één zitting te doen.</p>'
      + '<div class="bh-velden" style="grid-template-columns:repeat(3,minmax(0,1fr))">'
      + '<div><div class="bh-kaart-meta">Bevraagd</div><strong>' + gedaan.toLocaleString('nl-NL') + ' van ' + totaal.toLocaleString('nl-NL') + '</strong></div>'
      + '<div><div class="bh-kaart-meta">Nog te gaan</div><strong>' + (tedoen ? minuten + ' min' : 'niets') + '</strong></div>'
      + '<div><div class="bh-kaart-meta">Laatste ronde</div><strong>'
      + (epOpgehaald ? new Date(epOpgehaald).toLocaleDateString('nl-NL') : '–') + '</strong></div></div>';

    if (epBezig) {
      var pct = totaal ? Math.round(gedaan / totaal * 100) : 0;
      uit += '<h3 id="ep-stand">Bezig: ' + gedaan.toLocaleString('nl-NL') + ' van ' + totaal.toLocaleString('nl-NL') + ' (' + pct + '%)</h3>'
        + '<div class="bh-voortgang"><div class="bh-voortgang-vul" id="ep-vul" style="width:' + pct + '%"></div></div>'
        + '<div class="bh-form-knoppen"><button class="bh-knop" data-actie="ep-stop">Stoppen</button></div>';
    } else {
      uit += '<div class="bh-form-knoppen" style="margin-top:14px">'
        + (tedoen ? '<button class="bh-knop is-primair" data-actie="ep-ophalen">' + (gedaan ? 'Verder ophalen' : 'Ophalen') + '</button>' : '')
        + (epGewijzigd ? '<button class="bh-knop is-primair" data-actie="ep-bewaar">ep_data.inc downloaden</button>' : '')
        + (gedaan ? '<button class="bh-knop bh-gevaar" data-actie="ep-wis">Opnieuw beginnen</button>' : '')
        + '</div>';
    }
    if (epMelding) uit += '<p class="bh-hint">' + epMelding + '</p>';
    if (epFouten) uit += '<p class="bh-hint">' + epFouten.toLocaleString('nl-NL') + ' adressen zijn na drie pogingen overgeslagen; die komen bij een volgende ronde opnieuw aan de beurt.</p>';

    if (gedaan && !epBezig) {
      var v = epVerschillen();
      uit += '<h3>Wat het oplevert</h3><ul class="bh-leden">'
        + '<li><span class="bh-lid-naam">Gelijk aan wat we al hadden</span><span class="bh-lid-meta">' + v.gelijk.toLocaleString('nl-NL') + ' adressen</span></li>'
        + '<li><span class="bh-lid-naam">Andere letter dan we hadden</span><span class="bh-lid-meta">' + v.anders.toLocaleString('nl-NL') + ' adressen</span></li>'
        + '<li><span class="bh-lid-naam">Label waar we er geen hadden</span><span class="bh-lid-meta">' + v.nieuw.toLocaleString('nl-NL') + ' adressen</span></li>'
        + '<li><span class="bh-lid-naam">Geen label in EP-Online</span><span class="bh-lid-meta">' + v.zonder.toLocaleString('nl-NL') + ' adressen</span></li>'
        + '</ul>'
        + '<h3>Houdbaarheid</h3><ul class="bh-leden">'
        + '<li><span class="bh-lid-naam">Label al verlopen</span><span class="bh-lid-meta">' + v.verlopen.toLocaleString('nl-NL') + ' adressen</span></li>'
        + '<li><span class="bh-lid-naam">Verloopt binnen twee jaar</span><span class="bh-lid-meta">' + v.bijna.toLocaleString('nl-NL') + ' adressen</span></li>'
        + '<li><span class="bh-lid-naam">Nog op de oude rekenmethodiek</span><span class="bh-lid-meta">' + v.oudeMethode.toLocaleString('nl-NL') + ' adressen</span></li>'
        + '</ul>';
    }
    uit += '<p class="bh-hint">Zet ep_data.inc in de map data/ naast het dashboard; dat gebruikt deze labels boven die uit data/vve_data.inc en toont de geldigheid erbij.</p></div>';
    return uit;
  }

  // ── toestand van het scherm ─────────────────────────────────────────────
  var tab = 'clusters';
  var gekozenCluster = null;   // id
  var zoekterm = '';
  var bewerkHandmatig = null;  // id, of 'nieuw'

  function cluster(id) { return clusters.find(function (c) { return c.id === id; }); }
  function volgendId(lijst, voorvoegsel) {
    var n = lijst.map(function (x) { return parseInt(String(x.id || '').replace(/\D/g, ''), 10); })
      .filter(function (x) { return !isNaN(x); });
    return voorvoegsel + String((n.length ? Math.max.apply(null, n) : 0) + 1).padStart(4, '0');
  }
  function naamVrij(naam, eigenId) {
    var n = naam.trim().toLowerCase();
    return !clusters.some(function (c) { return c.id !== eigenId && (c.naam || '').toLowerCase() === n; });
  }
  function mapnaamBotst(naam) {
    var n = naam.trim().toLowerCase();
    return Object.keys(MAPNAMEN).some(function (k) { return String(MAPNAMEN[k]).toLowerCase() === n; });
  }
  var VERBODEN = /[\\/:*?"<>|]/;

  // ── zoeken naar VvE's om toe te voegen ─────────────────────────────────
  function zoekVves(term, uitsluiten) {
    var t = term.trim().toLowerCase();
    if (t.length < 2) return [];
    var weg = new Set((uitsluiten || []).map(kort));
    var uit = [];
    for (var i = 0; i < vveLijst.length && uit.length < 40; i++) {
      var v = vveLijst[i];
      if (weg.has(v.id)) continue;
      if ((v.naam + ' ' + v.straat + ' ' + v.buurt + ' ' + v.mapnaam + ' ' + v.id).toLowerCase().indexOf(t) >= 0) uit.push(v);
    }
    handmatig.forEach(function (h) {
      if (weg.has(h.id) || uit.length >= 40) return;
      if ((h.naam + ' ' + (h.straat || '') + ' ' + (h.buurt || '') + ' ' + h.id).toLowerCase().indexOf(t) >= 0) {
        uit.push({ id: h.id, naam: h.naam, straat: h.straat || '', buurt: h.buurt || '', woningen: h.woningen || 0, adressen: 0, handmatig: true });
      }
    });
    return uit;
  }

  // ── tekenen ─────────────────────────────────────────────────────────────
  function teken() {
    var html = '<header class="bh-kop"><div class="bh-in">'
      + '<h1>VvE-beheer</h1>'
      + '<p class="bh-sub">Clusters en handmatig toegevoegde VvE’s. Wijzigingen bewaar je door de bestanden te downloaden en in de map config/ naast het dashboard te zetten.</p>'
      + '<nav class="bh-tabs">'
      + '<button class="bh-tab' + (tab === 'clusters' ? ' is-actief' : '') + '" data-actie="tab" data-tab="clusters">Clusters <span class="bh-telling">' + clusters.length + '</span></button>'
      + '<button class="bh-tab' + (tab === 'handmatig' ? ' is-actief' : '') + '" data-actie="tab" data-tab="handmatig">Handmatige VvE’s <span class="bh-telling">' + handmatig.length + '</span></button>'
      + '<button class="bh-tab' + (tab === 'panden' ? ' is-actief' : '') + '" data-actie="tab" data-tab="panden">Panddata <span class="bh-telling">' + pandenMetGrond() + '</span></button>'
      + '<button class="bh-tab' + (tab === 'bron' ? ' is-actief' : '') + '" data-actie="tab" data-tab="bron">Brondata</button>'
      + '<button class="bh-tab' + (tab === 'woz' ? ' is-actief' : '') + '" data-actie="tab" data-tab="woz">WOZ <span class="bh-telling">' + Object.keys(woz).length.toLocaleString('nl-NL') + '</span></button>'
      + '<button class="bh-tab' + (tab === 'ep' ? ' is-actief' : '') + '" data-actie="tab" data-tab="ep">Energielabels <span class="bh-telling">' + Object.keys(ep).length.toLocaleString('nl-NL') + '</span></button>'
      + '</nav></div></header>';

    if (vuil) {
      html += '<div class="bh-balk bh-in"><span>Er zijn wijzigingen die nog niet in een bestand staan.</span>'
        + '<button class="bh-knop is-primair" data-actie="bewaar-clusters">clusters.inc downloaden</button>'
        + '<button class="bh-knop is-primair" data-actie="bewaar-handmatig">vve_handmatig.inc downloaden</button>'
        + '<button class="bh-knop" data-actie="verwerp">Wijzigingen weggooien</button></div>';
    }

    html += '<main class="bh-in">'
      + (tab === 'clusters' ? tekenClusters() : tab === 'handmatig' ? tekenHandmatig()
         : tab === 'panden' ? tekenPanden() : tab === 'woz' ? tekenWoz() : tab === 'ep' ? tekenEp() : tekenBron())
      + '</main>'
      + '<footer class="bh-voet bh-in">Beheertool versie ' + VERSIE + ' · ' + vveLijst.length.toLocaleString('nl-NL')
      + ' VvE’s uit de data · wijzigingen blijven in deze browser staan tot je ze downloadt</footer>';
    app.innerHTML = html;

    var z = app.querySelector('.bh-zoek');
    if (z && zoekterm) { z.focus(); z.setSelectionRange(z.value.length, z.value.length); }
  }

  function tekenClusters() {
    var c = gekozenCluster && cluster(gekozenCluster);
    var lijst = '<div class="bh-lijst"><div class="bh-lijst-kop"><h2>Clusters</h2>'
      + '<button class="bh-knop is-primair" data-actie="cluster-nieuw">+ Nieuw cluster</button></div>';
    if (!clusters.length) {
      lijst += '<p class="bh-leeg">Nog geen clusters. Maak er een en voeg VvE’s toe.</p>';
    } else {
      lijst += '<ul class="bh-kaarten">' + clusters.map(function (x) {
        return '<li><button class="bh-kaart' + (c && c.id === x.id ? ' is-gekozen' : '') + '" data-actie="cluster-kies" data-id="' + esc(x.id) + '">'
          + '<span class="bh-kaart-naam">' + esc(x.naam || x.id) + '</span>'
          + '<span class="bh-kaart-meta">' + (x.vves || []).length + ' VvE’s' + (x.status ? ' · ' + esc(x.status) : '') + '</span>'
          + '</button></li>';
      }).join('') + '</ul>';
    }
    lijst += '</div>';

    if (!c) return '<div class="bh-twee">' + lijst + '<div class="bh-paneel bh-leeg-paneel">Kies links een cluster, of maak een nieuw cluster.</div></div>';

    var leden = (c.vves || []);
    var paneel = '<div class="bh-paneel">'
      + '<div class="bh-paneel-kop"><h2>' + esc(c.naam || c.id) + '</h2>'
      + '<span class="bh-id">' + esc(c.id) + '</span>'
      + '<button class="bh-knop" data-actie="cluster-hernoem">Naam wijzigen</button>'
      + '<button class="bh-knop bh-gevaar" data-actie="cluster-weg">Verwijderen</button></div>'
      + '<div class="bh-velden">'
      + '<label>Status<input class="bh-veld" data-veld="status" value="' + esc(c.status || '') + '" placeholder="bijv. adviestraject"></label>'
      + '<label>Toelichting<input class="bh-veld" data-veld="toelichting" value="' + esc(c.toelichting || '') + '" placeholder="waarom horen deze VvE’s bij elkaar?"></label>'
      + '</div>'
      + '<h3>VvE’s in dit cluster <span class="bh-telling">' + leden.length + '</span></h3>';

    paneel += leden.length
      ? '<ul class="bh-leden">' + leden.map(function (id) {
          var v = VVES[kort(id)];
          return '<li><span class="bh-lid-naam">' + esc(vveNaam(id)) + '</span>'
            + '<span class="bh-lid-meta">' + esc(v ? (v.straat + ' · ' + v.buurt) : 'handmatig') + '</span>'
            + '<button class="bh-mini" data-actie="lid-weg" data-id="' + esc(id) + '" title="Uit het cluster halen">×</button></li>';
        }).join('') + '</ul>'
      : '<p class="bh-leeg">Nog geen VvE’s. Zoek ze hieronder op.</p>';

    paneel += '<h3>VvE toevoegen</h3>'
      + '<input class="bh-zoek" data-actie="zoek" placeholder="Zoek op naam, straat, buurt of nummer…" value="' + esc(zoekterm) + '">';
    var gevonden = zoekVves(zoekterm, leden);
    if (zoekterm.trim().length >= 2) {
      paneel += gevonden.length
        ? '<ul class="bh-treffers">' + gevonden.map(function (v) {
            return '<li><button class="bh-treffer" data-actie="lid-erbij" data-id="' + esc(v.id) + '">'
              + '<span>' + esc(v.naam || v.id) + (v.handmatig ? ' <span class="bh-vlag">handmatig</span>' : '') + '</span>'
              + '<span class="bh-lid-meta">' + esc(v.straat + (v.buurt ? ' · ' + v.buurt : '')) + ' · ' + v.woningen + ' won.</span>'
              + '</button></li>';
          }).join('') + '</ul>'
        : '<p class="bh-leeg">Niets gevonden.</p>';
    }
    paneel += '</div>';
    return '<div class="bh-twee">' + lijst + paneel + '</div>';
  }

  var HANDMATIG_VELDEN = [
    { key: 'naam', label: 'Naam', verplicht: true, breed: true },
    { key: 'buurt', label: 'Buurt', verplicht: true },
    { key: 'straat', label: 'Straat', verplicht: true },
    { key: 'van', label: 'Huisnummer van', verplicht: true, getal: true },
    { key: 'tot', label: 'tot', getal: true },
    { key: 'woningen', label: 'Woningen (schatting)', getal: true },
    { key: 'postcode', label: 'Postcode' },
    { key: 'kvk', label: 'KvK-nummer' },
    { key: 'hoofdsplitsing', label: 'Kadaster-ID hoofdsplitsing' },
    { key: 'typologie', label: 'Typologie' },
    { key: 'mapnaam', label: 'Mapnaam (leeg = automatisch)', breed: true },
    { key: 'bron', label: 'Bron', breed: true },
    { key: 'vervangen_door', label: 'Vervangen door Kadaster-ID (zodra hij in de data staat)', breed: true }
  ];

  function tekenHandmatig() {
    var lijst = '<div class="bh-lijst"><div class="bh-lijst-kop"><h2>Handmatige VvE’s</h2>'
      + '<button class="bh-knop is-primair" data-actie="hand-nieuw">+ Nieuwe VvE</button></div>';
    lijst += handmatig.length
      ? '<ul class="bh-kaarten">' + handmatig.map(function (h) {
          return '<li><button class="bh-kaart' + (bewerkHandmatig === h.id ? ' is-gekozen' : '') + '" data-actie="hand-kies" data-id="' + esc(h.id) + '">'
            + '<span class="bh-kaart-naam">' + esc(h.naam || h.id) + (h.vervangen_door ? ' <span class="bh-vlag">vervangen</span>' : '') + '</span>'
            + '<span class="bh-kaart-meta">' + esc((h.straat || '') + ' ' + (h.van || '') + (h.tot ? '-' + h.tot : '')) + ' · ' + esc(h.buurt || '') + '</span>'
            + '</button></li>';
        }).join('') + '</ul>'
      : '<p class="bh-leeg">Nog geen handmatige VvE’s.</p>';
    lijst += '</div>';

    if (!bewerkHandmatig) return '<div class="bh-twee">' + lijst + '<div class="bh-paneel bh-leeg-paneel">Kies links een VvE, of voeg er een toe.</div></div>';

    var h = bewerkHandmatig === 'nieuw' ? {} : (handmatig.find(function (x) { return x.id === bewerkHandmatig; }) || {});
    var paneel = '<div class="bh-paneel"><div class="bh-paneel-kop">'
      + '<h2>' + (bewerkHandmatig === 'nieuw' ? 'Nieuwe VvE' : esc(h.naam || h.id)) + '</h2>'
      + (h.id ? '<span class="bh-id">' + esc(h.id) + '</span>' : '')
      + (h.id ? '<button class="bh-knop bh-gevaar" data-actie="hand-weg" data-id="' + esc(h.id) + '">Verwijderen</button>' : '')
      + '</div><form class="bh-velden" data-actie="hand-opslaan">'
      + HANDMATIG_VELDEN.map(function (v) {
          return '<label class="' + (v.breed ? 'bh-breed' : '') + '">' + esc(v.label) + (v.verplicht ? ' *' : '')
            + '<input name="' + v.key + '" value="' + esc(h[v.key] == null ? '' : h[v.key]) + '"'
            + (v.getal ? ' inputmode="numeric"' : '') + (v.verplicht ? ' required' : '') + '></label>';
        }).join('')
      + '<label class="bh-breed bh-vink"><input type="checkbox" name="mini"' + (h.mini ? ' checked' : '') + '> In de map voor mini’s zetten</label>'
      + '<div class="bh-breed bh-form-knoppen">'
      + '<button class="bh-knop is-primair" type="submit">Opslaan</button>'
      + '<button class="bh-knop" type="button" data-actie="hand-annuleer">Annuleren</button>'
      + '</div></form>'
      + '<p class="bh-hint">De mapnaam volgt uit straat en huisnummers, tenzij je er zelf een invult. '
      + 'De generator controleert of die naam nog vrij is.</p></div>';
    return '<div class="bh-twee">' + lijst + paneel + '</div>';
  }

  // ── bediening ───────────────────────────────────────────────────────────
  app.addEventListener('click', function (e) {
    var k = e.target.closest('[data-actie]');
    if (!k || k.tagName === 'FORM' || k.tagName === 'INPUT') return;
    var actie = k.getAttribute('data-actie');
    var id = k.getAttribute('data-id');

    if (actie === 'tab') { tab = k.getAttribute('data-tab'); teken(); return; }
    if (actie === 'pand-ophalen') { haalPandenOp(true); return; }
    if (actie === 'pand-opnieuw') {
      if (confirm('Alle ' + allePandIds.length.toLocaleString('nl-NL') + ' panden opnieuw ophalen? Dat duurt een paar minuten.')) haalPandenOp(false);
      return;
    }
    if (actie === 'pand-stop') { ophalenStop = true; return; }
    if (actie === 'pand-bewaar') { bewaarPandBestand(); return; }
    if (actie === 'bron-ophalen') { haalBronOp(); return; }
    if (actie === 'bron-stop') { bronStop = true; return; }
    if (actie === 'bron-bewaar') { bewaarBronBestand(); return; }
    if (actie === 'woz-ophalen') { haalWozOp(); return; }
    if (actie === 'woz-stop') { wozStop = true; return; }
    if (actie === 'woz-bewaar') { bewaarWozBestand(); return; }
    if (actie === 'ep-ophalen') { haalEpOp(); return; }
    if (actie === 'ep-stop') { epStop = true; return; }
    if (actie === 'ep-bewaar') { bewaarEpBestand(); return; }
    if (actie === 'ep-wis') {
      if (!confirm('De opgehaalde energielabels weggooien en opnieuw beginnen?')) return;
      ep = {}; epOpgehaald = null; epGewijzigd = false; epMelding = ''; epFouten = 0;
      try { localStorage.removeItem(OPSLAG_EP); } catch (e) {}
      teken(); return;
    }
    if (actie === 'woz-wis') {
      if (!confirm('De opgehaalde WOZ-waarden weggooien en opnieuw beginnen? Dat kost weer zes dagen aan bevragingen.')) return;
      woz = {}; wozOpgehaald = null; wozGewijzigd = false; wozMelding = ''; wozFouten = 0;
      try { localStorage.removeItem(OPSLAG_WOZ); } catch (e) {}
      teken(); return;
    }
    if (actie === 'bewaar-clusters') { bewaarClusters(); return; }
    if (actie === 'bewaar-handmatig') { bewaarHandmatig(); return; }
    if (actie === 'verwerp') {
      if (confirm('Alle wijzigingen sinds de laatste download weggooien?')) {
        clusters = (typeof VVE_CLUSTERS !== 'undefined') ? kopie(VVE_CLUSTERS) : [];
        handmatig = (typeof VVE_HANDMATIG !== 'undefined') ? kopie(VVE_HANDMATIG) : [];
        werkOpgeslagen();
      }
      return;
    }

    if (actie === 'cluster-nieuw') {
      var naam = prompt('Naam van het cluster (wordt ook de mapnaam):', '');
      if (naam === null) return;
      naam = naam.trim();
      if (!naam) return;
      if (VERBODEN.test(naam)) { alert('Deze tekens mogen niet in een mapnaam: \\ / : * ? " < > |'); return; }
      if (!naamVrij(naam, null)) { alert('Er is al een cluster met deze naam.'); return; }
      if (mapnaamBotst(naam)) { alert('Let op: er bestaat al een VvE-map met deze naam. Kies iets anders.'); return; }
      var nieuw = { id: volgendId(clusters, 'CL-'), naam: naam, vves: [], status: '', toelichting: '' };
      clusters.push(nieuw);
      gekozenCluster = nieuw.id;
      zoekterm = '';
      bewaarWerk();
      return;
    }
    if (actie === 'cluster-kies') { gekozenCluster = id; zoekterm = ''; teken(); return; }
    if (actie === 'cluster-hernoem') {
      var c = cluster(gekozenCluster);
      var nw = prompt('Nieuwe naam (de map wordt bij de volgende scriptronde hernoemd):', c.naam || '');
      if (nw === null) return;
      nw = nw.trim();
      if (!nw) return;
      if (VERBODEN.test(nw)) { alert('Deze tekens mogen niet in een mapnaam: \\ / : * ? " < > |'); return; }
      if (!naamVrij(nw, c.id)) { alert('Er is al een cluster met deze naam.'); return; }
      c.naam = nw;
      bewaarWerk();
      return;
    }
    if (actie === 'cluster-weg') {
      var c2 = cluster(gekozenCluster);
      if (confirm('Cluster "' + (c2.naam || c2.id) + '" verwijderen?\n\nDe map in SharePoint blijft staan; die haal je zelf weg.')) {
        clusters = clusters.filter(function (x) { return x.id !== c2.id; });
        gekozenCluster = null;
        bewaarWerk();
      }
      return;
    }
    if (actie === 'lid-weg') {
      var c3 = cluster(gekozenCluster);
      c3.vves = (c3.vves || []).filter(function (v) { return kort(v) !== kort(id); });
      bewaarWerk();
      return;
    }
    if (actie === 'lid-erbij') {
      var c4 = cluster(gekozenCluster);
      c4.vves = c4.vves || [];
      if (!c4.vves.some(function (v) { return kort(v) === kort(id); })) c4.vves.push(kort(id));
      bewaarWerk();
      return;
    }

    if (actie === 'hand-nieuw') { bewerkHandmatig = 'nieuw'; teken(); return; }
    if (actie === 'hand-kies') { bewerkHandmatig = id; teken(); return; }
    if (actie === 'hand-annuleer') { bewerkHandmatig = null; teken(); return; }
    if (actie === 'hand-weg') {
      var h = handmatig.find(function (x) { return x.id === id; });
      if (confirm('"' + (h.naam || h.id) + '" verwijderen uit vve_handmatig.inc?')) {
        handmatig = handmatig.filter(function (x) { return x.id !== id; });
        bewerkHandmatig = null;
        bewaarWerk();
      }
      return;
    }
  });

  app.addEventListener('submit', function (e) {
    var f = e.target.closest('form[data-actie="hand-opslaan"]');
    if (!f) return;
    e.preventDefault();
    var nieuw = bewerkHandmatig === 'nieuw';
    var h = nieuw ? { id: volgendId(handmatig, 'HAND-') } : handmatig.find(function (x) { return x.id === bewerkHandmatig; });
    HANDMATIG_VELDEN.forEach(function (v) {
      var waarde = (f.elements[v.key].value || '').trim();
      if (!waarde) { delete h[v.key]; return; }
      h[v.key] = v.getal && /^\d+$/.test(waarde) ? parseInt(waarde, 10) : waarde;
    });
    if (f.elements.mini.checked) h.mini = true; else delete h.mini;
    if (nieuw) handmatig.push(h);
    bewerkHandmatig = h.id;
    bewaarWerk();
  });

  app.addEventListener('change', function (e) {
    if (e.target.getAttribute('data-actie') === 'woz-ronde') {
      wozRonde = e.target.value || '';
      teken();
    }
  });

  app.addEventListener('input', function (e) {
    var el = e.target;
    if (el.classList.contains('bh-zoek')) {
      zoekterm = el.value;
      var pos = el.selectionStart;
      teken();
      var z = app.querySelector('.bh-zoek');
      if (z) { z.focus(); try { z.setSelectionRange(pos, pos); } catch (x) {} }
      return;
    }
    if (el.classList.contains('bh-veld')) {
      var c = cluster(gekozenCluster);
      if (!c) return;
      c[el.getAttribute('data-veld')] = el.value;
      vuil = true;
      try { localStorage.setItem(OPSLAG, JSON.stringify({ vuil: true, clusters: clusters, handmatig: handmatig })); } catch (x) {}
    }
  });

  window.addEventListener('beforeunload', function (e) {
    if (!vuil) return;
    e.preventDefault();
    e.returnValue = '';
  });

  teken();
  try { console.info('VvE-beheer versie ' + VERSIE); } catch (e) {}
})();
