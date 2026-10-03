# Google Play hazırlık ve eksik listesi — 28 Eylül 2026

Durum: YAYINA HAZIR DEĞİL. Kod incelemesi, gerçek cihaz ve Console doğrulamasının yerine geçmez. Aşağıdaki düzeltmeler yereldir; 1.2.0 derleme 5 AAB bu son değişiklikleri içermez.

## Sıralı yayın kapıları

| Sıra | Sayfa / konu | Durum ve yapılacak iş |
|---|---|---|
| 1 | Uygulama erişimi | BLOKE: canlı yönetim bağlantısı çalışmıyor. Ayrı örnek firmada patron, şoför ve veli oluşturulmalı; her biri gerçek AAB ile denenmeli. Eski Apple demo scripti gerçek firma kayıtlarını kullanabildiği için çalıştırılmamalı. |
| 2 | Gizlilik politikası | YEREL DÜZELTME: /gizlilik ve /privacy aynı içerik; Gemini, konum, saklama ve silme davranışı açıklandı. Canlıya yayın, iletişim adresinin çalışması ve firma bilgilerinin işletmeci tarafından teyidi gerekli. |
| 3 | Uygulama içi gizlilik | YEREL DÜZELTME: giriş dahil tüm ekranlara gizlilik ve hesap/veri silme talebi bağlantıları eklendi. Gerçek cihazda erişilebilirlik ve görünüm testi gerekli. |
| 4 | Hesap/veri silme | AÇIK: mevcut API yalnızca mobil erişimi kaldırıyor. Buton bununla uyumlu adlandırıldı; başarısız yanıt artık başarı sayılmıyor. Tam veri silme talebinin alınması, doğrulanması, işlenmesi; hangi kayıtların neden/ne kadar saklanacağı ve yedek işlemleri tanımlanmalı. E-posta bağlantısı tek başına işleyen süreç kanıtı değildir. |
| 5 | Arka plan konumu | YEREL DÜZELTME: sistem izinlerinden önce ayrı açıklama/olumlu onay; reddetme ve kapatmada takip yok; ekran çıkışındaki izin yarışı engellendi. Console beyanı ve gerçek cihazda izin akışını gösteren video gerekli. |
| 6 | Fotoğraf/kamera izinleri | YEREL DÜZELTME: Android galeri seçiminde genel kitaplık izni istenmiyor; sistem seçicisi kullanılıyor. READ_MEDIA_IMAGES/VIDEO/AUDIO ve RECORD_AUDIO manifest izinleri engellendi. Yeni AAB manifesti ve gerçek cihazda kamera/seçici testi gerekli. |
| 7 | Veri güvenliği | AÇIK: konum, kişisel/hesap bilgisi, fotoğraf/belge, öğrenci/yolcu, ödeme/gider, bildirim ve teknik veri akışlarını Console kategorileriyle eşleştir. Üçüncü taraf işleyici istisnalarını ayrı değerlendir; tümüne otomatik Hayır denmemeli. Gemini aktarımı göz ardı edilmemeli. |
| 8 | Hedef kitle / reklam / derecelendirme | KISMİ: kullanıcının paylaştığı sonuç PEGI 3; bu çocuk hedef kitlesi demek değildir. Yetişkin patron/şoför/veli hedeflemesi, reklam beyanı ve tüm anket cevapları Console'da doğrulanmalı. |
| 9 | Mağaza girişi | AÇIK: Türkçe kısa/tam açıklama, ikon, özellik görseli ve gerçek sürüm ekran görüntüleri. Henüz olmayan mobil evrak görüntüleme özelliği vaat edilmemeli. İletişim ve gizlilik URL'leri doğrulanmalı. |
| 10 | Uygulama bütünlüğü / paket | KISMİ: kullanıcı paket kaydını Kayıtlı olarak paylaştı. Play App Signing, hedef Android seviyesi, 16 KB sayfa uyumu ve Play ön kontrolleri yeni AAB üzerinde doğrulanmalı. |
| 11 | Cihaz kalite testi | AÇIK: tüm roller, kamera/galeri, arka plan/izin reddi, bağlantı kesintisi, geri tuşu, yazı büyütme, bildirim, harita, veri erişim sınırları ve yeniden giriş testleri. |
| 12 | Kapalı test / üretim | AÇIK: kurulum tamamlandıktan sonra yeni AAB yükle, 12 gerçek test kullanıcısının 14 gün kesintisiz katılımını sağla; geri bildirim ve düzeltmeleri kaydet. Üretim başvurusu otomatik onay değildir. |

## Ekran bazlı kod incelemesi

- Giriş: gizlilik erişimi eklendi; 15 saniye zaman aşımı ve bilinmeyen rol hatası eklendi. Canlı inceleme hesapları yok.
- Şoför ana ekranı: çıkışta konum durdurulur. Mobil erişim kaldırmada HTTP hatası kullanıcıya gösterilir; tüm veri silme olarak adlandırılmaz.
- Sefer: konum açıklaması ve rıza eklendi; ilk açılışta otomatik harita geçişi kaldırıldı. Yoklama sunucuda kaydedilemezse durak ilerletilmez.
- Patron: gizlilik/silme talebi bağlantıları eklendi. Daha önce günlük özet ve hata/yenileme akışı geliştirildi; tüm alt sekmeler gerçek cihazda denenmedi.
- Veli: erişim kaldırma hatası gizlenmez; gizlilik/silme talebi erişimi eklendi. Bildirim ve harita gerçek cihaz testini bekliyor.
- Yakıt, arıza, güzergah oluşturma: izin/ağ kullanım noktaları tarandı; fotoğraf seçimi, OCR ve API işlemlerinin uçtan uca testi hâlâ gerekli.
- Web gizlilik sayfaları: tek kaynağa bağlandı. Diğer web paneli ekranlarının tamamı bu çalışmada uçtan uca test edilmedi.

## İncelemeci talimatı (hesaplar doğrulandıktan sonra)

Create three separate access entries: TekerTakip Manager Review Account, TekerTakip Driver Review Account, TekerTakip Parent Review Account.

Instruction draft: Open TekerTakip. Enter the supplied username in “Kullanıcı Adı” and password in “Şifre / PIN”, then tap “Giriş Yap”. The account role selects the corresponding screen automatically. Use only the supplied review accounts and sample data. Location permission is requested for driver trip tracking; camera access is requested when taking a receipt or incident photo.

Do not claim full access or submit credentials until each account has been tested against the live service. Do not store passwords in this repository.

## Kaynaklar

- https://support.google.com/googleplay/android-developer/answer/10144311
- https://support.google.com/googleplay/android-developer/answer/13327111
- https://support.google.com/googleplay/android-developer/answer/9799150
- https://support.google.com/googleplay/android-developer/answer/14151465
