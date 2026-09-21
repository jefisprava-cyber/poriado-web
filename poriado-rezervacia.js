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

  /* Bez tohto sa kalendár otvorí na dnešku a keď je dnes plno, zákazník vidí
     „V tento deň nie je dostupný žiadny termín" a musí klikať ďalej. Parameter
     ;nearestAvailable=1 (s bodkočiarkou, nie s otáznikom) ho otvorí rovno na
     najbližšom dni s voľným termínom. Reenio ho nemá v dokumentácii — je vyčítaný
     z jeho kódu a overený 21. 9. 2026. Ak ho raz prestane poznať, kalendár sa
     jednoducho otvorí na dnešku ako predtým. */
  var NAJBLIZSI_TERMIN = ';nearestAvailable=1';

  var STYL = [
    '.pr-prekryv{position:fixed;inset:0;background:rgba(15,25,45,.55);display:none;',
      'align-items:flex-start;justify-content:center;padding:30px 16px;z-index:9995;overflow-y:auto}',
    '.pr-prekryv.pr-otvorene{display:flex}',
    /* Kym je okno otvorene, bublina chatu nesmie prekryvat formular ani tlacidla. */
    'body.pr-okno-otvorene #pch-bubble{display:none !important}',
    '.pr-okno{background:#fff;border-radius:16px;max-width:1000px;width:100%;padding:30px 22px;',
      'position:relative;box-shadow:0 30px 70px rgba(0,0,0,.35);',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;',
      'color:#1c2530;line-height:1.6;text-align:left}',
    '.pr-okno h3{color:#1f3864;font-size:1.4rem;margin:0 0 6px;font-weight:700}',
    '.pr-sub{color:#5b6675;font-size:.95rem;margin:0 0 20px;line-height:1.55}',
    '.pr-sub b{color:#1f3864}',
    /* Krížik sedí v nulovo vysokom lepiacom obale — keď sa okno na mobile zroluje
       (kalendár Reenia je dlhý), ostane hore na obrazovke a netreba sa vracať. */
    '.pr-zavri-obal{position:sticky;top:26px;height:0;z-index:5}',
    '.pr-zavri{position:absolute;top:-16px;right:-12px;width:44px;height:44px;border-radius:50%;',
      'background:#fff;border:1px solid #e3eaf3;box-shadow:0 4px 14px rgba(15,25,45,.14);',
      'font-size:1.6rem;color:#5f6875;cursor:pointer;line-height:1;padding:0;',
      'display:flex;align-items:center;justify-content:center}',
    '.pr-zavri:hover{color:#1f3864}',
    '#reenio-container{min-height:280px}',
    '@media(max-width:640px){.pr-okno{padding:24px 12px}.pr-zavri-obal{top:24px}.pr-zavri{top:-14px;right:-4px}}'
  ].join('');

  var HTML =
    '<div class="pr-okno" role="dialog" aria-modal="true" aria-labelledby="pr-nadpis">' +
      '<div class="pr-zavri-obal"><button class="pr-zavri" id="rezervacia-close" type="button" aria-label="Zavrieť">&times;</button></div>' +
      '<h3 id="pr-nadpis">Rezervácia termínu</h3>' +
      '<p class="pr-sub"><b>Vyberte si balík a termín, ktorý vám sedí — potvrdenie máte okamžite.</b> ' +
        'Zaplatíte, ako vám vyhovuje: kartou hneď online, alebo prevodom cez faktúru s QR kódom, ' +
        'ktorú pošleme e-mailom. Zrušenie zdarma do 24 hodín pred termínom. ' +
        'Nemusíte byť doma celý čas — stačí nás pustiť dnu a povedať priority.</p>' +
      '<div id="reenio-container"></div>' +
    '</div>';

  var nacitane = false;

  /* Reenio vie po dokonceni rezervacie zavolat funkciu na stranke — meno si berie
     z atributu data-reservation-created. Bez toho reklamy vidia len otvorenie okna. */
  var HOTOVA = 'poriadoRezervaciaHotova';
  var CENY = { mini: 79.90, klasik: 129.90, maxi: 169.90, tepovanie: 40 };

  /* Reenio pri dokončení posiela { reservationId, price, currency, transactionId }.
     Samo zároveň odosiela do Mety Purchase s ID udalosti = transactionId a do GA4
     purchase s tým istým transaction_id. Keď naše udalosti nesú rovnaké ID, Meta
     aj GA4 ich s tými od Reenia zlúčia do jedného nákupu — Pixel v Reeniu tak
     môže ostať zapnutý (kampane na ňom stoja) a nič sa nezapočíta dvakrát. */
  window[HOTOVA] = function (data) {
    var d = data || {};
    var hodnota = 0;
    try { hodnota = Number(d.price || d.totalPrice || d.amount || d.sum || 0); } catch (e) {}
    if (!(hodnota > 0)) hodnota = CENY[posledny] || 0;
    var mena = (typeof d.currency === 'string' && d.currency) ? d.currency : 'EUR';
    var idTransakcie = d.transactionId || d.reservationId || null;

    var param = hodnota > 0 ? { value: hodnota, currency: mena } : {};
    if (idTransakcie) param.transaction_id = String(idTransakcie);
    var meta = idTransakcie ? { eventID: String(idTransakcie) } : undefined;
    if (typeof window.konverzia === 'function') window.konverzia('purchase', 'Purchase', param, meta);
  };

  /* Reenio ma vlastne GA4 a Pixel. Bez tychto atributov meria aj tomu, kto
     cookies odmietol. Widget zmenu atributu sam prenesie do iframu. */
  function suhlasNaDiv(d) {
    var s = (typeof window.poriadoSuhlas === 'function') ? window.poriadoSuhlas() : null;
    d.setAttribute('data-analytics-consent', s && s.analytics ? 'true' : 'false');
    d.setAttribute('data-marketing-consent', s && s.marketing ? 'true' : 'false');
  }
  document.addEventListener('poriado:suhlas', function () {
    var divy = document.querySelectorAll('#reenio-container .reenio-iframe');
    for (var i = 0; i < divy.length; i++) suhlasNaDiv(divy[i]);
  });

  var posledny = 'vsetky';

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
    posledny = kluc;

    var panely = c.querySelectorAll('[data-balik-panel]');
    for (var i = 0; i < panely.length; i++) panely[i].style.display = 'none';

    var panel = c.querySelector('[data-balik-panel="' + kluc + '"]');
    if (!panel) {
      panel = document.createElement('div');
      panel.setAttribute('data-balik-panel', kluc);
      var d = document.createElement('div');
      d.className = 'reenio-iframe';
      d.setAttribute('data-size', 'auto');
      d.setAttribute('data-reservation-created', HOTOVA);
      suhlasNaDiv(d);
      if (kluc !== 'vsetky') d.setAttribute('data-url', BALIKY[kluc] + NAJBLIZSI_TERMIN);
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
      document.body.classList.add('pr-okno-otvorene');
      var chat = document.getElementById('pch-panel');
      if (chat) chat.classList.remove('open');   // inak ostane otvoreny nad oknom
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
    function zavri() {
      prekryv.classList.remove('pr-otvorene');
      document.body.classList.remove('pr-okno-otvorene');
    }

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
