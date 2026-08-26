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

## Kendi Node.js sunucunuzda çalıştırma (self-host)

Bu proje SSR + sunucu fonksiyonları kullandığı için "statik dist" olarak değil,
**Node.js sunucu çıktısı** olarak derlenir. Build sonunda `.output/` klasörü oluşur
ve tek komutla ayağa kalkar:

```bash
git clone <repo-url> && cd <repo>
cp .env.example .env      # değerleri doldurun (Supabase + SMTP + admin)
npm install
npm run build             # Lovable dışında otomatik Node çıktısı üretir
npm run start             # = node .output/server/index.mjs  (varsayılan port 3000)
```

Port değiştirmek için: `PORT=8080 npm run start`

Çıktı klasörü:

```
.output/
├── server/index.mjs   → Node.js sunucu girişi (npm start bunu çalıştırır)
├── server/...          → SSR + server function kodu
├── public/             → statik dosyalar (css, js, görseller)
└── nitro.json
```

Sunucuya sadece derlenmiş halini atmak isterseniz `.output/` klasörünü ve
`.env` dosyasını kopyalayıp `node .output/server/index.mjs` çalıştırmanız yeterlidir
(o makinede `npm install` gerekmez, bağımlılıklar bundle edilmiştir).

### PM2 ile sürekli çalıştırma

```bash
npm install -g pm2
pm2 start .output/server/index.mjs --name mmpi --env production
pm2 save && pm2 startup
```

### Nginx reverse proxy (örnek)

```nginx
server {
  server_name mmpitesti.com;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```

> Not: Hedefi elle sabitlemek isterseniz `npm run build:node`
> (`NITRO_PRESET=node-server`) komutunu kullanın. Vercel/Netlify gibi bir platforma
> deploy ederken `NITRO_PRESET` değerini o platforma göre verin.

### E-posta gönderimi
Sonuç raporları `nodemailer` ile doğrudan SMTP üzerinden gönderilir. `.env` içinde
`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`
tanımlı olduğunda mailler `mmpitesti@pruvapsikoloji.com` adresinden gider ve
hem katılımcıya hem `ADMIN_EMAIL` adresine ulaşır. SMTP tanımlı değilse uygulama
Lovable e-posta bağlantısına düşer; kendi sunucunuzda SMTP kullanın.

> Not: Lovable önizlemesi serverless çalıştığı için SMTP portları orada kapalıdır;
> SMTP yalnızca kendi Node sunucunuzda devreye girer.
