/**
 * Mükemmel Ödev · QR oylama sunucusu (Google Apps Script) · TEK DOSYA
 *
 * Kurulum:
 * 1. Bu dosyanın tamamını Apps Script'teki Kod.gs'ye yapıştırın (eskisini silin) ve Ctrl+S ile kaydedin.
 *    Ayrı bir "Oy" dosyası GEREKMEZ.
 * 2. Dağıt → Dağıtımları yönet → kalem simgesi → Sürüm: "Yeni sürüm" → Dağıt.
 *    (İlk kez dağıtıyorsanız: Dağıt → Yeni dağıtım → Web uygulaması, Ben, Herkes.)
 */

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.action === 'results') return json_(results_(p.q));
  var safe = function (v) { return JSON.stringify(String(v || '')).replace(/</g, '\\u003c'); };
  var html = OY_HTML.replace('__Q__', safe(p.q)).replace('__O__', safe(p.o || '123'));
  return HtmlService.createHtmlOutput(html)
    .setTitle('Mükemmel Ödev · Oy ver')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** Telefon sayfası google.script.run ile bunu çağırır. */
function vote(q, o) {
  if (!/^[a-z0-9]{1,12}-s[1-9]-r[0-9]$/.test(String(q)) || !/^[123]$/.test(String(o))) return { ok: false, error: 'gecersiz' };
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
  <div class="eye" id="eye">Mükemmel Ödev</div>
  <h1 id="q"></h1>
  <div id="opts" style="display:flex;flex-direction:column;gap:10px"></div>
  <div class="msg" id="msg" hidden></div>
</div>
<script>
  var Q = __Q__;
  var O = __O__;
  var DATA = {
    s1:{q:"Elif Öğretmen bu gece ne yapmalı?", o:{1:"Yönetmeliği uygulamalı: Ödevi sıfır sayıp veliye e-posta göndermeli.",2:"Önce Sarper'le baş başa konuşmalı, kimseye bir şey söylememeli.",3:"Görmezden gelmeli: Kanıt kesin değil, notu verip dosyayı kapatmalı."}},
    s2:{q:"Hangi kanıtı toplamalı?", o:{1:"Sarper'e sınıfta, gözetim altında yeni bir kısa deneme yazdırmalı.",2:"Belgenin sürüm geçmişini istemeli.",3:"Metni ikinci bir tespit aracına yüklemeli."}},
    s3:{q:"Elif, Zeynep'in anlattıklarına nasıl yaklaşmalı?", o:{1:"Zeynep'e inanmalı: Araç güvenilmez, Sarper masum.",2:"Temkinli olmalı: Zeynep arkadaşını koruyor olabilir.",3:"Doğrulamalı: Kendi yazdığı bir metni araca yüklemeli, kurs belgesini istemeli."}},
    s4:{q:"Elif toplantıyı hangi cümleyle açmalı?", o:{1:"“Betül Hanım, yönetmelik açık. Ben yalnızca kuralı uyguladım.”",2:"“Emin olmadığım şeyler var. Elimdeki her şeyi size göstereceğim.”",3:"“Sarper, önce sen anlatmak ister misin?”"}},
    s5:{q:"Sarper'in ödevi için en adil karar hangisi?", o:{1:"Kural yoksa ihlal de yok: Tam not verilmeli, Sarper bursa girmeli.",2:"Kısmi not: Fikirler onun ama dil değil. Puanın yarısı verilmeli.",3:"Yeniden teslim: Sarper kendi taslağını, YZ'yi nasıl kullandığını açıklayan bir notla yeniden teslim etmeli."}},
    s6:{q:"Elif hangi politikayı önermeli?", o:{1:"Sıkı denetim: Tüm ödevler tespit aracından geçsin, %50'nin üstü otomatik sıfır olsun.",2:"Süreç odaklı değerlendirme: Taslaklar, sınıf içi yazım ve kısa bir sözlü savunma notlandırılsın.",3:"YZ okuryazarlığı: Yapay zekâ açıkça kullanılabilsin, her ödevde nasıl kullanıldığı beyan edilsin ve öğretilsin."}},
    s7:{q:"Elif canlı yayında ne cevap vermeli?", o:{1:"“Evet. Kurallar ne olursa olsun, o metni o yazmadı.”",2:"“Hayır. Kuralı koymayan bendim. Sorumluluk benim.”",3:"“Bir öğrencinin geleceği hakkında kamera önünde konuşmayacağım.”"}}
  };
  var m = /-(s\\d)-r(\\d)$/.exec(Q);
  var step = m && DATA[m[1]];
  var round = m ? Number(m[2]) : 0;
  var msg = document.getElementById('msg');
  function say(t, ok){ msg.hidden = false; msg.textContent = t; msg.className = 'msg' + (ok ? ' ok' : ''); }
  var KEY = 'oy_' + Q, voted = null;
  try { voted = localStorage.getItem(KEY); } catch(e) {}

  if (!step){
    document.getElementById('q').textContent = 'Bu QR geçersiz ya da eski.';
    say('Ekrandaki güncel QR kodu yeniden okutun.');
  } else {
    document.getElementById('eye').textContent = 'Soru ' + m[1].slice(1) + (round ? ' · Eşitlik oylaması' : '');
    document.getElementById('q').textContent = step.q;
    var box = document.getElementById('opts'), btns = [];
    O.split('').forEach(function(k){
      if (!step.o[k]) return;
      var b = document.createElement('button');
      b.className = 'opt'; b.type = 'button'; b.dataset.k = k;
      var n = document.createElement('b'); n.textContent = k;
      var s = document.createElement('span'); s.textContent = step.o[k];
      b.appendChild(n); b.appendChild(s);
      b.onclick = function(){ send(k, b); };
      box.appendChild(b); btns.push(b);
    });
    if (voted){ lock(voted); say('Oyunuz alındı. Ekrana bakın.', true); }
  }
  function lock(k){ btns.forEach(function(b){ b.disabled = true; if (b.dataset.k === k) b.classList.add('mine'); }); }
  function send(k, b, tries){
    tries = tries || 0;
    lock(k); say('Gönderiliyor…');
    google.script.run
      .withSuccessHandler(function(r){
        if (r && r.ok){ try { localStorage.setItem(KEY, k); } catch(e) {} say('Oyunuz alındı. Ekrana bakın.', true); }
        else { say('Oy kaydedilemedi. Ekrandaki güncel QR kodu okutun.'); }
      })
      .withFailureHandler(function(){
        if (tries < 3){ setTimeout(function(){ send(k, b, tries + 1); }, 700 + Math.random()*900); }
        else { btns.forEach(function(x){ x.disabled = false; x.classList.remove('mine'); }); say('Bağlantı yoğun. Lütfen tekrar dokunun.'); }
      })
      .vote(Q, k);
  }
</script>
</body>
</html>
`;
