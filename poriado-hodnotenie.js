/*
 * PORIADO — hodnotenie z Google, spoločné pre celý web.
 *
 * Hviezdičky sa vykresľujú z atribútu data-rating na .rev-bar. Hodnotenie
 * a počet recenzií denne obnovuje Apps Script z Google Places API; hodnoty
 * v HTML sú záložné — keď sa stiahnutie nepodarí, ostanú tak, ako sú.
 *
 * Prečo samostatný súbor a querySelectorAll:
 * Predtým bol tento kód vpísaný priamo v index.html a hľadal si JEDEN prvok
 * cez querySelector. Kým bolo hodnotenie na webe raz, fungovalo to. Len čo by
 * pribudlo na druhé miesto (rezervačná stránka, hero), druhý výskyt by sa
 * nikdy neaktualizoval a navždy by ukazoval záložné číslo z HTML — a nikto
 * by si toho nevšimol, lebo stránka by nehlásila žiadnu chybu.
 */
(function () {
  'use strict';

  var ZDROJ    = 'https://script.google.com/macros/s/AKfycbwQtR4rbzSBMcR4CG8koG4anzFlQmOOzKlZZPQN4g3Agz-ppnzu2NwuYzs4yT4kXadp/exec?akcia=hodnotenie';
  var KLUC     = 'poriado-hodnotenie';
  var PLATNOST = 86400000;   /* 24 h — jeden návštevník sa pýta najviac raz denne */

  var bary = document.querySelectorAll('.rev-bar');
  if (!bary.length) return;

  function vykresli(bar) {
    var box = bar.querySelector('.rev-stars');
    if (!box) return;
    var r = parseFloat(bar.getAttribute('data-rating'));
    if (isNaN(r)) return;
    var s = '';
    for (var i = 1; i <= 5; i++) {
      if (r >= i)             s += '★';   /* plná */
      else if (r >= i - 0.5)  s += '½';   /* polovičná */
      else                    s += '☆';   /* prázdna */
    }
    box.textContent = s;
    /* Žiadny aria-label. WCAG 2.5.3 žiada, aby prístupný názov obsahoval
       viditeľný text odkazu — inak človek ovládajúci web hlasom povie
       „Pozrieť" a odkaz sa nespustí. Každý ručne písaný názov sa skôr či
       neskôr rozíde s tým, čo je na obrazovke: pôvodný hovoril „5.0"
       s bodkou, kým vidieť bolo „5,0" s čiarkou, a počet recenzií sa navyše
       denne mení. Text odkazu sa so sebou rozísť nemôže. */
    bar.removeAttribute('aria-label');
  }

  /* 1 recenzia, 2–4 recenzie, 5 a viac recenzií */
  function sklonuj(n) {
    if (n === 1) return '1 recenzia na Google';
    if (n >= 2 && n <= 4) return n + ' recenzie na Google';
    return n + ' recenzií na Google';
  }

  function pouzi(d) {
    if (!d || d.ok !== true) return;
    var h = Number(d.hodnotenie), p = Number(d.pocet);
    if (!(h >= 1 && h <= 5) || !(p >= 1)) return;
    for (var i = 0; i < bary.length; i++) {
      var bar = bary[i];
      bar.setAttribute('data-rating', h.toFixed(1));
      var cislo = bar.querySelector('.rev-num');
      var pocet = bar.querySelector('.rev-count');
      if (cislo) cislo.textContent = h.toFixed(1).replace('.', ',');
      if (pocet) pocet.textContent = sklonuj(p);
      vykresli(bar);
    }
  }

  /* najprv z HTML, nech je pás správny aj keď sa nič nestiahne */
  for (var i = 0; i < bary.length; i++) vykresli(bary[i]);

  var ulozene = null;
  try { ulozene = JSON.parse(localStorage.getItem(KLUC) || 'null'); } catch (e) {}
  if (ulozene && ulozene.cas && (Date.now() - ulozene.cas) < PLATNOST) { pouzi(ulozene.data); return; }

  if (!window.fetch) return;

  /* Až po načítaní stránky — dve čísla nie sú dôležitejšie ako rýchlosť. */
  window.addEventListener('load', function () {
    fetch(ZDROJ)
      .then(function (r) { return r.json(); })
      .then(function (d) {
        pouzi(d);
        try { localStorage.setItem(KLUC, JSON.stringify({ cas: Date.now(), data: d })); } catch (e) {}
      })
      .catch(function () { /* ticho — v HTML ostanú pôvodné čísla */ });
  });
})();
