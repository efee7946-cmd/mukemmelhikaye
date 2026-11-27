/**
 * Sarper'in Yapay Zekâyla İmtihanı · TEK QR oylama + yazılı cevap sunucusu (Google Apps Script) · TEK DOSYA
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

/** Oylama: <oturum>-s<adım>-r<tur> */
function isKey_(q) { return /^[a-z0-9]{1,12}-s[1-9]-r[0-9]$/.test(String(q)); }
/** Yazılı cevap ekranları: <oturum>-t-<soru|gunluk|kamera> */
function isTextKey_(q) { return /^[a-z0-9]{1,12}-t-(soru|gunluk|kamera)$/.test(String(q)); }
/** Ders oturumu: QR'ı okutan cihazlar bu kimlikle sayılır */
function isRoom_(r) { return /^[a-z0-9]{1,12}$/.test(String(r)); }

/** Önce hızlı önbellek, yoksa kalıcı depo */
function getStore_(key, dflt) {
  var c = CacheService.getScriptCache().get(key);
  if (c) return c;
  return PropertiesService.getScriptProperties().getProperty(key) || dflt;
}
function putStore_(key, s) {
  CacheService.getScriptCache().put(key, s, 21600);
  if (s.length < 8500) PropertiesService.getScriptProperties().setProperty(key, s);
}

/** Ekranda şu an açık olan soru. Önce hızlı önbellekten okunur. */
function readState_() {
  var cache = CacheService.getScriptCache();
  var s = cache.get('state');
  if (!s) {
    s = PropertiesService.getScriptProperties().getProperty('state') || '{"q":"","o":"","open":false,"at":0,"seen":0,"room":""}';
    cache.put('state', s, 10);
  }
  return JSON.parse(s);
}

/** Sunum bunu düzenli çağırır: açık soruyu bildirir; oyları ya da yazılı cevapları ve katılımcı sayısını geri alır. */
function sync_(p) {
  if (p.k !== SUNUCU_ANAHTARI) return { error: 'anahtar' };
  var q = String(p.q || ''), o = String(p.o || ''), at = Number(p.at) || 0, now = Date.now();
  var room = isRoom_(p.room) ? String(p.room) : '';
  var isVote = isKey_(q) && /^[123]{1,3}$/.test(o);
  var isText = isTextKey_(q) && o === 'T';
  var open = isVote || isText;
  var cur = readState_();
  // Eski kalmış ikinci bir sekme güncel soruyu ezmesin.
  if (at >= cur.at || now - cur.seen > 20000) {
    var next = { q: open ? q : '', o: open ? o : '', open: open, at: at, seen: now, room: room };
    var s = JSON.stringify(next);
    CacheService.getScriptCache().put('state', s, 21600);
    if (next.q !== cur.q || next.o !== cur.o || next.at !== cur.at || next.room !== cur.room) PropertiesService.getScriptProperties().setProperty('state', s);
  }
  var out = isVote ? results_(q) : isText ? { texts: texts_(q) } : { ok: true };
  out.joined = room ? joinCount_(room) : 0;
  return out;
}

/** Telefon sayfası birkaç saniyede bir bunu çağırır; cihaz kimliğiyle katılımı da kaydeder. */
function state(cid) {
  var s = readState_();
  if (cid && s.room) recordJoin_(s.room, String(cid).slice(0, 40));
  return { q: s.q, o: s.o, open: s.open };
}

/** QR'ı okutan her cihaz bir kez sayılır (aynı telefon sayfayı yenilese de). */
function recordJoin_(room, cid) {
  var key = 'j_' + room;
  if (JSON.parse(getStore_(key, '{}'))[cid]) return;
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(4000)) return; // yoğunlukta bir sonraki yoklamada yeniden denenir
  try {
    var map = JSON.parse(getStore_(key, '{}'));
    if (!map[cid]) { map[cid] = 1; putStore_(key, JSON.stringify(map)); }
  } finally {
    lock.releaseLock();
  }
}
function joinCount_(room) { return Object.keys(JSON.parse(getStore_('j_' + room, '{}'))).length; }

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

/** Yazılı cevap: her cihazın bir cevabı olur; yeniden gönderirse güncellenir. */
function answer(q, cid, t) {
  q = String(q || ''); cid = String(cid || '').slice(0, 40);
  t = String(t || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  if (!isTextKey_(q) || !t) return { ok: false, error: 'gecersiz' };
  var cur = readState_();
  if (!cur.open || cur.q !== q) return { ok: false, error: 'kapali' };
  var lock = LockService.getScriptLock();
  lock.waitLock(8000);
  try {
    var key = 't_' + q, list = JSON.parse(getStore_(key, '[]')), found = false;
    for (var i = 0; i < list.length; i++) if (cid && list[i].c === cid) { list[i].t = t; found = true; }
    if (!found) {
      if (list.length >= 60) return { ok: false, error: 'dolu' };
      list.push({ i: list.length + 1, c: cid, t: t });
    }
    putStore_(key, JSON.stringify(list));
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
/** Sunuma cihaz kimliği gönderilmez, yalnızca sıra numarası ve metin. */
function texts_(q) {
  return JSON.parse(getStore_('t_' + String(q || ''), '[]')).map(function (x) { return { i: x.i, t: x.t }; });
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/** Provalardan sonra eski oyları ve cevapları silmek için bu fonksiyonu editörden bir kez çalıştırın. */
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
  :root{--bg:#141210;--card:#1E1B18;--fg:#F2EEE9;--muted:#A39B92;--line:#37322C;--o1:#F2634E;--o2:#E8B03E;--o3:#5DAEF7;--win:#4CC98A}
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
  textarea{width:100%;min-height:110px;padding:12px 14px;border-radius:14px;border:2px solid var(--line);background:var(--card);color:var(--fg);font:inherit;font-size:18px;line-height:1.4;resize:vertical}
  textarea:focus{outline:none;border-color:var(--o1)}
  button.send{padding:15px;border-radius:14px;border:0;background:var(--o1);color:#fff;font:700 18px system-ui,-apple-system,sans-serif}
  button.send:disabled{opacity:.5}
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
  /* Yazılı cevap ekranları (sunumdaki "Soruyu / Cümleyi siz ..." sayfaları) */
  var TDATA = {
    soru:{eye:"Soruyu siz yazın", q:"Elif, Sarper'e hangi soruyu sormalı?", ph:"Elif'in kâğıdına yazacağı soru…"},
    gunluk:{eye:"Cümleyi siz tamamlayın", q:"“Belki de bu hikâyede asıl yanılan…”", ph:"…cümlenin devamı"},
    kamera:{eye:"Son cümleyi siz kurun", q:"“Bütün öğretmenlere ve öğrencilere söylemek istediğim şu…”", ph:"…Elif'in kameraya söyleyeceği cümle"}
  };
  var msg = document.getElementById('msg'), eye = document.getElementById('eye');
  var title = document.getElementById('q'), box = document.getElementById('opts');
  var shown = null, curQ = '', btns = [], busy = false, fails = 0, timer = null, seenQuestion = false;
  /* Cihaz kimliği: katılımcı sayısı için; aynı telefon yenilese de bir kez sayılır */
  var CID = '';
  try { CID = localStorage.getItem('oy_cid') || ''; if (!CID) { CID = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); localStorage.setItem('oy_cid', CID); } }
  catch(e) { CID = Math.random().toString(36).slice(2, 12); }
  function say(t, ok){ msg.hidden = false; msg.textContent = t; msg.className = 'msg' + (ok ? ' ok' : ''); }
  function saved(q){ try { return localStorage.getItem('oy_' + q); } catch(e) { return null; } }
  function lock(k){ btns.forEach(function(b){ b.disabled = true; if (b.dataset.k === k) b.classList.add('mine'); }); }

  function show(s){
    var sig = s.open ? s.q + '|' + s.o : 'bekle';
    if (sig === shown) return;
    shown = sig; curQ = ''; btns = []; box.textContent = ''; msg.hidden = true;
    var tm = s.open && s.o === 'T' ? /-t-(soru|gunluk|kamera)$/.exec(s.q) : null;
    if (tm){ showText(s.q, tm[1]); window.scrollTo(0, 0); return; }
    var m = s.open ? /-(s\\d)-r(\\d)$/.exec(s.q) : null;
    var step = m && DATA[m[1]];
    if (!step){
      eye.textContent = "Sarper'in Yapay Zekâyla İmtihanı";
      title.textContent = seenQuestion ? 'Sıradakini bekle' : 'Bağlandın!';
      say('Soru ekrana gelince telefonunda kendiliğinden açılacak. Bu sayfayı kapatma.');
      return;
    }
    seenQuestion = true; curQ = s.q;
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

  function showText(q, key){
    var d = TDATA[key];
    seenQuestion = true; curQ = q;
    eye.textContent = d.eye;
    title.textContent = d.q;
    var ta = document.createElement('textarea');
    ta.maxLength = 120; ta.rows = 3; ta.placeholder = d.ph;
    var prev = saved('tx_' + q);
    if (prev) ta.value = prev;
    var b = document.createElement('button');
    b.className = 'send'; b.type = 'button'; b.textContent = prev ? 'Güncelle' : 'Gönder';
    b.onclick = function(){
      var t = ta.value.replace(/\\s+/g, ' ').trim();
      if (!t){ say('Önce bir şey yaz.'); return; }
      sendText(q, t, b, 0);
    };
    box.appendChild(ta); box.appendChild(b);
    if (prev) say('Cevabın ekranda. İstersen değiştirip yeniden gönderebilirsin.', true);
  }

  function sendText(q, t, b, tries){
    if (q !== curQ) return;
    b.disabled = true; say('Gönderiliyor…');
    google.script.run
      .withSuccessHandler(function(r){
        b.disabled = false;
        if (q !== curQ) return;
        if (r && r.ok){
          try { localStorage.setItem('oy_tx_' + q, t); } catch(e) {}
          b.textContent = 'Güncelle';
          say('Cevabın ekrana düştü. İstersen değiştirip yeniden gönderebilirsin.', true);
        }
        else say(r && r.error === 'dolu' ? 'Bu soru için yeterince cevap toplandı.' : 'Bu soru için yazma kapandı.');
      })
      .withFailureHandler(function(){
        if (q !== curQ) return;
        if (tries < 3){ setTimeout(function(){ sendText(q, t, b, tries + 1); }, 700 + Math.random()*900); }
        else { b.disabled = false; say('Bağlantı yoğun. Lütfen tekrar dene.'); }
      })
      .answer(q, CID, t);
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
      .state(CID);
  }
  document.addEventListener('visibilitychange', function(){ if (document.hidden) clearTimeout(timer); else poll(); });
  title.textContent = 'Bağlanıyor…';
  poll();
</script>
</body>
</html>
`;
