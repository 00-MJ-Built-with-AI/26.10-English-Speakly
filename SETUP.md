# Speakly setup

Speakly runs without any accounts in **test mode** (progress in this browser, rough scores from the
browser's own speech recognition, a simple stand-in tutor). To get the real app you connect three
services. Each one takes about 10 minutes. Keys go in `.env.local` for your computer and in Vercel
for the live site; **never commit them**.

## 1. Firebase: Google sign-in, progress, recordings

1. Go to <https://console.firebase.google.com> → **Add project** → name it `speakly` (Google Analytics: off is fine).
2. **Build → Authentication → Get started → Sign-in method → Google → Enable**. Pick your support email. Save.
3. **Build → Firestore Database → Create database** → production mode → a region near you (e.g. `eur3` or `nam5`).
   Open the **Rules** tab, paste the contents of `firestore.rules` from this folder, **Publish**.
4. Recordings need the **Blaze** (pay-as-you-go) plan: click **Upgrade** at the bottom left and add a card.
   Then in Google Cloud Billing → **Budgets & alerts**, create a budget of **$1** with email alerts.
   Normal use stays inside the free quota (5 GB stored, 1 GB/day downloads), so the bill should be $0.
5. **Build → Storage → Get started** → production mode → same region. Open **Rules**, paste `storage.rules`, **Publish**.
6. **Project settings (gear) → General → Your apps → Web (`</>`)** → register app `speakly` (no hosting).
   Copy the config values into `.env.local`:
   ```
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_PROJECT_ID=...
   VITE_FIREBASE_STORAGE_BUCKET=...
   VITE_FIREBASE_APP_ID=...
   FIREBASE_PROJECT_ID=...        (same project id, used by the server to check sign-ins)
   ALLOWED_EMAILS=you@gmail.com   (only this account can use the paid AI and speech services)
   ```
7. After deploying (step 5 below): **Authentication → Settings → Authorized domains → Add domain** → your Vercel domain.

## 2. Azure AI Speech: pronunciation scoring and the tutor's voice

1. Go to <https://portal.azure.com> (a free account works) → **Create a resource** → search **Speech** (Azure AI services) → **Create**.
2. Region: **East US** or **West Europe** (pronunciation assessment with prosody and the most natural
   "HD" voices are available there). Pricing tier: **Free F0** to start. The tutor uses an HD voice by
   default; if your resource can't use HD voices, the app switches to the standard voice automatically
   (Settings lets you pick either). HD voices cost more per character than standard ones; check
   Azure's pricing page.
3. When it's created, open it → **Keys and Endpoint**. Copy **Key 1** and the **Location/Region**:
   ```
   AZURE_SPEECH_KEY=...
   AZURE_SPEECH_REGION=eastus
   ```
   The free tier includes 5 hours of speech recognition (which includes pronunciation scoring) and
   0.5 million characters of neural voice per month. At 20-30 minutes a day you may go a little over;
   switch to Standard S0 then (about $1 per extra hour of listening; check Azure's pricing page).

## 3. Anthropic: the AI tutor

1. Go to <https://console.anthropic.com> → **API keys → Create key**. Add some credit under **Billing**.
2. ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```
3. Model: the tutor uses **Claude Opus 5.5** by default. To lower cost, set one of:
   ```
   TUTOR_MODEL=claude-sonnet-5-5   (about half the price)
   TUTOR_MODEL=claude-haiku-5-5    (much cheaper, simpler conversation)
   ```
   Requests that a safety filter declines are retried automatically on a fallback model
   (`fallbacks: "default"`), so a conversation doesn't stop on a false positive.

## Spending limits

The app shows estimated spending in Settings and stops the paid services at a daily limit you choose
(default $1). That limit is enforced by the app, so for a hard stop also set a monthly spend limit in the
Anthropic console (Settings > Limits) and a budget alert in Azure (Cost Management > Budgets).

## 4. Run it on your computer

```
cd speakly-app
npm install
npm run dev
```
Open <http://localhost:5190>. With Firebase configured, remove `ALLOW_UNAUTHENTICATED` from `.env.local`.
Use Chrome or Edge, allow the microphone, and wear headphones for hands-free conversations.

## 5. Online (Vercel)

The app is already deployed: Vercel project **speakly** (team mohammadjouzas-projects), live at
<https://speakly-puce-gamma.vercel.app>. The GitHub repo is connected, so every push to `main` deploys
automatically. Until the keys below are added, the live site runs in test mode.

1. Vercel dashboard → **speakly → Settings → Environment Variables**: add every variable from the lists
   above (Production and Preview), **except** `ALLOW_UNAUTHENTICATED`. The `VITE_FIREBASE_*` ones are read
   at build time, so redeploy after adding them (Deployments → ... → Redeploy, or push a commit).
2. Firebase → Authentication → Settings → **Authorized domains** → add `speakly-puce-gamma.vercel.app`.
3. **Deployment Protection**: Vercel protects new projects so visitors must log in to Vercel first. The app
   has its own Google sign-in and `ALLOWED_EMAILS`, so you can turn this off in Settings → Deployment
   Protection → Vercel Authentication, or keep it and stay logged in to Vercel on your devices.
4. On your phone, open the site in Chrome → menu → **Add to Home screen** to install it as an app.

Manual deploy from this folder (optional): `npx vercel build --prod` then `npx vercel deploy --prebuilt --prod`.
