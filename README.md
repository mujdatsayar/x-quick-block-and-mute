# X.com Hızlı Engelleme, Hesap ve Kelime Sessize Alma (Hepsi Bir Arada)

X (eski Twitter) üzerinde **hesap engelleme**, **hesap sessize alma** ve **kelime/ifade sessize alma** işlemlerini saniyelere indiren Tampermonkey / Violentmonkey kullanıcı betiği (`userscript`).

> **Önemli Fark:** Bu araç tweet'leri yalnızca tarayıcıda gizlemez; yaptığınız her işlem **doğrudan X hesabınızın resmi ayarlarına** kaydedilir (`Engellenen hesaplar`, `Sessize alınan hesaplar`, `Sessize alınan kelimeler`). Böylece telefon uygulamanız dahil tüm cihazlarınızda kalıcı olarak geçerli olur.

---

## Neden Kullanışlı? (Pratiklik)

Normalde X üzerinde:
- Bir **kelimeyi** sessize almak için: *Daha fazla → Ayarlar ve gizlilik → Gizlilik ve güvenlik → Sessize al ve engelle → Sessize alınan kelimeler → Ekle → Kelime yaz → Süre/seçenek seç → Kaydet* (7-8 adım),
- Bir **hesabı** engellemek için: *Üç nokta (`...`) → Engelle → Onayla* (3 adım, yanlış tıklama riski) gerekir.

Bu eklenti ile:
- **Kelime sessize alma:** Tweet içinde rahatsız olduğunuz **tek bir kelimeyi veya birden fazla kelimeyi fareyle seçin**, çıkan balona tıklayın. Anında `x.com/settings/muted_keywords` listenize eklenir!
- **Hesap engelleme / sessize alma:** Akışta herhangi bir **kullanıcı adına tıkladığınızda** şık bir hızlı işlem penceresi açılır; **Profiline Git**, **Bu Hesabı Sessize Al** veya **Bu Hesabı Engelle** seçeneklerinden birini tek tıkla seçebilirsiniz.

---

## Özellikler

- **Tek ve Çoklu Kelime Sessize Alma:**
  - **Tek kelime seçimi:** Tek tıkla doğrudan X'in *Sessize alınan kelimeler* ayarlarına ekler.
  - **Çoklu kelime seçimi:** Birden fazla kelime seçtiğinizde iki seçenek sunar:
    1. *İfadeyi sessize al* (seçili kalıbı tek kural olarak kaydeder)
    2. *Kelimeleri seç* (seçilen metindeki kelimeleri ayrı ayrı etiket/chip olarak listeler; istediklerinizi işaretleyip, süre ve *"Takip edilenler hariç"* seçeneğini belirleyerek hepsini tek seferde X ayarlarına kaydeder)
  - **Toplu Kelime Ekleme Menüsü:** Tampermonkey eklenti simgesi → *"Toplu Kelime Sessize Al (X Ayarlarına Kaydet)"* üzerinden metin seçmeden de virgülle birden fazla kelime ekleyebilirsiniz.
- **Hızlı Hesap İşlemleri (Profil / Sessize Al / Engelle):**
  - X'in resmi akışını ve resmi API uç noktalarını (`/1.1/blocks/create`, `/1.1/mutes/users/create`) kullanır.
  - Yanlışlıkla engelleme veya sessize alma durumunda bildirim çubuğunda **Geri Al** butonu sunar.
  - **Alıntı Tweet (Quote Tweet) Koruması:** Alıntı yapılan kişinin adına tıkladığınızda yanlışlıkla dıştaki tweet sahibini değil, doğrudan alıntılanan hesabı hedefler.
  - **Kendi Hesabı Koruması:** Kendi kullanıcı adınıza tıkladığınızda engelleme/sessize alma butonlarını gizler.
  - **Hızlı Profil Geçişi:** *Profiline Git* dediğinizde sayfayı baştan yüklemeden X'in kendi SPA yönlendiricisiyle anında profile geçer.
- **Akıllı Akış Temizliği & Tema Uyumu:**
  - DOM'dan eleman silmek yerine React sanal listesiyle uyumlu gizleme uygular; sayfa kaydırıldıkça yeni yüklenen eşleşen tweet'leri de gizler.
  - X'in **Açık (Light)**, **Loş (Dim)** ve **Karanlık (Lights Out)** temalarına otomatik uyum sağlar.
- **Güncellemelere Dayanıklı Dinamik Mimari:**
  - Sabit Webpack modül ID'lerine bağımlı değildir; X'in `x-client-transaction-id` üretecini ve Redux store'unu çalışma zamanında dinamik olarak tespit eder.

---

## Kurulum

1. Tarayıcınıza **[Tampermonkey](https://www.tampermonkey.net/)** (Chrome, Edge, Brave, Firefox) veya **Violentmonkey** eklentisini kurun.
2. Tek tıkla kurulum için **[Buraya Tıklayın (x-quick-block-and-mute.user.js)](https://raw.githubusercontent.com/mujdatsayar/x-quick-block-and-mute/main/x-quick-block-and-mute.user.js)** — Tampermonkey otomatik olarak kurulum ekranını açacaktır.
   *(Alternatif olarak [`x-quick-block-and-mute.user.js`](./x-quick-block-and-mute.user.js) dosyasını açıp içeriğini kopyalayarak Tampermonkey Dashboard'da yeni bir betiğe yapıştırıp `Ctrl + S` ile kaydedebilirsiniz.)*
3. Açık bir `https://x.com/` sekmeniz varsa sayfayı yenileyin (`F5`).

---

## Nasıl Kullanılır?

| İşlem | Nasıl Yapılır? | Nereye Kaydedilir? |
| :--- | :--- | :--- |
| **Tek kelime sessize al** | Tweet metninde kelimeyi fareyle seçin → çıkan balona tıklayın | `x.com/settings/muted_keywords` |
| **Birden fazla kelime sessize al** | Birkaç kelime/cümle seçin → **Kelimeleri seç** butonuna basın → istediklerinizi işaretleyip kaydedin | `x.com/settings/muted_keywords` |
| **Toplu kelime ekle** | Tarayıcıdaki Tampermonkey simgesi → *Toplu Kelime Sessize Al* | `x.com/settings/muted_keywords` |
| **Hesap engelle / sessize al** | Akıştaki kullanıcı adına tıklayın → *Bu Hesabı Sessize Al* veya *Bu Hesabı Engelle* | `x.com/settings/muted/all` / `x.com/settings/blocked/all` |
| **Doğrudan profile git** | `Ctrl + Tık` (veya modalda *Profiline Git*) | — |

> **İpucu:** Tweet'in sağındaki tarih/saat bağlantısına (`· 2s`) tıkladığınızda normal şekilde tweet detayına gitmeye devam edersiniz; modal yalnızca kullanıcı adı/handle kısmına tıklandığında açılır.

---

## Gizlilik ve Güvenlik

- Betik **tamamen tarayıcınız içinde** çalışır; harici hiçbir sunucuya, üçüncü parti API'ye veya takip servisine veri göndermez.
- Tüm istekler doğrudan kendi tarayıcı oturumunuz (`x.com` / `api.x.com`) üzerinden, X'in kendi CSRF (`ct0`) ve `x-client-transaction-id` imzalarıyla gerçekleştirilir.
- Kullanıcı arayüzü `TrustedHTML` / XSS riskine karşı `innerHTML` yerine güvenli DOM API'leri (`createElement` / `textContent`) ile oluşturulur.

---

## Lisans

[MIT](./LICENSE)
