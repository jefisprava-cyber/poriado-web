/*
 * PORIADO — individuálny dopyt, spoločný pre celý web.
 * ---------------------------------------------------------------------------
 * Vloženie na stránku:
 *
 *     <script src="poriado-dopyt.js" defer><\/script>
 *
 * Súbor si sám vloží štýly aj HTML okna, takže na podstránkach netreba nič
 * kopírovať. Okno sa otvorí:
 *   - klikom na čokoľvek s atribútom  data-open-individ
 *   - príchodom na adresu s kotvou  #individ  (odkazy z chatu a starých stránok)
 *
 * Po úspešnom odoslaní zavolá window.konverzia('generate_lead', 'Lead')
 * z poriado-meranie.js. Ak meranie na stránke nie je (alebo ide o demo),
 * formulár funguje ďalej, len sa nič nezmeria.
 *
 * Vlastné triedy majú predponu pd- a farby sú zapísané priamo, nie cez CSS
 * premenné — podstránky majú vlastné palety a okno musí vyzerať všade rovnako.
 */
(function () {
  'use strict';

  var AKCIA = 'https://script.google.com/macros/s/AKfycbwQtR4rbzSBMcR4CG8koG4anzFlQmOOzKlZZPQN4g3Agz-ppnzu2NwuYzs4yT4kXadp/exec';
  var MAX_FOTIEK = 5;
  var MAX_HRANA  = 1400;   // px — dlhšia strana fotky po zmenšení
  var KVALITA    = 0.75;

  var STYL = [
    '.pd-overlay{position:fixed;inset:0;background:rgba(15,25,45,.55);display:none;',
      'align-items:flex-start;justify-content:center;padding:30px 16px;z-index:100;overflow-y:auto}',
    '.pd-overlay.pd-open{display:flex}',
    '.pd-okno{background:#fff;border-radius:16px;max-width:560px;width:100%;padding:34px 30px;',
      'position:relative;box-shadow:0 30px 70px rgba(0,0,0,.35);',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;',
      'color:#1c2530;line-height:1.6;text-align:left}',
    '.pd-okno h3{color:#1f3864;font-size:1.4rem;margin:0 0 6px;font-weight:700}',
    '.pd-sub{color:#5b6675;font-size:.95rem;margin:0 0 20px;line-height:1.55}',
    '.pd-zavri{position:absolute;top:14px;right:18px;background:none;border:none;font-size:1.7rem;',
      'color:#5f6875;cursor:pointer;line-height:1;padding:0}',
    '.pd-zavri:hover{color:#1f3864}',
    '.pd-okno form{background:none;box-shadow:none;padding:0;margin:0}',
    '.pd-okno label{display:block;font-weight:600;font-size:.9rem;margin-bottom:6px;color:#1f3864}',
    '.pd-okno input,.pd-okno textarea{width:100%;padding:11px 14px;border:1px solid #d7e0ec;',
      'border-radius:9px;margin-bottom:16px;font-family:inherit;font-size:.97rem;color:#1c2530;background:#fff}',
    '.pd-okno input:focus,.pd-okno textarea:focus{outline:none;border-color:#2e75b6}',
    '.pd-foto{border:1.5px dashed #2e75b6;border-radius:9px;background:#f7f9fc;',
      'font-size:.9rem;padding:10px;margin-bottom:4px}',
    '.pd-foto-note{font-size:.8rem;color:#5b6675;margin:0 0 12px}',
    '.pd-foto-stav{color:#19b07a;font-weight:700}',
    /* Musí byť špecifickejšie než .pd-okno label vyššie, inak si súhlas
       s podmienkami vezme štýl bežného popisku poľa. */
    '.pd-okno label.pd-gdpr{display:flex;gap:9px;align-items:flex-start;font-size:.82rem;',
      'color:#5b6675;margin:2px 0 14px;font-weight:400}',
    '.pd-okno label.pd-gdpr input{margin:3px 0 0;flex:none;width:16px;height:16px;accent-color:#2e75b6}',
    '.pd-okno label.pd-gdpr a{color:#2e75b6;text-decoration:underline}',
    '.pd-odoslat{display:block;width:100%;background:#2e75b6;color:#fff;padding:12px 22px;',
      'border-radius:9px;font-weight:700;border:none;cursor:pointer;font-size:.95rem;',
      'font-family:inherit;transition:.2s}',
    '.pd-odoslat:hover{background:#255f95}',
    '.pd-odoslat:disabled{opacity:.65;cursor:default}',
    '.pd-ok{display:none;color:#19b07a;font-weight:700;text-align:center;margin-top:14px}',
    '.pd-hp{position:absolute;left:-9999px;width:1px;height:1px;opacity:0}',
    '@media(max-width:640px){.pd-okno{padding:28px 18px}}'
  ].join('');

  var HTML =
    '<div class="pd-okno" role="dialog" aria-modal="true" aria-labelledby="pd-nadpis">' +
      '<button class="pd-zavri" id="individ-close" type="button" aria-label="Zavrieť">&times;</button>' +
      '<h3 id="pd-nadpis">Individuálny dopyt</h3>' +
      '<p class="pd-sub">Pre Airbnb, kancelárie a špeciálne priestory. Napíšte nám, čo potrebujete, ' +
        'a ozveme sa do 24 hodín s ponukou na mieru.</p>' +
      '<form id="individ-form" action="' + AKCIA + '" method="POST">' +
        '<input type="hidden" name="token" value="poriado2026">' +
        '<input type="text" name="hp" class="pd-hp" tabindex="-1" autocomplete="off" aria-hidden="true">' +
        '<label for="i-meno">Meno alebo firma</label>' +
        '<input type="text" id="i-meno" name="meno" required autocomplete="name" placeholder="Meno / názov firmy">' +
        '<label for="i-telefon">Telefón</label>' +
        '<input type="tel" id="i-telefon" name="telefon" required autocomplete="tel" inputmode="tel" placeholder="+421 900 000 000">' +
        '<label for="i-email">E-mail</label>' +
        '<input type="email" id="i-email" name="email" required autocomplete="email" inputmode="email" placeholder="vas@email.sk">' +
        '<label for="i-text">Správa</label>' +
        '<textarea id="i-text" name="text" rows="4" placeholder="O aký priestor ide, aká je jeho veľkosť, čo potrebujete a kedy — čím viac napíšete, tým presnejšiu ponuku pripravíme."></textarea>' +
        '<label for="i-foto">Fotky priestoru (nepovinné, max ' + MAX_FOTIEK + ')</label>' +
        '<input type="file" id="i-foto" class="pd-foto" accept="image/*" multiple>' +
        '<p class="pd-foto-note">Nahrajte fotky miestností — pripravíme presnejšiu ponuku bez obhliadky. ' +
          '<span class="pd-foto-stav"></span></p>' +
        '<label class="pd-gdpr"><input type="checkbox" required> Potvrdzujem, že som sa oboznámil/a so ' +
          '<a href="ochrana-osobnych-udajov.html" target="_blank" rel="noopener">zásadami spracovania osobných údajov</a>.</label>' +
        '<button type="submit" class="pd-odoslat">Odoslať dopyt</button>' +
        '<p id="individ-ok" class="pd-ok">Ďakujeme! Ozveme sa vám do 24 hodín.</p>' +
      '</form>' +
    '</div>';


  function vlozStyl() {
    if (document.getElementById('pd-styl')) return;
    var s = document.createElement('style');
    s.id = 'pd-styl';
    s.appendChild(document.createTextNode(STYL));
    document.head.appendChild(s);
  }

  /* Fotky zmenšíme priamo v prehliadači — Apps Script má limit na veľkosť
     požiadavky a originály z mobilu ho spoľahlivo prekročia. */
  function wireFotky(form) {
    var input = form.querySelector('.pd-foto');
    var stav  = form.querySelector('.pd-foto-stav');
    if (!input || !stav) return;

    form._fotky = [];
    form._subory = [];

    function hotove() {
      var p = form._fotky.filter(Boolean).length;
      var slovo = p === 1 ? 'fotka pripravená' : (p < 5 ? 'fotky pripravené' : 'fotiek pripravených');
      stav.innerHTML = '';
      stav.appendChild(document.createTextNode('✓ ' + p + ' ' + slovo + '  '));
      var z = document.createElement('a');
      z.href = '#';
      z.style.color = '#c0392b';
      z.textContent = '✕ vymazať';
      z.addEventListener('click', function (ev) {
        ev.preventDefault();
        form._subory = []; form._fotky = []; input.value = ''; stav.innerHTML = '';
      });
      stav.appendChild(z);
    }

    function prepocitaj() {
      form._fotky = [];
      if (!form._subory.length) { stav.innerHTML = ''; return; }
      stav.textContent = 'Spracovávam fotky…';
      var hotovoPocet = 0, n = form._subory.length;
      form._subory.forEach(function (f, i) {
        var img = new Image(), url = URL.createObjectURL(f);
        img.onload = function () {
          var w = img.width, h = img.height;
          if (w > MAX_HRANA || h > MAX_HRANA) {
            var k = MAX_HRANA / Math.max(w, h);
            w = Math.round(w * k); h = Math.round(h * k);
          }
          var c = document.createElement('canvas');
          c.width = w; c.height = h;
          c.getContext('2d').drawImage(img, 0, 0, w, h);
          form._fotky[i] = c.toDataURL('image/jpeg', KVALITA).split(',')[1];
          URL.revokeObjectURL(url);
          if (++hotovoPocet === n) hotove();
        };
        img.onerror = function () {
          URL.revokeObjectURL(url);
          if (++hotovoPocet === n) hotove();
        };
        img.src = url;
      });
    }

    input.addEventListener('change', function () {
      var nove = Array.prototype.slice.call(input.files);
      for (var i = 0; i < nove.length && form._subory.length < MAX_FOTIEK; i++) form._subory.push(nove[i]);
      input.value = '';          // umožní pridávať fotky aj po jednej
      prepocitaj();
    });
  }

  function wireForm(form) {
    wireFotky(form);
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var btn  = form.querySelector('button[type=submit]');
      var text = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Odosielam…';

      var fd = new FormData(form);
      /* Formulár už nemá výber balíka ani typu priestoru — správa je celý text. */
      fd.set('sprava', fd.get('text') || '');
      fd.delete('text');

      var f = (form._fotky || []).filter(Boolean);
      fd.append('foto_count', f.length);
      f.forEach(function (b, i) { fd.append('foto_' + (i + 1), b); });

      fetch(form.action, { method: 'POST', body: fd, mode: 'no-cors' })
        .then(function () {
          form.reset();
          form._subory = []; form._fotky = [];
          var stav = form.querySelector('.pd-foto-stav');
          if (stav) stav.innerHTML = '';
          btn.disabled = false;
          btn.textContent = text;
          var ok = document.getElementById('individ-ok');
          if (ok) ok.style.display = 'block';
          if (typeof window.konverzia === 'function') window.konverzia('generate_lead', 'Lead');
        })
        .catch(function () {
          btn.disabled = false;
          btn.textContent = text;
          alert('Dopyt sa nepodarilo odoslať. Skúste znova alebo nám zavolajte.');
        });
    });
  }

  function start() {
    /* Keby okno na stránke už bolo napevno, druhé nevkladám. */
    if (document.getElementById('individ-modal')) return;

    vlozStyl();
    var overlay = document.createElement('div');
    overlay.className = 'pd-overlay';
    overlay.id = 'individ-modal';
    overlay.innerHTML = HTML;
    document.body.appendChild(overlay);

    function otvor() { overlay.classList.add('pd-open'); }
    function zavri() { overlay.classList.remove('pd-open'); }

    /* Klik chytáme na dokumente, nie na jednotlivých odkazoch. Chat sa totiž
       vkladá až po tomto skripte a jeho odkaz "Individuálny dopyt" by inak
       nikto neodchytil — na podstránke by návštevníka odviedol na hlavnú
       stránku. Odkazy /#individ tak fungujú na mieste; href im nechávam, aby
       bez JavaScriptu doviedli aspoň na hlavnú stránku ako predtým. */
    var VYBER = '[data-open-individ], a[href$="#individ"]';
    document.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      if (!t.closest(VYBER)) return;
      e.preventDefault();
      otvor();
    });

    document.getElementById('individ-close').addEventListener('click', zavri);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) zavri(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlay.classList.contains('pd-open')) zavri();
    });

    function zHashu() { if (location.hash === '#individ') otvor(); }
    zHashu();
    window.addEventListener('hashchange', zHashu);

    wireForm(document.getElementById('individ-form'));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
