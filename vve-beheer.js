// VvE-beheer — clusters en handmatig toegevoegde VvE's bijhouden.
// Aparte tool, los van het dashboard: hier wordt data gemaakt, daar gebruikt.
// Leest vve_data.js, vve_mapnamen.js, vve_handmatig.txt en vve_clusters.txt;
// schrijft die laatste twee als download terug.
(function () {
  'use strict';

  var VERSIE = 3;
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
      + '// Zet dit bestand naast vve_dashboard.html. Niet naar GitHub.\n\n';
  }
  function bewaarClusters() {
    download('vve_clusters.txt', kopTekst('vve_clusters.txt', 'clusters van VvE’s die samen een proces ingaan')
      + 'const VVE_CLUSTERS = ' + JSON.stringify(clusters, null, 2) + ';\n');
    werkOpgeslagen();
  }
  function bewaarHandmatig() {
    download('vve_handmatig.txt', kopTekst('vve_handmatig.txt', 'VvE’s die nog niet in de centrale dataset zitten')
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
    var tekst = '// pand_hoogte_data.js - gebouwgegevens uit de 3D BAG (api.3dbag.nl)\n'
      + '// grond = grondvlak in m2 (b3_opp_grond, de footprint), h = nok minus maaiveld,\n'
      + '// opp = dakoppervlak, dak = daktype, bouwlagen = aantal lagen.\n'
      + '// Opgehaald met de beheertool op ' + new Date().toLocaleString('nl-NL') + ': '
      + Object.keys(panden).length + ' panden, ' + pandenMetGrond() + ' met grondvlak.\n\n'
      + 'const PAND_HOOGTE_DATA = ' + JSON.stringify(panden) + ';\n';
    download('pand_hoogte_data.inc', tekst);
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
        + (pandenGewijzigd ? '<button class="bh-knop is-primair" data-actie="pand-bewaar">pand_hoogte_data.inc downloaden</button>' : '')
        + '</div>';
      if (ophalenFout) uit += '<p class="bh-hint">' + ophalenFout + ' panden gaven een fout; die staan nog bij \u201cnog op te halen\u201d.</p>';
    }
    uit += '<p class="bh-hint">Na het downloaden zet je pand_hoogte_data.inc naast het dashboard; .js, .inc en .txt worden alle drie gelezen, '
      + 'dus kies de extensie die door jullie beveiliging komt. Zolang dat niet gebeurd is, '
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
    + 'warmteprogramma,warmteprogramma_tijdvak,oppervlakte,bouwjaar_gerelateerd_pand';
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
  // net zoals pandid_warmteprogramma.js die altijd aanleverde.
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
            bj: p.bouwjaar_gerelateerd_pand || null
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

  // Wat wijkt af van wat nu in vve_data.js staat?
  function bronVerschillen() {
    var kanWarmteVergelijken = (typeof getWarmteprogramma === 'function');
    var uit = { label: 0, mon: 0, warmte: kanWarmteVergelijken ? 0 : null, opp: 0 };
    RIJEN.forEach(function (r) {
      var b = bron[String(r.verblijfsobject_id)];
      if (!b) return;
      if (b.label && b.label !== r.energielabel) uit.label++;
      if (b.mon && b.mon !== r.monumentale_status) uit.mon++;
      if (b.opp && Number(b.opp) !== Number(r.oppervlakte)) uit.opp++;
      // Zonder pandid_warmteprogramma.js valt er niets te vergelijken; dan
      // zou elk adres als afwijkend tellen en dat zegt niets.
      if (!kanWarmteVergelijken) return;
      var huidig = r.gerelateerd_pand_id
        ? getWarmteprogramma(String(r.gerelateerd_pand_id).split(',')[0].trim()) : null;
      if (b.warmte && (!huidig || huidig.warmte !== b.warmte)) uit.warmte++;
    });
    return uit;
  }

  function bewaarBronBestand() {
    var tekst = '// bron_haarlem.inc - adresgegevens uit de WFS van de gemeente Haarlem\n'
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
      + '//\n'
      + '// Het dashboard zet deze waarden over die uit vve_data.js heen.\n'
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
      + 'het beschermd gezicht, het warmteprogramma met tijdvak, de oppervlakte, het bouwjaar en het '
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
    uit += '<p class="bh-hint">Na het downloaden zet je bron_haarlem.inc naast het dashboard; dat gebruikt de nieuwe '
      + 'waarden boven die uit vve_data.js. WOZ-waarden komen in een volgende ronde, via het Kadaster.</p></div>';
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
      + '<p class="bh-sub">Clusters en handmatig toegevoegde VvE’s. Wijzigingen bewaar je door de bestanden te downloaden en naast het dashboard te zetten.</p>'
      + '<nav class="bh-tabs">'
      + '<button class="bh-tab' + (tab === 'clusters' ? ' is-actief' : '') + '" data-actie="tab" data-tab="clusters">Clusters <span class="bh-telling">' + clusters.length + '</span></button>'
      + '<button class="bh-tab' + (tab === 'handmatig' ? ' is-actief' : '') + '" data-actie="tab" data-tab="handmatig">Handmatige VvE’s <span class="bh-telling">' + handmatig.length + '</span></button>'
      + '<button class="bh-tab' + (tab === 'panden' ? ' is-actief' : '') + '" data-actie="tab" data-tab="panden">Panddata <span class="bh-telling">' + pandenMetGrond() + '</span></button>'
      + '<button class="bh-tab' + (tab === 'bron' ? ' is-actief' : '') + '" data-actie="tab" data-tab="bron">Brondata</button>'
      + '</nav></div></header>';

    if (vuil) {
      html += '<div class="bh-balk bh-in"><span>Er zijn wijzigingen die nog niet in een bestand staan.</span>'
        + '<button class="bh-knop is-primair" data-actie="bewaar-clusters">vve_clusters.txt downloaden</button>'
        + '<button class="bh-knop is-primair" data-actie="bewaar-handmatig">vve_handmatig.txt downloaden</button>'
        + '<button class="bh-knop" data-actie="verwerp">Wijzigingen weggooien</button></div>';
    }

    html += '<main class="bh-in">'
      + (tab === 'clusters' ? tekenClusters() : tab === 'handmatig' ? tekenHandmatig()
         : tab === 'panden' ? tekenPanden() : tekenBron())
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
      if (confirm('"' + (h.naam || h.id) + '" verwijderen uit vve_handmatig.txt?')) {
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
