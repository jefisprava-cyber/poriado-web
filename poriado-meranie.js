/**
 * PORIADO — súhlas s cookies + meranie (GA4, Meta Pixel), spoločné pre celý web.
 *
 * VLOŽ DO <head> KAŽDEJ STRÁNKY značku script s atribútom
 *     src="poriado-meranie.js"  — a BEZ atribútu defer.
 *     (Ukážku značky tu zámerne nepíšem celú: sekvencia ukončujúcej
 *      script značky by v komentári predčasne ukončila celý skript,
 *      keby ho niekto vložil priamo do stránky.)
 *
 * Bez defer preto, že Google Consent Mode musí nastaviť predvolené "denied"
 * skôr, než sa čokoľvek meracie vôbec načíta. Zvyšok (lišta, tlačidlá) sa
 * dorobí až po načítaní stránky, takže to nič nespomalí.
 *
 * Súbor rieši všetko naraz:
 *   - Consent Mode v2 (default denied → update po súhlase)
 *   - cookie lištu aj okno s nastaveniami vrátane štýlov (vloží ich sám)
 *   - uloženie voľby do localStorage pod kľúčom poriado_cookie_consent
 *   - načítanie GA4 až po súhlase s analytickými cookies
 *   - načítanie Meta Pixelu až po súhlase s marketingovými cookies
 *   - funkciu window.konverzia(gaNazov, fbNazov) na meranie konverzií
 *
 * Farby sú zapísané natvrdo, nie cez CSS premenné — podstránky majú vlastné
 * sady premenných a lišta musí vyzerať rovnako všade.
 */
(function () {
  'use strict';

  var KEY       = 'poriado_cookie_consent';
  var GA_ID     = 'G-BN8T9S3MTS';
  var PIXEL_ID  = '939652179152863';
  var ODKAZ_GDPR = 'ochrana-osobnych-udajov.html';

  /* ── 1. Consent Mode — musí bežať okamžite ── */
  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== 'function') {
    window.gtag = function () { window.dataLayer.push(arguments); };
  }
  gtag('consent', 'default', {
    ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
    analytics_storage: 'denied', wait_for_update: 500
  });

  /* ── 2. Načítanie meracích skriptov ── */
  var gaNacitane = false, pixelNacitany = false;

  function nacitajGA() {
    if (gaNacitane) return;
    gaNacitane = true;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);
    gtag('js', new Date());
    gtag('config', GA_ID);
  }

  function nacitajPixel() {
    if (pixelNacitany) return;
    pixelNacitany = true;
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
      t = b.createElement(e); t.async = !0; t.src = v;
      s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', PIXEL_ID);
    fbq('track', 'PageView');
  }

  function dajSuhlas() {
    try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; }
  }

  /* Súhlas sa dá odovzdať priamo — po kliknutí na tlačidlo tak nezávisíme
     na tom, či sa zápis do localStorage naozaj podaril. */
  function pouziSuhlas(suhlas) {
    var c = suhlas || dajSuhlas();
    if (!c) return;
    gtag('consent', 'update', {
      analytics_storage:  c.analytics ? 'granted' : 'denied',
      ad_storage:         c.marketing ? 'granted' : 'denied',
      ad_user_data:       c.marketing ? 'granted' : 'denied',
      ad_personalization: c.marketing ? 'granted' : 'denied'
    });
    if (c.analytics) nacitajGA();
    if (c.marketing) nacitajPixel();
  }

  /* Konverzie — volá sa z tlačidiel. Ak návštevník meranie odmietol,
     window.gtag/fbq jednoducho nič neodošlú. */
  window.konverzia = function (gaNazov, fbNazov) {
    try { if (window.gtag) gtag('event', gaNazov); } catch (e) {}
    try { if (window.fbq)  fbq('track', fbNazov); } catch (e) {}
  };

  pouziSuhlas();   // ak už súhlas máme z minulej návštevy, použi ho hneď

  /* ── 3. Lišta a okno s nastaveniami ── */
  var CSS = [
    '.pk-lista{position:fixed;left:0;right:0;bottom:0;z-index:200;background:#fff;border-top:1px solid #e3eaf3;box-shadow:0 -8px 30px rgba(15,25,45,.12);padding:18px 0;display:none;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif}',
    '.pk-lista.pk-vidno{display:block}',
    '.pk-vnutro{max-width:1080px;margin:0 auto;padding:0 22px;display:flex;gap:18px;align-items:center;flex-wrap:wrap;justify-content:space-between}',
    '.pk-text{color:#1c2530;font-size:.92rem;line-height:1.5;flex:1;min-width:260px}',
    '.pk-text a{color:#2e75b6;font-weight:600;text-decoration:underline}',
    '.pk-tlacidla{display:flex;gap:10px;flex-wrap:wrap}',
    '.pk-btn{background:#2e75b6;color:#fff;padding:10px 20px;border-radius:9px;font-weight:700;border:none;cursor:pointer;font-size:.92rem;font-family:inherit;transition:.2s}',
    '.pk-btn:hover{background:#1f3864}',
    '.pk-btn-ghost{background:transparent;color:#1f3864;border:2px solid #2e75b6}',
    '.pk-btn-ghost:hover{background:#2e75b6;color:#fff}',
    '.pk-prekryv{position:fixed;inset:0;background:rgba(15,25,45,.55);display:none;align-items:center;justify-content:center;padding:20px;z-index:210}',
    '.pk-prekryv.pk-otvorene{display:flex}',
    '.pk-okno{background:#fff;border-radius:16px;max-width:520px;width:100%;padding:28px;box-shadow:0 30px 70px rgba(0,0,0,.35);max-height:90vh;overflow-y:auto;font-family:inherit}',
    '.pk-okno h3{color:#1f3864;font-size:1.3rem;margin:0 0 14px}',
    '.pk-okno p{color:#5b6675;font-size:.93rem;margin:0 0 16px;line-height:1.6}',
    '.pk-riadok{display:flex;gap:14px;align-items:flex-start;padding:14px 0;border-top:1px solid #eef2f7}',
    '.pk-riadok b{color:#1c2530;display:block;font-size:.95rem}',
    '.pk-riadok span{color:#5b6675;font-size:.86rem;display:block;margin-top:2px}',
    '.pk-prep{position:relative;width:44px;height:24px;flex-shrink:0;margin-left:auto}',
    '.pk-prep input{opacity:0;width:0;height:0}',
    '.pk-posuvnik{position:absolute;inset:0;background:#c7cfda;border-radius:24px;cursor:pointer;transition:.2s}',
    '.pk-posuvnik:before{content:"";position:absolute;height:18px;width:18px;left:3px;top:3px;background:#fff;border-radius:50%;transition:.2s}',
    '.pk-prep input:checked+.pk-posuvnik{background:#19b07a}',
    '.pk-prep input:checked+.pk-posuvnik:before{transform:translateX(20px)}',
    '.pk-prep input:disabled+.pk-posuvnik{background:#2e75b6;opacity:.5;cursor:not-allowed}',
    '.pk-akcie{display:flex;gap:10px;margin-top:20px;flex-wrap:wrap}',
    '.pk-akcie .pk-btn{flex:1}'
  ].join('\n');

  var HTML =
    '<div class="pk-lista" id="pk-lista">' +
      '<div class="pk-vnutro">' +
        '<div class="pk-text"><b>Používame cookies.</b> Nevyhnutné sú vždy aktívne. Analytické a marketingové používame len s vaším súhlasom. Viac v <a href="' + ODKAZ_GDPR + '">zásadách ochrany údajov</a>.</div>' +
        '<div class="pk-tlacidla">' +
          '<button type="button" class="pk-btn pk-btn-ghost" id="pk-nastavenia">Nastavenia</button>' +
          '<button type="button" class="pk-btn pk-btn-ghost" id="pk-odmietnut">Odmietnuť</button>' +
          '<button type="button" class="pk-btn" id="pk-prijat">Prijať všetko</button>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="pk-prekryv" id="pk-okno-prekryv">' +
      '<div class="pk-okno">' +
        '<h3>Nastavenia cookies</h3>' +
        '<p>Vyberte si, ktoré cookies môžeme používať. Voľbu môžete kedykoľvek zmeniť odkazom v pätičke.</p>' +
        '<div class="pk-riadok"><div><b>Nevyhnutné</b><span>Potrebné na fungovanie stránky. Nedajú sa vypnúť.</span></div>' +
          '<label class="pk-prep"><input type="checkbox" checked disabled><span class="pk-posuvnik"></span></label></div>' +
        '<div class="pk-riadok"><div><b>Analytické</b><span>Anonymné štatistiky návštevnosti (Google Analytics).</span></div>' +
          '<label class="pk-prep"><input type="checkbox" id="pk-analytika"><span class="pk-posuvnik"></span></label></div>' +
        '<div class="pk-riadok"><div><b>Marketingové</b><span>Meranie účinnosti reklamy (Meta Pixel).</span></div>' +
          '<label class="pk-prep"><input type="checkbox" id="pk-marketing"><span class="pk-posuvnik"></span></label></div>' +
        '<div class="pk-akcie">' +
          '<button type="button" class="pk-btn pk-btn-ghost" id="pk-ulozit">Uložiť výber</button>' +
          '<button type="button" class="pk-btn" id="pk-prijat-vsetko">Prijať všetko</button>' +
        '</div>' +
      '</div>' +
    '</div>';

  function pripoj() {
    if (document.getElementById('pk-lista')) return;   // už tam je

    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    var obal = document.createElement('div');
    obal.innerHTML = HTML;
    while (obal.firstChild) document.body.appendChild(obal.firstChild);

    var lista  = document.getElementById('pk-lista');
    var okno   = document.getElementById('pk-okno-prekryv');
    var aChk   = document.getElementById('pk-analytika');
    var mChk   = document.getElementById('pk-marketing');

    function uloz(c) {
      try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) {}
      lista.classList.remove("pk-vidno");
      okno.classList.remove("pk-otvorene");
      pouziSuhlas(c);
    }
    function na(id, fn) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('click', fn);
    }

    var ulozeny = dajSuhlas();
    if (!ulozeny) lista.classList.add('pk-vidno');
    else { aChk.checked = !!ulozeny.analytics; mChk.checked = !!ulozeny.marketing; }

    na('pk-prijat',        function () { uloz({ necessary: true, analytics: true,  marketing: true  }); });
    na('pk-prijat-vsetko', function () { uloz({ necessary: true, analytics: true,  marketing: true  }); });
    na('pk-odmietnut',     function () { uloz({ necessary: true, analytics: false, marketing: false }); });
    na('pk-nastavenia',    function () { okno.classList.add('pk-otvorene'); });
    na('pk-ulozit',        function () { uloz({ necessary: true, analytics: aChk.checked, marketing: mChk.checked }); });
    okno.addEventListener('click', function (e) { if (e.target === okno) okno.classList.remove('pk-otvorene'); });

    /* Odkaz "Nastavenia cookies" v pätičke — na každej stránke má id cookie-reopen */
    na('cookie-reopen', function (e) {
      e.preventDefault();
      var s = dajSuhlas();
      if (s) { aChk.checked = !!s.analytics; mChk.checked = !!s.marketing; }
      okno.classList.add('pk-otvorene');
    });

    /* Rezervačnú konverziu (begin_checkout / InitiateCheckout) meria
       poriado-rezervacia.js pri otvorení okna. Zámerne to nie je aj tu —
       obidve miesta by ju započítali dvakrát. */
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', pripoj);
  } else {
    pripoj();
  }
})();
