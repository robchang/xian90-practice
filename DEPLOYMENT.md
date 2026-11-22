# Deployment Guide

This app is a static site that can be deployed to any static hosting service for free.

## Option 1: Netlify Drop (Easiest - No CLI needed)

1. Build the app locally:
   ```bash
   npm run build
   ```

2. Go to https://app.netlify.com/drop

3. Drag and drop the `dist` folder

4. Your app is live! Netlify will give you a URL like `https://random-name-123.netlify.app`

5. (Optional) Change the site name in Netlify settings or add a custom domain

## Option 2: Vercel CLI

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Deploy:
   ```bash
   cd mandarin-speech-app
   vercel --prod
   ```

3. Follow the prompts. Your app will be live at a Vercel URL.

## Option 3: GitHub Pages (via GitHub Actions)

1. Push this code to a GitHub repository

2. Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
          cache-dependency-path: mandarin-speech-app/package-lock.json
          
      - name: Install dependencies
        working-directory: ./mandarin-speech-app
        run: npm ci
        
      - name: Build
        working-directory: ./mandarin-speech-app
        run: npm run build
        
      - name: Setup Pages
        uses: actions/configure-pages@v4
        
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: ./mandarin-speech-app/dist
          
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

3. In your GitHub repo settings:
   - Go to Settings → Pages
   - Under "Build and deployment", set Source to "GitHub Actions"

4. Push your code. The workflow will run and deploy your site.

5. Your app will be available at `https://USERNAME.github.io/REPO-NAME/`

**Note**: If deploying to a subdirectory (e.g., `https://username.github.io/repo-name/`), you need to update `vite.config.ts`:

```typescript
export default defineConfig({
  base: '/repo-name/',  // Add your repository name here
  // ... rest of config
})
```

Then rebuild before deploying.

## Option 4: Cloudflare Pages

1. Push code to GitHub

2. Go to https://pages.cloudflare.com/

3. Connect your GitHub repository

4. Configure build settings:
   - Build command: `cd mandarin-speech-app && npm run build`
   - Build output directory: `mandarin-speech-app/dist`

5. Deploy!

## Option 5: Surge.sh (Quick CLI deployment)

1. Install Surge:
   ```bash
   npm install -g surge
   ```

2. Build and deploy:
   ```bash
   npm run build
   cd dist
   surge
   ```

3. Follow prompts to create account and deploy.

## Updating the Deployed App

After initial deployment:

1. Make your changes locally
2. Test: `npm run dev`
3. Build: `npm run build`
4. Deploy using your chosen method:
   - Netlify Drop: Drag new `dist` folder
   - Vercel: `vercel --prod`
   - GitHub Pages: Push to main branch (auto-deploys)
   - Cloudflare: Push to repo (auto-deploys)
   - Surge: `cd dist && surge`

## Custom Domain (Optional)

All these services support custom domains:

1. Purchase a domain from any registrar (Namecheap, Google Domains, etc.)
2. Follow your hosting provider's instructions to add the domain:
   - Netlify: Settings → Domain management → Add custom domain
   - Vercel: Settings → Domains → Add
   - GitHub Pages: Settings → Pages → Custom domain
   - Cloudflare Pages: Custom domains section

## SSL/HTTPS

All these services provide free SSL certificates automatically. Your app will be served over HTTPS.

## PWA Installation

Once deployed, users can "install" the app on their devices:

- **Mobile**: Tap browser menu → "Add to Home Screen"
- **Desktop Chrome**: Look for install icon in address bar
- **Desktop Edge**: Settings menu → Apps → Install this site as an app

The app will work offline after the first visit!
