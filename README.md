# Welcome to your Lovable project

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Open your project in the [Lovable editor](https://lovable.dev) and keep building.

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: connect the project to GitHub and every change made in Lovable is committed straight to your repository.
- **Full ownership**: this code is yours. Push to your repository and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS

## cPanel kurulumu (Node.js YOK — statik dist + PHP)

Sunucunuzda Node.js olmadığı için sistem **statik dosyalar + küçük bir PHP API**
olarak çalışacak şekilde hazırlandı. Puanlama tarayıcıda hesaplanır; kayıtlar
cPanel MySQL'e yazılır; sonuç e-postaları PHP üzerinden SMTP ile gönderilir.

### 1) Build alın (kendi bilgisayarınızda)

```bash
npm install
npm run build:static
```

Çıktı: **`dist/client/`** klasörü. İçinde şunlar hazır gelir:

```
dist/client/
├── index.html          → uygulama girişi
├── assets/             → js + css
├── .htaccess           → /admin yönlendirmesi + /api/mmpi -> api/mmpi.php
└── api/
    ├── mmpi.php        → tüm API (kayıt, cevap, terk takibi, sonuç, admin)
    ├── smtp.php        → bağımlılıksız SMTP gönderici
    └── config.php      → AYARLAR (düzenlenmeli)
```

### 2) Yükleyin

`dist/client/` klasörünün **içeriğini** `public_html/` (veya alt alan adı
klasörünüz) içine kopyalayın. `npm install` gerekmez, Node.js gerekmez.

### 3) Veritabanı

cPanel > **MySQL Veritabanları**: bir veritabanı + kullanıcı oluşturup tüm
yetkileri verin. Tablolar (test_sessions, test_answers, session_events) ilk
istekte otomatik oluşturulur — SQL çalıştırmanız gerekmez.

### 4) `api/config.php` dosyasını düzenleyin

```php
'db_host' => 'localhost',
'db_name' => 'kullanici_mmpi',
'db_user' => 'kullanici_mmpi',
'db_pass' => '********',

'smtp_host' => 'srvc67.trwww.com',
'smtp_port' => 465,
'smtp_secure' => 'ssl',
'smtp_user' => 'mmpitesti@pruvapsikoloji.com',
'smtp_pass' => '@pruvapsikoloji.com',
'mail_from' => 'mmpitesti@pruvapsikoloji.com',
'admin_email' => 'mmpitesti@pruvapsikoloji.com',

'admin_user' => 'admin',
'admin_pass' => '@pruvapsikoloji.com',
```

Sonuç e-postası hem katılımcıya hem `admin_email` adresine gider.
Yönetim paneli: `https://alanadiniz.com/admin`

### Gereksinimler

- PHP 7.4+ (PDO MySQL + openssl açık — cPanel'de varsayılan)
- Apache `mod_rewrite` (cPanel'de varsayılan açık)
- SMTP 465 portu giden bağlantılara açık olmalı (aynı sunucudaki hesap için sorun olmaz)

### Sorun giderme

- **Boş sayfa / 404 (örn. /admin):** `.htaccess` yüklenmemiş olabilir; gizli
  dosyaları göstererek kontrol edin.
- **"Veritabanına bağlanılamadı":** `config.php` içindeki MySQL bilgileri.
- **E-posta gitmiyor:** Sonuç ekranında SMTP hata mesajı gösterilir; port/şifreyi
  kontrol edin. Alternatif olarak `smtp_port => 587`, `smtp_secure => 'tls'`.

## Node.js sunucusunda çalıştırma (alternatif)

Node.js'li bir sunucu kullanırsanız SSR sürümü de derlenebilir:

```bash
npm run build      # .output/ üretir
npm run start      # node .output/server/index.mjs (port 3000)
```

