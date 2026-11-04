// vve-export.js — exportdialoog van het VvE-dashboard
//
// Vervangt het oude Export-menu. In één venster stel je de export samen:
//   - voor wie of wat de export is (doelgroep), met een omschrijving;
//   - per VvE of per adres, als Excel of als CSV;
//   - welke onderdelen (en eventueel welke losse kolommen) erin komen.
// Een doelgroep is een startpunt: hij zet niveau, bestand en onderdelen klaar,
// daarna kun je alles nog aanpassen. Een Excel krijgt een tweede tabblad
// 'Over deze export' met doelgroep, omschrijving, datum, maker en selectie,
// zodat je later nog weet wat je met wie hebt gedeeld. Het eerste tabblad
// blijft de data, zodat 'Importeer Excel' de intern-export gewoon weer leest.
//
// Het dashboard kent de gegevens en levert de kolommen (met een functie die
// de waarde uit een rij haalt). Dit bestand kent alleen de onderdelen en de
// doelgroepen en maakt het venster en het bestand.
//
// Gebruik vanuit het dashboard:
//   VveExport.open({
//     kolommen: [{ key, kop, groep, niveau?: 'vve'|'adres', waarde: rij => ..,
//                  breed?, fmt?, midden?, invoer?, link?: rij => url, adv? }],
//     rijen: { vve: () => [...], adres: () => [...] },
//     aantal: { vve, adres }, slug, selectie, gebruiker,
//     intakeBeschikbaar, laadExcel: async () => ExcelJS,
//     extra: [{ label, uitleg, aantal, actie }]
//   })

(function () {
  'use strict';

  // ── onderdelen ──────────────────────────────────────────────────────
  // intern: hoort niet bij een externe partij. persoon: persoonsgegevens.
  var GROEPEN = [
    { id: 'ident', titel: 'Identificatie', uitleg: 'VvE-identificatie, naam, KvK-nummer en nickname' },
    { id: 'adres', titel: 'Adres en ligging', uitleg: 'Straat, huisnummers, postcode, buurt, wijk en stadsdeel' },
    { id: 'gebouw', titel: 'Gebouw', uitleg: 'Woningen, bouwjaar, typologie, WOZ, energielabel en monumentstatus' },
    { id: 'warmte', titel: 'Warmteprogramma', uitleg: 'Tijdvak en warmtevoorziening' },
    { id: 'corporatie', titel: 'Corporatiebezit', uitleg: 'Gespikkeld, aandeel en naam van de corporatie' },
    { id: 'bag', titel: 'BAG-sleutels', uitleg: 'Pand- en verblijfsobject-id’s' },
    { id: 'traject', titel: 'Adviestraject', uitleg: 'Traject, fasen, bureau, procesbegeleider en beheerder' },
    { id: 'dossier', titel: 'Dossier en cluster', uitleg: 'Dossiermap, dossierstatus, huidige locatie en cluster', intern: true },
    { id: 'notities', titel: 'Notities', uitleg: 'De vrije notities uit het dossier', intern: true },
    { id: 'contact', titel: 'Contactpersonen', uitleg: 'Naam, e-mail en telefoon van bestuur en duurzaamheid', persoon: true },
    { id: 'intake', titel: 'Intake-antwoorden', uitleg: 'De antwoorden uit het intakeformulier, één kolom per vraag' },
    { id: 'score', titel: 'Kansrijkheid', uitleg: 'Kansrijkheidsscore en volledigheid van de intake', intern: true }
  ];
  var groepVan = function (id) { return GROEPEN.filter(function (g) { return g.id === id; })[0] || { id: id, titel: id }; };

  // ── doelgroepen ─────────────────────────────────────────────────────
  // groepen: deze onderdelen helemaal. alleen: precies deze kolommen.
  // zonder: deze kolommen niet. intakeAdv: van de intake alleen de vragen
  // die voor het adviesbureau zijn bedoeld (a: true in intake_vragen.inc).
  var DOELGROEPEN = [
    { id: 'intern', titel: 'Intern team', sub: 'Werklijst met dossier en traject. De gele kolommen lees je weer in met Importeer Excel.',
      niveau: 'vve', formaat: 'xlsx', groepen: ['ident', 'dossier', 'traject', 'notities', 'adres', 'gebouw', 'warmte', 'corporatie'],
      prefix: { vve: 'dashboard-data', adres: 'dashboard-adressen' } },
    { id: 'adviesbureau', titel: 'Adviesbureau', sub: 'Overdracht van VvE’s: gebouw, contactpersonen en de intakevragen voor het bureau. Zonder score en notities.',
      extern: true, niveau: 'vve', formaat: 'xlsx', groepen: ['ident', 'contact', 'adres', 'gebouw', 'warmte', 'corporatie', 'bag', 'intake'],
      zonder: ['id', 'nickname'], intakeAdv: true },
    { id: 'voortgang', titel: 'Voortgang en rapportage', sub: 'Stand van het traject per VvE, met kansrijkheid. Zonder persoonsgegevens.',
      niveau: 'vve', formaat: 'xlsx', groepen: ['ident', 'adres', 'gebouw', 'warmte', 'traject', 'score'], zonder: ['id', 'nickname'] },
    { id: 'monitoring', titel: 'Monitoringtool', sub: 'Adressen met BAG-sleutels als referentie bij een aanlevering (splits_aanlevering.py).',
      niveau: 'adres', formaat: 'csv',
      alleen: ['id', 'vve_identificatie', 'statutairenaam', 'kvknummer', 'straatnaam', 'huisnummer', 'huisletter', 'huisnummertoevoeging', 'postcode', 'verblijfsobject_id', 'gerelateerd_pand_id'],
      prefix: { vve: 'dashboard-data', adres: 'dashboard-adressen' } },
    { id: 'adreslijst', titel: 'Adreslijst', sub: 'Eén regel per adres, voor een brief of een huisbezoek.',
      niveau: 'adres', formaat: 'xlsx', alleen: ['statutairenaam', 'straatnaam', 'huisnummer', 'huisletter', 'huisnummertoevoeging', 'postcode', 'buurt', 'wijk'] },
    { id: 'eigen', titel: 'Eigen samenstelling', sub: 'Begint bij wat je de vorige keer zelf hebt samengesteld.', niveau: 'vve', formaat: 'xlsx' }
  ];
  var doelgroepVan = function (id) { return DOELGROEPEN.filter(function (d) { return d.id === id; })[0] || DOELGROEPEN[0]; };

  // ── onthouden (alleen in deze browser) ──────────────────────────────
  var OPSLAG = 'vve_export_keuze';
  var leesOpslag = function () {
    try { return JSON.parse(localStorage.getItem(OPSLAG) || '{}') || {}; } catch (e) { return {}; }
  };
  var schrijfOpslag = function (o) {
    try { localStorage.setItem(OPSLAG, JSON.stringify(o)); } catch (e) {}
  };

  var esc = function (s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };
  var toSlug = function (s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  };
  var leeg = function (v) { return v == null || v === ''; };

  // ── stijl ───────────────────────────────────────────────────────────
  var STIJL = '\
.ve-achter{position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:10000;display:flex;align-items:center;justify-content:center;padding:24px;font-family:"Segoe UI",system-ui,-apple-system,sans-serif;font-size:13px;color:#323130}\
.ve-paneel{background:#fff;width:100%;max-width:1040px;max-height:100%;display:flex;flex-direction:column;box-shadow:0 8px 32px rgba(0,0,0,.25);min-height:0}\
.ve-kop{display:flex;align-items:baseline;gap:12px;padding:12px 18px;border-bottom:1px solid #e1dfdd}\
.ve-kop h2{font-size:16px;font-weight:600;margin:0}\
.ve-kop .ve-sub{flex:1;font-size:12px;color:#605e5c;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\
.ve-sluit{border:0;background:none;font-size:20px;line-height:1;color:#605e5c;cursor:pointer;padding:0 4px}\
.ve-romp{display:flex;flex:1;min-height:0}\
.ve-links{width:290px;flex-shrink:0;border-right:1px solid #e1dfdd;background:#faf9f8;overflow:auto;padding:12px 0}\
.ve-rechts{flex:1;min-width:0;overflow:auto;padding:12px 20px 20px}\
.ve-titel{font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:#605e5c;margin:0 14px 6px}\
.ve-rechts .ve-titel{margin:16px 0 6px}\
.ve-rechts .ve-titel:first-child{margin-top:0}\
.ve-dg{display:block;width:100%;text-align:left;border:0;border-left:3px solid transparent;background:none;padding:7px 14px;cursor:pointer;font:inherit;color:inherit}\
.ve-dg:hover{background:#f3f2f1}\
.ve-dg b{display:block;font-weight:600}\
.ve-dg small{display:block;color:#605e5c;font-size:11.5px;line-height:1.35;margin-top:1px}\
.ve-dg.is-aan{border-left-color:var(--vd-accent,#217346);background:#fff}\
.ve-dg.is-aan b{color:var(--vd-accent-donker,#1a5c38)}\
.ve-tag{display:inline-block;font-size:10px;font-weight:600;padding:0 4px;margin-left:6px;border:1px solid #c8c6c4;color:#605e5c;vertical-align:1px;white-space:nowrap}\
.ve-tag.extern{border-color:#0078d4;color:#0066b8}\
.ve-tag.intern{border-color:#a4262c;color:#a4262c}\
.ve-tag.persoon{border-color:#c19c00;color:#8a6d00}\
.ve-extra{border-top:1px solid #e1dfdd;margin-top:12px;padding-top:12px}\
.ve-extra button{display:flex;justify-content:space-between;gap:8px;width:100%;text-align:left;border:0;background:none;padding:5px 14px;cursor:pointer;font:inherit;font-size:12px;color:#323130}\
.ve-extra button:hover{background:#f3f2f1}\
.ve-extra button span:last-child{color:#a19f9d;font-variant-numeric:tabular-nums}\
.ve-inv{font:inherit;padding:5px 8px;border:1px solid #c8c6c4;width:100%;box-sizing:border-box}\
.ve-inv:focus{outline:none;border-color:var(--vd-accent,#217346)}\
.ve-rij{display:flex;flex-wrap:wrap;gap:18px}\
.ve-keus{display:inline-flex}\
.ve-keus button{font:inherit;padding:4px 12px;border:1px solid #c8c6c4;background:#fff;cursor:pointer;margin-right:-1px}\
.ve-keus button.is-aan{border-color:var(--vd-accent,#217346);background:var(--vd-accent-licht,#f0faf4);color:var(--vd-accent-donker,#1a5c38);position:relative}\
.ve-keus small{display:block;font-size:11px;color:#605e5c;margin-top:3px}\
.ve-groep{border-bottom:1px solid #f3f2f1}\
.ve-groep>header{display:flex;align-items:center;gap:8px;padding:6px 0}\
.ve-groep>header label{display:flex;align-items:center;gap:8px;flex:1;min-width:0;cursor:pointer}\
.ve-groep>header label span{min-width:0}\
.ve-groep>header label small{display:block;color:#605e5c;font-size:11.5px}\
.ve-groep.is-uit>header label b{color:#8a8886;font-weight:600}\
.ve-groep.nvt{opacity:.55}\
.ve-teller{font-size:11px;color:#605e5c;font-variant-numeric:tabular-nums;white-space:nowrap}\
.ve-open{border:0;background:none;color:#0066b8;cursor:pointer;font:inherit;font-size:12px;padding:2px 4px;white-space:nowrap}\
.ve-kols{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:2px 14px;padding:0 0 8px 26px}\
.ve-kols label{display:flex;align-items:flex-start;gap:6px;font-size:12px;cursor:pointer;line-height:1.35}\
.ve-kols label input{margin-top:2px}\
.ve-kols .ve-snel{grid-column:1/-1;font-size:12px;color:#605e5c;margin-bottom:2px}\
.ve-kols .ve-snel button{border:0;background:none;color:#0066b8;cursor:pointer;font:inherit;padding:0 2px}\
.ve-melding{padding:8px 10px;margin:10px 0 0;font-size:12px;line-height:1.45;border-left:3px solid}\
.ve-melding.rood{background:#fdf3f4;border-color:#a4262c;color:#6e1a1e}\
.ve-melding.geel{background:#fff8e1;border-color:#c19c00;color:#5c4a00}\
.ve-melding.blauw{background:#eff6fc;border-color:#0078d4;color:#004578}\
.ve-melding button{border:0;background:none;color:inherit;text-decoration:underline;cursor:pointer;font:inherit;padding:0}\
.ve-voet{display:flex;align-items:center;flex-wrap:wrap;gap:8px 12px;padding:10px 18px;border-top:1px solid #e1dfdd;background:#faf9f8}\
.ve-voet .ve-naam{flex:1;min-width:220px;display:flex;align-items:center;gap:6px}\
.ve-voet .ve-naam input{font-family:Consolas,monospace;font-size:12px}\
.ve-voet .ve-ext{font-family:Consolas,monospace;font-size:12px;color:#605e5c}\
.ve-voet .ve-status{font-size:12px;color:#605e5c;white-space:nowrap}\
.ve-voet label{display:flex;align-items:center;gap:5px;font-size:12px;white-space:nowrap;cursor:pointer}\
.ve-knop{font:600 13px "Segoe UI",system-ui,sans-serif;padding:6px 16px;border:1px solid #8a8886;background:#fff;color:#323130;cursor:pointer}\
.ve-knop:hover{background:#f3f2f1}\
.ve-knop.hoofd{background:var(--vd-accent,#217346);border-color:var(--vd-accent,#217346);color:#fff}\
.ve-knop.hoofd:hover{background:var(--vd-accent-donker,#1a5c38)}\
.ve-knop[disabled]{opacity:.5;cursor:default}\
@media (max-width:760px){.ve-achter{padding:0}.ve-romp{flex-direction:column;overflow:auto}.ve-links,.ve-rechts{width:auto;overflow:visible;border-right:0}.ve-links{border-bottom:1px solid #e1dfdd}}';

  var stijlGezet = false;
  var zetStijl = function () {
    if (stijlGezet) return;
    var st = document.createElement('style');
    st.textContent = STIJL;
    document.head.appendChild(st);
    stijlGezet = true;
  };

  // ── bestand maken ───────────────────────────────────────────────────
  var download = function (blob, naam) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = naam;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  };

  var csvWaarde = function (v) {
    if (leeg(v)) return '';
    if (typeof v === 'number') return String(v).replace('.', ',');
    var s = String(v);
    return /[;"\n\r]/.test(s) || s !== s.trim() ? '"' + s.replace(/"/g, '""') + '"' : s;
  };

  var maakCsv = function (kols, rijen) {
    var regels = [kols.map(function (k) { return k.key; }).join(';')];
    rijen.forEach(function (r) {
      regels.push(kols.map(function (k) {
        var v = k.waarde(r);
        // Een percentage staat als fractie klaar voor Excel; in CSV als getal.
        if (k.fmt === '0.0%' && typeof v === 'number') v = Math.round(v * 1000) / 10;
        return csvWaarde(v);
      }).join(';'));
    });
    return new Blob(['﻿' + regels.join('\n')], { type: 'text/csv;charset=utf-8;' });
  };

  var KOPSTIJL = function (cell) {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10, name: 'Calibri' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF742774' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false };
    cell.border = { bottom: { style: 'medium', color: { argb: 'FF5C1F5C' } } };
  };

  var maakXlsx = async function (ExcelJS, kols, rijen, meta) {
    var wb = new ExcelJS.Workbook();
    wb.creator = 'VvE Dashboard Haarlem';
    wb.created = new Date();
    var ws = wb.addWorksheet(meta.niveau === 'adres' ? 'Adressen' : 'VvE data', {
      views: [{ state: 'frozen', xSplit: 0, ySplit: 1, activeCell: 'A2' }]
    });
    ws.columns = kols.map(function (k) { return { header: k.kop, key: k.key, width: k.breed || 14 }; });
    var kop = ws.getRow(1);
    kop.height = 20;
    kop.eachCell(KOPSTIJL);
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: Math.max(1, kols.length) } };

    var dotted = { style: 'dotted', color: { argb: 'FFCCCCCC' } };
    var rand = { top: dotted, left: dotted, bottom: dotted, right: dotted };
    var naamKol = kols.filter(function (k) { return k.key === 'statutairenaam'; })[0];
    var maxNaam = 16;
    rijen.forEach(function (r, idx) {
      var waarden = {};
      kols.forEach(function (k) {
        var v = k.waarde(r);
        waarden[k.key] = leeg(v) ? null : v;
      });
      var row = ws.addRow(waarden);
      var bg = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF5F3FF';
      var naamLen = naamKol ? String(waarden.statutairenaam || '').length : 0;
      maxNaam = Math.max(maxNaam, naamLen);
      row.height = naamLen > 45 ? 28 : 15;
      kols.forEach(function (k, i) {
        var cell = row.getCell(i + 1);
        cell.font = { size: 10, name: 'Calibri' };
        cell.alignment = k.midden ? { vertical: 'middle', horizontal: 'center' } : (k.wrap ? { vertical: 'middle', wrapText: true } : { vertical: 'middle' });
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: k.invoer ? 'FFFEF9C3' : bg } };
        cell.border = rand;
        if (k.fmt && typeof cell.value === 'number') cell.numFmt = k.fmt;
        if (k.link && cell.value != null) {
          var url = k.link(r);
          if (url) {
            cell.value = { text: String(cell.value), hyperlink: String(url) };
            cell.font = { size: 10, name: 'Calibri', color: { argb: 'FF0563C1' }, underline: true };
          }
        }
      });
    });
    // Naamkolom breed genoeg voor ten hoogste twee regels
    if (naamKol) ws.getColumn('statutairenaam').width = Math.max(20, Math.min(Math.ceil(maxNaam / 2 * 1.2), 50));

    if (meta.over) {
      var wo = wb.addWorksheet('Over deze export');
      wo.columns = [{ key: 'a', width: 24 }, { key: 'b', width: 90 }];
      var regels = [
        ['Doelgroep', meta.doelgroep],
        ['Voor wie / waarvoor', meta.omschrijving || '–'],
        ['Gemaakt op', meta.datum],
        ['Door', meta.door || '–'],
        ['Selectie in het dashboard', meta.selectie],
        ['Niveau', meta.niveau === 'adres' ? 'Eén regel per adres' : 'Eén regel per VvE'],
        ['Aantal regels', rijen.length],
        ['Onderdelen', meta.onderdelen.join(', ')]
      ];
      meta.meldingen.forEach(function (m) { regels.push(['Let op', m]); });
      regels.forEach(function (rg) {
        var row = wo.addRow({ a: rg[0], b: rg[1] });
        row.getCell(1).font = { bold: true, size: 10, name: 'Calibri' };
        row.getCell(2).font = { size: 10, name: 'Calibri' };
        row.getCell(2).alignment = { wrapText: true, vertical: 'top', horizontal: 'left' };
        row.getCell(1).alignment = { vertical: 'top' };
      });
      wo.addRow({});
      var kk = wo.addRow({ a: 'Onderdeel', b: 'Kolom' });
      kk.eachCell(KOPSTIJL);
      kols.forEach(function (k) {
        var row = wo.addRow({ a: groepVan(k.groep).titel, b: k.kop });
        row.eachCell(function (c) { c.font = { size: 10, name: 'Calibri' }; });
      });
    }
    var buffer = await wb.xlsx.writeBuffer();
    return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  };

  // ── venster ─────────────────────────────────────────────────────────
  var open = function (opt) {
    zetStijl();
    var alleKols = (opt.kolommen || []).filter(function (k) { return k && k.key && typeof k.waarde === 'function'; });
    var opslag = leesOpslag();
    var st = {
      doelgroep: null, niveau: 'vve', formaat: 'xlsx', kol: new Set(),
      omschrijving: '', naam: null, over: opslag.over !== false, aangepast: false,
      open: {}, bezig: false
    };

    var kolsVoor = function (niveau) {
      return alleKols.filter(function (k) { return !k.niveau || k.niveau === niveau; });
    };
    var gekozen = function () {
      return kolsVoor(st.niveau).filter(function (k) { return st.kol.has(k.key); });
    };

    var kiesDoelgroep = function (id) {
      var d = doelgroepVan(id);
      st.doelgroep = d.id;
      st.aangepast = false;
      st.naam = null;
      st.omschrijving = (opslag.omschrijving && opslag.omschrijving[d.id]) || '';
      if (d.id === 'eigen') {
        var e = opslag.eigen || {};
        st.niveau = e.niveau === 'adres' ? 'adres' : 'vve';
        st.formaat = e.formaat === 'csv' ? 'csv' : 'xlsx';
        st.kol = new Set(Array.isArray(e.kol) && e.kol.length ? e.kol : kolsVoor(st.niveau).filter(function (k) { return ['ident', 'adres', 'gebouw'].indexOf(k.groep) >= 0; }).map(function (k) { return k.key; }));
        return;
      }
      st.niveau = d.niveau;
      st.formaat = d.formaat;
      var kols = kolsVoor(d.niveau);
      if (d.alleen) {
        st.kol = new Set(d.alleen);
      } else {
        st.kol = new Set(kols.filter(function (k) {
          if ((d.groepen || []).indexOf(k.groep) < 0) return false;
          if ((d.zonder || []).indexOf(k.key) >= 0) return false;
          if (k.groep === 'intake' && d.intakeAdv && !k.adv) return false;
          return true;
        }).map(function (k) { return k.key; }));
      }
    };

    var wijzig = function () { st.aangepast = true; teken(); };

    var wisselNiveau = function (niveau) {
      if (niveau === st.niveau) return;
      var oud = kolsVoor(st.niveau);
      var nieuw = kolsVoor(niveau);
      var heel = {};
      GROEPEN.forEach(function (g) {
        var inG = oud.filter(function (k) { return k.groep === g.id; });
        heel[g.id] = inG.length > 0 && inG.every(function (k) { return st.kol.has(k.key); });
      });
      var sel = new Set();
      nieuw.forEach(function (k) { if (st.kol.has(k.key) || heel[k.groep]) sel.add(k.key); });
      st.kol = sel;
      st.niveau = niveau;
      wijzig();
    };

    var dg = function () { return doelgroepVan(st.doelgroep); };

    var meldingen = function () {
      var uit = [];
      var kols = gekozen();
      var groepenAan = GROEPEN.filter(function (g) { return kols.some(function (k) { return k.groep === g.id; }); });
      var intern = groepenAan.filter(function (g) { return g.intern; });
      if (dg().extern && intern.length) {
        uit.push({ kleur: 'rood', tekst: 'Deze export is voor een externe partij, maar bevat interne gegevens: ' + intern.map(function (g) { return g.titel; }).join(', ') + '. Haal die weg, tenzij je zeker weet dat het mag.', haalWeg: intern.map(function (g) { return g.id; }) });
      } else if (intern.length && st.doelgroep !== 'intern') {
        uit.push({ kleur: 'blauw', tekst: 'Bevat interne gegevens (' + intern.map(function (g) { return g.titel; }).join(', ') + '). Niet doorsturen buiten het team.' });
      }
      if (groepenAan.some(function (g) { return g.persoon; })) {
        uit.push({ kleur: 'geel', tekst: 'Bevat persoonsgegevens van contactpersonen. Deel het bestand alleen via een beveiligde weg en bewaar het niet langer dan nodig.' });
      }
      if (dg().extern && !st.omschrijving.trim()) {
        uit.push({ kleur: 'blauw', tekst: 'Vul hierboven in voor welk bureau en waarvoor. Dat komt in het bestand, zodat later na te gaan is wat je met wie hebt gedeeld.' });
      }
      if (st.formaat === 'csv' && st.over) {
        uit.push({ kleur: 'blauw', tekst: 'Een CSV heeft geen tweede tabblad: de omschrijving en de selectie komen alleen in een Excel-bestand mee.' });
      }
      return uit;
    };

    var autoNaam = function () {
      var d = dg();
      var basis = d.prefix && d.prefix[st.niveau] ? d.prefix[st.niveau]
        : (d.id === 'eigen' || d.id === 'intern' ? (st.niveau === 'adres' ? 'vve-adressen' : 'vve-export') : toSlug(d.titel));
      var delen = [basis];
      var o = toSlug(st.omschrijving).slice(0, 40).replace(/-+$/, '');
      if (o) delen.push(o);
      delen.push(opt.slug || 'alle-vves');
      return delen.join('-');
    };
    var bestandsnaam = function () {
      var n = st.naam != null ? st.naam : autoNaam();
      n = String(n).trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\.(xlsx|csv)$/i, '') || autoNaam();
      return n + '.' + st.formaat;
    };

    // DOM
    var achter = document.createElement('div');
    achter.className = 've-achter';
    achter.innerHTML = '<div class="ve-paneel" role="dialog" aria-modal="true" aria-labelledby="ve-h">'
      + '<div class="ve-kop"><h2 id="ve-h">Exporteren</h2><span class="ve-sub"></span><button class="ve-sluit" type="button" title="Sluiten (Esc)" aria-label="Sluiten">×</button></div>'
      + '<div class="ve-romp"><div class="ve-links"></div><div class="ve-rechts"></div></div>'
      + '<div class="ve-voet"></div></div>';
    var paneel = achter.firstChild;
    var links = achter.querySelector('.ve-links');
    var rechts = achter.querySelector('.ve-rechts');
    var voet = achter.querySelector('.ve-voet');
    achter.querySelector('.ve-sub').textContent = [
      (opt.aantal && opt.aantal.vve != null ? opt.aantal.vve.toLocaleString('nl-NL') + ' VvE’s' : ''),
      (opt.aantal && opt.aantal.adres != null ? opt.aantal.adres.toLocaleString('nl-NL') + ' adressen' : ''),
      opt.selectie ? 'selectie: ' + opt.selectie : ''
    ].filter(Boolean).join(' · ');

    var sluit = function () {
      document.removeEventListener('keydown', toets, true);
      achter.remove();
    };
    var toets = function (e) {
      if (e.key === 'Escape') { e.stopPropagation(); sluit(); }
    };
    document.addEventListener('keydown', toets, true);
    achter.addEventListener('mousedown', function (e) { if (e.target === achter) sluit(); });
    achter.querySelector('.ve-sluit').onclick = sluit;

    var tekenLinks = function () {
      var h = '<div class="ve-titel">Voor wie of wat?</div>';
      DOELGROEPEN.forEach(function (d) {
        h += '<button type="button" class="ve-dg' + (d.id === st.doelgroep ? ' is-aan' : '') + '" data-dg="' + d.id + '"><b>' + esc(d.titel)
          + (d.extern ? '<span class="ve-tag extern">extern</span>' : '')
          + (d.id === st.doelgroep && st.aangepast ? '<span class="ve-tag">aangepast</span>' : '')
          + '</b><small>' + esc(d.sub) + '</small></button>';
      });
      var extra = (opt.extra || []).filter(function (x) { return x && typeof x.actie === 'function'; });
      if (extra.length) {
        h += '<div class="ve-extra"><div class="ve-titel">Bestanden voor databeheer</div>';
        extra.forEach(function (x, i) {
          h += '<button type="button" data-extra="' + i + '" title="' + esc(x.uitleg || '') + '"><span>' + esc(x.label) + '</span><span>' + (x.aantal != null ? esc(x.aantal) : '') + '</span></button>';
        });
        h += '</div>';
      }
      links.innerHTML = h;
      links.querySelectorAll('[data-dg]').forEach(function (b) {
        b.onclick = function () { kiesDoelgroep(b.getAttribute('data-dg')); teken(); };
      });
      links.querySelectorAll('[data-extra]').forEach(function (b) {
        b.onclick = function () {
          var x = extra[+b.getAttribute('data-extra')];
          var r;
          try { r = x.actie(); } catch (e) { alert('Exporteren mislukt: ' + e.message); return; }
          if (r !== false) sluit();
        };
      });
    };

    var tekenRechts = function () {
      var scroll = rechts.scrollTop;
      var h = '<div class="ve-titel">Voor wie precies, en waarvoor?</div>'
        + '<input class="ve-inv" data-oms maxlength="120" placeholder="' + (dg().extern ? 'Bijv. Bureau De Vries, offerte ronde 2' : 'Bijv. overleg wijkteam Noord, november') + '" value="' + esc(st.omschrijving) + '">'
        + '<div class="ve-rij" style="margin-top:14px">'
        + '<div><div class="ve-titel" style="margin:0 0 6px">Eén regel per</div><div class="ve-keus">'
        + '<button type="button" data-niveau="vve" class="' + (st.niveau === 'vve' ? 'is-aan' : '') + '">VvE</button>'
        + '<button type="button" data-niveau="adres" class="' + (st.niveau === 'adres' ? 'is-aan' : '') + '">Adres</button></div></div>'
        + '<div><div class="ve-titel" style="margin:0 0 6px">Bestand</div><div class="ve-keus">'
        + '<button type="button" data-formaat="xlsx" class="' + (st.formaat === 'xlsx' ? 'is-aan' : '') + '">Excel</button>'
        + '<button type="button" data-formaat="csv" class="' + (st.formaat === 'csv' ? 'is-aan' : '') + '">CSV</button></div></div>'
        + '</div>'
        + '<div class="ve-titel">Wat komt erin?</div>';
      var kols = kolsVoor(st.niveau);
      GROEPEN.forEach(function (g) {
        var inG = kols.filter(function (k) { return k.groep === g.id; });
        var n = inG.filter(function (k) { return st.kol.has(k.key); }).length;
        var nvt = inG.length === 0;
        var uitleg = g.uitleg;
        if (nvt && g.id === 'intake') uitleg = opt.intakeBeschikbaar === false ? 'Niet beschikbaar: config/intake_vragen.inc is niet geladen' : 'Geen vragen gevonden';
        else if (nvt) uitleg = 'Niet bij een export per ' + (st.niveau === 'adres' ? 'adres' : 'VvE');
        h += '<div class="ve-groep' + (n === 0 ? ' is-uit' : '') + (nvt ? ' nvt' : '') + '" data-groep="' + g.id + '"><header><label><input type="checkbox" data-gk' + (nvt ? ' disabled' : '') + (n > 0 && n === inG.length ? ' checked' : '') + '><span><b>' + esc(g.titel) + '</b>'
          + (g.intern ? '<span class="ve-tag intern">intern</span>' : '') + (g.persoon ? '<span class="ve-tag persoon">persoonsgegevens</span>' : '')
          + '<small>' + esc(uitleg) + '</small></span></label>'
          + (nvt ? '' : '<span class="ve-teller">' + n + ' van ' + inG.length + '</span><button type="button" class="ve-open" data-open>' + (st.open[g.id] ? 'minder' : 'kolommen') + '</button>')
          + '</header>';
        if (st.open[g.id] && !nvt) {
          h += '<div class="ve-kols">';
          if (g.id === 'intake' && inG.some(function (k) { return k.adv; })) {
            h += '<div class="ve-snel">Kies: <button type="button" data-snel="alle">alle vragen</button> · <button type="button" data-snel="adv">alleen voor het adviesbureau</button> · <button type="button" data-snel="geen">geen</button></div>';
          }
          inG.forEach(function (k) {
            h += '<label title="' + esc(k.titel || '') + '"><input type="checkbox" data-kol="' + esc(k.key) + '"' + (st.kol.has(k.key) ? ' checked' : '') + '><span>' + esc(k.kop) + (k.adv && g.id === 'intake' ? '<span class="ve-tag">bureau</span>' : '') + '</span></label>';
          });
          h += '</div>';
        }
        h += '</div>';
      });
      h += '<div data-mld></div>';
      rechts.innerHTML = h;
      tekenMeldingen();
      rechts.scrollTop = scroll;

      // gedeeltelijk aangevinkt
      rechts.querySelectorAll('.ve-groep').forEach(function (el) {
        var g = el.getAttribute('data-groep');
        var inG = kols.filter(function (k) { return k.groep === g; });
        var n = inG.filter(function (k) { return st.kol.has(k.key); }).length;
        var cb = el.querySelector('[data-gk]');
        cb.indeterminate = n > 0 && n < inG.length;
        cb.onchange = function () {
          var aan = n < inG.length;
          inG.forEach(function (k) { if (aan) st.kol.add(k.key); else st.kol.delete(k.key); });
          wijzig();
        };
        var op = el.querySelector('[data-open]');
        if (op) op.onclick = function () { st.open[g] = !st.open[g]; teken(); };
        el.querySelectorAll('[data-kol]').forEach(function (c) {
          c.onchange = function () {
            var k = c.getAttribute('data-kol');
            if (c.checked) st.kol.add(k); else st.kol.delete(k);
            wijzig();
          };
        });
        el.querySelectorAll('[data-snel]').forEach(function (b) {
          b.onclick = function () {
            var s = b.getAttribute('data-snel');
            inG.forEach(function (k) {
              if (s === 'alle' || (s === 'adv' && k.adv)) st.kol.add(k.key); else st.kol.delete(k.key);
            });
            wijzig();
          };
        });
      });
      // Alleen voet en meldingen bijwerken: een volledige hertekening zou
      // de klik op een andere knop laten verdwijnen.
      var oms = rechts.querySelector('[data-oms]');
      oms.oninput = function () {
        st.omschrijving = oms.value;
        tekenMeldingen();
        tekenVoet();
      };
      rechts.querySelectorAll('[data-niveau]').forEach(function (b) {
        b.onclick = function () { wisselNiveau(b.getAttribute('data-niveau')); };
      });
      rechts.querySelectorAll('[data-formaat]').forEach(function (b) {
        b.onclick = function () {
          if (st.formaat === b.getAttribute('data-formaat')) return;
          st.formaat = b.getAttribute('data-formaat');
          wijzig();
        };
      });
    };

    var tekenMeldingen = function () {
      var vak = rechts.querySelector('[data-mld]');
      if (!vak) return;
      var mld = meldingen();
      vak.innerHTML = mld.map(function (m, i) {
        return '<div class="ve-melding ' + m.kleur + '">' + esc(m.tekst) + (m.haalWeg ? ' <button type="button" data-haalweg="' + i + '">Haal weg</button>' : '') + '</div>';
      }).join('');
      vak.querySelectorAll('[data-haalweg]').forEach(function (b) {
        b.onclick = function () {
          var m = mld[+b.getAttribute('data-haalweg')];
          kolsVoor(st.niveau).forEach(function (k) { if (m.haalWeg.indexOf(k.groep) >= 0) st.kol.delete(k.key); });
          wijzig();
        };
      });
    };

    var tekenVoet = function () {
      var kols = gekozen();
      var aantal = st.niveau === 'adres' ? (opt.aantal || {}).adres : (opt.aantal || {}).vve;
      var naamVeld = voet.querySelector('[data-naam]');
      var heeftFocus = naamVeld && document.activeElement === naamVeld;
      if (!heeftFocus) {
        voet.innerHTML = '<div class="ve-naam"><input class="ve-inv" data-naam spellcheck="false" title="Bestandsnaam; pas hem gerust aan"><span class="ve-ext"></span></div>'
          + '<label title="Een tweede tabblad met doelgroep, omschrijving, datum, maker en selectie"><input type="checkbox" data-over> Tabblad ‘Over deze export’</label>'
          + '<span class="ve-status"></span>'
          + '<button type="button" class="ve-knop" data-annuleer>Annuleren</button>'
          + '<button type="button" class="ve-knop hoofd" data-ga>Exporteren</button>';
        naamVeld = voet.querySelector('[data-naam]');
        naamVeld.value = bestandsnaam().replace(/\.(xlsx|csv)$/, '');
        naamVeld.oninput = function () { st.naam = naamVeld.value; };
        naamVeld.onblur = function () { if (!naamVeld.value.trim()) st.naam = null; tekenVoet(); };
        voet.querySelector('[data-annuleer]').onclick = sluit;
        voet.querySelector('[data-ga]').onclick = exporteer;
        var over = voet.querySelector('[data-over]');
        over.onchange = function () { st.over = over.checked; teken(); };
      }
      voet.querySelector('.ve-ext').textContent = '.' + st.formaat;
      var over2 = voet.querySelector('[data-over]');
      over2.checked = st.over;
      over2.disabled = st.formaat !== 'xlsx';
      over2.parentNode.style.opacity = st.formaat === 'xlsx' ? '' : '.5';
      voet.querySelector('.ve-status').textContent = st.bezig ? 'Bestand maken…'
        : kols.length + ' kolom' + (kols.length === 1 ? '' : 'men') + (aantal != null ? ' × ' + aantal.toLocaleString('nl-NL') + ' regels' : '');
      var ga = voet.querySelector('[data-ga]');
      ga.disabled = st.bezig || kols.length === 0;
      ga.textContent = st.bezig ? 'Bezig…' : 'Exporteren';
    };

    var teken = function () { tekenLinks(); tekenRechts(); tekenVoet(); };

    var exporteer = async function () {
      var kols = gekozen();
      if (!kols.length || st.bezig) return;
      var naam = bestandsnaam();
      st.bezig = true;
      tekenVoet();
      try {
        var rijen = (st.niveau === 'adres' ? opt.rijen.adres : opt.rijen.vve)();
        var blob;
        if (st.formaat === 'csv') {
          blob = maakCsv(kols, rijen);
        } else {
          var ExcelJS = await opt.laadExcel();
          var groepenAan = [];
          kols.forEach(function (k) { var t = groepVan(k.groep).titel; if (groepenAan.indexOf(t) < 0) groepenAan.push(t); });
          var nu = new Date();
          blob = await maakXlsx(ExcelJS, kols, rijen, {
            niveau: st.niveau,
            over: st.over,
            doelgroep: dg().titel + (st.aangepast ? ' (aangepast)' : ''),
            omschrijving: st.omschrijving.trim(),
            datum: nu.toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + nu.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }),
            door: opt.gebruiker || '',
            selectie: opt.selectie || 'alle VvE’s',
            onderdelen: groepenAan,
            meldingen: meldingen().filter(function (m) { return m.kleur !== 'blauw'; }).map(function (m) { return m.tekst; })
          });
        }
        download(blob, naam);
        // onthouden
        var o = leesOpslag();
        o.doelgroep = st.doelgroep;
        o.over = st.over;
        o.omschrijving = o.omschrijving || {};
        o.omschrijving[st.doelgroep] = st.omschrijving.trim();
        if (st.doelgroep === 'eigen' || st.aangepast) o.eigen = { niveau: st.niveau, formaat: st.formaat, kol: Array.from(st.kol) };
        schrijfOpslag(o);
        sluit();
      } catch (e) {
        st.bezig = false;
        tekenVoet();
        alert('Exporteren mislukt: ' + e.message);
      }
    };

    kiesDoelgroep(opslag.doelgroep || 'intern');
    document.body.appendChild(achter);
    teken();
    paneel.querySelector('[data-oms]').focus();
    return { sluit: sluit };
  };

  window.VveExport = { open: open, doelgroepen: DOELGROEPEN, groepen: GROEPEN };
})();
