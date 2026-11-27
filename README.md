# Sarper'in Yapay Zekâyla İmtihanı

Yapay zekâ ve akademik dürüstlük üzerine, 7 karar noktalı interaktif bir sınıf sunumu (ilk adı: "Mükemmel Ödev"). Elif Öğretmen'in, Sarper'in ödevinin yapay zekâyla yazıldığından şüphelendiği hikâyede öğrenciler her adımda telefonlarından QR kodla oy verir; çoğunluğun seçimi hikâyeyi ilerletir (eşitlikte yeniden oylama yapılır).

## Dosyalar

| Dosya | Ne işe yarar |
|---|---|
| `mukemmel-odev.html` | Sunumun ilk sürümü (tam HTML iskeleti yok). |
| `Sunum-Mukemmel-Odev.html` | Her adımda ayrı QR gösteren sunum. Yeni sekmede sıfırdan başlar, yeniden oylamada eski oyları saymaz. |
| `oylama-apps-script/Kod.gs` | Yukarıdaki sunumun oylama sunucusu (Google Apps Script). Her QR kendi sorusunu açar. |
| `tek-qr/Sunum-Tek-QR.html` | Tek QR sürümü: öğrenciler bir kez okutur, sorular telefonda kendiliğinden değişir. |
| `tek-qr/Kod.gs` | Tek QR sürümünün sunucusu. Ekrandaki soruyu yalnızca sunum (`PRESENTER_KEY`) değiştirebilir. |

## Kurulum (Google Apps Script)

1. script.google.com'da yeni proje açın, ilgili `Kod.gs`'nin tamamını yapıştırıp kaydedin.
2. **Dağıt → Yeni dağıtım → Web uygulaması**, "Ben" olarak çalıştır, erişim "Herkes".
3. Çıkan `/exec` adresini sunumun ayarlar bölümüne yapıştırın (veya HTML'deki `DEFAULT_VOTE_URL`'yi güncelleyin).
4. Tek QR sürümünde `Kod.gs` içindeki `SUNUCU_ANAHTARI` ile HTML'deki `PRESENTER_KEY` aynı olmalı.
5. Provalardan sonra editörden `oylariTemizle()` fonksiyonunu bir kez çalıştırın.

Sunum dosyaları tarayıcıda doğrudan açılır; derleme gerekmez.
