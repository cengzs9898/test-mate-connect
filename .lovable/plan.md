# MMPI Kişilik Testi — 566 soruluk test sistemi

Referans sitedeki (mmpitesti.com) soru listesi, ölçek anahtarları ve T-skor tabloları birebir alınıp
projeye taşınacak. Üzerine kayıt formu, süre sayacı, kilitli cevaplar, terk/dönüş takibi, PDF çıktısı,
e-posta gönderimi ve yönetim paneli eklenecek.

## Görsel yön
- Logodaki mavi→yeşil geçiş ana renk olacak; koyu lacivert arayüz (paylaşılan ekran görüntülerine yakın),
  kart tabanlı, liste düzeninde soru akışı.
- Sorular sayfa sayfa (29 sayfa × ~20 soru), sağda ilerleme yüzdesi + sayfa navigasyonu, üstte geri sayım
  yerine geçen süre sayacı.

## Akış
1. **Kayıt ekranı**: ad soyad, yaş, cinsiyet, telefon, e-posta. Doldurulmadan teste başlanamaz.
2. **Test**: her soru D/Y. Bir seçim yapıldıktan sonra kilitlenir, değiştirilemez.
   Cevaplar anında sunucuya yazılır, süre sayacı çalışır.
3. **Dönüş**: aynı e-posta ile tekrar girildiğinde "Devam et" / "Yeniden başla" seçeneği.
4. **Sonuç**: klinik ölçek grafiği, içerik ölçek grafiği, ham puan / K düzeltme / T-skor tabloları,
   detaylı yorum kartları (referans sitedeki metinler), geçerlilik uyarıları.
5. **PDF**: `isim-soyisim-tarih-saat.pdf` olarak indirilir ve e-posta ekine değil, e-posta içine özet +
   indirilebilir bağlantı olarak konur (ek dosya desteklenmiyor).
6. **E-posta**: sonuç özeti hem kişinin adresine hem `cengizs.98@gmail.com` adresine gider.

## Takip ve yönetim paneli
Her oturum için kaydedilecek: IP adresi, tarayıcı bilgisi, başlangıç/bitiş saati, toplam süre,
cevaplanan soru sayısı, sekmeden/siteden ayrılma saati, dönüş saati, ayrıldığı andaki soru numarası.
Yönetim paneli: oturum listesi, filtre, detay görünümü, sonuçları tekrar görme/PDF alma.

## Teknik
- **Lovable Cloud** açılacak: `test_sessions`, `test_answers`, `session_events` (terk/dönüş kayıtları) tabloları,
  RLS ile korunacak; oturumlar anonim token ile yazılacak, panel yalnızca yönetici rolüyle okunacak.
- Yönetici girişi: e-posta/şifre ile giriş + `user_roles` tablosunda `admin` rolü.
- Soru ve puanlama verisi: `src/data/mmpi-questions.ts`, `src/data/mmpi-scales.ts` (referans veriden dönüştürülmüş).
- Puanlama ve yorum üretimi paylaşılan bir modülde; hem ekran hem PDF hem e-posta aynı çıktıyı kullanır.
- E-posta gönderimi **Gmail connector** üzerinden sunucu tarafında yapılır.
- PDF: jsPDF + tablo/grafik render, dosya adı `isim-soyisim-YYYY-MM-DD-HH-mm.pdf`.
- Terk takibi: `visibilitychange` / `beforeunload` olayları sunucuya yazılır.

## Uyarılar
- Klinik değerlendirme yalnızca yetkili bir ruh sağlığı profesyoneli tarafından yapılabilir — bu uyarı
  hem arayüzde hem PDF'te yer alacak.
- Gmail connector bağlantısı için onay kartı açılacak; onaylanmazsa e-posta gönderimi çalışmaz.
