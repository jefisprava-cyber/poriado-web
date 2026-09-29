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
 *   - Consent Mode v2 v POKROČILOM režime (default denied → update po súhlase)
 *   - cookie lištu aj okno s nastaveniami vrátane štýlov (vloží ich sám)
 *   - uloženie voľby do localStorage pod kľúčom poriado_cookie_consent
 *   - načítanie GA4 hneď, meranie s cookies až po súhlase
 *   - načítanie Meta Pixelu hneď, odosielanie až po súhlase
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

  /* ── 2. Načítanie meracích skriptov — POKROČILÝ REŽIM ──
     Predtým sa GA4 aj Pixel načítali až PO kliknutí na súhlas. Kto lištu
     odmietol alebo si jej nevšimol, ten sa nezmeral vôbec — a keďže väčšina
     ľudí lištu ignoruje, do Google Ads aj Mety chodil zlomok konverzií.
     Algoritmy potom nemali z čoho optimalizovať doručovanie reklám.

     Teraz sa obidva načítajú hneď, ale s predvoleným súhlasom "denied"
     z bodu 1 vyššie. Rozdiel medzi platformami je podstatný:

       GA4  — pri "denied" neukladá cookies ani identifikátory a posiela len
              bezcookiové signály. Google z nich vie konverzie dopočítať,
              takže z odmietnutej návštevy ostane aspoň anonymný signál.

       Meta — nič také ako Consent Mode nemá. Voláme preto fbq consent revoke
              ešte pred inicializáciou, takže Pixel do udelenia súhlasu
              NEODOŠLE NIČ. Získame len to, že po kliknutí na súhlas je už
              načítaný a neujde mu prvá udalosť. Konverzie od ľudí, ktorí
              súhlas nedajú, Meta nezmeria ani takto — to sa dá riešiť jedine
              serverovým Conversions API, čo je samostatná úloha. */
  var gaNacitane = false, pixelNacitany = false, pixelPovoleny = false;

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
    /* Poradie je dôležité — revoke musí byť pred init, inak Pixel stihne
       odoslať prvú udalosť ešte pred zákazom. PageView zámerne nespúšťame
       tu, ale až v povolPixel(), keď ho je komu poslať. */
    fbq('consent', 'revoke');
    fbq('init', PIXEL_ID);
  }

  function povolPixel() {
    if (!pixelNacitany || pixelPovoleny) return;
    pixelPovoleny = true;
    try { fbq('consent', 'grant'); fbq('track', 'PageView'); } catch (e) {}
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
    /* Skripty sú načítané už od začiatku, tu sa len odomyká meranie.
       GA4 si súhlas prevezme sám cez consent update vyššie. */
    if (c.marketing) povolPixel();
    /* Súhlas mohol prísť až teraz — zdroj návštevy sme dovtedy držali len
       v pamäti a od tejto chvíle sa smie uložiť. */
    if (c.marketing && zdrojPamat) ulozZdroj(zdrojPamat);
    try { document.dispatchEvent(new CustomEvent('poriado:suhlas')); } catch (e) {}
  }

  /* Konverzie — volá sa z tlačidiel. GA4 udalosť odíde vždy: so súhlasom
     ako plnohodnotná konverzia, bez neho ako bezcookiový signál. Meta
     udalosť odíde len so súhlasom, dovtedy ju Pixel zahodí sám. */
  /* metaVolby: napr. { eventID: '...' } — rovnaké ID od dvoch zdrojov Meta zlúči. */
  window.konverzia = function (gaNazov, fbNazov, param, metaVolby) {
    var p = param || {};
    try { if (window.gtag) gtag('event', gaNazov, p); } catch (e) {}
    try {
      if (window.fbq) {
        /* value a currency rozumejú obe strany rovnako, items je ale iba
           formát GA4 — Meta chce content_ids a content_type. Prekladáme to
           tu, nech to nemusí riešiť každé volanie zvlášť. */
        var m = {};
        for (var k in p) if (p.hasOwnProperty(k) && k !== 'items') m[k] = p[k];
        if (p.items && p.items.length) {
          m.content_type = 'product';
          m.content_ids = p.items.map(function (i) { return String(i.item_id); });
        }
        if (metaVolby) fbq('track', fbNazov, m, metaVolby);
        else fbq('track', fbNazov, m);
      }
    } catch (e) {}
  };

  /* Stav suhlasu pre ostatne skripty. Rezervacne okno ho posiela do Reenia,
     ktore ma vlastne GA4 aj Pixel a inak meria aj tomu, kto cookies odmietol. */
  window.poriadoSuhlas = function () {
    var c = dajSuhlas();
    return { analytics: !!(c && c.analytics), marketing: !!(c && c.marketing), zodpovedane: !!c };
  };

  /* ── Zdroj návštevy ──
     Rezervácia ani dopyt doteraz nemali kanál, takže sa nedalo povedať, či
     objednávka prišla z reklamy, z vyhľadávania alebo od známeho.

     Prečo cookie a nie sessionStorage, ako to bolo predtým: platba prebieha
     na doméne Bookia a zákazník sa na náš web už nevráti. Zapamätaný zdroj
     musí prežiť zavretú kartu aj niekoľko dní, inak ho pri dodatočnom
     priraďovaní konverzie nemáme odkiaľ vziať. 90 dní je zhodou okolností aj
     lehota, dokedy Google počíta klik (gclid) a Meta klik z reklamy (fbc). */
  var ZDROJ_KEY = 'poriado_zdroj';
  var ZDROJ_DNI = 90;

  /* Identifikátory kliku. gclid je bežný Google Ads; gbraid a wbraid ním Google
     nahrádza pri prekliku z iPhonu, kde sa gclid nesmie preniesť; msclkid je
     Bing, keby sme ho niekedy spustili. Bez týchto troch by nám z reklamy na
     mobile Apple nezostalo vôbec nič. */
  var KLIKY = ['gclid', 'gbraid', 'wbraid', 'fbclid', 'msclkid'];
  var UTM = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];

  function cookieHodnota(meno) {
    try {
      var m = document.cookie.match('(^|;)\\s*' + meno + '\\s*=\\s*([^;]+)');
      return m ? decodeURIComponent(m[2]) : '';
    } catch (e) { return ''; }
  }

  /* Zdroj držíme vždy aj v pamäti stránky. Do cookie a do localStorage ho
     zapíšeme až vtedy, keď návštevník dá marketingový súhlas — pravidlo webu
     znie, že pred súhlasom sa neuloží žiadna cookie, a zdroj návštevy je
     marketingový údaj, nie nevyhnutný. Bez súhlasu teda zdroj žije len do
     zavretia karty a nikam sa neodosiela.
     Keď súhlas príde neskôr (lišta sa odklikne až po chvíli čítania), zdroj
     sa doloží z pamäte — pozri pouziSuhlas(). Inak by sa gclid z prvého
     prekliku stratil hneď, ako návštevník prejde na druhú stránku. */
  var zdrojPamat = null;

  function smieUkladatZdroj() {
    var c = dajSuhlas();
    return !!(c && c.marketing);
  }

  function ulozZdroj(z) {
    zdrojPamat = z;
    if (!smieUkladatZdroj()) return;
    var text = JSON.stringify(z);
    try {
      document.cookie = ZDROJ_KEY + '=' + encodeURIComponent(text) +
        ';path=/;max-age=' + (ZDROJ_DNI * 24 * 60 * 60) + ';SameSite=Lax' +
        (location.protocol === 'https:' ? ';Secure' : '');
    } catch (e) {}
    try { localStorage.setItem(ZDROJ_KEY, text); } catch (e) {}   // záloha, keď cookie neprejde
  }

  function citajZdroj() {
    var s = cookieHodnota(ZDROJ_KEY);
    if (!s) { try { s = localStorage.getItem(ZDROJ_KEY) || ''; } catch (e) {} }
    if (!s) { try { s = sessionStorage.getItem(ZDROJ_KEY) || ''; } catch (e) {} }  // staršie návštevy
    var ulozene = {};
    try { ulozene = s ? JSON.parse(s) : {}; } catch (e) { ulozene = {}; }
    if (!zdrojPamat) return ulozene;
    /* Pamäť má prednosť — je z tejto návštevy, uložené môže byť spred týždňa. */
    var von = {};
    for (var a in ulozene) if (ulozene.hasOwnProperty(a)) von[a] = ulozene[a];
    for (var b in zdrojPamat) if (zdrojPamat.hasOwnProperty(b)) von[b] = zdrojPamat[b];
    return von;
  }

  function zapamatajZdroj() {
    try {
      var u = new URLSearchParams(location.search);
      var z = citajZdroj();
      var novyKlik = false;

      /* Identifikátory kliku prepisujeme — pri priraďovaní konverzie sa počíta
         POSLEDNÝ klik z reklamy, nie prvý. */
      KLIKY.concat(UTM).forEach(function (k) {
        var v = u.get(k);
        if (!v) return;
        z[k] = String(v).slice(0, 200);
        if (KLIKY.indexOf(k) > -1) novyKlik = true;
      });
      if (novyKlik) z.cas_kliku = new Date().toISOString();

      /* Prvý dotyk zapisujeme len raz — pre človeka v tabuľke je to
         užitočnejšie ako posledný preklik po vlastnom webe. */
      if (!z.prvy_cas) {
        z.prvy_cas = new Date().toISOString();
        z.vstup = location.pathname;
        if (document.referrer && document.referrer.indexOf(location.hostname) === -1) {
          z.referrer = document.referrer.slice(0, 200);
        }
      }
      ulozZdroj(z);
    } catch (e) {}
  }

  window.poriadoZdroj = function () {
    var z = citajZdroj();
    /* _fbp a _fbc zakladá Meta Pixel sám; pri dodatočnom posielaní konverzie
       zo servera sú to najsilnejšie údaje na spárovanie s človekom. */
    var fbp = cookieHodnota('_fbp'), fbc = cookieHodnota('_fbc');
    if (fbp) z.fbp = fbp;
    if (fbc) z.fbc = fbc;
    /* Google si gclid odkladá do vlastnej cookie; keď nám chýba z adresy
       (návštevník prišiel cez záložku), vezmeme ho odtiaľ. */
    if (!z.gclid) {
      var aw = cookieHodnota('_gcl_aw');          // tvar GCL.1234567890.<gclid>
      var c = aw.split('.');
      if (c.length > 2) z.gclid = c.slice(2).join('.');
    }
    return z;
  };

  /* Jedna veta, ktorá sa dá rovno prečítať v CRM. */
  window.poriadoZdrojText = function () {
    var z = window.poriadoZdroj();
    var d = [];
    if (z.gclid || z.gbraid || z.wbraid) d.push('Google Ads');
    if (z.msclkid) d.push('Bing Ads');
    if (z.fbclid) d.push('Meta (Facebook/Instagram)');
    if (z.utm_source) d.push(z.utm_source + (z.utm_medium ? ' / ' + z.utm_medium : ''));
    if (z.utm_campaign) d.push('kampaň ' + z.utm_campaign);
    if (!d.length && z.referrer) {
      try { d.push('odkaz z ' + new URL(z.referrer).hostname); } catch (e) { d.push('odkaz'); }
    }
    if (!d.length) d.push('priamo alebo z vyhľadávania');
    if (z.vstup && z.vstup !== '/') d.push('vstup ' + z.vstup);
    return d.join(' · ');
  };

  /* ── Zdroj rezervácie do CRM ──────────────────────────────────────────────
     Rezervácia sa dokončuje v Bookiu, teda na cudzej doméne. Vo chvíli, keď
     je hotová, o nej na našom webe nevieme nič — a Google Ads nemá ako
     priradiť ju ku kliku na reklamu, lebo cookie s gclid je naša, prvej
     strany, a na bookio.com neexistuje.

     Preto v momente, keď návštevník, ktorý prišiel z reklamy, naozaj začne
     rezervovať (a znova, keď ho widget odvedie preč — to je okamih odoslania),
     pošleme do tabuľky jeden riadok: kedy to bolo, aký balík a s akým gclid.
     Skript pri tabuľke potom rezerváciu z Bookia s týmto riadkom spáruje
     podľa času a balíka a vďaka tomu vieme konverziu dodatočne nahrať.

     Odosiela sa LEN pri marketingovom súhlase. Nie je to opatrnosť navyše:
     bez súhlasu sa konverzia s gclid do Google Ads nahrať ani nesmie, takže
     by nám taký riadok bol na nič.
     Bez reklamného identifikátora sa neposiela nič — priame návštevy do
     tabuľky pridávať netreba, tie sa nikam nenahrávajú. */
  var ZDROJ_AKCIA = 'https://script.google.com/macros/s/AKfycbwQtR4rbzSBMcR4CG8koG4anzFlQmOOzKlZZPQN4g3Agz-ppnzu2NwuYzs4yT4kXadp/exec';
  var ZDROJ_TOKEN = 'poriado2026';
  var odoslaneFazy = {};

  window.poriadoZaznamZdroja = function (faza, balik) {
    try {
      if (!smieUkladatZdroj()) return;
      if (odoslaneFazy[faza]) return;               // jedna fáza = jeden riadok

      var z = window.poriadoZdroj();
      var maKlik = false;
      KLIKY.forEach(function (k) { if (z[k]) maKlik = true; });
      if (!maKlik) return;

      odoslaneFazy[faza] = true;

      var p = [];
      function pridaj(k, v) {
        if (v === undefined || v === null || v === '') return;
        p.push(encodeURIComponent(k) + '=' + encodeURIComponent(String(v).slice(0, 300)));
      }
      pridaj('token', ZDROJ_TOKEN);
      pridaj('akcia', 'zdroj');
      pridaj('faza', faza);
      pridaj('balik', balik || '');
      pridaj('cas', new Date().toISOString());
      KLIKY.concat(UTM).forEach(function (k) { pridaj(k, z[k]); });
      ['fbp', 'fbc', 'cas_kliku', 'referrer', 'vstup'].forEach(function (k) { pridaj(k, z[k]); });
      /* User agent prehliadača. Meta ho pri webových udalostiach vyžaduje —
         bez neho sa konverzia nedá odoslať ako udalosť z webu a nespáruje sa
         s človekom. Sem patrí user agent ZÁKAZNÍKA; keby sme ho dopĺňali až
         na serveri, poslali by sme user agent Googlu. */
      pridaj('ua', navigator.userAgent);
      var telo = p.join('&');

      /* sendBeacon prežije aj odchod zo stránky — a práve vtedy ho
         potrebujeme najviac, lebo widget Bookia prehodí celé okno na svoju
         doménu. Keď ho prehliadač nemá (staršie Safari), skúsime fetch
         s keepalive; ten robí to isté, len nie všade. */
      var poslane = false;
      try {
        if (navigator.sendBeacon) {
          var blob = new Blob([telo], { type: 'application/x-www-form-urlencoded' });
          poslane = navigator.sendBeacon(ZDROJ_AKCIA, blob);
        }
      } catch (e) {}
      if (poslane) return;
      try {
        fetch(ZDROJ_AKCIA, {
          method: 'POST', mode: 'no-cors', keepalive: true,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: telo
        })['catch'](function () {});
      } catch (e) {}
    } catch (e) {}
  };

  zapamatajZdroj();

  /* Telefón, WhatsApp a e-mail sú pri tejto službe bežný spôsob objednania,
     ale doteraz sa nemerali vôbec — reklamy o nich nevedeli. */
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var a = t.closest('a[href^="tel:"], a[href*="wa.me"], a[href^="mailto:"]');
    if (!a) return;
    var h = a.getAttribute('href') || '';
    var kanal = h.indexOf('tel:') === 0 ? 'telefon'
              : (h.indexOf('mailto:') === 0 ? 'email' : 'whatsapp');
    /* Jeden človek klikne na telefón aj trikrát, kým sa dovolá. Bez tejto
       poistky z toho boli tri kontakty a reklamné systémy si mysleli, že
       kanál funguje trikrát lepšie, než v skutočnosti. */
    try {
      var kluc = 'poriado_kontakt_' + kanal;
      if (sessionStorage.getItem(kluc)) return;
      sessionStorage.setItem(kluc, '1');
    } catch (e) {}
    if (typeof window.konverzia === 'function') window.konverzia('contact', 'Contact', { kanal: kanal });
  });

  /* Načítavame hneď, bez ohľadu na súhlas — o tom, čo sa smie merať,
     rozhoduje Consent Mode, nie prítomnosť skriptu. */
  nacitajGA();
  nacitajPixel();

  pouziSuhlas();   // ak už súhlas máme z minulej návštevy, použi ho hneď

  /* ── 3. Lišta a okno s nastaveniami ── */
  var CSS = [
    '.pk-lista{position:fixed;left:0;right:0;bottom:0;z-index:200;background:#fff;border-top:1px solid #e3eaf3;box-shadow:0 -8px 30px rgba(15,25,45,.12);padding:18px 0;display:none;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif}',
    '.pk-lista.pk-vidno{display:block}',
    '.pk-vnutro{max-width:1080px;margin:0 auto;padding:0 22px;display:flex;gap:18px;align-items:center;flex-wrap:wrap;justify-content:space-between}',
    '.pk-text{color:#1c2530;font-size:.92rem;line-height:1.5;flex:1;min-width:260px}',
    '.pk-text a{color:#2e75b6;font-weight:600;text-decoration:underline}',
    '.pk-tlacidla{display:flex;gap:10px;flex-wrap:wrap}',
    '.pk-btn{background:#2e75b6;color:#fff;padding:10px 20px;min-height:44px;border-radius:9px;font-weight:700;border:none;cursor:pointer;font-size:.92rem;font-family:inherit;transition:.2s}',
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
    '.pk-prep input:checked+.pk-posuvnik{background:#2e75b6}',
    '.pk-prep input:checked+.pk-posuvnik:before{transform:translateX(20px)}',
    '.pk-prep input:disabled+.pk-posuvnik{background:#2e75b6;opacity:.5;cursor:not-allowed}',
    '.pk-akcie{display:flex;gap:10px;margin-top:20px;flex-wrap:wrap}',
    '.pk-akcie .pk-btn{flex:1}',
    /* Mobil: kratšia lišta — tri rovnako veľké tlačidlá v jednom riadku. */
    '@media(max-width:600px){.pk-lista{padding:12px 0 14px}.pk-vnutro{padding:0 14px;gap:10px}',
      '.pk-text{font-size:.85rem;line-height:1.45;min-width:0;flex-basis:100%}',
      '.pk-tlacidla{display:grid;grid-template-columns:1fr 1fr 1.25fr;gap:8px;width:100%}',
      '.pk-btn{padding:8px 6px;font-size:.84rem}}',
    /* Kým je lišta na obrazovke, bublina chatu (a jej panel) sedí nad ňou, nie cez tlačidlá. */
    'body.pk-on #pch-bubble{bottom:calc(var(--pk-vyska, 0px) + 14px)}',
    'body.pk-on #pch-panel{bottom:calc(var(--pk-vyska, 0px) + 86px);max-height:calc(100vh - var(--pk-vyska, 0px) - 106px)}'
  ].join('\n');

  var HTML =
    '<div class="pk-lista" id="pk-lista" role="region" aria-label="Súhlas s cookies">' +
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

    /* Chat a iné plávajúce prvky potrebujú vedieť, či a aká vysoká je lišta. */
    function hlasListu() {
      var vidno = lista.classList.contains('pk-vidno');
      document.body.classList.toggle('pk-on', vidno);
      if (vidno) document.documentElement.style.setProperty('--pk-vyska', lista.offsetHeight + 'px');
    }
    window.addEventListener('resize', function () { if (lista.classList.contains('pk-vidno')) hlasListu(); });

    function uloz(c) {
      try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) {}
      lista.classList.remove("pk-vidno");
      hlasListu();
      okno.classList.remove("pk-otvorene");
      pouziSuhlas(c);
    }
    function na(id, fn) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('click', fn);
    }

    var ulozeny = dajSuhlas();
    if (!ulozeny) { lista.classList.add('pk-vidno'); hlasListu(); }
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
