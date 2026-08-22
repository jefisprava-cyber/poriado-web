/*
 * PORIADO — rezervačné okno, spoločné pre celý web.
 * ---------------------------------------------------------------------------
 * Vloženie na stránku:
 *
 *     <script src="poriado-rezervacia.js" defer><\/script>
 *
 * Okno sa otvorí:
 *   - klikom na čokoľvek s atribútom  data-open-rezervacia
 *     (voliteľne  data-balik="mini|klasik|maxi|tepovanie"  ide rovno na balík)
 *   - klikom na akýkoľvek odkaz smerujúci na rezervacie.poriado.sk — ten sa
 *     prepíše na otvorenie okna, aby návštevník neodišiel z poriado.sk preč.
 *     Z Reenia sa totiž nemá ako vrátiť späť.
 *
 * Pri otvorení zavolá window.konverzia('begin_checkout', 'InitiateCheckout')
 * z poriado-meranie.js. Meranie je teda na jednom mieste — v tomto súbore —
 * a nesmie sa duplikovať inde, inak by sa konverzia počítala dvakrát.
 *
 * Vlastné triedy majú predponu pr- a farby sú zapísané priamo, nie cez CSS
 * premenné — podstránky majú vlastné palety a okno musí vyzerať všade rovnako.
 */
(function () {
  'use strict';

  var WIDGET = 'https://reenio.sk/sk/GI3DSMRZ/widget-iframe.js';

  /* Cesty do Reenia na konkrétny balík. Widget ich berie cez atribút data-url
     a pripája k adrese https://poriado.reenio.sk/sk/iframe — zákazník tak
     preskočí výber balíka a rovno vidí kalendár. Bez balíka sa zobrazí zoznam. */
  var BALIKY = {
    mini:      '/view/mini-3-hodiny-r132830',
    klasik:    '/view/klasik-6-hodin-r132831',
    maxi:      '/view/maxi-9-hodin-r132832',
    tepovanie: '/view/tepovanie-r132833'
  };

  var STYL = [
    '.pr-prekryv{position:fixed;inset:0;background:rgba(15,25,45,.55);display:none;',
      'align-items:flex-start;justify-content:center;padding:30px 16px;z-index:100;overflow-y:auto}',
    '.pr-prekryv.pr-otvorene{display:flex}',
    '.pr-okno{background:#fff;border-radius:16px;max-width:1000px;width:100%;padding:30px 22px;',
      'position:relative;box-shadow:0 30px 70px rgba(0,0,0,.35);',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;',
      'color:#1c2530;line-height:1.6;text-align:left}',
    '.pr-okno h3{color:#1f3864;font-size:1.4rem;margin:0 0 6px;font-weight:700}',
    '.pr-sub{color:#5b6675;font-size:.95rem;margin:0 0 20px;line-height:1.55}',
    '.pr-sub b{color:#1f3864}',
    '.pr-zavri{position:absolute;top:14px;right:18px;background:none;border:none;font-size:1.7rem;',
      'color:#5f6875;cursor:pointer;line-height:1;padding:0}',
    '.pr-zavri:hover{color:#1f3864}',
    '#reenio-container{min-height:280px}',
    '@media(max-width:640px){.pr-okno{padding:24px 12px}}'
  ].join('');

  var HTML =
    '<div class="pr-okno" role="dialog" aria-modal="true" aria-labelledby="pr-nadpis">' +
      '<button class="pr-zavri" id="rezervacia-close" type="button" aria-label="Zavrieť">&times;</button>' +
      '<h3 id="pr-nadpis">Rezervácia termínu</h3>' +
      '<p class="pr-sub"><b>Vyberte si balík a termín, ktorý vám sedí — potvrdenie máte okamžite.</b> ' +
        'Zaplatíte, ako vám vyhovuje: kartou hneď online, alebo prevodom cez faktúru s QR kódom, ' +
        'ktorú pošleme e-mailom. Zrušenie zdarma do 24 hodín pred termínom.</p>' +
      '<div id="reenio-container"></div>' +
    '</div>';

  var nacitane = false;

  function vlozStyl() {
    if (document.getElementById('pr-styl')) return;
    var s = document.createElement('style');
    s.id = 'pr-styl';
    s.appendChild(document.createTextNode(STYL));
    document.head.appendChild(s);
  }

  /* Každý balík má vlastný panel s vlastným widgetom. Panely sa iba prepínajú
     zobrazením, nikdy sa neodstraňujú — keby sme už načítaný widget vybrali
     z DOM, jeho poslucháči by ďalej volali postMessage na neexistujúci iframe
     a sypali chyby do konzoly. */
  function nastavBalik(balik) {
    var c = document.getElementById('reenio-container');
    if (!c) return;
    var kluc = balik && BALIKY[balik] ? balik : 'vsetky';

    var panely = c.querySelectorAll('[data-balik-panel]');
    for (var i = 0; i < panely.length; i++) panely[i].style.display = 'none';

    var panel = c.querySelector('[data-balik-panel="' + kluc + '"]');
    if (!panel) {
      panel = document.createElement('div');
      panel.setAttribute('data-balik-panel', kluc);
      var d = document.createElement('div');
      d.className = 'reenio-iframe';
      d.setAttribute('data-size', 'auto');
      if (kluc !== 'vsetky') d.setAttribute('data-url', BALIKY[kluc]);
      panel.appendChild(d);
      c.insertBefore(panel, c.firstChild);
    }
    panel.style.display = '';
  }

  function start() {
    if (document.getElementById('rezervacia-modal')) return;   // už tam je

    vlozStyl();
    var prekryv = document.createElement('div');
    prekryv.className = 'pr-prekryv';
    prekryv.id = 'rezervacia-modal';
    prekryv.innerHTML = HTML;
    document.body.appendChild(prekryv);

    function otvor(balik) {
      prekryv.classList.add('pr-otvorene');
      if (typeof window.konverzia === 'function') window.konverzia('begin_checkout', 'InitiateCheckout');
      nastavBalik(balik);
      if (!nacitane) {
        var s = document.createElement('script');
        s.src = WIDGET;
        s.async = true; s.defer = true;
        var c = document.getElementById('reenio-container');
        if (c) c.appendChild(s);
        nacitane = true;
      }
    }
    function zavri() { prekryv.classList.remove('pr-otvorene'); }

    /* Klik chytáme na dokumente, nie na jednotlivých tlačidlách. Chat sa totiž
       vkladá až po tomto skripte a jeho odkaz "Rezervovať termín" by inak nikto
       neodchytil — na podstránke by návštevníka odviedol na hlavnú stránku.
       Href pri odkazoch nechávam, aby bez JavaScriptu fungovali ako predtým. */
    var VYBER = '[data-open-rezervacia], a[href*="rezervacie.poriado.sk"], a[href$="#rezervacia"]';
    document.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var el = t.closest(VYBER);
      if (!el) return;
      e.preventDefault();
      otvor(el.getAttribute('data-balik'));
    });

    document.getElementById('rezervacia-close').addEventListener('click', zavri);
    prekryv.addEventListener('click', function (e) { if (e.target === prekryv) zavri(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && prekryv.classList.contains('pr-otvorene')) zavri();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
