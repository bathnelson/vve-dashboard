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

  var antwoordTekst = function (v, w) {
    if (leeg(w)) return '';
    if (Array.isArray(w)) return w.join(', ');
    if (v.type === 'datum' && /^\d{4}-\d{2}-\d{2}$/.test(w)) { var d = w.split('-'); return d[2] + '-' + d[1] + '-' + d[0]; }
    return String(w) + (v.eenheid ? ' ' + v.eenheid : '');
  };

  // ── stijl ───────────────────────────────────────────────────────────
  var STIJL = '\
.vi-achter{position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:10000;display:flex;align-items:stretch;justify-content:center;padding:24px;font-family:"Segoe UI",system-ui,-apple-system,sans-serif;font-size:13px;color:#323130}\
.vi-paneel{position:relative;background:#fff;width:100%;max-width:1120px;display:flex;flex-direction:column;box-shadow:0 8px 32px rgba(0,0,0,.25);min-height:0}\
.vi-kop{display:flex;align-items:center;gap:16px;padding:12px 18px;border-bottom:1px solid #e1dfdd}\
.vi-kop h2{font-size:16px;font-weight:600;margin:0;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\
.vi-kop .vi-sub{font-size:12px;color:#605e5c;font-weight:400}\
.vi-score{display:flex;align-items:center;gap:8px;cursor:pointer;padding:4px 10px;border:1px solid #e1dfdd;background:#faf9f8}\
.vi-score b{font-size:20px;font-variant-numeric:tabular-nums;color:var(--vd-accent,#217346)}\
.vi-score span{font-size:11px;color:#605e5c;line-height:1.3}\
.vi-romp{display:flex;flex:1;min-height:0}\
.vi-nav{width:210px;border-right:1px solid #e1dfdd;overflow:auto;padding:8px 0;flex-shrink:0;background:#faf9f8}\
.vi-nav a{display:flex;justify-content:space-between;gap:6px;padding:7px 14px;color:#323130;text-decoration:none;cursor:pointer;border-left:3px solid transparent}\
.vi-nav a:hover{background:#f3f2f1}\
.vi-nav a.is-aan{border-left-color:var(--vd-accent,#217346);background:#fff;font-weight:600}\
.vi-nav a small{color:#a19f9d;font-weight:400;font-variant-numeric:tabular-nums}\
.vi-inhoud{flex:1;overflow:auto;padding:4px 24px 240px;min-width:0}\
.vi-sectie h3{font-size:14px;font-weight:600;color:var(--vd-accent,#217346);margin:22px 0 4px;padding-bottom:4px;border-bottom:1px solid #edebe9}\
.vi-feiten{display:grid;grid-template-columns:minmax(140px,220px) 1fr;gap:3px 14px;margin:8px 0 4px}\
.vi-feiten div:nth-child(odd){color:#605e5c}\
.vi-vraag{padding:10px 0;border-bottom:1px solid #f3f2f1}\
.vi-vraag>label,.vi-vraag>.vi-vt{display:block;font-weight:600;margin-bottom:6px}\
.vi-tag{display:inline-block;font-size:10px;font-weight:600;padding:0 4px;margin-left:6px;border:1px solid #c8c6c4;color:#605e5c;vertical-align:1px}\
.vi-tag.k{border-color:var(--vd-accent,#217346);color:var(--vd-accent,#217346)}\
.vi-hulp{font-weight:400;color:#605e5c;font-size:12px;margin:-3px 0 6px}\
.vi-opties{display:flex;flex-wrap:wrap;gap:6px}\
.vi-opties label{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border:1px solid #c8c6c4;cursor:pointer;background:#fff;user-select:none}\
.vi-opties label:hover{border-color:#8a8886}\
.vi-opties input{position:absolute;opacity:0;pointer-events:none}\
.vi-opties label.is-aan{border-color:var(--vd-accent,#217346);background:var(--vd-accent-licht,#f0faf4);color:var(--vd-accent-donker,#1a5c38)}\
.vi-opties label.onbekend{color:#8a8886;border-style:dashed}\
.vi-opties label.onbekend.is-aan{color:#605e5c;background:#f3f2f1;border-color:#8a8886}\
.vi-inv{font:inherit;padding:5px 8px;border:1px solid #c8c6c4;min-width:180px}\
.vi-inv:focus{outline:none;border-color:var(--vd-accent,#217346)}\
textarea.vi-inv{width:100%;min-height:64px;resize:vertical}\
.vi-voet{display:flex;align-items:center;gap:8px;padding:10px 18px;border-top:1px solid #e1dfdd;background:#faf9f8}\
.vi-voet .vi-status{flex:1;color:#605e5c;font-size:12px}\
.vi-knop{font:600 13px "Segoe UI",system-ui,sans-serif;padding:6px 16px;border:1px solid #8a8886;background:#fff;color:#323130;cursor:pointer}\
.vi-knop:hover{background:#f3f2f1}\
.vi-knop.hoofd{background:var(--vd-accent,#217346);border-color:var(--vd-accent,#217346);color:#fff}\
.vi-knop.hoofd:hover{background:var(--vd-accent-donker,#1a5c38)}\
.vi-uitleg{position:absolute;right:18px;top:58px;width:380px;max-height:70vh;overflow:auto;background:#fff;border:1px solid #c8c6c4;box-shadow:0 6px 24px rgba(0,0,0,.18);padding:12px 14px;z-index:2}\
.vi-uitleg h4{margin:0 0 6px;font-size:13px}\
.vi-uitleg table{width:100%;border-collapse:collapse;font-size:12px}\
.vi-uitleg td{padding:3px 4px;border-bottom:1px solid #f3f2f1;vertical-align:top}\
.vi-uitleg td.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}\
.vi-uitleg .vi-balk{height:4px;background:#edebe9;margin-top:3px}\
.vi-uitleg .vi-balk i{display:block;height:4px;background:var(--vd-accent,#217346)}\
.vi-uitleg p{color:#605e5c;font-size:11px;margin:8px 0 0}\
.vi-notities{position:absolute;right:20px;bottom:62px;width:330px;background:#fffbe6;border:1px solid #e3d48a;box-shadow:0 6px 20px rgba(0,0,0,.18);z-index:3;display:flex;flex-direction:column}\
.vi-notities header{display:flex;align-items:center;gap:8px;padding:6px 10px;border-bottom:1px solid #eee2a8;font-weight:600;cursor:pointer}\
.vi-notities header span{flex:1}\
.vi-notities header small{font-weight:400;color:#8a7a2a}\
.vi-notities textarea{font:inherit;border:0;background:transparent;padding:8px 10px;height:170px;resize:vertical;outline:none}\
.vi-notities.dicht{width:auto}\
.vi-notities.dicht textarea{display:none}\
.vi-notities.dicht header{border-bottom:0}\
@media (max-width:760px){.vi-achter{padding:0}.vi-nav{display:none}.vi-uitleg{left:8px;right:8px;width:auto}}';

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
      + '<h2>Intakeformulier <span class="vi-sub">' + esc(opt.naam || opt.vveId) + '</span></h2>'
      + '<div class="vi-score" title="Kansrijkheid: alleen voor intern gebruik, staat niet in het startdocument"><b>–</b><span>kansrijk<br><em style="font-style:normal">0% ingevuld</em></span></div>'
      + '</div>'
      + '<div class="vi-romp"><nav class="vi-nav"></nav><div class="vi-inhoud"></div></div>'
      + '<div class="vi-voet"><div class="vi-status"></div>'
      + '<button type="button" class="vi-knop" data-doe="sluit">Sluiten</button>'
      + '<button type="button" class="vi-knop" data-doe="startdoc">Startdocument</button>'
      + '<button type="button" class="vi-knop hoofd" data-doe="opslaan">Opslaan</button></div>'
      + '</div>';
    document.body.appendChild(achter);

    var nav = achter.querySelector('.vi-nav');
    var inhoud = achter.querySelector('.vi-inhoud');
    var scoreEl = achter.querySelector('.vi-score');
    var statusEl = achter.querySelector('.vi-status');
    var kop = achter.querySelector('.vi-kop');
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
      scoreEl.querySelector('b').textContent = s.score === null ? '–' : s.score;
      scoreEl.querySelector('em').textContent = s.volledigheid + '% ingevuld';
      tekenUitleg(s);
      // voortgang per sectie in de navigatie
      secties.forEach(function (sec) {
        if (sec.feiten) return;
        var vr = (sec.vragen || []).filter(function (v) { return zichtbaar(v, a); });
        var klaar = vr.filter(function (v) { return !leeg(a[v.id]); }).length;
        var el = nav.querySelector('[data-sectie="' + sec.id + '"] small');
        if (el) el.textContent = klaar + '/' + vr.length;
      });
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

    var tekenVraag = function (v) {
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
      link.innerHTML = '<span>' + esc(sec.titel) + '</span><small></small>';
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
          return '<div>' + esc(f[0]) + '</div><div>' + (f[2] ? f[1] : esc(f[1])) + '</div>';
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
      if (doe === 'startdoc') {
        if (gewijzigd && !opslaan()) return;
        startdocument({ naam: opt.naam, feiten: feiten, antwoorden: a, gebruiker: opt.gebruiker });
      }
    });

    zetStatus();
    herreken();
  };

  // ── startdocument ───────────────────────────────────────────────────
  // Leesbaar en af te drukken, met akkoordtekst uit de config. Zonder score:
  // die is voor intern gebruik.
  var startdocument = function (opt) {
    var c = cfg();
    if (!c) return;
    var a = opt.antwoorden || {};
    var vandaag = new Date().toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' });
    var td = 'style="padding:4px 8px;border:1px solid #bbb;vertical-align:top;font-size:11pt;"';
    var tl = 'style="padding:4px 8px;border:1px solid #bbb;vertical-align:top;font-size:11pt;font-weight:bold;background:#f2f2f2;width:42%;"';
    var tab = 'style="border-collapse:collapse;width:100%;margin-bottom:14px;table-layout:fixed;"';
    var h2 = 'style="font-size:13pt;color:#2F5496;margin:18px 0 6px;"';

    var feitenRijen = (opt.feiten || []).filter(function (f) { return f[1] !== '' && f[1] != null; })
      .map(function (f) { return '<tr><td ' + tl + '>' + esc(f[0]) + '</td><td ' + td + '>' + (f[2] ? f[1] : esc(f[1])) + '</td></tr>'; }).join('');

    var sectiesHtml = (c.secties || []).filter(function (s) { return !s.nietInStartdocument; }).map(function (s) {
      var rijen = (s.vragen || []).filter(function (v) { return zichtbaar(v, a) && !v.nietInStartdocument; }).map(function (v) {
        var t = antwoordTekst(v, a[v.id]);
        return '<tr><td ' + tl + '>' + esc(v.kort || v.vraag) + '</td><td ' + td + '>' + (t ? esc(t).replace(/\n/g, '<br>') : '<span style="color:#999">–</span>') + '</td></tr>';
      }).join('');
      return rijen ? '<h2 ' + h2 + '>' + esc(s.titel) + '</h2><table ' + tab + '>' + rijen + '</table>' : '';
    }).join('');

    var akkoord = typeof c.akkoordHtml === 'function' ? c.akkoordHtml({ naam: opt.naam, datum: vandaag }) : (c.akkoordHtml || '');

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
      + '</body></html>';
    var w = window.open('', '_blank');
    if (!w) { alert('Het startdocument kon niet worden geopend. Sta pop-ups toe voor het dashboard.'); return; }
    w.document.write(html);
    w.document.close();
    w.focus();
  };

  // ── voor de exportdialoog ──────────────────────────────────────────
  // Eén kolom per vraag: id, label, sectie en of de vraag voor het
  // adviesbureau is bedoeld (a: true). exportWaarde geeft het antwoord als
  // tekst, leeg als de vraag bij deze antwoorden niet aan de orde is.
  var exportVelden = function () {
    var c = cfg();
    if (!c) return [];
    return alleVragen(c).filter(function (x) { return x.vraag && x.vraag.id; }).map(function (x) {
      var v = x.vraag;
      return { id: v.id, label: v.kort || v.vraag, vraag: v.vraag, sectie: x.sectie.titel, adv: !!v.a, k: !!v.k, type: v.type };
    });
  };
  var exportWaarde = function (id, antwoorden) {
    var c = cfg();
    if (!c || !antwoorden) return '';
    var x = alleVragen(c).filter(function (y) { return y.vraag.id === id; })[0];
    if (!x || !zichtbaar(x.vraag, antwoorden)) return '';
    return antwoordTekst(x.vraag, antwoorden[id]);
  };

  window.VveIntake = { open: open, score: score, startdocument: startdocument, exportVelden: exportVelden, exportWaarde: exportWaarde, beschikbaar: function () { return !!cfg(); } };
})();
