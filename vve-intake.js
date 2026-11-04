// vve-intake.js — intakeformulier per VvE
//
// Een formulier met vaste keuzes dat de procesbegeleider tijdens of na het
// intakegesprek invult. De antwoorden worden als dossiergegevens bij de VvE
// bewaard (veld intakeForm). Uit de antwoorden volgen:
//   - een kansrijkheidsscore (0-100) met uitleg per onderdeel, alleen voor intern gebruik;
//   - het startdocument waarop de VvE akkoord geeft (zonder score).
//
// De vragen, punten en de tekst over financiering en ondertekening staan niet
// hier maar in config/intake_vragen.inc in de dashboardmap (var INTAKE_VRAGEN).
// Zo blijft de werkwijze buiten de publieke repository, net als
// config/document_sjabloon.inc. Dit bestand laadt dat config-bestand zelf.
//
// Gebruik vanuit het dashboard:
//   VveIntake.open({ vveId, naam, feiten: [[label, waarde], ...],
//                    opgeslagen: <object of null>, gebruiker, onOpslaan: fn(obj) })
//   VveIntake.score(antwoorden) -> { score, volledigheid, onderdelen: [...] }
//
// Naast vragen kent de config 'uitleg'-blokken: tekst voor de gespreksleider om
// toe te lichten (bijvoorbeeld hoe het traject verloopt). Met besproken: true
// krijgt het blok een vinkje 'Besproken'; met inStartdocument: true komt de
// tekst ook in het startdocument.

(function () {
  'use strict';

  // ── config laden ────────────────────────────────────────────────────
  // Als script, want een XMLHttpRequest op een lokaal bestand blokkeert de
  // browser via file://. Het pad is relatief aan vve_dashboard.html.
  (function laadConfig() {
    if (typeof window.INTAKE_VRAGEN !== 'undefined') return;
    var s = document.createElement('script');
    s.src = 'config/intake_vragen.inc';
    s.onerror = function () { console.info('config/intake_vragen.inc niet gevonden — intakeformulier niet beschikbaar.'); };
    document.head.appendChild(s);
  })();

  var cfg = function () { return typeof window.INTAKE_VRAGEN !== 'undefined' ? window.INTAKE_VRAGEN : null; };

  var esc = function (s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };
  var ONBEKEND = 'Onbekend';

  // Opties mogen een tekst zijn of { t: 'tekst', p: punten }.
  var optTekst = function (o) { return typeof o === 'string' ? o : o.t; };
  var optPunten = function (o) { return typeof o === 'string' ? null : (typeof o.p === 'number' ? o.p : null); };

  var alleVragen = function (c) {
    var uit = [];
    (c.secties || []).forEach(function (s) { (s.vragen || []).forEach(function (v) { uit.push({ sectie: s, vraag: v }); }); });
    return uit;
  };

  var zichtbaar = function (v, a) {
    if (typeof v.als !== 'function') return true;
    try { return !!v.als(a); } catch (e) { return true; }
  };

  var leeg = function (w) {
    return w == null || w === '' || (Array.isArray(w) && w.length === 0);
  };

  // ── score ───────────────────────────────────────────────────────────
  // Per vraag met punten: [min, max] en het behaalde aantal. Onbeantwoord of
  // 'Onbekend' telt niet mee (neutraal), maar verlaagt de volledigheid.
  // score = som(behaald - min) / som(max - min) over de beantwoorde vragen.
  var bereikVan = function (v) {
    if (Array.isArray(v.bereik)) return v.bereik;
    var ps = (v.opties || []).map(optPunten).filter(function (p) { return p !== null; });
    if (!ps.length) return null;
    if (v.type === 'meer') {
      var neg = ps.filter(function (p) { return p < 0; }).reduce(function (a, b) { return a + b; }, 0);
      var pos = ps.filter(function (p) { return p > 0; }).reduce(function (a, b) { return a + b; }, 0);
      return [neg, pos];
    }
    return [Math.min.apply(null, ps.concat(0)), Math.max.apply(null, ps)];
  };

  var puntenVoor = function (v, w, a) {
    if (typeof v.punten === 'function') {
      try { var r = v.punten(w, a); return typeof r === 'number' && isFinite(r) ? r : null; } catch (e) { return null; }
    }
    if (leeg(w)) return null;
    var vind = function (t) {
      var o = (v.opties || []).filter(function (x) { return optTekst(x) === t; })[0];
      return o ? optPunten(o) : null;
    };
    if (v.type === 'meer') {
      var sel = w.filter(function (t) { return t !== ONBEKEND; });
      if (!sel.length) return null;
      var som = 0, telt = false;
      sel.forEach(function (t) { var p = vind(t); if (p !== null) { som += p; telt = true; } });
      return telt ? som : 0;
    }
    if (w === ONBEKEND) return null;
    return vind(w);
  };

  var score = function (antwoorden) {
    var c = cfg();
    if (!c) return null;
    var a = antwoorden || {};
    var onderdelen = [];
    alleVragen(c).forEach(function (x) {
      var v = x.vraag;
      if (!v.k || !zichtbaar(v, a)) return;
      var br = bereikVan(v);
      if (!br || br[1] === br[0]) return;
      var p = puntenVoor(v, a[v.id], a);
      if (p !== null) p = Math.max(br[0], Math.min(br[1], p));
      onderdelen.push({ id: v.id, label: v.kort || v.vraag, sectie: x.sectie.titel, min: br[0], max: br[1], punten: p });
    });
    (c.afgeleid || []).forEach(function (d) {
      var p = null;
      try { p = d.fn(a); } catch (e) { p = null; }
      if (typeof p !== 'number' || !isFinite(p)) p = null;
      var br = d.bereik || [0, 10];
      if (p !== null) p = Math.max(br[0], Math.min(br[1], p));
      onderdelen.push({ id: d.id, label: d.label, sectie: d.sectie || 'Enquête', min: br[0], max: br[1], punten: p });
    });
    var beantwoord = onderdelen.filter(function (o) { return o.punten !== null; });
    var teller = 0, noemer = 0;
    beantwoord.forEach(function (o) { teller += o.punten - o.min; noemer += o.max - o.min; });
    return {
      score: noemer > 0 ? Math.round(100 * teller / noemer) : null,
      volledigheid: onderdelen.length ? Math.round(100 * beantwoord.length / onderdelen.length) : 0,
      onderdelen: onderdelen
    };
  };

  // tekst: string of lijst van alinea's; punten: genummerde lijst; lijst: opsomming
  var uitlegHtml = function (v, esc) {
    var h = '';
    [].concat(v.tekst || []).forEach(function (p) { h += '<p>' + esc(p) + '</p>'; });
    if (v.punten) h += '<ol>' + v.punten.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ol>';
    if (v.lijst) h += '<ul>' + v.lijst.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul>';
    return h;
  };

  var antwoordTekst = function (v, w) {
    if (leeg(w)) return '';
    if (Array.isArray(w)) return w.join(', ');
    if (v.type === 'datum' && /^\d{4}-\d{2}-\d{2}$/.test(w)) { var d = w.split('-'); return d[2] + '-' + d[1] + '-' + d[0]; }
    return String(w) + (v.eenheid ? ' ' + v.eenheid : '');
  };

  // ── stijl ───────────────────────────────────────────────────────────
  var STIJL = '\
.vi-achter{--a:var(--vd-accent,#217346);--ad:var(--vd-accent-donker,#1a5c38);--al:var(--vd-accent-licht,#eaf6ef);--rand:#e3e6ea;--zacht:#f4f6f8;--tekst:#1f2933;--grijs:#5f6b7a;position:fixed;inset:0;background:rgba(17,24,39,.45);z-index:10000;display:flex;align-items:stretch;justify-content:center;padding:24px;font-family:"Segoe UI",system-ui,-apple-system,sans-serif;font-size:13.5px;color:var(--tekst);animation:vi-in .15s ease-out}\
@keyframes vi-in{from{opacity:0}to{opacity:1}}\
.vi-achter *{box-sizing:border-box}\
.vi-paneel{position:relative;background:var(--zacht);width:100%;max-width:1160px;display:flex;flex-direction:column;border-radius:14px;overflow:clip;box-shadow:0 24px 64px rgba(0,0,0,.28);min-height:0}\
.vi-kop{display:flex;align-items:center;gap:18px;padding:16px 22px 18px;background:linear-gradient(120deg,var(--ad),var(--a));color:#fff}\
.vi-kop .vi-titel{flex:1;min-width:0}\
.vi-kop .vi-boven{font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;opacity:.8}\
.vi-kop h2{font-size:20px;font-weight:600;margin:2px 0 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\
.vi-kop .vi-sub{font-size:12px;opacity:.85;margin-top:2px;min-height:16px}\
.vi-score{display:flex;align-items:center;gap:10px;cursor:pointer;padding:6px 14px 6px 6px;border-radius:40px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.25);transition:background .15s}\
.vi-score:hover{background:rgba(255,255,255,.24)}\
.vi-ring{--p:0;width:46px;height:46px;border-radius:50%;background:conic-gradient(#fff calc(var(--p)*1%),rgba(255,255,255,.25) 0);display:grid;place-items:center;flex-shrink:0}\
.vi-ring b{width:36px;height:36px;border-radius:50%;background:var(--a);display:grid;place-items:center;font-size:15px;font-weight:700;font-variant-numeric:tabular-nums}\
.vi-score span{font-size:11px;line-height:1.35;opacity:.95}\
.vi-score span strong{display:block;font-size:12px;font-weight:600}\
.vi-voortgang{height:4px;background:var(--rand)}\
.vi-voortgang i{display:block;height:100%;width:0;background:var(--a);transition:width .3s ease}\
.vi-romp{display:flex;flex:1;min-height:0}\
.vi-nav{width:236px;overflow:auto;padding:14px 10px;flex-shrink:0;background:#fff;border-right:1px solid var(--rand)}\
.vi-nav a{display:grid;grid-template-columns:1fr auto;align-items:center;gap:2px 8px;padding:8px 10px;margin-bottom:2px;border-radius:8px;color:var(--tekst);text-decoration:none;cursor:pointer;line-height:1.3}\
.vi-nav a:hover{background:var(--zacht)}\
.vi-nav a.is-aan{background:var(--al);color:var(--ad);font-weight:600}\
.vi-nav a small{color:var(--grijs);font-weight:400;font-size:11px;font-variant-numeric:tabular-nums}\
.vi-nav a.is-klaar small{color:var(--a);font-weight:600}\
.vi-nav a.is-klaar small::before{content:"\\2713  "}\
.vi-nav a em{grid-column:1/-1;height:3px;border-radius:2px;background:#edf0f3;overflow:hidden;display:block}\
.vi-nav a em i{display:block;height:100%;width:0;background:var(--a);transition:width .3s}\
.vi-inhoud{flex:1;overflow:auto;padding:18px 26px 260px;min-width:0}\
.vi-sectie{background:#fff;border:1px solid var(--rand);border-radius:12px;padding:6px 22px 10px;margin-bottom:16px;box-shadow:0 1px 2px rgba(16,24,40,.04)}\
.vi-sectie h3{font-size:16px;font-weight:600;color:var(--tekst);margin:14px 0 2px;display:flex;align-items:center;gap:10px}\
.vi-sectie h3::before{content:"";width:4px;height:18px;border-radius:2px;background:var(--a)}\
.vi-sectie>.vi-hulp{margin:0 0 6px 14px}\
.vi-feiten{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:8px;margin:12px 0 6px}\
.vi-feiten>div{background:var(--zacht);border-radius:8px;padding:8px 12px;min-width:0;overflow-wrap:anywhere}\
.vi-feiten>div span{display:block;font-size:11px;color:var(--grijs);margin-bottom:2px}\
.vi-feiten>div.breed{grid-column:1/-1}\
.vi-vraag{padding:14px 0 14px 14px;margin-left:-14px;border-bottom:1px solid #f0f2f4;border-left:3px solid transparent;transition:border-color .2s}\
.vi-vraag:last-child{border-bottom:0}\
.vi-vraag.is-ingevuld{border-left-color:var(--al)}\
.vi-vraag>label,.vi-vraag>.vi-vt{display:block;font-weight:600;font-size:14px;margin-bottom:8px}\
.vi-tag{display:inline-block;font-size:10px;font-weight:700;line-height:16px;padding:0 6px;margin-left:6px;border-radius:8px;background:#eef1f4;color:var(--grijs);vertical-align:2px}\
.vi-tag.k{background:var(--al);color:var(--ad)}\
.vi-hulp{font-weight:400;color:var(--grijs);font-size:12.5px;margin:-4px 0 8px}\
.vi-vt .vi-hulp{font-size:12px}\
.vi-opties{display:flex;flex-wrap:wrap;gap:8px}\
.vi-opties label{position:relative;display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border:1px solid #d5dae0;border-radius:999px;cursor:pointer;background:#fff;user-select:none;transition:all .12s}\
.vi-opties label:hover{border-color:var(--a);background:#fbfdfc}\
.vi-opties label:focus-within{box-shadow:0 0 0 3px var(--al)}\
.vi-opties input{position:absolute;opacity:0;pointer-events:none}\
.vi-opties label.is-aan{border-color:var(--a);background:var(--a);color:#fff;box-shadow:0 1px 3px rgba(0,0,0,.12)}\
.vi-opties label.is-aan::before{content:"\\2713";font-weight:700;font-size:12px}\
.vi-opties label.onbekend{color:var(--grijs);border-style:dashed;background:transparent}\
.vi-opties label.onbekend.is-aan{color:var(--tekst);background:#e9ecef;border-color:#adb5bd;border-style:solid;box-shadow:none}\
.vi-inv{font:inherit;padding:8px 11px;border:1px solid #d5dae0;border-radius:8px;min-width:200px;background:#fff;color:var(--tekst);transition:border-color .12s,box-shadow .12s}\
.vi-inv:hover{border-color:#b8c0c9}\
.vi-inv:focus{outline:none;border-color:var(--a);box-shadow:0 0 0 3px var(--al)}\
textarea.vi-inv{width:100%;min-height:72px;resize:vertical;line-height:1.45}\
.vi-voet{display:flex;align-items:center;gap:8px;padding:12px 22px;border-top:1px solid var(--rand);background:#fff}\
.vi-voet .vi-status{flex:1;color:var(--grijs);font-size:12px;display:flex;align-items:center;gap:6px;min-width:0}\
.vi-voet .vi-status::before{content:"";width:8px;height:8px;border-radius:50%;background:#adb5bd;flex-shrink:0}\
.vi-voet .vi-status.is-gewijzigd::before{background:#f0a020}\
.vi-voet .vi-status.is-bewaard::before{background:var(--a)}\
.vi-knop{font:600 13px "Segoe UI",system-ui,sans-serif;padding:8px 16px;border:1px solid #d0d5dc;border-radius:8px;background:#fff;color:var(--tekst);cursor:pointer;transition:all .12s}\
.vi-knop:hover{background:var(--zacht);border-color:#b8c0c9}\
.vi-knop.klein{font-weight:500;padding:7px 10px;border-color:transparent;color:var(--grijs)}\
.vi-knop.klein:hover{background:var(--zacht);color:var(--tekst)}\
.vi-knop.hoofd{background:var(--a);border-color:var(--a);color:#fff;padding:8px 22px;box-shadow:0 1px 3px rgba(0,0,0,.15)}\
.vi-knop.hoofd:hover{background:var(--ad);border-color:var(--ad)}\
.vi-scheid{width:1px;height:22px;background:var(--rand);margin:0 2px}\
.vi-inlees{position:absolute;left:22px;bottom:60px;background:#fff;border:1px solid var(--rand);border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.18);padding:6px;display:flex;flex-direction:column;z-index:4}\
.vi-inlees button{font:inherit;text-align:left;padding:8px 14px;border:0;border-radius:6px;background:none;cursor:pointer}\
.vi-inlees button:hover{background:var(--zacht)}\
.vi-uitleg{position:absolute;right:22px;top:76px;width:390px;max-height:70vh;overflow:auto;background:#fff;color:var(--tekst);border:1px solid var(--rand);border-radius:12px;box-shadow:0 16px 40px rgba(0,0,0,.22);padding:14px 16px;z-index:5}\
.vi-uitleg h4{margin:0 0 8px;font-size:14px}\
.vi-uitleg table{width:100%;border-collapse:collapse;font-size:12px}\
.vi-uitleg td{padding:4px 4px;border-bottom:1px solid #f0f2f4;vertical-align:top}\
.vi-uitleg td.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}\
.vi-uitleg .vi-balk{height:5px;border-radius:3px;background:#edf0f3;margin-top:4px;overflow:hidden}\
.vi-uitleg .vi-balk i{display:block;height:100%;background:var(--a);border-radius:3px}\
.vi-uitleg p{color:var(--grijs);font-size:11px;margin:10px 0 0}\
.vi-notities{position:absolute;right:26px;bottom:72px;width:340px;background:#fff8d6;border:1px solid #efd97a;border-radius:12px;box-shadow:0 10px 28px rgba(0,0,0,.18);z-index:3;display:flex;flex-direction:column;overflow:hidden}\
.vi-notities header{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid #f1e3a0;font-weight:600;cursor:pointer;color:#5c4a00}\
.vi-notities header span{flex:1}\
.vi-notities header span::before{content:"\\270E  "}\
.vi-notities header small{font-weight:600;color:#8a7a2a}\
.vi-notities textarea{font:inherit;border:0;background:transparent;padding:10px 12px;height:180px;resize:vertical;outline:none;line-height:1.5}\
.vi-notities.dicht{width:auto;border-radius:999px}\
.vi-notities.dicht textarea{display:none}\
.vi-notities.dicht header{border-bottom:0;padding:8px 16px}\
.vi-uitlegblok{margin:14px 0 6px;padding:14px 18px;background:#f2f7fd;border:1px solid #d8e6f6;border-radius:10px}\
.vi-uitlegblok .vi-vt{color:#1f4e8c;font-weight:600;font-size:14px;margin-bottom:4px}\
.vi-uitlegblok .vi-vt::before{content:"i";display:inline-grid;place-items:center;width:18px;height:18px;border-radius:50%;background:#2f6db5;color:#fff;font-size:11px;font-weight:700;font-style:italic;margin-right:8px;vertical-align:1px}\
.vi-uitlegblok p{margin:5px 0;line-height:1.5}\
.vi-uitlegblok ol,.vi-uitlegblok ul{margin:4px 0 4px 22px;padding:0;line-height:1.5}\
.vi-uitlegblok li{margin:3px 0}\
.vi-uitlegblok .vi-besproken{display:inline-flex;align-items:center;gap:8px;margin-top:8px;padding:5px 12px;border-radius:999px;background:#fff;border:1px solid #c9daef;cursor:pointer;font-weight:600;color:#1f4e8c}\
.vi-uitlegblok .vi-besproken:has(input:checked){background:#2f6db5;border-color:#2f6db5;color:#fff}\
.vi-uitlegblok .vi-besproken input{accent-color:#2f6db5;margin:0}\
@media (max-width:760px){.vi-achter{padding:0}.vi-paneel{border-radius:0}.vi-nav{display:none}.vi-inhoud{padding:12px 12px 260px}.vi-sectie{padding:4px 14px 8px}.vi-uitleg{left:8px;right:8px;width:auto}.vi-voet{flex-wrap:wrap}.vi-score span{display:none}}';

  var stijlGezet = false;
  var zetStijl = function () {
    if (stijlGezet) return;
    var st = document.createElement('style');
    st.textContent = STIJL;
    document.head.appendChild(st);
    stijlGezet = true;
  };

  // ── formulier ───────────────────────────────────────────────────────
  var open = function (opt) {
    var c = cfg();
    if (!c) {
      alert('De vragenlijst voor het intakeformulier (config/intake_vragen.inc) is niet gevonden in de dashboardmap.');
      return;
    }
    zetStijl();
    var bewaard = opt.opgeslagen || {};
    var a = JSON.parse(JSON.stringify(bewaard.antwoorden || {}));
    var gewijzigd = false;
    var feiten = opt.feiten || [];

    var achter = document.createElement('div');
    achter.className = 'vi-achter';
    achter.innerHTML =
      '<div class="vi-paneel" role="dialog" aria-modal="true" aria-label="Intakeformulier">'
      + '<div class="vi-kop" style="position:relative">'
      + '<div class="vi-titel"><div class="vi-boven">Intakeformulier</div><h2>' + esc(opt.naam || opt.vveId) + '</h2><div class="vi-sub"></div></div>'
      + '<div class="vi-score" title="Kansrijkheid: alleen voor intern gebruik, staat niet in het startdocument. Klik voor de opbouw."><div class="vi-ring"><b>–</b></div><span><strong>Kansrijkheid</strong><em style="font-style:normal">0% ingevuld</em></span></div>'
      + '</div>'
      + '<div class="vi-voortgang"><i></i></div>'
      + '<div class="vi-romp"><nav class="vi-nav"></nav><div class="vi-inhoud"></div></div>'
      + '<div class="vi-voet">'
      + '<button type="button" class="vi-knop klein" data-doe="download" title="Startdocument met de antwoorden erin downloaden, om in de dossiermap te bewaren">Downloaden</button>'
      + '<button type="button" class="vi-knop klein" data-doe="deel" title="Startdocument met de antwoorden delen via Windows (bijvoorbeeld Teams of Outlook)" style="display:none">Delen</button>'
      + '<button type="button" class="vi-knop klein" data-doe="kopieer" title="Antwoorden naar het klembord kopiëren">Kopiëren</button>'
      + '<button type="button" class="vi-knop klein" data-doe="inlezen" title="Antwoorden inlezen uit een gedownload startdocument of van het klembord">Inlezen</button>'
      + '<div class="vi-status"></div>'
      + '<button type="button" class="vi-knop" data-doe="sluit">Sluiten</button>'
      + '<span class="vi-scheid"></span>'
      + '<button type="button" class="vi-knop" data-doe="startdoc">Startdocument</button>'
      + '<button type="button" class="vi-knop hoofd" data-doe="opslaan">Opslaan</button></div>'
      + '</div>';
    document.body.appendChild(achter);

    var nav = achter.querySelector('.vi-nav');
    var inhoud = achter.querySelector('.vi-inhoud');
    var scoreEl = achter.querySelector('.vi-score');
    var statusEl = achter.querySelector('.vi-status');
    var kop = achter.querySelector('.vi-kop');
    var voortgangEl = achter.querySelector('.vi-voortgang i');
    var subEl = achter.querySelector('.vi-sub');
    var uitleg = null;

    // Zwevend notitieveld voor vragen en punten die buiten de volgorde opkomen.
    // Wordt bewaard bij de antwoorden (_notities), staat niet in het startdocument.
    var notities = document.createElement('div');
    notities.className = 'vi-notities' + (a._notities ? '' : ' dicht');
    notities.innerHTML = '<header title="Openen of inklappen (Alt+N)"><span>Notities buiten de flow</span><small></small><b aria-hidden="true">\u2013</b></header>'
      + '<textarea placeholder="Vragen of punten die tussendoor opkomen. Eén punt per regel; ze worden bewaard maar staan niet in het startdocument."></textarea>';
    achter.querySelector('.vi-paneel').appendChild(notities);
    var notTekst = notities.querySelector('textarea');
    var notTeller = notities.querySelector('small');
    var notKnop = notities.querySelector('b');
    notTekst.value = a._notities || '';
    var telNotities = function () {
      var n = notTekst.value.split('\n').filter(function (r) { return r.trim(); }).length;
      notTeller.textContent = n ? '(' + n + ')' : '';
      notKnop.textContent = notities.classList.contains('dicht') ? '+' : '\u2013';
    };
    var wisselNotities = function (open) {
      notities.classList.toggle('dicht', open === undefined ? !notities.classList.contains('dicht') : !open);
      telNotities();
      if (!notities.classList.contains('dicht')) notTekst.focus();
    };
    notities.querySelector('header').addEventListener('click', function () { wisselNotities(); });
    notTekst.addEventListener('input', function () {
      if (notTekst.value.trim()) a._notities = notTekst.value; else delete a._notities;
      gewijzigd = true;
      zetStatus();
      telNotities();
    });
    telNotities();

    var zetStatus = function () {
      statusEl.classList.toggle('is-gewijzigd', !!gewijzigd);
      statusEl.classList.toggle('is-bewaard', !gewijzigd && !!bewaard.opgeslagen);
      if (gewijzigd) statusEl.textContent = 'Niet opgeslagen wijzigingen';
      else if (bewaard.opgeslagen) statusEl.textContent = 'Opgeslagen ' + new Date(bewaard.opgeslagen).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' }) + (bewaard.door ? ' door ' + bewaard.door : '');
      else statusEl.textContent = 'Nog niet opgeslagen';
    };

    // secties: eerst wat het dashboard al weet, dan de vragen
    var secties = [{ id: '_feiten', titel: 'Uit het dashboard', feiten: true }].concat(c.secties || []);

    var tekenUitleg = function (s) {
      if (!uitleg) return;
      var rijen = s.onderdelen.map(function (o) {
        var pct = o.punten === null ? 0 : Math.round(100 * (o.punten - o.min) / (o.max - o.min));
        return '<tr><td>' + esc(o.label) + '<div class="vi-balk"><i style="width:' + pct + '%"></i></div></td>'
          + '<td class="n">' + (o.punten === null ? '<span style="color:#a19f9d">–</span>' : (o.punten - o.min) + ' / ' + (o.max - o.min)) + '</td></tr>';
      }).join('');
      uitleg.innerHTML = '<h4>Opbouw kansrijkheid</h4><table>' + rijen + '</table>'
        + '<p>Een streepje betekent onbeantwoord of onbekend: die vraag telt niet mee. De punten zijn een eerste inschatting en worden later geijkt op afgeronde trajecten. De score staat niet in het startdocument.</p>';
    };

    var herreken = function () {
      var s = score(a);
      if (!s) return;
      // Pas een score tonen als er genoeg is ingevuld; anders zegt één antwoord al '100'.
      var toon = s.score !== null && s.volledigheid >= 25;
      scoreEl.querySelector('b').textContent = toon ? s.score : '–';
      scoreEl.querySelector('.vi-ring').style.setProperty('--p', toon ? s.score : 0);
      scoreEl.querySelector('em').textContent = s.volledigheid + '% ingevuld';
      var totaal = 0, totKlaar = 0;
      tekenUitleg(s);
      // voortgang per sectie in de navigatie
      secties.forEach(function (sec) {
        if (sec.feiten) return;
        var vr = (sec.vragen || []).filter(function (v) { return zichtbaar(v, a) && (v.type !== 'uitleg' || v.besproken); });
        var klaar = vr.filter(function (v) { return !leeg(a[v.id]); }).length;
        totaal += vr.length; totKlaar += klaar;
        var l = nav.querySelector('[data-sectie="' + sec.id + '"]');
        if (!l) return;
        l.querySelector('small').textContent = klaar + '/' + vr.length;
        l.querySelector('em i').style.width = (vr.length ? Math.round(100 * klaar / vr.length) : 0) + '%';
        l.classList.toggle('is-klaar', vr.length > 0 && klaar === vr.length);
      });
      voortgangEl.style.width = (totaal ? Math.round(100 * totKlaar / totaal) : 0) + '%';
      voortgangEl.parentNode.title = totKlaar + ' van ' + totaal + ' vragen beantwoord';
      subEl.textContent = [a.procesbegeleider ? 'Intake door ' + a.procesbegeleider : '', a.datum_intake ? antwoordTekst({ type: 'datum' }, a.datum_intake) : ''].filter(Boolean).join(' \u00b7 ');
      inhoud.querySelectorAll('.vi-vraag[data-vraag]').forEach(function (el) { el.classList.toggle('is-ingevuld', !leeg(a[el.getAttribute('data-vraag')])); });
      // vragen met een voorwaarde tonen of verbergen
      alleVragen(c).forEach(function (x) {
        var el = inhoud.querySelector('[data-vraag="' + x.vraag.id + '"]');
        if (el) el.style.display = zichtbaar(x.vraag, a) ? '' : 'none';
      });
    };

    var wijzig = function (id, w) {
      if (leeg(w)) delete a[id]; else a[id] = w;
      gewijzigd = true;
      zetStatus();
      herreken();
    };

    var tekenUitlegBlok = function (v) {
      var div = document.createElement('div');
      div.className = 'vi-uitlegblok';
      div.setAttribute('data-vraag', v.id);
      div.innerHTML = '<div class="vi-vt">' + esc(v.vraag) + '</div>' + uitlegHtml(v, esc)
        + (v.besproken ? '<label class="vi-besproken"><input type="checkbox"' + (a[v.id] ? ' checked' : '') + '> Besproken</label>' : '');
      var vink = div.querySelector('input');
      if (vink) vink.addEventListener('change', function () { wijzig(v.id, vink.checked ? 'Ja' : ''); });
      return div;
    };

    var tekenVraag = function (v) {
      if (v.type === 'uitleg') return tekenUitlegBlok(v);
      var div = document.createElement('div');
      div.className = 'vi-vraag';
      div.setAttribute('data-vraag', v.id);
      var tags = (v.k ? '<span class="vi-tag k" title="Telt mee in de kansrijkheid">K</span>' : '')
        + (v.a ? '<span class="vi-tag" title="Nodig voor het adviesbureau">A</span>' : '');
      var naam = 'vi-' + v.id;
      var w = a[v.id];
      var h = '';
      if (v.type === 'keuze' || v.type === 'meer') {
        h += '<div class="vi-vt">' + esc(v.vraag) + tags + (v.type === 'meer' ? ' <span class="vi-hulp" style="font-weight:400">(meerdere mogelijk)</span>' : '') + '</div>';
        if (v.hulp) h += '<div class="vi-hulp">' + esc(v.hulp) + '</div>';
        h += '<div class="vi-opties" role="' + (v.type === 'keuze' ? 'radiogroup' : 'group') + '">';
        (v.opties || []).forEach(function (o) {
          var t = optTekst(o);
          var aan = v.type === 'meer' ? (Array.isArray(w) && w.indexOf(t) >= 0) : w === t;
          h += '<label class="' + (aan ? 'is-aan' : '') + (t === ONBEKEND ? ' onbekend' : '') + '">'
            + '<input type="' + (v.type === 'keuze' ? 'radio' : 'checkbox') + '" name="' + naam + '" value="' + esc(t) + '"' + (aan ? ' checked' : '') + '>'
            + esc(t) + '</label>';
        });
        h += '</div>';
      } else {
        h += '<label for="' + naam + '">' + esc(v.vraag) + tags + '</label>';
        if (v.hulp) h += '<div class="vi-hulp">' + esc(v.hulp) + '</div>';
        if (v.type === 'tekst') h += '<textarea class="vi-inv" id="' + naam + '">' + esc(w || '') + '</textarea>';
        else h += '<input class="vi-inv" id="' + naam + '" type="' + (v.type === 'getal' ? 'number' : v.type === 'datum' ? 'date' : 'text') + '"'
          + (v.type === 'getal' ? ' inputmode="decimal" step="any"' + (v.min != null ? ' min="' + v.min + '"' : '') + (v.max != null ? ' max="' + v.max + '"' : '') : '')
          + ' value="' + esc(w == null ? '' : w) + '">' + (v.eenheid ? ' <span class="vi-hulp">' + esc(v.eenheid) + '</span>' : '');
      }
      div.innerHTML = h;

      if (v.type === 'keuze' || v.type === 'meer') {
        div.querySelectorAll('input').forEach(function (inp) {
          inp.addEventListener('change', function () {
            var waarde;
            if (v.type === 'keuze') {
              waarde = inp.value;
            } else {
              waarde = Array.prototype.slice.call(div.querySelectorAll('input:checked')).map(function (x) { return x.value; });
              // 'Onbekend' sluit de andere keuzes uit, en omgekeerd
              if (inp.checked && inp.value === ONBEKEND) waarde = [ONBEKEND];
              else if (inp.checked) waarde = waarde.filter(function (x) { return x !== ONBEKEND; });
              div.querySelectorAll('input').forEach(function (x) { x.checked = waarde.indexOf(x.value) >= 0; });
            }
            div.querySelectorAll('label').forEach(function (l) { l.classList.toggle('is-aan', l.querySelector('input').checked); });
            wijzig(v.id, waarde);
          });
        });
        // nogmaals klikken op een gekozen rondje maakt de keuze leeg
        if (v.type === 'keuze') {
          div.querySelectorAll('label').forEach(function (l) {
            l.addEventListener('mousedown', function () { l._was = l.querySelector('input').checked; });
            l.addEventListener('click', function (e) {
              if (!l._was) return;
              e.preventDefault();
              l._was = false;
              l.querySelector('input').checked = false;
              l.classList.remove('is-aan');
              wijzig(v.id, '');
            });
          });
        }
      } else {
        var inp = div.querySelector('.vi-inv');
        inp.addEventListener('input', function () {
          var waarde = inp.value;
          if (v.type === 'getal') waarde = waarde === '' ? '' : Number(waarde);
          if (v.type === 'getal' && waarde !== '' && !isFinite(waarde)) return;
          wijzig(v.id, waarde);
        });
      }
      return div;
    };

    secties.forEach(function (sec, i) {
      var link = document.createElement('a');
      link.setAttribute('data-sectie', sec.id);
      link.innerHTML = '<span>' + esc(sec.titel) + '</span><small></small>' + (sec.feiten ? '' : '<em><i></i></em>');
      link.addEventListener('click', function () {
        var doel = inhoud.querySelector('[data-sectie-blok="' + sec.id + '"]');
        if (doel) inhoud.scrollTop += doel.getBoundingClientRect().top - inhoud.getBoundingClientRect().top - 8;
      });
      if (i === 0) link.classList.add('is-aan');
      nav.appendChild(link);

      var blok = document.createElement('section');
      blok.className = 'vi-sectie';
      blok.setAttribute('data-sectie-blok', sec.id);
      blok.innerHTML = '<h3>' + esc(sec.titel) + '</h3>' + (sec.intro ? '<div class="vi-hulp">' + esc(sec.intro) + '</div>' : '');
      if (sec.feiten) {
        var g = document.createElement('div');
        g.className = 'vi-feiten';
        g.innerHTML = feiten.filter(function (f) { return f[1] !== '' && f[1] != null; }).map(function (f) {
          return '<div' + (f[2] || String(f[1]).length > 60 ? ' class="breed"' : '') + '><span>' + esc(f[0]) + '</span>' + (f[2] ? f[1] : esc(f[1])) + '</div>';
        }).join('');
        blok.appendChild(g);
        var noot = document.createElement('div');
        noot.className = 'vi-hulp';
        noot.style.marginTop = '6px';
        noot.textContent = 'Klopt iets niet? Pas het aan via Bewerken of geef het door aan de beheerder van de data.';
        blok.appendChild(noot);
      } else {
        (sec.vragen || []).forEach(function (v) { blok.appendChild(tekenVraag(v)); });
      }
      inhoud.appendChild(blok);
    });

    // actieve sectie in de navigatie volgen
    inhoud.addEventListener('scroll', function () {
      var actief = null;
      inhoud.querySelectorAll('[data-sectie-blok]').forEach(function (b) {
        if (b.getBoundingClientRect().top - inhoud.getBoundingClientRect().top <= 40) actief = b.getAttribute('data-sectie-blok');
      });
      nav.querySelectorAll('a').forEach(function (l) { l.classList.toggle('is-aan', l.getAttribute('data-sectie') === (actief || '_feiten')); });
    });

    scoreEl.addEventListener('click', function () {
      if (uitleg) { uitleg.remove(); uitleg = null; return; }
      uitleg = document.createElement('div');
      uitleg.className = 'vi-uitleg';
      kop.appendChild(uitleg);
      tekenUitleg(score(a));
    });

    var opslaan = function () {
      var s = score(a) || {};
      var obj = {
        versie: c.versie || '',
        antwoorden: a,
        score: s.score,
        volledigheid: s.volledigheid,
        opgeslagen: new Date().toISOString(),
        door: opt.gebruiker || ''
      };
      try { opt.onOpslaan && opt.onOpslaan(obj); } catch (e) { alert('Opslaan is mislukt: ' + e.message); return false; }
      bewaard = obj;
      gewijzigd = false;
      zetStatus();
      return true;
    };

    // ── bewaren buiten de browser ──
    // Het dashboard bewaart in de browser; dat is kwetsbaar. Daarom kan de intake
    // ook als bestand (het startdocument met de antwoorden erin) of via het
    // klembord worden bewaard, en later weer worden ingelezen.
    var pakket = function () {
      var s = score(a) || {};
      return { soort: 'vve-intake', vveId: opt.vveId, naam: opt.naam || '', versie: c.versie || '', antwoorden: a,
        score: s.score, volledigheid: s.volledigheid, opgeslagen: (bewaard && bewaard.opgeslagen) || '', door: opt.gebruiker || '',
        gekopieerd: new Date().toISOString() };
    };
    var bestand = function () {
      var html = startdocumentHtml({ naam: opt.naam, feiten: feiten, antwoorden: a, gebruiker: opt.gebruiker }, pakket());
      var datum = new Date().toISOString().slice(0, 10);
      var basis = String(opt.bestandsnaam || opt.naam || opt.vveId || 'vve').replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim();
      return { naam: 'Startdocument ' + basis + ' ' + datum + '.html', blob: new Blob([html], { type: 'text/html' }) };
    };
    // Delen via het deelvenster van Windows/de browser, als die bestanden kan delen.
    var kanDelen = (function () {
      try { return !!(navigator.canShare && navigator.canShare({ files: [new File(['x'], 'x.html', { type: 'text/html' })] })); } catch (e) { return false; }
    })();
    var delen = function () {
      var b = bestand();
      var f = new File([b.blob], b.naam, { type: 'text/html' });
      navigator.share({ files: [f], title: b.naam }).then(function () {
        statusEl.textContent = 'Gedeeld.';
      }, function (e) {
        if (e && e.name === 'AbortError') return;
        statusEl.textContent = 'Delen lukte niet; gebruik Downloaden.';
      });
    };
    var downloaden = function () {
      var b = bestand();
      var link = document.createElement('a');
      link.href = URL.createObjectURL(b.blob);
      link.download = b.naam;
      document.body.appendChild(link);
      link.click();
      setTimeout(function () { URL.revokeObjectURL(link.href); link.remove(); }, 1000);
      statusEl.textContent = 'Gedownload. Zet het bestand in de dossiermap van de VvE.';
    };
    var kopieer = function () {
      var tekst = JSON.stringify(pakket());
      var gelukt = function () { statusEl.textContent = 'Antwoorden staan op het klembord.'; };
      var oud = function () {
        var ta = document.createElement('textarea');
        ta.value = tekst; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); gelukt(); } catch (e) { alert('Kopiëren lukte niet.'); }
        ta.remove();
      };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(tekst).then(gelukt, oud); else oud();
    };
    var leesPakket = function (tekst) {
      var m = /<script[^>]*id="vve-intake-data"[^>]*>([\s\S]*?)<\/script>/.exec(tekst);
      var p;
      try { p = JSON.parse(m ? m[1] : tekst.trim()); } catch (e) { p = null; }
      if (!p || p.soort !== 'vve-intake' || typeof p.antwoorden !== 'object') {
        alert('Hierin staat geen intake. Kies een gedownload startdocument of plak gekopieerde antwoorden.');
        return;
      }
      if (p.vveId && opt.vveId && p.vveId !== opt.vveId &&
          !confirm('Deze intake hoort bij ' + (p.naam || p.vveId) + ', niet bij ' + (opt.naam || opt.vveId) + '. Toch inlezen?')) return;
      var heeftAntwoorden = Object.keys(a).some(function (k) { return !leeg(a[k]); });
      if (heeftAntwoorden && !confirm('De antwoorden die nu in het formulier staan worden vervangen. Doorgaan?')) return;
      document.removeEventListener('keydown', toets);
      achter.remove();
      var nieuweOpt = {};
      Object.keys(opt).forEach(function (k) { nieuweOpt[k] = opt[k]; });
      nieuweOpt.opgeslagen = { versie: p.versie, antwoorden: p.antwoorden, opgeslagen: bewaard && bewaard.opgeslagen, door: bewaard && bewaard.door };
      nieuweOpt._ingelezen = true;
      open(nieuweOpt);
    };
    var inleesMenu = null;
    var inlezen = function () {
      if (inleesMenu) { inleesMenu.remove(); inleesMenu = null; return; }
      inleesMenu = document.createElement('div');
      inleesMenu.className = 'vi-inlees';
      inleesMenu.innerHTML = '<button type="button" data-in="bestand">Uit een bestand (gedownload startdocument)</button>'
        + '<button type="button" data-in="plak">Van het klembord plakken</button>';
      achter.querySelector('.vi-paneel').appendChild(inleesMenu);
      inleesMenu.addEventListener('click', function (e) {
        var soort = e.target.getAttribute('data-in');
        if (!soort) return;
        inleesMenu.remove(); inleesMenu = null;
        if (soort === 'bestand') {
          var inp = document.createElement('input');
          inp.type = 'file'; inp.accept = '.html,.htm,.json,.txt';
          inp.addEventListener('change', function () {
            var f = inp.files && inp.files[0];
            if (!f) return;
            var r = new FileReader();
            r.onload = function () { leesPakket(String(r.result || '')); };
            r.readAsText(f);
          });
          inp.click();
        } else {
          var handmatig = function () {
            var t = prompt('Plak hier de gekopieerde antwoorden:');
            if (t) leesPakket(t);
          };
          if (navigator.clipboard && navigator.clipboard.readText) navigator.clipboard.readText().then(function (t) { if (t) leesPakket(t); else handmatig(); }, handmatig);
          else handmatig();
        }
      });
    };

    var sluit = function () {
      if (gewijzigd && !confirm('Er zijn wijzigingen die nog niet zijn opgeslagen. Toch sluiten?')) return;
      document.removeEventListener('keydown', toets);
      achter.remove();
    };
    var toets = function (e) {
      if (e.altKey && (e.key === 'n' || e.key === 'N' || e.code === 'KeyN')) { e.preventDefault(); wisselNotities(); return; }
      if (e.key === 'Escape') { if (uitleg) { uitleg.remove(); uitleg = null; } else sluit(); } };
    document.addEventListener('keydown', toets);

    achter.querySelector('.vi-voet').addEventListener('click', function (e) {
      var doe = e.target.getAttribute && e.target.getAttribute('data-doe');
      if (doe === 'sluit') sluit();
      if (doe === 'opslaan') opslaan();
      if (doe === 'download') downloaden();
      if (doe === 'deel') delen();
      if (doe === 'kopieer') kopieer();
      if (doe === 'inlezen') inlezen();
      if (doe === 'startdoc') {
        if (gewijzigd && !opslaan()) return;
        startdocument({ naam: opt.naam, feiten: feiten, antwoorden: a, gebruiker: opt.gebruiker });
      }
    });

    if (kanDelen) achter.querySelector('[data-doe="deel"]').style.display = '';
    if (opt._ingelezen) { gewijzigd = true; zetStatus(); statusEl.textContent = 'Ingelezen. Klik op Opslaan om het bij deze VvE te bewaren.'; }
    else zetStatus();
    herreken();
  };

  // ── startdocument ───────────────────────────────────────────────────
  // Leesbaar en af te drukken, met akkoordtekst uit de config. Zonder score:
  // die is voor intern gebruik.
  var startdocument = function (opt) {
    var html = startdocumentHtml(opt, null);
    if (!html) return;
    var w = window.open('', '_blank');
    if (!w) { alert('Het startdocument kon niet worden geopend. Sta pop-ups toe voor het dashboard.'); return; }
    w.document.write(html);
    w.document.close();
    w.focus();
  };

  // De HTML van het startdocument. Met een pakket erbij (bij Downloaden) gaan de
  // antwoorden onzichtbaar mee in het bestand, zodat het later weer in te lezen is.
  var startdocumentHtml = function (opt, pakket) {
    var c = cfg();
    if (!c) return '';
    var a = opt.antwoorden || {};
    var vandaag = new Date().toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' });
    var td = 'style="padding:4px 8px;border:1px solid #bbb;vertical-align:top;font-size:11pt;"';
    var tl = 'style="padding:4px 8px;border:1px solid #bbb;vertical-align:top;font-size:11pt;font-weight:bold;background:#f2f2f2;width:42%;"';
    var tab = 'style="border-collapse:collapse;width:100%;margin-bottom:14px;table-layout:fixed;"';
    var h2 = 'style="font-size:13pt;color:#2F5496;margin:18px 0 6px;"';

    var feitenRijen = (opt.feiten || []).filter(function (f) { return f[1] !== '' && f[1] != null; })
      .map(function (f) { return '<tr><td ' + tl + '>' + esc(f[0]) + '</td><td ' + td + '>' + (f[2] ? f[1] : esc(f[1])) + '</td></tr>'; }).join('');

    var sectiesHtml = (c.secties || []).filter(function (s) { return !s.nietInStartdocument; }).map(function (s) {
      // vragen als tabel; uitlegblokken (met inStartdocument) als tekst ertussen
      var uit = '', rijen = '';
      var sluitTabel = function () { if (rijen) { uit += '<table ' + tab + '>' + rijen + '</table>'; rijen = ''; } };
      (s.vragen || []).forEach(function (v) {
        if (!zichtbaar(v, a) || v.nietInStartdocument) return;
        if (v.type === 'uitleg') {
          if (!v.inStartdocument) return;
          sluitTabel();
          uit += '<h3 style="font-size:11.5pt;margin:12px 0 4px;">' + esc(v.vraag) + '</h3>' + uitlegHtml(v, esc);
          return;
        }
        var t = antwoordTekst(v, a[v.id]);
        rijen += '<tr><td ' + tl + '>' + esc(v.kort || v.vraag) + '</td><td ' + td + '>' + (t ? esc(t).replace(/\n/g, '<br>') : '<span style="color:#999">–</span>') + '</td></tr>';
      });
      sluitTabel();
      return uit ? '<h2 ' + h2 + '>' + esc(s.titel) + '</h2>' + uit : '';
    }).join('');

    var akkoord = typeof c.akkoordHtml === 'function' ? c.akkoordHtml({ naam: opt.naam, datum: vandaag, antwoorden: a, esc: esc }) : (c.akkoordHtml || '');

    var html = '<!DOCTYPE html><html lang="nl"><head><meta charset="UTF-8"><title>Startdocument verduurzamingsadvies - ' + esc(opt.naam || 'VvE') + '</title>'
      + '<style>body{font-family:Calibri,sans-serif;font-size:11pt;color:#333;max-width:700px;margin:20px auto;padding:15px;line-height:1.4}'
      + '.knoppen{position:sticky;top:0;background:#fff;padding:6px 0;text-align:right}.knoppen button{font:600 12px Calibri,sans-serif;padding:5px 14px;cursor:pointer}'
      + '@media print{.knoppen{display:none}body{margin:1.5cm}}</style></head><body>'
      + '<div class="knoppen"><button onclick="window.print()">Afdrukken of opslaan als PDF</button></div>'
      + '<h1 style="font-size:18pt;color:#2F5496;margin-bottom:4px;">Startdocument verduurzamingsadvies ' + esc(opt.naam || '') + '</h1>'
      + '<p style="color:#666;font-size:9pt;margin-top:0;">Opgesteld op ' + vandaag + (a.procesbegeleider ? ' door ' + esc(a.procesbegeleider) : (opt.gebruiker ? ' door ' + esc(opt.gebruiker) : '')) + '</p>'
      + (feitenRijen ? '<h2 ' + h2 + '>Gegevens van het gebouw</h2><table ' + tab + '>' + feitenRijen + '</table>' : '')
      + sectiesHtml
      + akkoord
      + (pakket ? '<script type="application/json" id="vve-intake-data">' + JSON.stringify(pakket).replace(/</g, '\\u003c') + '</script>' : '')
      + '</body></html>';
    return html;
  };

  window.VveIntake = { open: open, score: score, startdocument: startdocument, beschikbaar: function () { return !!cfg(); } };
})();
