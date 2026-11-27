/**
 * Sarper'in Yapay Zekâyla İmtihanı · TEK QR oylama sunucusu (Google Apps Script) · TEK DOSYA
 *
 * Kurulum:
 * 1. Bu dosyanın tamamını Apps Script'teki Kod.gs'ye yapıştırın (eskisini silin) ve Ctrl+S ile kaydedin.
 *    Ayrı bir "Oy" dosyası GEREKMEZ.
 * 2. Dağıt → Dağıtımları yönet → kalem simgesi → Sürüm: "Yeni sürüm" → Dağıt.
 *    (İlk kez dağıtıyorsanız: Dağıt → Yeni dağıtım → Web uygulaması, Ben, Herkes.)
 */

/** Sunum dosyasındaki PRESENTER_KEY ile aynı olmalı. Ekrandaki soruyu yalnızca sunum değiştirebilir. */
var SUNUCU_ANAHTARI = '4aec09d9610a541a';

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.action === 'results') return json_(results_(p.q));
  if (p.action === 'sync') return json_(sync_(p));
  return HtmlService.createHtmlOutput(OY_HTML)
    .setTitle("Sarper'in Yapay Zekâyla İmtihanı · Oy ver")
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function isKey_(q) { return /^[a-z0-9]{1,12}-s[1-9]-r[0-9]$/.test(String(q)); }

/** Ekranda şu an açık olan soru. Önce hızlı önbellekten okunur. */
function readState_() {
  var cache = CacheService.getScriptCache();
  var s = cache.get('state');
  if (!s) {
    s = PropertiesService.getScriptProperties().getProperty('state') || '{"q":"","o":"","open":false,"at":0,"seen":0}';
    cache.put('state', s, 10);
  }
  return JSON.parse(s);
}

/** Sunum bunu düzenli çağırır: açık soruyu bildirir, o sorunun oylarını geri alır. */
function sync_(p) {
  if (p.k !== SUNUCU_ANAHTARI) return { error: 'anahtar' };
  var q = String(p.q || ''), o = String(p.o || ''), at = Number(p.at) || 0, now = Date.now();
  var open = isKey_(q) && /^[123]{1,3}$/.test(o);
  var cur = readState_();
  // Eski kalmış ikinci bir sekme güncel soruyu ezmesin.
  if (at >= cur.at || now - cur.seen > 20000) {
    var next = { q: open ? q : '', o: open ? o : '', open: open, at: at, seen: now };
    var s = JSON.stringify(next);
    CacheService.getScriptCache().put('state', s, 21600);
    if (next.q !== cur.q || next.o !== cur.o || next.at !== cur.at) PropertiesService.getScriptProperties().setProperty('state', s);
  }
  return open ? results_(q) : { ok: true };
}

/** Telefon sayfası birkaç saniyede bir bunu çağırır. */
function state() {
  var s = readState_();
  return { q: s.q, o: s.o, open: s.open };
}

/** Telefon sayfası google.script.run ile bunu çağırır. */
function vote(q, o) {
  if (!isKey_(q) || !/^[123]$/.test(String(o))) return { ok: false, error: 'gecersiz' };
  var cur = readState_();
  if (!cur.open || cur.q !== q || cur.o.indexOf(String(o)) < 0) return { ok: false, error: 'kapali' };
  var lock = LockService.getScriptLock();
  lock.waitLock(8000);
  try {
    var props = PropertiesService.getScriptProperties();
    var key = 'v_' + q;
    var c = JSON.parse(props.getProperty(key) || '{"1":0,"2":0,"3":0}');
    c[o] = (c[o] || 0) + 1;
    var s = JSON.stringify(c);
    props.setProperty(key, s);
    CacheService.getScriptCache().put(key, s, 21600);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

function results_(q) {
  var key = 'v_' + String(q || '');
  var s = CacheService.getScriptCache().get(key) || PropertiesService.getScriptProperties().getProperty(key) || '{"1":0,"2":0,"3":0}';
  return { counts: JSON.parse(s) };
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/** Provalardan sonra eski oyları silmek için bu fonksiyonu editörden bir kez çalıştırın. */
function oylariTemizle() {
  PropertiesService.getScriptProperties().deleteAllProperties();
}

/* ===== Telefonda açılan oy sayfası ===== */
var OY_HTML = `<!DOCTYPE html>
<html>
<head>
<base target="_top">
<meta charset="utf-8">
<style>
  :root{--bg:#0F1420;--card:#171E2D;--fg:#ECE8E1;--muted:#9AA3B5;--line:#2E384C;--o1:#F0706A;--o2:#F2B33D;--o3:#5DAEF7;--win:#3DD68C}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--fg);font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;padding:20px 16px 32px;min-height:100vh}
  .wrap{max-width:520px;margin:0 auto;display:flex;flex-direction:column;gap:14px}
  .eye{font:700 12px/1 ui-monospace,Consolas,monospace;letter-spacing:.12em;color:var(--muted);text-transform:uppercase}
  h1{font-size:22px;line-height:1.25;margin:0}
  button.opt{display:grid;grid-template-columns:40px 1fr;gap:12px;align-items:center;text-align:left;width:100%;padding:14px;border-radius:14px;border:2px solid var(--line);background:var(--card);color:var(--fg);font-size:17px;line-height:1.3;cursor:pointer}
  button.opt b{width:40px;height:40px;border-radius:10px;display:grid;place-items:center;color:var(--bg);font:700 18px ui-monospace,Consolas,monospace}
  button.opt[data-k="1"] b{background:var(--o1)} button.opt[data-k="2"] b{background:var(--o2)} button.opt[data-k="3"] b{background:var(--o3)}
  button.opt:disabled{opacity:.35}
  button.opt.mine{opacity:1;border-color:var(--win)}
  .msg{padding:14px;border-radius:12px;background:var(--card);border:1px solid var(--line);font-size:16px}
  .msg.ok{border-color:var(--win);color:var(--win)}
</style>
</head>
<body>
<div class="wrap">
  <div class="eye" id="eye">Sarper'in Yapay Zekâyla İmtihanı</div>
  <h1 id="q"></h1>
  <div id="opts" style="display:flex;flex-direction:column;gap:10px"></div>
  <div class="msg" id="msg" hidden></div>
</div>
<script>
  var DATA = {
    s1:{q:"Elif Öğretmen bu gece ne yapmalı?", o:{1:"Yönetmeliği uygulamalı: Ödevi sıfır sayıp veliye e-posta göndermeli.",2:"Önce Sarper'le baş başa konuşmalı, kimseye bir şey söylememeli.",3:"Görmezden gelmeli: Kanıt kesin değil, notu verip dosyayı kapatmalı."}},
    s2:{q:"Hangi kanıtı toplamalı?", o:{1:"Sarper'e sınıfta, gözetim altında yeni bir kısa deneme yazdırmalı.",2:"Belgenin sürüm geçmişini istemeli.",3:"Metni ikinci bir tespit aracına yüklemeli."}},
    s3:{q:"Elif, Zeynep'in anlattıklarına nasıl yaklaşmalı?", o:{1:"Zeynep'e inanmalı: Araç güvenilmez, Sarper masum.",2:"Temkinli olmalı: Zeynep arkadaşını koruyor olabilir.",3:"Doğrulamalı: Kendi yazdığı bir metni araca yüklemeli, kurs belgesini istemeli."}},
    s4:{q:"Elif toplantıyı hangi cümleyle açmalı?", o:{1:"“Betül Hanım, yönetmelik açık. Ben yalnızca kuralı uyguladım.”",2:"“Emin olmadığım şeyler var. Elimdeki her şeyi size göstereceğim.”",3:"“Sarper, önce sen anlatmak ister misin?”"}},
    s5:{q:"Sarper'in ödevi için en adil karar hangisi?", o:{1:"Kural yoksa ihlal de yok: Tam not verilmeli, Sarper bursa girmeli.",2:"Kısmi not: Fikirler onun ama dil değil. Puanın yarısı verilmeli.",3:"Yeniden teslim: Sarper kendi taslağını, YZ'yi nasıl kullandığını açıklayan bir notla yeniden teslim etmeli."}},
    s6:{q:"Elif hangi politikayı önermeli?", o:{1:"Sıkı denetim: Tüm ödevler tespit aracından geçsin, %50'nin üstü otomatik sıfır olsun.",2:"Süreç odaklı değerlendirme: Taslaklar, sınıf içi yazım ve kısa bir sözlü savunma notlandırılsın.",3:"YZ okuryazarlığı: Yapay zekâ açıkça kullanılabilsin, her ödevde nasıl kullanıldığı beyan edilsin ve öğretilsin."}},
    s7:{q:"Elif canlı yayında ne cevap vermeli?", o:{1:"“Evet. Kurallar ne olursa olsun, o metni o yazmadı.”",2:"“Hayır. Kuralı koymayan bendim. Sorumluluk benim.”",3:"“Bir öğrencinin geleceği hakkında kamera önünde konuşmayacağım.”"}}
  };
  var msg = document.getElementById('msg'), eye = document.getElementById('eye');
  var title = document.getElementById('q'), box = document.getElementById('opts');
  var shown = null, curQ = '', btns = [], busy = false, fails = 0, timer = null, seenQuestion = false;
  function say(t, ok){ msg.hidden = false; msg.textContent = t; msg.className = 'msg' + (ok ? ' ok' : ''); }
  function saved(q){ try { return localStorage.getItem('oy_' + q); } catch(e) { return null; } }
  function lock(k){ btns.forEach(function(b){ b.disabled = true; if (b.dataset.k === k) b.classList.add('mine'); }); }

  function show(s){
    var m = s.open ? /-(s\\d)-r(\\d)$/.exec(s.q) : null;
    var step = m && DATA[m[1]];
    var sig = step ? s.q + '|' + s.o : 'bekle';
    if (sig === shown) return;
    shown = sig; curQ = step ? s.q : ''; btns = []; box.textContent = ''; msg.hidden = true;
    if (!step){
      eye.textContent = "Sarper'in Yapay Zekâyla İmtihanı";
      title.textContent = seenQuestion ? 'Sıradaki soruyu bekle' : 'Bağlandın!';
      say('Soru ekrana gelince telefonunda kendiliğinden açılacak. Bu sayfayı kapatma.');
      return;
    }
    seenQuestion = true;
    eye.textContent = 'Soru ' + m[1].slice(1) + (Number(m[2]) ? ' · Eşitlik oylaması' : '');
    title.textContent = step.q;
    s.o.split('').forEach(function(k){
      if (!step.o[k]) return;
      var b = document.createElement('button');
      b.className = 'opt'; b.type = 'button'; b.dataset.k = k;
      var n = document.createElement('b'); n.textContent = k;
      var t = document.createElement('span'); t.textContent = step.o[k];
      b.appendChild(n); b.appendChild(t);
      b.onclick = function(){ send(s.q, k); };
      box.appendChild(b); btns.push(b);
    });
    var v = saved(s.q);
    if (v){ lock(v); say('Oyunuz alındı. Ekrana bakın.', true); }
    window.scrollTo(0, 0);
  }

  function send(q, k, tries){
    tries = tries || 0;
    if (q !== curQ) return;
    lock(k); say('Gönderiliyor…');
    google.script.run
      .withSuccessHandler(function(r){
        if (r && r.ok){ try { localStorage.setItem('oy_' + q, k); } catch(e) {} }
        if (q !== curQ) return;
        if (r && r.ok) say('Oyunuz alındı. Ekrana bakın.', true);
        else say('Bu soru için oylama kapandı.');
      })
      .withFailureHandler(function(){
        if (q !== curQ) return;
        if (tries < 3){ setTimeout(function(){ send(q, k, tries + 1); }, 700 + Math.random()*900); }
        else { btns.forEach(function(x){ x.disabled = false; x.classList.remove('mine'); }); say('Bağlantı yoğun. Lütfen tekrar dokunun.'); }
      })
      .vote(q, k);
  }

  function plan(){
    clearTimeout(timer);
    if (!document.hidden) timer = setTimeout(poll, 2500 + Math.random()*1000 + Math.min(fails, 5)*1000);
  }
  function poll(){
    clearTimeout(timer);
    if (busy) return;
    busy = true;
    google.script.run
      .withSuccessHandler(function(s){ busy = false; if (fails >= 3) shown = null; fails = 0; show(s); plan(); })
      .withFailureHandler(function(){ busy = false; fails++; if (fails >= 3) say('Bağlantı zayıf, yeniden deneniyor…'); plan(); })
      .state();
  }
  document.addEventListener('visibilitychange', function(){ if (document.hidden) clearTimeout(timer); else poll(); });
  title.textContent = 'Bağlanıyor…';
  poll();
</script>
</body>
</html>
`;
