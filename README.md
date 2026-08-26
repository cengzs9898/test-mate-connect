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

## Kendi sunucunuzda çalıştırma (self-host)

```bash
git clone <repo-url> && cd <repo>
cp .env.example .env   # değerleri doldurun
npm install
npm run build
npm run start          # veya: node .output/server/index.mjs
```

### E-posta gönderimi
Sonuç raporları `nodemailer` ile doğrudan SMTP üzerinden gönderilir. `.env` içinde
`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`
tanımlı olduğunda mailler `mmpitesti@pruvapsikoloji.com` adresinden gider ve
hem katılımcıya hem `ADMIN_EMAIL` adresine ulaşır. SMTP tanımlı değilse uygulama
Lovable e-posta bağlantısına düşer; kendi sunucunuzda SMTP kullanın.

> Not: Lovable önizlemesi serverless çalıştığı için SMTP portları orada kapalıdır;
> SMTP yalnızca kendi Node sunucunuzda devreye girer.
