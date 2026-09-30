/*
 * PORIADO — rezervačné okno, spoločné pre celý web.  (Bookio, od 28. 9. 2026)
 * ---------------------------------------------------------------------------
 * Vloženie na stránku:
 *
 *     <script src="poriado-rezervacia.js" defer><\/script>
 *
 * Okno sa otvorí:
 *   - klikom na čokoľvek s atribútom  data-open-rezervacia
 *     (voliteľne  data-balik="mini|klasik|maxi|tepovanie"  ide rovno na balík)
 *   - klikom na akýkoľvek odkaz smerujúci na services.bookio.com — ten sa
 *     prepíše na otvorenie okna, aby návštevník neodišiel z poriado.sk preč.
 *     Z Bookia sa totiž nemá ako vrátiť späť.
 *     Staré odkazy na rezervacie.poriado.sk (Reenio) chytáme tiež — sú ešte
 *     vo firemnom profile Google, v podpise e-mailu a v šablóne faktúry
 *     v KROSe a tie sa nedajú prepísať naraz. Kým tam sú, otvoria naše okno.
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

  /* ═══════════════════════════════════════════════════════════════════════
     PREPÍNAČ VERZIE PLATBY — JEDINÉ MIESTO, KTORÉ SA MENÍ
     'prevod' = verzia A: v Bookiu nie je zapnutá platba, platí sa prevodom.
     'karta'  = verzia B: v Bookiu je pri službách nastavená platba kartou.
     Prepnutie na verziu B: zmeniť riadok nižšie na 'karta' a pushnúť.
     V Bookiu treba zároveň pri všetkých štyroch službách nastaviť spôsob
     platby (paymentType) — bez toho by text sľuboval kartu, ktorú widget
     neponúkne. Poradie: najprv Bookio, potom tento riadok.
     ═══════════════════════════════════════════════════════════════════════ */
  var PLATBA = 'karta';

  /* Poučenie podľa zákona o ochrane spotrebiteľa pri predaji na diaľku.
     Obchodné podmienky sľubujú, že ho uvádzame pri rezervačnom formulári.
     Stojí teda POD formulárom, nie nad ním — hore by z neho urobilo prvú vetu,
     ktorú zákazník pri rezervácii prečíta, a to je právnický text, nie ponúka.
     Rovnaké znenie má aj stránka rezervacia.html. */
  var POUCENIE = 'Ak je termín skôr ako o 14 dní, odoslaním rezervácie nás žiadate ' +
    'o poskytnutie služby v tomto termíne; po jej úplnom poskytnutí právo ' +
    'odstúpiť od zmluvy do 14 dní zaniká.';

  /* Veta pod nadpisom okna. Obe verzie sú tu natvrdo, prepína sa len kľúč
     vyššie — aby sa pri prepnutí nič nepísalo a nedalo sa pomýliť.
     Zámerne je krátka: hneď pod ňou má Bookio vlastný modrý rámček s cenami,
     doplnkami a podmienkami. Keď bolo dlhé oboje, okno začínalo stenou textu
     a zákazník sa k výberu balíka prerolovával. */
  var TEXTY = {
    prevod:
      '<b>Vyberte si balík a termín — potvrdenie máte okamžite.</b> ' +
      'Platí sa prevodom: faktúru s QR kódom pošleme e-mailom do 24 hodín. ' +
      'Zrušenie zdarma do 24 hodín pred termínom.',
    karta:
      '<b>Vyberte si balík a termín — potvrdenie máte okamžite.</b> ' +
      'Rezerváciu dokončíte online platbou. ' +
      'Zrušenie zdarma do 24 hodín pred termínom.'
  };

  /* ── Bookio ──────────────────────────────────────────────────────────── */

  var ORIGIN = 'https://services.bookio.com';

  /* hiddenHeader=true schová hlavičku widgetu — logo Bookia s naším názvom,
     odkaz na www.poriado.sk a vlajočku na prepnutie jazyka. V našom okne je
     hlavička zbytočná (zákazník vie, kde je) a tlačila výber balíka o 70 px
     nadol. Vlajočka navyše vedela prepnúť widget do češtiny, po ktorej by
     potvrdzovací e-mail prišiel po česky a parser do tabuľky by ho neprečítal.
     Overené na widgete 26. 9. 2026: vlastný text prevádzky ostáva, mizne len
     hlavička. Keby parameter raz prestal fungovať, zobrazí sa hlavička ako
     predtým — nič sa nerozbije. */
  var ZAKLAD = ORIGIN + '/poriado-sor759f2/widget?lang=sk&hiddenHeader=true';

  /* Služby v Bookiu — jedna tabuľka, tri údaje na riadok:
       id    — deep-link &service=<id>, overený naživo 26. 9. 2026: widget
               službu predvyberie, rozbalí doplnky a zobrazí kalendár aj časy.
               Parameter &category= netreba, prevádzka nemá kategórie.
       cena  — náhradná suma, keby v správe o dokončení chýbal eventTotal.
       nazov — presne to, čo Bookio posiela v payloade ako eventValue,
               malými písmenami. Podľa neho vieme cenu dohľadať aj vtedy,
               keď sa okno otvorilo všeobecným tlačidlom a nevieme, aký
               balík si zákazník vybral až vnútri widgetu (nález 4).
     Kritika navrhovala druhú samostatnú mapu CENY_PODLA_NAZVU. Dal som
     všetko do jednej tabuľky zámerne: cena 79,90 zapísaná na dvoch miestach
     by sa pri najbližšej zmene cenníka rozišla a konverzie by ticho hlásili
     starú sumu. Takto sa mení na jednom riadku.
     Pozor: služba 173509 sa v Bookiu volá "Tepovanie " s medzerou na konci
     (bod 5.1 runbooku) — preto sa názov pred porovnaním vždy trimuje. */
  var SLUZBY = {
    mini:      { id: 173506, cena: 79.90, nazov: 'Mini' },
    klasik:    { id: 173507, cena: 129.90, nazov: 'Klasik' },
    maxi:      { id: 173508, cena: 169.90, nazov: 'Maxi' },
    tepovanie: { id: 173509, cena: 40, nazov: 'Tepovanie' }
  };

  /* Meno iframu. Bookio ho vracia v každej správe ako pole iframeId (posiela
     window.name), takže podľa neho odlíšime naše správy od cudzích. */
  var RAM_NAZOV = 'poriado-bookio';

  /* Identifikátory kliku z reklamy sa do adresy widgetu ZÁMERNE nepridávajú.
     Chvíľu tu boli — v konfigurácii widgetu je pole reservationSource.url a
     vyzeralo to, že si doň Bookio uloží celú adresu aj s gclid. Preverením
     28. 9. 2026 sa ukázalo, že to tak nie je:
       - reservationSource.url je len prepis hlavičky Referer, teda adresa
         NAŠEJ stránky, z ktorej sa widget načítal — a tú prehliadače pri
         odkaze na cudziu doménu skracujú na holú doménu,
       - parametre adresy widgetu si Bookio síce naparsuje do options.urlParams,
         ale do rezervácie ich neposiela; slúžia mu len na čakaciu listinu a
         na odkaz „nová rezervácia" na ďakovnej stránke.
     Posielať Bookiu gclid teda nemá žiadny účinok, a keďže gclid je v EÚ
     osobný údaj, posielať ho tretej strane bez účelu je horšie než ho
     neposlať. Zdroj si preto držíme u seba — pozri poriado-meranie.js,
     funkciu poriadoZaznamZdroja, a párovanie v ZDROJE-reklama.js. */
  function adresa(balik) {
    return SLUZBY[balik] ? (ZAKLAD + '&service=' + SLUZBY[balik].id) : ZAKLAD;
  }

  /* Parametre pre begin_checkout. Bez hodnoty a meny si Google aj Meta
     dosadia jednotku a potom optimalizujú na „niekto otvoril kalendár za
     jedno euro". Keď zákazník klikol na konkrétny balík, vieme presnú cenu;
     pri všeobecnom tlačidle použijeme Klasik ako stredný balík — je to menej,
     než je priemer skutočných zákaziek, takže hodnotu skôr podceníme. */
  var CENA_NEZNAMY_BALIK = 129.90;

  /* item_id je kľúč balíka ('mini', 'klasik', …), nie číslo služby v Bookiu.
     Ten istý kľúč posiela do Mety aj dokončený nákup zo servera
     (META-capi.js, content_ids). Keby sa tu použilo číslo z Bookia, Meta by
     začatú a dokončenú rezerváciu považovala za dva rôzne produkty a nevedela
     by povedať, ktorý balík sa naozaj predáva. */
  function parametreZaciatku(kluc) {
    var s = SLUZBY[kluc];
    if (!s) return { value: CENA_NEZNAMY_BALIK, currency: 'EUR' };
    return {
      value: s.cena,
      currency: 'EUR',
      items: [{ item_id: kluc, item_name: s.nazov, price: s.cena, quantity: 1 }]
    };
  }

  /* Cena podľa kľúča balíka ('vsetky' cenu nemá — vtedy 0). */
  function cenaBalika(balik) {
    return SLUZBY[balik] ? SLUZBY[balik].cena : 0;
  }

  /* Cena podľa názvu služby z Bookia. */
  function cenaPodlaNazvu(nazov) {
    if (typeof nazov !== 'string') return 0;
    var n = nazov.trim().toLowerCase();
    /* Porovnávame podreťazcom, nie na presnú zhodu. Služby sa v Bookiu volajú
       „3h Mini", „6h Klasik", „9h Maxi" a názov sa už raz menil („01 Mini");
       pri presnej zhode by táto náhrada prestala fungovať po každom
       premenovaní a nikto by si to nevšimol. */
    for (var k in SLUZBY) {
      if (SLUZBY.hasOwnProperty(k) && n.indexOf(SLUZBY[k].nazov.toLowerCase()) > -1) return SLUZBY[k].cena;
    }
    return 0;
  }

  /* Oficiálny skript widget.bookio.js ZÁMERNE NENAČÍTAME. Je to len polyfill
     plynulého rolovania plus obsluha, ktorá pri správe REQUEST_IFRAME_SCROLL
     zavolá window.scrollTo() — teda odroluje CELÚ STRÁNKU pod naším oknom.
     Naše okno je pevný prekryv, ktorý si roluje sám, takže by sa rolovalo
     úplne inde, než zákazník pozerá. Navyše neoveruje origin správy a správu
     INIT_IFRAME_SCROLL nepozná vôbec. Obe správy, ktoré potrebujeme, si preto
     obsluhujeme sami nižšie — je to pár riadkov a rolujeme vlastný prekryv.
     Id iframu necháme bookio-iframe, ako si ho ten skript hľadá: keby ho
     niekto v budúcnosti predsa pridal, nájde si správny prvok. */

  var STYL = [
    /* overscroll-behavior:contain — keď je prekryv dorolovaný na koniec (na
       mobile po ~1500 px kalendára veľmi ľahko), ďalšie ťahanie prstom by sa
       prelialo na stránku pod oknom. overflow:hidden na <body> zámerne
       nedávam: na iOS stratí pozíciu rolovania stránky. (nález 8) */
    '.pr-prekryv{position:fixed;inset:0;background:rgba(15,25,45,.55);display:none;',
      'align-items:flex-start;justify-content:center;padding:30px 16px;z-index:9995;',
      'overflow-y:auto;overscroll-behavior:contain}',
    '.pr-prekryv.pr-otvorene{display:flex}',
    /* Kym je okno otvorene, bublina chatu nesmie prekryvat formular ani tlacidla. */
    'body.pr-okno-otvorene #pch-bubble{display:none !important}',
    /* Cookie lišta musí ostať klikateľná aj nad rezervačným oknom. Bez toho
       návštevník, ktorý príde na cenník a klikne rovno "Rezervovať", nemá ako
       dať súhlas — a Pixel je do súhlasu v stave revoke, takže Meta jeho
       InitiateCheckout aj Purchase zahodí. Bookio v rámci vlastnú lištu
       nezobrazuje (viď blok "Súhlas s cookies" nižšie), takže sa dve lišty
       neprekryjú. (nález 2) */
    'body.pr-okno-otvorene .pk-lista{z-index:9996}',
    'body.pr-okno-otvorene .pk-prekryv{z-index:9997}',
    '.pr-okno{background:#fff;border-radius:16px;max-width:1000px;width:100%;padding:30px 22px;',
      'position:relative;box-shadow:0 30px 70px rgba(0,0,0,.35);',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;',
      'color:#1c2530;line-height:1.6;text-align:left}',
    '.pr-okno h3{color:#1f3864;font-size:1.4rem;margin:0 0 6px;font-weight:700}',
    '.pr-sub{color:#5b6675;font-size:.95rem;margin:0 0 20px;line-height:1.55}',
    '.pr-sub b{color:#1f3864}',
    /* Zákonné poučenie — patrí sem, ale nesmie prekričať vetu o tom, čo má
       zákazník urobiť. Preto menšie a svetlejšie, no stále nad 4,5:1. */
    '.pr-pozn{display:block;margin-top:8px;font-size:.85rem;color:#6b7684}',
    /* Krížik sedí v nulovo vysokom lepiacom obale — keď sa okno na mobile zroluje
       (kalendár Bookia je dlhý), ostane hore na obrazovke a netreba sa vracať. */
    '.pr-zavri-obal{position:sticky;top:26px;height:0;z-index:5}',
    '.pr-zavri{position:absolute;top:-16px;right:-12px;width:44px;height:44px;border-radius:50%;',
      'background:#fff;border:1px solid #e3eaf3;box-shadow:0 4px 14px rgba(15,25,45,.14);',
      'font-size:1.6rem;color:#5f6875;cursor:pointer;line-height:1;padding:0;',
      'display:flex;align-items:center;justify-content:center}',
    '.pr-zavri:hover{color:#1f3864}',
    '#bookio-obal{min-height:280px}',
    /* Výšku iframu nastavuje Bookio správou WIDGET_HEIGHT. Kým príde prvá,
       drží miesto min-height — inak okno na okamih preblikne prázdne.
       min-height je v vh, nie v px: pri zmene šírky (otočenie telefónu)
       výšku dočasne pustíme a nech medzitým nič neoreže. (nález 7) */
    '#bookio-iframe{display:block;width:100%;border:0;min-height:70vh}',
    /* Záchranný odkaz: keď sa iframe nenačíta (blokovač, prísne nastavenie
       cookies v prehliadači), zákazník sa vie dostať do Bookia priamo. Je to
       bežný odkaz, takže funguje aj bez JavaScriptu. */
    '.pr-nahrada{margin:14px 0 0;font-size:.9rem;color:#5b6675}',
    '.pr-nahrada a{color:#1f3864}',
    /* Formulár priamo v stránke (rezervacia.html). Widget má vlastné biele
       pozadie, takže okolo neho stačí rámik a vzduch — nie druhá karta. */
    '.pr-vstranke{display:block;max-width:1000px;margin:0 auto}',
    '.pr-vstranke .pr-sub{margin:0 0 16px}',
    /* Na rezervačnej stránke je pod widgetom ďalší obsah, takže dopočítaná
       výška ho posunie. Rezervujeme preto rovno toľko miesta, koľko Bookio
       pri zozname služieb naozaj hlási — odmerané 26. 9. 2026: 550 px na
       počítači, 718 px na mobile. Bez toho mala stránka CLS 0,53, čo je
       pomalé poskakovanie obsahu pod prstami. */
    '.pr-vstranke #bookio-iframe{min-height:740px}',
    '@media(min-width:800px){.pr-vstranke #bookio-iframe{min-height:560px}}',
    '@media(max-width:640px){.pr-okno{padding:24px 12px}.pr-zavri-obal{top:24px}.pr-zavri{top:-14px;right:-4px}}'
  ].join('');

  var HTML =
    '<div class="pr-okno" role="dialog" aria-modal="true" aria-labelledby="pr-nadpis">' +
      '<div class="pr-zavri-obal"><button class="pr-zavri" id="rezervacia-close" type="button" aria-label="Zavrieť">&times;</button></div>' +
      '<h3 id="pr-nadpis">Rezervácia termínu</h3>' +
      '<p class="pr-sub">' + TEXTY[PLATBA] + '</p>' +
      '<div id="bookio-obal"></div>' +
      '<p class="pr-nahrada">Nenačítal sa kalendár? ' +
        '<a href="' + ZAKLAD + '" target="_blank" rel="noopener">Otvorte rezerváciu v novom okne</a>.</p>' +
      '<p class="pr-pozn">' + POUCENIE + '</p>' +
    '</div>';

  var posledny = 'vsetky';      // naposledy otvorený balík — pre náhradnú cenu
  var interagoval = false;      // klikol už zákazník do widgetu?
  var otvaral = null;           // prvok, z ktorého sa okno otvorilo (návrat fokusu)
  var PREKRYV = null;
  var poslednyNakup = '';       // podpis poslednej odoslanej rezervácie
  var poslednyCas = 0;
  var zapocitaneOtvorenie = false;  // begin_checkout už odišiel? (nález 5)
  var hotovo = false;           // widget ukazuje "ďakujeme" — pri ďalšom otvorení ho vymeníme (nález 6)
  var poslednaVyska = 0;        // posledná výška ohlásená Bookiom (nález 7)
  var poslednaSirka = 0;
  var cakanieNaVysku = null;
  var naInterakciu = null;   // formulár v stránke si sem dá počítanie konverzie

  function ramec() { return document.getElementById('bookio-iframe'); }

  function vlozStyl() {
    if (document.getElementById('pr-styl')) return;
    var s = document.createElement('style');
    s.id = 'pr-styl';
    s.appendChild(document.createTextNode(STYL));
    document.head.appendChild(s);
  }

  /* ── Správy z Bookia ─────────────────────────────────────────────────────
     Bookio posiela rodičovi štyri druhy správ (overené 26. 9. 2026 v kóde
     widgetu aj naživo na našej prevádzke):
       WIDGET_HEIGHT              { widgetHeight, iframeId }  — nová výška obsahu
       INIT_IFRAME_SCROLL         { scrollTo, animated }      — rolovanie po načítaní
       REQUEST_IFRAME_SCROLL      { scrollTo, animated }      — rolovanie po kroku
       BOOKIO_RESERVATION_SUCCESS { payload }                 — rezervácia hotová
     Hneď po WIDGET_HEIGHT pošle ešte raz holé číslo (starý formát), ktoré
     ignorujeme. */

  /* scrollTo je odstup prvku OD ZAČIATKU dokumentu vo widgete, nie od okna
     prehliadača. Prepočítame ho teda na pozíciu v našom prekryve — a keď
     formulár nie je v okne, ale priamo v stránke (rezervacia.html), rolujeme
     samotnú stránku. Hlavička je lepiaca, preto necháme nad cieľom 80 px. */
  function roluj(kam, plynulo) {
    var r = ramec();
    if (!r || kam === undefined || isNaN(Number(kam))) return;

    if (!PREKRYV) {
      var ciel2 = window.pageYOffset + r.getBoundingClientRect().top + Number(kam) - 80;
      if (ciel2 < 0) ciel2 = 0;
      try { window.scrollTo({ top: ciel2, behavior: plynulo ? 'smooth' : 'auto' }); }
      catch (e2) { window.scrollTo(0, ciel2); }
      return;
    }

    var rozdiel = r.getBoundingClientRect().top - PREKRYV.getBoundingClientRect().top;
    var ciel = PREKRYV.scrollTop + rozdiel + Number(kam) - 12;   // 12 px vzduchu
    if (ciel < 0) ciel = 0;
    try {
      PREKRYV.scrollTo({ top: ciel, behavior: plynulo ? 'smooth' : 'auto' });
    } catch (e) {
      PREKRYV.scrollTop = ciel;                                  // staršie prehliadače
    }
  }

  function naSpravu(e) {
    if (e.origin !== ORIGIN) return;
    var d = e.data;
    if (!d || typeof d !== 'object') return;          // holé číslo = starý formát
    if (d.iframeId && d.iframeId !== RAM_NAZOV) return;

    if (d.type === 'WIDGET_HEIGHT') {
      var v = parseInt(d.widgetHeight, 10);
      var r = ramec();
      if (r && !isNaN(v) && v > 0) {
        /* +8 px rezerva. Bookio hlási výšku zaokrúhlenú nadol a chýbajúci
           pixel stačí na to, aby iframu naskočil zvislý posuvník; ten zožerie
           ~15 px šírky, obsah sa prestane zmestiť do šírky a naskočí aj
           vodorovný. Výsledok boli dva posuvníky vnútri okna. 8 px prázdna
           nevidno, dva posuvníky áno. */
        r.style.height = (v + 8) + 'px';
        /* min-height drží miesto, kým nepríde prvá výška. Od tej chvíle by
           len prekážala: na rezervačnej stránke hlási Bookio pri zozname
           služieb ~540 px, čo je menej než 70vh, a pod widgetom by ostal pás
           prázdna. Po prvej správe teda min-height vypneme. */
        r.style.minHeight = '0';
        poslednaVyska = v;
        if (cakanieNaVysku) { clearTimeout(cakanieNaVysku); cakanieNaVysku = null; }
      }
      return;
    }

    /* Rozdiel medzi oboma rolovaniami je v tom, kto ich vyvolal.
       INIT chodí sám od seba hneď po načítaní (pri deep-linku aj dvakrát,
       s hodnotami cez 400 px) a odrolovalo by okno tak, že zákazník nevidí
       nadpis ani vetu o platbe. Preto ho poslúchneme až vtedy, keď zákazník
       do widgetu naozaj klikol — dovtedy okno ostáva hore pri nadpise.
       REQUEST chodí po kroku, ktorý zákazník urobil (vybral dátum, čas…) —
       ten poslúchneme vždy, inak by na mobile nevidel ďalší krok. */
    if (d.type === 'INIT_IFRAME_SCROLL') {
      if (interagoval) roluj(d.scrollTo, d.animated);
      return;
    }
    if (d.type === 'REQUEST_IFRAME_SCROLL') {
      interagoval = true;
      /* Táto správa chodí až po kroku, ktorý zákazník naozaj urobil (vybral
         službu, deň, čas). Na rezervačnej stránke je to jediný spoľahlivý
         signál, že začal rezervovať — klik v cudzom iframe sa k nám inak
         nedostane. V okne sa konverzia počíta už pri otvorení, tam to netreba. */
      if (naInterakciu) naInterakciu();
      /* Zároveň je to prvý okamih, keď má zmysel poznačiť si do CRM, že tento
         návštevník prišiel z reklamy. Ďalej už rezervuje v cudzom systéme,
         odkiaľ sa k nám nič nevráti. */
      if (typeof window.poriadoZaznamZdroja === 'function') window.poriadoZaznamZdroja('zacal', posledny);
      roluj(d.scrollTo, d.animated);
      return;
    }

    if (d.type === 'BOOKIO_RESERVATION_SUCCESS') { nakup(d.payload); return; }
  }

  /* Keď zákazník rezerváciu odošle, widget prehodí celé okno prehliadača na
     bookio.com — žiadnu správu nám o tom nepošle. Jediné, čo z toho vidíme,
     je že stránka práve odchádza a fokus je vnútri jeho rámca. Keby odchádzal
     sám (klikol na odkaz, zavrel kartu), fokus je na dokumente, nie na rámci.
     Nie je to dôkaz, ale je to najpresnejší okamih, aký máme — a práve v ňom
     sa v tabuľke zakladá riadok, ku ktorému sa potom rezervácia priradí. */
  window.addEventListener('pagehide', function () {
    if (!interagoval) return;
    var r = ramec();
    if (!r || document.activeElement !== r) return;
    if (typeof window.poriadoZaznamZdroja === 'function') window.poriadoZaznamZdroja('odchod', posledny);
  });

  /* Bookio v payloade posiela:
       { event:'created_reservation', eventCategory, eventAction,
         eventLabel: adresa widgetu,
         eventValue: NÁZOV služby (reťazec, nie suma),
         eventTotal: cena balíka + doplnkov (číslo) }
     Mena ani číslo rezervácie v ňom NIE SÚ — Bookio ich neposiela. Preto:
       - menu berieme ako EUR (v inej nám Bookio neúčtuje),
       - transaction_id si vyrábame sami, aby sa tá istá udalosť nezapočítala
         dvakrát, keby ju widget poslal opakovane. Nie je to číslo rezervácie
         z Bookia — spárovať konverziu s konkrétnou rezerváciou sa cez widget
         nedá (treba overiť, či sa to dá dotiahnuť cez API alebo webhook).
     Pozor do budúcna: widget Bookia má aj vlastné odoslanie purchase do GTM
     (sendPurchaseEvent). Spustí sa len vtedy, keď je v Bookiu vyplnené GTM id
     — to je podľa cenníka až od balíka Standard a my máme Smart, takže teraz
     dvojité meranie nehrozí. Ak sa GTM v Bookiu niekedy zapne, treba to tu
     doriešiť (zladiť id udalosti), inak budú nákupy v GA4 dvakrát. */
  function nakup(p) {
    var d = p || {};

    /* Suma: najprv eventTotal z Bookia. Číslo môže prísť aj ako reťazec
       s desatinnou čiarkou, preto čiarku prepíšeme na bodku. */
    var hodnota = 0;
    if (typeof d.eventTotal === 'string') hodnota = Number(d.eventTotal.replace(',', '.'));
    else hodnota = Number(d.eventTotal);
    if (isNaN(hodnota)) hodnota = 0;

    /* Keď suma nedorazila: náhradu hľadáme najprv podľa názvu služby, ktorý
       Bookio posiela v eventValue. Funguje to aj vtedy, keď sa okno otvorilo
       všeobecným tlačidlom (väčšina vstupov na webe) a "posledny" je 'vsetky'.
       Až potom siahneme po balíku, z ktorého sa okno otvorilo. (nález 4) */
    if (!(hodnota > 0)) hodnota = cenaPodlaNazvu(d.eventValue);
    if (!(hodnota > 0)) hodnota = cenaBalika(posledny);

    /* Tú istú rezerváciu nezapočítame dvakrát. Nerušíme sa natvrdo po prvom
       nákupe — zákazník si môže hneď objednať ďalší termín a ten už widget
       pošle ako novú správu bez znovunačítania iframu. Preto porovnávame
       službu a sumu a odmietame len opakovanie do minúty. */
    var ted = Date.now();
    var podpis = String(d.eventValue || '') + '|' + hodnota;
    if (podpis === poslednyNakup && (ted - poslednyCas) < 60000) return;
    poslednyNakup = podpis;
    poslednyCas = ted;

    var id = 'bk-' + ted + '-' + Math.floor(Math.random() * 100000);

    /* Menu posielame vždy. Meta bez dvojice value + currency označí Purchase
       za chybný a nákup má hodnotu 0 — ROAS aj optimalizácia kampaní idú dole.
       Sumu pripájame len keď ju naozaj poznáme, aby sme neposlali klamnú 0. */
    var param = { transaction_id: id, currency: 'EUR' };
    if (hodnota > 0) param.value = hodnota;
    if (typeof d.eventValue === 'string' && d.eventValue) param.sluzba = d.eventValue;

    if (typeof window.konverzia === 'function') {
      window.konverzia('purchase', 'Purchase', param, { eventID: id });
    }

    /* Rezervácia je hotová — widget teraz ukazuje "ďakujeme". Keby okno niekto
       otvoril znova (druhý byt, iný termín), musí dostať čistý formulár. */
    hotovo = true;

    /* Ďalšia rezervácia je nový lievik, takže begin_checkout smie odísť znova. */
    zapocitaneOtvorenie = false;
  }

  /* ── Súhlas s cookies ────────────────────────────────────────────────────
     Reeniu sme súhlas vedeli odovzdať atribútmi na kontajneri. Bookio na to
     nemá žiadny vstup — ale v našom prípade to ani netreba riešiť. Overené
     v zdroji widgetu 26. 9. 2026:
       - CookieYes sa vo widgete načíta len vtedy, keď widget NIE JE v iframe
         (podmienka isFramed()). V našom okne teda zákazník DRUHÚ cookie lištu
         nedostane;
       - widget nastaví gtag('consent','default') so všetkým na 'denied' a keďže
         CookieYes nepríde, na 'granted' sa to neprepne a žiadny GTM kontajner
         v HTML nie je — meranie Bookia v rámci teda nebeží;
       - z cookies nastaví len bslang=sk (jazyk); do localStorage si ukladá
         bookio-services.widget-customer, aby vedel formulár nabudúce
         predvyplniť. Pri zablokovanom úložisku tretích strán widget nespadne,
         len nepredvyplní.
     Náš súhlas sa do Bookia neprenesie a ani nemusí — naše GA4 a Pixel riadi
     poriado-meranie.js. V ochrane osobných údajov musí byť Bookio uvedené ako
     príjemca údajov, ale netvrdiť, že v okne ukazuje vlastnú lištu alebo že
     v ňom beží Google Analytics — ani jedno nie je pravda. (nález 3) */

  /* ── Formulár priamo v stránke ────────────────────────────────────────────
     Stránka, ktorá má v tele <div id="pr-inline">, nedostane vyskakovacie
     okno — widget sa vloží rovno do nej. Používa sa na rezervacia.html, kam
     smerujú odkazy zvonku (Google profil, e-mailový podpis): návštevník tak
     pristane na poriado.sk a nie na bookio.com.
     Okno a stránka sa na jednej stránke nemiešajú — obe by mali rovnaké id
     obalu aj iframu a widget by sa načítal dvakrát. Preto buď/alebo. */
  function startInline(obal) {
    vlozStyl();
    obal.className = 'pr-vstranke';
    /* Rezervované miesto zo štýlu stránky už netreba — od tejto chvíle výšku
       drží samotný widget a prázdny pás pod ním by len zavádzal. */
    obal.style.minHeight = '0';
    /* Vetu o platbe tu zámerne nedávame. V okne dáva zmysel — návštevník
       doň skočil z cenníka a inak by o platbe nevedel. Na rezervačnej
       stránke je hneď nad formulárom nadpis stránky a hneď pod ním modrý
       rámček Bookia s cenami aj podmienkami, takže by to bolo to isté
       povedané tretíkrát pod sebou. */
    obal.innerHTML =
      '<div id="bookio-obal"></div>' +
      '<p class="pr-nahrada">Nenačítal sa kalendár? <a href="' + ZAKLAD +
        '" target="_blank" rel="noopener">Otvorte rezerváciu v novom okne</a>.</p>';

    var balik = obal.getAttribute('data-balik');
    posledny = balik && SLUZBY[balik] ? balik : 'vsetky';

    var r = document.createElement('iframe');
    r.id = 'bookio-iframe';
    r.name = RAM_NAZOV;
    r.title = 'Rezervačný kalendár Poriado';
    r.src = adresa(posledny);
    document.getElementById('bookio-obal').appendChild(r);
    poslednaSirka = window.innerWidth;

    window.addEventListener('message', naSpravu, false);

    /* begin_checkout neposielame pri načítaní stránky — na samostatnej
       rezervačnej stránke by ho dostal každý, kto sa len pozrel a odišiel,
       a Mete by sa pokazil pomer začatých rezervácií k dokončeným. Čakáme,
       kým zákazník do widgetu naozaj klikne. Klik v cudzom iframe k nám
       nepreteká, ale stránka pri ňom stratí fokus a ten prejde na iframe. */
    function zaciatok() {
      if (zapocitaneOtvorenie) return;
      zapocitaneOtvorenie = true;
      if (typeof window.konverzia === 'function') window.konverzia('begin_checkout', 'InitiateCheckout', parametreZaciatku(posledny));
    }
    naInterakciu = zaciatok;
    window.addEventListener('blur', function () {
      setTimeout(function () {
        if (document.activeElement === ramec()) { interagoval = true; zaciatok(); }
      }, 0);
    });

    /* Tlačidlá "Rezervovať" v hlavičke a v pätke tu nemajú čo otvárať —
       formulár už na stránke je. Odrolujeme k nemu a ak je vybraný balík,
       prepneme naň widget. */
    var VYBER_I = '[data-open-rezervacia], a[href*="/widget?lang="],' +
                  ' a[href*="rezervacie.poriado.sk"], a[href$="#rezervacia"]';
    document.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var el = t.closest(VYBER_I);
      if (!el || obal.contains(el)) return;
      e.preventDefault();
      var b = el.getAttribute('data-balik');
      var rr = ramec();
      if (b && SLUZBY[b] && rr && rr.src !== adresa(b)) {
        posledny = b;
        rr.src = adresa(b);
        rr.style.height = '';
        rr.style.minHeight = '';
        poslednaVyska = 0;
      }
      var y = window.pageYOffset + obal.getBoundingClientRect().top - 70;
      try { window.scrollTo({ top: y < 0 ? 0 : y, behavior: 'smooth' }); }
      catch (e3) { window.scrollTo(0, y < 0 ? 0 : y); }
    });

    /* Pri zmene šírky (otočenie telefónu) Bookio výšku samo neprepočíta —
       rovnaká poistka ako v okne. */
    window.addEventListener('resize', function () {
      if (window.innerWidth === poslednaSirka) return;
      poslednaSirka = window.innerWidth;
      var rr = ramec();
      if (!rr) return;
      var vyska = poslednaVyska;
      rr.style.height = '';
      rr.style.minHeight = '';
      if (cakanieNaVysku) clearTimeout(cakanieNaVysku);
      cakanieNaVysku = setTimeout(function () {
        cakanieNaVysku = null;
        var r3 = ramec();
        if (r3 && !r3.style.height && vyska > 0) { r3.style.height = (vyska + 8) + 'px'; r3.style.minHeight = '0'; }
      }, 1200);
    });
  }

  function start() {
    var vstranke = document.getElementById('pr-inline');
    if (vstranke) { startInline(vstranke); return; }

    if (document.getElementById('rezervacia-modal')) return;   // už tam je

    vlozStyl();
    var prekryv = document.createElement('div');
    prekryv.className = 'pr-prekryv';
    prekryv.id = 'rezervacia-modal';
    prekryv.innerHTML = HTML;
    document.body.appendChild(prekryv);
    PREKRYV = prekryv;

    /* Cookie lišta a jej okno nastavení sú jediné dve veci mimo rezervačného
       okna, ktoré musia ostať použiteľné — preto ich ani neschovávame pred
       odčítačom, ani z nich nevraciame fokus späť. Viď nález 2. */
    function mimoOkna(el) {
      if (!el || el === document || el === window) return true;
      if (prekryv.contains(el)) return false;
      var lista = document.getElementById('pk-lista');
      var okno = document.getElementById('pk-okno-prekryv');
      if (lista && lista.contains(el)) return false;
      if (okno && okno.contains(el)) return false;
      return true;
    }

    /* Obsah za oknom schováme odčítačom, aby aria-modal="true" nebolo lož.
       Nepoužívam atribút inert: ten okrem fokusu vypína aj klikanie, takže by
       zhasol cookie lištu, ktorú práve potrebujeme klikateľnú. aria-hidden
       dávame len prvkom, ktoré ho ešte nemajú — cudzie aria-hidden by sme pri
       zatvorení omylom zmazali. (nález 1) */
    function schovajPozadie() {
      var deti = document.body.children;
      for (var i = 0; i < deti.length; i++) {
        var el = deti[i];
        if (el === prekryv || el.tagName === 'SCRIPT' || el.tagName === 'STYLE') continue;
        if (!mimoOkna(el)) continue;
        if (el.getAttribute('aria-hidden') !== null) continue;
        el.setAttribute('data-pr-skryte', '1');
        el.setAttribute('aria-hidden', 'true');
      }
    }
    function odkryPozadie() {
      var skryte = document.querySelectorAll('[data-pr-skryte]');
      for (var i = 0; i < skryte.length; i++) {
        skryte[i].removeAttribute('aria-hidden');
        skryte[i].removeAttribute('data-pr-skryte');
      }
    }

    /* Pasca fokusu. Cez iframe sa tabuje von automaticky — keď fokus pristane
       mimo okna (a mimo cookie lišty), vrátime ho na krížik. Nedá sa to overiť
       axom: pascu fokusu žiadny automat nenájde. (nález 1) */
    function drzFokus(e) {
      if (!prekryv.classList.contains('pr-otvorene')) return;
      if (!mimoOkna(e.target)) return;
      var x = document.getElementById('rezervacia-close');
      if (x) x.focus();
    }

    /* Záchranný odkaz musí viesť na ten balík, ktorý si zákazník vybral —
       pri zablokovanom rámci je to jediná cesta ďalej. Nastavujeme ho tu,
       spolu s adresou iframu, aby sa tie dve adresy nemali ako rozísť. (nález 9) */
    function nastavNahradu(url) {
      var a = prekryv.querySelector('.pr-nahrada a');
      if (a) a.setAttribute('href', url);
    }

    /* Iframe vyrobíme až pri prvom otvorení — nech sa Bookio nenačítava
       každému, kto len príde na stránku. */
    function pripravRamec(balik) {
      var obal = document.getElementById('bookio-obal');
      if (!obal) return;
      var url = adresa(balik);
      nastavNahradu(url);
      var r = ramec();

      /* Po dokončenej rezervácii widget drží stránku "ďakujeme". Zákazník,
         ktorý si hneď objednáva druhý termín, musí dostať čistý formulár.
         Rámec preto zahodíme a vyrobíme nový. Kritika navrhovala aj variant
         s contentWindow.location.replace(url) — to sa robiť nedá, location
         cudzieho originu je pre nás zakázaná a skončilo by to výnimkou.
         Výmena celého prvku je kratšia aj bezpečnejšia. (nález 6) */
      if (r && hotovo) {
        obal.innerHTML = '';
        r = null;
        hotovo = false;
        poslednaVyska = 0;
      }

      if (!r) {
        r = document.createElement('iframe');
        r.id = 'bookio-iframe';          // toto id si hľadá oficiálny skript Bookia
        r.name = RAM_NAZOV;              // vráti sa nám späť ako iframeId
        r.title = 'Rezervačný kalendár Poriado';
        r.src = url;
        obal.appendChild(r);
        return;
      }
      /* Iný balík = iná adresa, widget sa musí načítať odznova. Rovnaký balík
         necháme tak — zákazník mohol byť v polovici formulára a prepísanie
         src by mu zmazalo všetko, čo vyplnil. */
      if (r.src !== url) {
        r.src = url;
        r.style.height = '';
        r.style.minHeight = '';
        poslednaVyska = 0;
      }
    }

    function otvor(balik, zdroj) {
      var kluc = balik && SLUZBY[balik] ? balik : 'vsetky';
      posledny = kluc;
      otvaral = zdroj || null;
      interagoval = false;

      prekryv.classList.add('pr-otvorene');
      document.body.classList.add('pr-okno-otvorene');
      prekryv.scrollTop = 0;                     // vždy začíname pri nadpise
      var chat = document.getElementById('pch-panel');
      if (chat) chat.classList.remove('open');   // inak ostane otvoreny nad oknom

      /* Meriame začatie rezervácie, nie počet klikov na tlačidlá — pri
         preklikaní cenníka (Mini → Klasik → Maxi) by inak z jednej návštevy
         odišli tri InitiateCheckout a Mete by sa pokazil pomer k nákupom.
         Príznak sa vracia späť po odoslanom purchase v nakup(). (nález 5) */
      if (!zapocitaneOtvorenie) {
        zapocitaneOtvorenie = true;
        if (typeof window.konverzia === 'function') window.konverzia('begin_checkout', 'InitiateCheckout', parametreZaciatku(kluc));
      }

      pripravRamec(kluc);
      poslednaSirka = window.innerWidth;
      var x = document.getElementById('rezervacia-close');
      if (x) x.focus();                          // fokus do okna, nie za ním
      schovajPozadie();                          // až po fokuse, nech neschováme fokusovaný prvok
    }
    function zavri() {
      prekryv.classList.remove('pr-otvorene');
      document.body.classList.remove('pr-okno-otvorene');
      interagoval = false;
      odkryPozadie();                            // pred vrátením fokusu
      if (otvaral && typeof otvaral.focus === 'function') otvaral.focus();
      otvaral = null;
    }

    /* Klik chytáme na dokumente, nie na jednotlivých tlačidlách. Chat sa totiž
       vkladá až po tomto skripte a jeho odkaz "Rezervovať termín" by inak nikto
       neodchytil — na podstránke by návštevníka odviedol na hlavnú stránku.
       Href pri odkazoch nechávam, aby bez JavaScriptu fungovali ako predtým. */
    /* Chytáme len odkazy do rezervačného widgetu, nie hocičo na services.bookio.com —
       v zásadách ochrany údajov je odkaz na stránku Bookia o spracúvaní údajov
       (/gdpr/sk) a ten sa má otvoriť normálne, nie v našom okne. */
    var VYBER = '[data-open-rezervacia], a[href*="/widget?lang="],' +
                ' a[href*="rezervacie.poriado.sk"], a[href$="#rezervacia"]';
    document.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var el = t.closest(VYBER);
      if (!el) return;
      if (el.closest('.pr-nahrada')) return;   // záchranný odkaz v okne nechytáme
      e.preventDefault();
      otvor(el.getAttribute('data-balik'), el);
    });

    window.addEventListener('message', naSpravu, false);
    document.addEventListener('focusin', drzFokus);

    /* Bookio posiela výšku len vtedy, keď sa zmení, a pri zmene šírky okna
       (otočenie telefónu, otvorenie klávesnice, zmena veľkosti na desktope)
       ju neprepočíta. Fixná výška z predchádzajúcej šírky by obsah orezala
       a widget by si vnútri vyrobil druhý posuvník — dve vnorené rolovacie
       plochy sa na dotyku ovládajú veľmi zle. Výšku preto pustíme na
       min-height a počkáme na novú. Keby žiadna neprišla (Bookiu sa výška
       nezmenila), po 1,2 s vrátime poslednú známu — inak by sme si ten druhý
       posuvník vyrobili sami. (nález 7) */
    window.addEventListener('resize', function () {
      if (!prekryv.classList.contains('pr-otvorene')) return;
      if (window.innerWidth === poslednaSirka) return;   // zmenila sa len výška = klávesnica
      poslednaSirka = window.innerWidth;
      var r = ramec();
      if (!r) return;
      var vyska = poslednaVyska;
      r.style.height = '';
      r.style.minHeight = '';
      if (cakanieNaVysku) clearTimeout(cakanieNaVysku);
      cakanieNaVysku = setTimeout(function () {
        cakanieNaVysku = null;
        var rr = ramec();
        if (rr && !rr.style.height && vyska > 0) { rr.style.height = (vyska + 8) + 'px'; rr.style.minHeight = '0'; }
      }, 1200);
    });

    /* Klik do cudzieho iframu sa k nám nedostane, ale naše okno pri ňom stratí
       fokus a ten prejde na iframe. To nám stačí ako signál, že zákazník
       s widgetom naozaj pracuje — až potom poslúchame automatické rolovanie. */
    window.addEventListener('blur', function () {
      setTimeout(function () {
        if (document.activeElement === ramec()) interagoval = true;
      }, 0);
    });

    document.getElementById('rezervacia-close').addEventListener('click', zavri);
    prekryv.addEventListener('click', function (e) { if (e.target === prekryv) zavri(); });
    /* Esc funguje, kým je fokus mimo widgetu. Len čo zákazník klikne do
       formulára Bookia, keydown spracúva dokument cudzieho originu a k nám sa
       nedostane — obísť sa to nedá nijako. Hlavné zatváranie je preto lepiaci
       krížik (44×44 px, drží sa hore aj po zrolovaní); s pascou fokusu vyššie
       je na dosah jedným cyklom tabulátora. Do zoznamu testov po nasadení to
       treba napísať takto, nech sa to nehlási ako chyba. (nález 10) */
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && prekryv.classList.contains('pr-otvorene')) zavri();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
