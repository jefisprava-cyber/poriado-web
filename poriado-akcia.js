/* poriado-akcia.js — plošná zľava na balíky upratovania
 *
 * Robí dve veci:
 *   1. pri cenách označených atribútom data-akcia prečiarkne bežnú cenu,
 *      dopíše cenu po zľave a pod ňu kód, ktorý ju odomkne;
 *   2. raz za návštevníka ukáže okno so zľavou a kódom.
 *
 * ──────────────────────────────────────────────────────────────────────
 * VYPNUTIE AKCIE = JEDEN RIADOK: ZAPNUTA: false (nižšie v nastavení).
 * Ceny v HTML sa pri akcii neprepisujú, len sa nad ne dokresľuje — takže
 * po vypnutí nie je čo vracať a nedá sa nikde zabudnúť stará cena.
 *
 * Akcia sa navyše skončí SAMA po dátume DO (23:59 toho dňa) aj vtedy, keď
 * sa nič nepushne. ZAPNUTA: false je len na skoršie ukončenie.
 * ──────────────────────────────────────────────────────────────────────
 *
 * Čo sa na akcii NEzúčastňuje a prečo:
 *   - darčekové poukážky a permanentky (poukazky.html, karta Poukážky na
 *     domovskej) — v obchodných podmienkach aj na sluzby.html stojí, že sa
 *     na ne zľavy nevzťahujú, a kód má v Bookiu obmedzenie na služby;
 *   - tepovanie a žehlenie — akcia je na balíky upratovania;
 *   - veta v <h1> na domovskej a súvislý text v odsekoch — prečiarknutá
 *     cena vo vete sa nečíta a v nadpise by sa bila s <title> a JSON-LD.
 *     Bežná cena je naďalej 79,90 €; 71,91 € je cena s kódom.
 *
 * Kód musí zákazník v Bookiu NAPÍSAŤ — do odkazu na widget sa predplniť
 * nedá (Bookio z URL čita len category, service, worker a term). Preto
 * stojí pri každej zľavnenej cene, nie len v okne.
 */
(function () {
  'use strict';

  /* ── NASTAVENIE AKCIE ─────────────────────────────────────────────── */
  var A = {
    ZAPNUTA: true,
    KOD:     'BLACKFRIDAY',
    TYP:     'percent',        // 'percent' = zľava v %, 'eur' = pevná suma
    HODNOTA: 15,               // podľa TYP: 15 = 15 %, pri 'eur' by 10 = 10 €
    NAZOV:   'Black Friday',    // '' → v okne bude len „Zľava do …"
    OD:      '',                // '' → beží hneď; inak napr. '2026-11-27'
    DO:      '2026-11-30',      // posledný deň, kedy sa dá kód zadať (vrátane)
    /* Príklad v okne. Musí sedieť s balíkom Mini v Bookiu. */
    PRIKLAD_NAZOV: 'Mini',
    PRIKLAD_CENA:  79.90,
    /* Kategória upratovania v Bookiu — tlačidlo v okne vedie na ňu. */
    KATEGORIA: '42936'
  };
  /* ─────────────────────────────────────────────────────────────────── */

  var KLUC = 'poriado_akcia_' + A.KOD;   // nový kód = okno sa ukáže znova

  function bezi() {
    if (!A.ZAPNUTA) return false;
    var teraz = new Date();
    var do_ = new Date(A.DO + 'T23:59:59');
    if (isNaN(do_.getTime())) return false;    // zlý dátum → radšej nebeží
    if (teraz > do_) return false;
    if (A.OD) {
      var od = new Date(A.OD + 'T00:00:00');
      if (isNaN(od.getTime()) || teraz < od) return false;
    }
    return true;
  }
  if (!bezi()) return;

  var MESIACE = ['januára', 'februára', 'marca', 'apríla', 'mája', 'júna',
                 'júla', 'augusta', 'septembra', 'októbra', 'novembra', 'decembra'];

  function doSlovom() {
    var d = new Date(A.DO + 'T12:00:00');
    return d.getDate() + '. ' + MESIACE[d.getMonth()];
  }

  function suma(cislo) {
    return cislo.toFixed(2).replace('.', ',') + ' €';
  }
  /* Bookio zaokrúhli na centy ZĽAVU (od polovice nahor) a až tú odráta —
     nie výslednú cenu. Overené na potvrdení rezervácie z 20. 11. 2026:
     Klasik 139,90 €, kód −15 % → „Zľavový kód: SOLIDARITA15 (−20.99 €),
     cena po zľave 118.91 €". Zaokrúhlením výslednej ceny by vyšlo 118,92 €
     a na webe by svietilo o cent viac, než zákazník naozaj zaplatí.
     Počíta sa v centoch, aby do toho nehovorili desatinné čísla. */
  function poZlave(zaklad) {
    var centy = Math.round(zaklad * 100);
    var zlava = (A.TYP === 'eur')
      ? Math.round(A.HODNOTA * 100)                 // pevná suma — bez zaokrúhľovania
      : Math.round(centy * A.HODNOTA / 100);
    if (zlava >= centy) zlava = 0;                  // poistka proti cene pod nulou
    return suma((centy - zlava) / 100);
  }

  /* „15 %" alebo „10 €" — bez zbytočných núl za čiarkou. */
  function zlavaSlovom() {
    if (A.TYP !== 'eur') return A.HODNOTA + ' %';
    return suma(A.HODNOTA).replace(',00 €', ' €');
  }

  /* ── ŠTÝLY ────────────────────────────────────────────────────────── */
  /* Farby ako var(--premenná, #záložná) — rovnako ako ostatné štyri
     widgety, aby zmena :root prefarbila aj toto. Prečiarknutá cena je
     zámerne --muted, nie zlatá: zlatá na webe označuje výhodu a toto je
     cena, ktorú zákazník neplatí (rovnaká logika ako .cenik .predtym). */
  var CSS = [
    /* vizuálne skryté, ale čítačka to prečíta */
    '.pa-skryt{position:absolute;width:1px;height:1px;margin:-1px;padding:0;',
      'overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}',

    '.pa-cena{white-space:normal}',
    '.pa-staro{text-decoration:line-through;font-weight:600;color:var(--muted,#5b6675)}',
    '.pa-novo{font-weight:800}',
    '.pa-kod{display:block;font-size:.72rem;font-weight:700;line-height:1.3;',
      'margin-top:2px;white-space:normal;color:var(--gold-text,#6B4E00)}',

    /* Cenníkový zoznam (sluzby.html): prečiarknutá nad novou cenou. */
    '.cenik .pa-cena{line-height:1.25}',
    '.cenik .pa-cena .pa-staro{display:block;font-size:.8rem}',
    '.cenik .pa-cena .pa-kod{font-size:.7rem}',

    /* Karty na domovskej. Prečiarknutá cena tu zostáva v riadku, aby sa
       predchádzajúce „od " nezlomilo na samostatný riadok; zalomí až
       nová cena pod ňou. */
    '.kat .pa-cena .pa-staro{font-size:.82rem}',
    '.kat .pa-cena .pa-novo{display:block}',
    '.kat .pa-cena .pa-kod{font-size:.68rem}',

    /* Zlatý štítok v úvodnom riadku: na zlatej ploche smie byť len tmavý
       text, takže tu je aj prečiarknutá cena a kód navy (8,72:1), nie
       --muted ani --gold-text. */
    '.hodiny .pa-cena{text-align:right;line-height:1.2}',
    '.hodiny .pa-cena .pa-staro{display:block;font-size:.72rem;font-weight:700;',
      'color:var(--navy,#471683)}',
    '.hodiny .pa-cena .pa-kod{font-size:.62rem;letter-spacing:.2px;',
      'color:var(--navy,#471683)}',

    /* Lepiaca lišta na telefóne — najmenej miesta na webe. */
    '.mlista .pa-cena .pa-staro{font-size:.8rem}',
    '.mlista .pa-cena .pa-kod{font-size:.66rem;margin-top:1px}',

    /* ── okno ── */
    '.pa-prekryv{position:fixed;inset:0;background:rgba(71,22,131,.55);',
      'display:none;align-items:center;justify-content:center;padding:20px;',
      'z-index:9994;overflow-y:auto}',
    '.pa-prekryv.pa-vidno{display:flex}',
    '.pa-okno{position:relative;width:100%;max-width:400px;background:#fff;',
      'border-radius:16px;padding:26px 24px 22px;',
      'box-shadow:0 24px 60px rgba(71,22,131,.28);',
      'font-family:\'Instrument Sans\',-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;',
      'color:var(--ink,#1c2530);text-align:center}',
    '.pa-x{position:absolute;top:6px;right:6px;width:44px;height:44px;',
      'border:none;background:none;cursor:pointer;border-radius:9px;',
      'color:var(--muted,#5b6675);font-size:1.5rem;line-height:1}',
    '.pa-x:hover,.pa-x:focus-visible{background:var(--bg,#FAF7FF);color:var(--navy,#471683)}',
    '.pa-kicker{font-size:.76rem;font-weight:700;letter-spacing:.6px;',
      'text-transform:uppercase;color:var(--gold-text,#6B4E00);margin-bottom:8px}',
    '.pa-okno h3{margin:0 0 10px;font-size:1.3rem;font-weight:800;line-height:1.25;',
      'letter-spacing:-.4px;color:var(--navy,#471683)}',
    '.pa-okno p{margin:0 0 16px;font-size:.95rem;line-height:1.6}',
    '.pa-kodbox{display:flex;align-items:stretch;gap:8px;margin-bottom:14px;',
      'padding:10px;background:var(--light,#F8F4FF);border-radius:11px}',
    '.pa-kodtext{flex:1;display:flex;align-items:center;justify-content:center;',
      'font-family:inherit;font-size:1.12rem;font-weight:800;letter-spacing:1.5px;',
      'color:var(--navy,#471683)}',
    '.pa-kopia{flex:none;min-height:44px;padding:0 14px;border:none;border-radius:9px;',
      'background:var(--blue,#7424D6);color:#fff;font-family:inherit;font-size:.88rem;',
      'font-weight:700;cursor:pointer}',
    '.pa-kopia:hover,.pa-kopia:focus-visible{background:var(--blue-tmava,#5C1DAA)}',
    '.pa-btn{display:block;padding:13px 22px;border-radius:9px;',
      'background:var(--gold,#FFD632);color:var(--navy,#471683);',
      'font-size:.95rem;font-weight:700;text-decoration:none}',
    '.pa-btn:hover,.pa-btn:focus-visible{background:var(--gold-tmava,#E8C01C)}',
    '.pa-note{margin:14px 0 0 !important;font-size:.8rem !important;',
      'color:var(--muted,#5b6675);line-height:1.5 !important}',
    '@media(max-width:420px){.pa-okno{padding:22px 18px 18px}',
      '.pa-okno h3{font-size:1.18rem}}',

    /* Pás v rezervačnom okne, nad widgetom Bookia. */
    '.pa-pas{margin:0 0 14px;padding:11px 14px;border-radius:11px;',
      'background:var(--light,#F8F4FF);border:1px solid #E9E2F7;',
      'font-size:.92rem;line-height:1.5;color:var(--ink,#1c2530)}',
    '.pa-pas b{color:var(--gold-text,#6B4E00)}',
    '.pa-pas .pa-kodtext{display:inline;font-size:1rem;letter-spacing:1px}'
  ].join('');

  function styly() {
    if (document.getElementById('pa-styl')) return;
    var s = document.createElement('style');
    s.id = 'pa-styl';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  /* ── CENY ─────────────────────────────────────────────────────────── */

  function uniknut(t) { return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  /* Nájde v prvku textový uzol s danou cenou. Hľadá sa v uzloch, nie v
     innerHTML — prvok môže mať vnorené <small> alebo <b> a prepis celého
     innerHTML by z nich urobil nový obsah bez naviazaných posluchačov. */
  function najdiUzol(el, hladane) {
    var ch = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
    var u;
    while ((u = ch.nextNode())) {
      if (hladane.test(u.nodeValue)) return u;
    }
    return null;
  }

  function prepisCeny() {
    var prvky = document.querySelectorAll('[data-akcia]');
    var i;
    for (i = 0; i < prvky.length; i++) {
      var el = prvky[i];
      if (el.classList.contains('pa-cena')) continue;        // už hotové

      var zapis  = (el.getAttribute('data-akcia') || '').trim();
      var zaklad = parseFloat(zapis.replace(',', '.'));
      if (!zapis || isNaN(zaklad) || zaklad <= 0) continue;

      /* Cena aj s eurom, aby sa prečiarkla „79,90 €" a nie len „79,90".
         Medzera môže byť aj nezlomiteľná (&nbsp;), preto \s aj  . */
      var re  = new RegExp(uniknut(zapis) + '[\\s\\u00a0]*€');
      var uz  = najdiUzol(el, re);
      if (!uz) { re = new RegExp(uniknut(zapis)); uz = najdiUzol(el, re); }
      if (!uz) continue;                                      // cena sa zmenila → nerob nič

      var text  = uz.nodeValue;
      var zhoda = text.match(re);
      var od    = zhoda.index;
      var dlzka = zhoda[0].length;

      var rodic = uz.parentNode;
      var zvysok = uz.splitText(od);                 // zvysok začína cenou
      zvysok.nodeValue = zvysok.nodeValue.slice(dlzka);

      var kus = document.createDocumentFragment();

      var popis = document.createElement('span');
      popis.className = 'pa-skryt';
      popis.textContent = 'Bežná cena ';
      kus.appendChild(popis);

      var staro = document.createElement('s');
      staro.className = 'pa-staro';
      staro.textContent = zhoda[0];
      kus.appendChild(staro);

      kus.appendChild(document.createTextNode(' '));

      var novo = document.createElement('span');
      novo.className = 'pa-novo';
      novo.textContent = poZlave(zaklad);
      kus.appendChild(novo);

      if (el.getAttribute('data-akcia-kod') !== 'nie') {
        var kod = document.createElement('span');
        kod.className = 'pa-kod';
        kod.textContent = 's kódom ' + A.KOD;
        kus.appendChild(kod);
      }

      rodic.insertBefore(kus, zvysok);
      el.classList.add('pa-cena');
    }
  }

  /* ── OKNO ─────────────────────────────────────────────────────────── */

  var prekryv = null, otvaral = null;

  function postavOkno() {
    var p = document.createElement('div');
    p.className = 'pa-prekryv';
    p.id = 'pa-prekryv';

    var o = document.createElement('div');
    o.className = 'pa-okno';
    o.setAttribute('role', 'dialog');
    o.setAttribute('aria-modal', 'true');
    o.setAttribute('aria-labelledby', 'pa-titul');

    var x = document.createElement('button');
    x.type = 'button';
    x.className = 'pa-x';
    x.setAttribute('aria-label', 'Zavrieť');
    x.innerHTML = '&times;';

    var kicker = document.createElement('div');
    kicker.className = 'pa-kicker';
    kicker.textContent = (A.NAZOV ? A.NAZOV + ' · do ' : 'Zľava do ') + doSlovom();

    var h = document.createElement('h3');
    h.id = 'pa-titul';
    h.textContent = (A.TYP === 'eur')
      ? zlavaSlovom() + ' z každého balíka upratovania'
      : zlavaSlovom() + ' na všetky balíky upratovania';

    var t = document.createElement('p');
    t.textContent = 'Kód zadáte v rezervácii a z ceny balíka vám odrátame ' +
      zlavaSlovom() + '. Balík ' + A.PRIKLAD_NAZOV + ' tak stojí ' +
      poZlave(A.PRIKLAD_CENA) + ' namiesto ' + suma(A.PRIKLAD_CENA) + '.';

    var box = document.createElement('div');
    box.className = 'pa-kodbox';
    var kodtext = document.createElement('code');
    kodtext.className = 'pa-kodtext';
    kodtext.textContent = A.KOD;
    var kopia = document.createElement('button');
    kopia.type = 'button';
    kopia.className = 'pa-kopia';
    kopia.textContent = 'Kopírovať';
    box.appendChild(kodtext);
    box.appendChild(kopia);

    /* Skutočný odkaz na widget: poriado-rezervacia.js ho odchytí a otvorí
       v okne (posluchač je na document, takže platí aj pre prvky vložené
       takto neskôr). Kde ten skript nie je, odkaz funguje normálne. */
    var btn = document.createElement('a');
    btn.className = 'pa-btn';
    btn.href = 'https://services.bookio.com/poriado-sor759f2/widget?lang=sk&category=' + A.KATEGORIA;
    btn.setAttribute('data-open-rezervacia', '');
    btn.setAttribute('data-kategoria', A.KATEGORIA);
    btn.textContent = 'Rezervovať termín';

    var note = document.createElement('p');
    note.className = 'pa-note';
    note.textContent = 'Na darčekové poukážky a permanentky sa zľava nevzťahuje.';

    o.appendChild(x); o.appendChild(kicker); o.appendChild(h); o.appendChild(t);
    o.appendChild(box); o.appendChild(btn); o.appendChild(note);
    p.appendChild(o);
    document.body.appendChild(p);

    x.addEventListener('click', zavri);
    btn.addEventListener('click', function () { zapamatuj(); zavri(true); });
    p.addEventListener('click', function (e) { if (e.target === p) zavri(); });

    kopia.addEventListener('click', function () {
      var hotovo = function () {
        kopia.textContent = 'Skopírované';
        setTimeout(function () { kopia.textContent = 'Kopírovať'; }, 2000);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(A.KOD).then(hotovo, function () { oznac(kodtext); });
      } else {
        oznac(kodtext);
      }
    });

    return p;
  }

  /* Keď clipboard nejde (staršie prehliadače, stránka bez HTTPS), aspoň
     kód označíme, aby sa dal skopírovať ručne. */
  function oznac(el) {
    try {
      var r = document.createRange();
      r.selectNodeContents(el);
      var s = window.getSelection();
      s.removeAllRanges();
      s.addRange(r);
    } catch (e) {}
  }

  function zapamatuj() {
    try { localStorage.setItem(KLUC, '1'); } catch (e) {}
  }

  function fokusovatelne() {
    if (!prekryv) return [];
    return Array.prototype.filter.call(
      prekryv.querySelectorAll('a[href],button'),
      function (el) { return el.offsetParent !== null; }
    );
  }

  function naKlavesu(e) {
    if (!prekryv || !prekryv.classList.contains('pa-vidno')) return;
    if (e.key === 'Escape') { zavri(); return; }
    if (e.key !== 'Tab') return;
    var f = fokusovatelne();
    if (!f.length) return;
    var prvy = f[0], posledny = f[f.length - 1];
    if (e.shiftKey && document.activeElement === prvy) { e.preventDefault(); posledny.focus(); }
    else if (!e.shiftKey && document.activeElement === posledny) { e.preventDefault(); prvy.focus(); }
  }

  function otvor() {
    styly();
    if (!prekryv) prekryv = postavOkno();
    otvaral = document.activeElement;
    prekryv.classList.add('pa-vidno');
    zapamatuj();
    var h = document.getElementById('pa-titul');
    if (h) { h.setAttribute('tabindex', '-1'); h.focus(); }
  }

  /* bezFokusu: po kliknutí na „Rezervovať termín" sa fokus nevracia —
     preberá ho rezervačné okno, ktoré sa práve otvára. */
  function zavri(bezFokusu) {
    if (!prekryv) return;
    prekryv.classList.remove('pa-vidno');
    if (!bezFokusu && otvaral && typeof otvaral.focus === 'function') otvaral.focus();
    otvaral = null;
  }

  /* Okno nesmie prekryť cookie lištu (bez nej sa nedá dať súhlas) ani
     rezervačné okno či okno dopytu. Preto sa čaká, kým je obrazovka voľná. */
  function volno() {
    var b = document.body;
    return !b.classList.contains('pk-on') &&
           !b.classList.contains('pr-okno-otvorene') &&
           !b.classList.contains('pd-okno-otvorene');
  }

  function naplanuj() {
    try { if (localStorage.getItem(KLUC)) return; } catch (e) {}

    var hotovo = false, pokusov = 0;
    function skus() {
      if (hotovo) return;
      if (volno()) { hotovo = true; otvor(); return; }
      if (++pokusov > 300) return;                // ~4 minúty a dosť
      setTimeout(skus, 800);
    }

    /* Hlavná cesta: chvíľu po načítaní. Kým je na obrazovke cookie lišta
       alebo iné okno, skúša sa ďalej — človek sa na cookie lištu rozhoduje
       aj pol minúty a dovtedy by sa akcia inak nikdy neukázala. */
    setTimeout(skus, 2500);

    /* A ešte raz hneď po udelení súhlasu, nech sa nečaká na ďalší tik. */
    document.addEventListener('poriado:suhlas', function () {
      setTimeout(skus, 1800);
    });
  }

  /* ── PÁS V REZERVAČNOM OKNE ───────────────────────────────────────── */

  /* Kód musí byť na očiach práve tam, kde sa zadáva. Nápoveda vnútri
     widgetu („zadajte kód SOLIDARITA15") je nastavenie Bookia, do ktorého
     odtiaľto nevidíme — rám okna je ale náš a riadok sa doň vložiť dá.
     Rovnaký obal #bookio-obal má aj formulár priamo v stránke na
     rezervacia.html, takže to platí pre obe podoby. */
  function pasVOkne() {
    var obal = document.getElementById('bookio-obal');
    if (!obal || !obal.parentNode) return;
    if (obal.parentNode.querySelector('.pa-pas')) return;     // už tam je

    var p = document.createElement('p');
    p.className = 'pa-pas';
    p.appendChild(document.createTextNode('Zľava −' + zlavaSlovom() +
      ' na balíky upratovania do ' + doSlovom() + ' — pri dokončení rezervácie zadajte kód '));
    var k = document.createElement('b');
    k.className = 'pa-kodtext';
    k.textContent = A.KOD;
    p.appendChild(k);
    p.appendChild(document.createTextNode('.'));

    obal.parentNode.insertBefore(p, obal);
  }

  function sledujOkno() {
    pasVOkne();                                   // formulár priamo v stránke
    setTimeout(pasVOkne, 400);                    // keby sa staval neskôr
    if (!window.MutationObserver) return;
    /* Rezervačné okno sa stavia až pri prvom otvorení — vtedy pribudne
       telu trieda pr-okno-otvorene. */
    new MutationObserver(function () {
      if (document.body.classList.contains('pr-okno-otvorene')) pasVOkne();
    }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  /* ── START ────────────────────────────────────────────────────────── */

  function start() {
    styly();
    prepisCeny();
    sledujOkno();
    document.addEventListener('keydown', naKlavesu);
    naplanuj();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
