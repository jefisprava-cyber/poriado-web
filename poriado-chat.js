/* Poriado — FAQ chat widget (bez AI, beží čisto v prehliadači)
   Použitie: <script src="poriado-chat.js" defer></script> pred </body> */
(function () {
  var CSS = `
  #pch-bubble{position:fixed;right:20px;bottom:20px;width:60px;height:60px;border-radius:50%;
    background:linear-gradient(135deg,#1f3864,#2e75b6);color:#fff;border:none;cursor:pointer;z-index:9990;
    box-shadow:0 8px 24px rgba(31,56,100,.35);font-size:26px;display:flex;align-items:center;justify-content:center;
    transition:transform .2s}
  #pch-bubble:hover{transform:scale(1.08)}
  #pch-panel{position:fixed;right:20px;bottom:92px;width:360px;max-width:calc(100vw - 32px);height:520px;
    max-height:calc(100vh - 120px);background:#fff;border-radius:16px;z-index:9991;display:none;flex-direction:column;
    box-shadow:0 20px 60px rgba(20,30,50,.30);overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif}
  #pch-panel.open{display:flex}
  .pch-head{background:linear-gradient(135deg,#1f3864,#2e75b6);color:#fff;padding:14px 16px}
  .pch-head b{font-size:1.05rem}
  .pch-head b span{color:#9fc0e8}
  .pch-head small{display:block;color:#dce6f1;font-size:.75rem;margin-top:2px}
  .pch-gold{height:3px;background:linear-gradient(90deg,rgba(228,178,96,0),#e6c584 18%,#d4a44c 50%,#e6c584 82%,rgba(228,178,96,0))}
  #pch-body{flex:1;overflow-y:auto;padding:14px;background:#f7f9fc}
  .pch-msg{max-width:85%;padding:10px 13px;border-radius:14px;margin-bottom:10px;font-size:.88rem;line-height:1.5;
    white-space:pre-line;animation:pchIn .25s ease}
  .pch-bot{background:#fff;border:1px solid #e7edf5;color:#1c2530;border-bottom-left-radius:4px}
  .pch-user{background:#2e75b6;color:#fff;margin-left:auto;border-bottom-right-radius:4px}
  @keyframes pchIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
  .pch-chips{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 12px}
  .pch-chip{background:#fff;border:1.5px solid #2e75b6;color:#1f3864;border-radius:20px;padding:7px 12px;
    font-size:.8rem;font-weight:600;cursor:pointer;transition:.15s}
  .pch-chip:hover{background:#2e75b6;color:#fff}
  .pch-cta{display:flex;gap:8px;padding:10px 14px;background:#fff;border-top:1px solid #e7edf5}
  .pch-cta a{flex:1;text-align:center;padding:10px 6px;border-radius:9px;font-size:.82rem;font-weight:700;text-decoration:none}
  .pch-cta .p{background:#2e75b6;color:#fff}
  .pch-cta .p:hover{background:#1f3864}
  .pch-cta .s{background:#e2f6ee;color:#0f7a54}
  .pch-cta .s:hover{background:#19b07a;color:#fff}
  #pch-close{float:right;background:none;border:none;color:#dce6f1;font-size:20px;cursor:pointer;line-height:1;margin-top:-2px}
  @media(max-width:480px){#pch-panel{right:8px;bottom:84px}}
  `;

  var FAQ = [
    { q: "💰 Koľko stojí upratovanie?",
      a: "Máme tri balíky podľa hodín — všetko s vlastnými prostriedkami a dopravou po Bratislave v cene:\n\n• Mini (3 h) — 79,90 €\n• Klasik (6 h) — 129,90 €\n• Maxi (9 h) — 169,90 € vrátane tepovania\n\nŽiadne skryté poplatky — čo si dohodneme, to zaplatíte." },
    { q: "🧽 Ako to funguje?",
      a: "Jednoducho: pred upratovaním sa dohodneme, čomu sa máme v rámci času balíka venovať najviac — priority určujete vy.\n\nPrídeme s vlastnými prostriedkami aj vybavením a domácnosti upratujeme bez obhliadky." },
    { q: "🛋 Robíte tepovanie?",
      a: "Áno! Tepovanie je zahrnuté v balíku Maxi. K balíkom Mini a Klasik si ho doplatíte od 25 €, alebo prídeme len tepovať samostatne za 40 €/hod.\n\nPri koženej sedačke ponúkame jej ošetrenie namiesto tepovania.",
      link: { text: "Viac o tepovaní →", href: "/tepovanie-bratislava.html" } },
    { q: "📅 Ako si rezervujem termín?",
      a: "Online v rezervačnom kalendári — termín potvrdíme okamžite. Zaplatíte podľa výberu: kartou online hneď pri rezervácii, alebo prevodom cez faktúru s QR kódom, ktorá príde e-mailom.\n\nTermín môžete bezplatne zrušiť do 24 hodín pred začiatkom." },
    { q: "💖 Máte zľavy?",
      a: "Áno — dôchodcom a držiteľom preukazu ZŤP ponúkame trvalú zľavu 15 % na všetky balíky. Stačí sa preukázať pri prvej návšteve." },
    { q: "🏢 Kancelárie / Airbnb?",
      a: "Kancelárie, prevádzky aj Airbnb apartmány riešime individuálne — pošlite nám individuálny dopyt a do 24 hodín dostanete ponuku na mieru. Obhliadka je zdarma.",
      link: { text: "Individuálny dopyt →", href: "/#individ" } },
    { q: "👀 Musíte si priestor najprv pozrieť?",
      a: "Domácnosti (byty a domy) upratujeme bez obhliadky — stačí si vybrať balík a termín.\n\nPri kanceláriách a iných priestoroch si dohodneme obhliadku a pripravíme vám ponuku na mieru." },
    { q: "👥 Koľko ľudí príde upratovať?",
      a: "Štandardne príde jedna upratovačka. Ak máme voľné kapacity, pošleme dve — čas upratovania sa vtedy skráti na polovicu.\n\nRozsah práce aj cena balíka zostávajú rovnaké." },
    { q: "💳 Ako prebieha platba?",
      a: "Vyberte si, čo vám vyhovuje:\n\n• kartou online priamo pri rezervácii\n• bankovým prevodom — do 24 hodín pošleme e-mailom faktúru s QR kódom, splatnú do 24 hodín od doručenia\n\nHotovosť neprijímame. Firmám radi vystavíme faktúru na IČO." },
    { q: "🔄 Môžem zmeniť alebo zrušiť termín?",
      a: "Áno. Termín zrušíte bezplatne najneskôr 24 hodín pred začiatkom priamo v rezervácii.\n\nAk ho chcete len presunúť, napíšte na info@poriado.sk alebo zavolajte na +421 949 076 917 (Po–Pi 8:00–17:00) — zmeníme ho bez poplatku.\n\nPri zrušení menej ako 24 hodín pred termínom účtujeme 50 % z ceny." },
    { q: "⚠️ Čo ak je priestor veľmi znečistený?",
      a: "Pri extrémnom znečistení alebo ak zvolený balík nestačí na rozsah priestoru si vyhradzujeme právo zákazku odmietnuť alebo si vyžiadať primeraný doplatok.\n\nVždy sa dohodneme priamo na mieste ešte pred začatím upratovania — žiadne prekvapenia." },
    { q: "📍 Pôsobíte aj mimo Bratislavy?",
      a: "Zatiaľ upratujeme výhradne v Bratislave — doprava po celom meste je v cene.\n\nAk ste z blízkeho okolia, ozvite sa nám — po dohode vieme prísť aj k vám.",
      link: { text: "Kontaktovať nás →", href: "/#kontakt" } }
  ];

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  function init() {
    var style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);

    var bubble = el("button", null, "💬");
    bubble.id = "pch-bubble";
    bubble.setAttribute("aria-label", "Otvoriť chat s otázkami");

    var panel = el("div"); panel.id = "pch-panel";
    panel.innerHTML =
      '<div class="pch-head"><button id="pch-close" aria-label="Zavrieť">×</button>' +
      '<b>Poriado<span>.</span></b><small>Radi odpovieme — vyberte otázku</small></div>' +
      '<div class="pch-gold"></div><div id="pch-body"></div>' +
      '<div class="pch-cta"><a class="p" href="/#rezervacia">📅 Rezervovať termín</a>' +
      '<a class="s" href="https://wa.me/421949076917" target="_blank" rel="noopener">WhatsApp</a></div>';

    document.body.appendChild(bubble);
    document.body.appendChild(panel);
    var body = panel.querySelector("#pch-body");

    function chips() {
      var wrap = el("div", "pch-chips");
      FAQ.forEach(function (f) {
        var c = el("button", "pch-chip", f.q);
        c.onclick = function () { ask(f); };
        wrap.appendChild(c);
      });
      body.appendChild(wrap);
      body.scrollTop = body.scrollHeight;
    }
    function bot(text, delay, cb) {
      setTimeout(function () {
        body.appendChild(el("div", "pch-msg pch-bot", text));
        body.scrollTop = body.scrollHeight;
        if (cb) cb();
      }, delay || 0);
    }
    function ask(f) {
      var old = body.querySelectorAll(".pch-chips");
      old.forEach(function (o) { o.remove(); });
      body.appendChild(el("div", "pch-msg pch-user", f.q));
      body.scrollTop = body.scrollHeight;
      var text = f.a;
      if (f.link) text += '\n\n<a href="' + f.link.href + '" style="color:#2e75b6;font-weight:700">' + f.link.text + "</a>";
      bot(text, 450, function () {
        bot("Pomôžem ešte s niečím? 🙂", 350, chips);
      });
    }

    var opened = false;
    bubble.onclick = function () {
      panel.classList.toggle("open");
      if (panel.classList.contains("open") && !opened) {
        opened = true;
        bot("Dobrý deň! 👋 Som asistent Poriado. S čím vám pomôžem?", 250, chips);
      }
    };
    panel.querySelector("#pch-close").onclick = function () { panel.classList.remove("open"); };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
