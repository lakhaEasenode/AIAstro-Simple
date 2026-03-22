# AstroAI Hosting On Azure VM + Cloudflare

Assumption:
- Ubuntu VM
- domain: `lakhendra.in`
- frontend served from `lakhendra.in`
- backend served through the same domain on `/api`

## 1. Azure VM

Open inbound ports in the Azure Network Security Group:
- `22` for SSH
- `80` for HTTP
- `443` for HTTPS

## 2. Install packages on VM

```bash
sudo apt update
sudo apt install -y nginx git
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

## 3. Clone project

```bash
cd /var/www
sudo mkdir -p /var/www/astroai
sudo chown -R $USER:$USER /var/www/astroai
git clone https://github.com/lakhaEasenode/AIAstro-Simple.git /var/www/astroai
cd /var/www/astroai
```

## 4. Install app dependencies

```bash
cd /var/www/astroai/client
npm install

cd /var/www/astroai/server
npm install
```

## 5. Configure environment

Create `/var/www/astroai/server/.env`:

```env
PORT=3303
CLIENT_URL=https://lakhendra.in
ALLOWED_ORIGINS=https://lakhendra.in,https://www.lakhendra.in
OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=gpt-4o-mini
MONGODB_URI=your_mongodb_uri
MONGODB_DB_NAME=astroai
SMTP_EMAIL=your_email@gmail.com
SMTP_PASSWORD=your_app_password
ACCESS_TOKEN_SECRET=replace_with_long_random_secret
REFRESH_TOKEN_SECRET=replace_with_long_random_secret
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_DAYS=30
```

Create `/var/www/astroai/client/.env.production`:

```env
VITE_API_BASE_URL=/api
```

## 6. Build client

```bash
cd /var/www/astroai/client
npm run build
```

## 7. Start API with systemd

Copy the service file:

```bash
sudo cp /var/www/astroai/deploy/astroai-api.service /etc/systemd/system/astroai-api.service
```

Edit the service user if needed:
- if your app files belong to `azureuser`, change `User=www-data` to `User=azureuser`

Then enable it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable astroai-api
sudo systemctl start astroai-api
sudo systemctl status astroai-api
```

## 8. Configure Nginx

```bash
sudo cp /var/www/astroai/deploy/astroai-nginx.conf /etc/nginx/sites-available/astroai
sudo ln -s /etc/nginx/sites-available/astroai /etc/nginx/sites-enabled/astroai
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

## 9. Cloudflare DNS

Create:
- `A` record for `@` -> your Azure VM public IP -> `Proxied`
- `A` record for `www` -> your Azure VM public IP -> `Proxied`

## 10. SSL

In Cloudflare:
- SSL/TLS mode -> `Full (strict)` after your origin has a valid certificate

Recommended path:
- use Cloudflare Origin Certificate on Nginx, or
- use Let’s Encrypt on the VM

If you want the easiest first launch, you can start with:
- Cloudflare SSL/TLS -> `Full`

Then move to:
- `Full (strict)` once origin TLS is installed correctly

## 11. Deploy updates later

```bash
cd /var/www/astroai
git pull

cd /var/www/astroai/client
npm install
npm run build

cd /var/www/astroai/server
npm install
sudo systemctl restart astroai-api
sudo systemctl reload nginx
```
