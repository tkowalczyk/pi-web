# Production Deployment Guide - powiadomienia.info

**Version:** 1.0
**Date:** 2026-01-28
**Status:** Ready for Execution
**CRITICAL:** This app handles REAL USERS and REAL MONEY - verify every step

---

## Executive Summary

Complete production deployment guide for powiadomienia.info SMS notification system. Covers database setup, Cloudflare Workers configuration, third-party integrations (Stripe, Google OAuth, SerwerSMS), and verification procedures.

**Deployment Order:**
1. Neon Postgres production database
2. Stripe production setup (CRITICAL - handles payments)
3. Google OAuth production credentials
4. Cloudflare Workers infrastructure (KV, Queues, Cron)
5. Environment secrets configuration
6. Deploy data-service worker
7. Deploy user-application frontend
8. Post-deployment verification

---

## 1. Neon Postgres Database

### 1.1 Production Database Setup

**Action:** Create production database on Neon

1. **Navigate to Neon Console:** https://console.neon.tech
2. **Create New Project:**
   - Name: `powiadomienia-info-prod`
   - Region: `Europe (Frankfurt)` (closest to users in Poland)
   - Postgres version: Latest stable
3. **Get Connection String:**
   - Format: `postgresql://[user]:[password]@[host]/[dbname]?sslmode=require`
   - Extract components:
     - `DATABASE_HOST`: `[host]/[dbname]?sslmode=require&channel_binding=require`
     - `DATABASE_USERNAME`: `[user]`
     - `DATABASE_PASSWORD`: `[password]`
4. **Enable Connection Pooler:**
   - Use pooled connection for Workers (required for serverless)
   - Port: 5432 (pooler)

### 1.2 Configure Production Environment File

**File:** `packages/data-ops/.env.prod`

```bash
CLOUDFLARE_ENV=prod
DATABASE_HOST="ep-xxx-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
DATABASE_USERNAME="neondb_owner"
DATABASE_PASSWORD="npg_xxx"

BETTER_AUTH_SECRET="<generate-new-secret>"

GOOGLE_CLIENT_ID="<prod-google-client-id>"
GOOGLE_CLIENT_SECRET="<prod-google-client-secret>"

STRIPE_CARD_MONTHLY_PRODUCT_ID="prod_xxx"
STRIPE_CARD_MONTHLY_PRICE_ID="price_xxx"
STRIPE_BLIK_ANNUAL_PRODUCT_ID="prod_yyy"
STRIPE_BLIK_ANNUAL_PRICE_ID="price_yyy"
```

**Generate BETTER_AUTH_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 1.3 Run Migrations

**From:** `packages/data-ops/`

```bash
# 1. Generate migration (compares schema.ts with prod DB)
pnpm drizzle:prod:generate

# 2. Review generated SQL
# Check files in: src/drizzle/migrations/prod/
# Verify CREATE TABLE statements match expected schema

# 3. Apply migration
pnpm drizzle:prod:migrate

# 4. Verify tables created
# Use Neon console SQL editor or:
# psql connection-string -c "\dt"
```

**Expected Tables:**
- `auth_user`, `auth_session`, `auth_account`, `auth_verification` (Better Auth)
- `cities`, `streets`, `addresses` (location data)
- `waste_types`, `waste_schedules` (collection schedules)
- `notification_preferences`, `notification_logs` (SMS system)
- `subscription_plans`, `subscriptions`, `payments` (payment system)
- `webhook_events` (idempotency tracking)

### 1.4 Seed Initial Data

**From:** `packages/data-ops/`

```bash
# Import cities, streets, waste schedules from files
pnpm import:prod

# Seed subscription plans (after Stripe setup in Section 2)
pnpm seed:prod
```

**Verification:**
```sql
-- Check data imported
SELECT COUNT(*) FROM cities;      -- Should be > 0
SELECT COUNT(*) FROM streets;     -- Should be > 0
SELECT COUNT(*) FROM waste_schedules;  -- Should be > 0

-- Check subscription plans seeded
SELECT id, name, stripe_price_id, amount FROM subscription_plans;
-- Should show 2 rows: Card Monthly (1000 grosze), BLIK Annual (10000 grosze)
```

---

## 2. Stripe Integration (CRITICAL - REAL MONEY)

### 2.1 Stripe Account Setup

**Action:** Set up production Stripe account

1. **Create Stripe Account:** https://dashboard.stripe.com/register
2. **Activate Account:**
   - Complete business details
   - Verify identity
   - Add bank account for payouts
3. **Enable Payment Methods:**
   - Dashboard → Settings → Payment methods
   - Enable: **Card**, **BLIK**
   - BLIK note: Automatically available for PLN currency in Poland

### 2.2 Create Products and Prices

**IMPORTANT:** Do this in **LIVE MODE** (toggle in dashboard top-left)

**Product 1: Card Monthly Subscription**

1. Dashboard → Products → Add Product
2. Settings:
   - Name: `powiadomienia.info - Card Monthly`
   - Description: `Monthly subscription with automatic card payments - PLN 10/month`
   - Pricing model: `Recurring`
   - Price: `10.00 PLN`
   - Billing period: `Monthly`
   - Payment methods: `Card`
3. Save → Copy IDs:
   - Product ID: `prod_xxx` (starts with `prod_`)
   - Price ID: `price_xxx` (starts with `price_`)

**Product 2: BLIK Annual Payment**

1. Dashboard → Products → Add Product
2. Settings:
   - Name: `powiadomienia.info - BLIK Annual`
   - Description: `Annual payment with BLIK - PLN 100/year (save PLN 20 vs monthly)`
   - Pricing model: `One-time`
   - Price: `100.00 PLN`
   - Payment methods: `BLIK` (auto-detected for Polish accounts)
3. Save → Copy IDs:
   - Product ID: `prod_yyy`
   - Price ID: `price_yyy`

**Update Environment Files:**

Add IDs to `packages/data-ops/.env.prod` and `apps/user-application/.env.prod`

### 2.3 Get API Keys

**Dashboard → Developers → API keys (LIVE MODE)**

Copy:
- **Publishable key:** `pk_live_xxx` (safe to expose in frontend)
- **Secret key:** `sk_live_xxx` (NEVER commit to git)

### 2.4 Configure Webhook Endpoints

**CRITICAL:** Webhooks handle subscription updates and payment processing

**Required Events:**
- `checkout.session.completed` - Initial payment success
- `customer.subscription.updated` - Subscription status changes
- `customer.subscription.deleted` - Subscription canceled
- `invoice.payment_succeeded` - Recurring payment success
- `invoice.payment_failed` - Payment failure
- `payment_intent.succeeded` - BLIK one-time payment success

**Production Setup:**

1. Dashboard → Developers → Webhooks → Add endpoint
2. Endpoint URL: `https://powiadomienia.info/worker/webhooks/stripe`
3. Description: `Production webhook - subscription and payment events`
4. Events to send: Select all 6 events listed above
5. Save → Copy **Signing secret:** `whsec_xxx`

**Stage Setup (for testing):**

1. Create second webhook endpoint
2. URL: `https://stage.powiadomienia.info/worker/webhooks/stripe`
3. Same 6 events
4. Copy separate signing secret for stage

**Webhook Implementation:**

Already implemented in `apps/data-service/src/hono/routes/webhooks.ts`
- Signature verification via `stripe.webhooks.constructEventAsync()`
- Idempotency via `webhook_events` table
- All handlers in `apps/data-service/src/stripe/webhooks/`

### 2.5 Stripe Environment Variables Summary

**For data-service:**
- `STRIPE_SECRET_KEY` (secret) - `sk_live_xxx`
- `STRIPE_WEBHOOK_SECRET` (secret) - `whsec_xxx`
- `STRIPE_CARD_MONTHLY_PRICE_ID` - `price_xxx`
- `STRIPE_BLIK_ANNUAL_PRICE_ID` - `price_yyy`

**For user-application:**
- `VITE_STRIPE_PUBLISHABLE_KEY` - `pk_live_xxx`
- `VITE_STRIPE_CARD_MONTHLY_PRICE_ID` - `price_xxx`
- `VITE_STRIPE_BLIK_ANNUAL_PRICE_ID` - `price_yyy`

### 2.6 Test Payment Flow (Test Mode First)

**Before going live, verify in TEST MODE:**

1. Switch dashboard to **Test mode**
2. Create test products/prices (same process as 2.2)
3. Deploy to **stage** environment
4. Use Stripe test cards:
   - Success: `4242 4242 4242 4242`
   - Decline: `4000 0000 0000 0002`
   - BLIK test: Use Stripe test mode BLIK flow
5. Verify:
   - Checkout session creates subscription
   - Webhook events fire
   - Database records created
   - Payment status correct

**Only switch to live mode after stage verification passes**

---

## 3. Google OAuth Configuration

### 3.1 Google Cloud Console Setup

**Action:** Create production OAuth credentials

1. **Navigate:** https://console.cloud.google.com
2. **Create Project:**
   - Name: `powiadomienia-info-prod`
   - Organization: Personal/Company
3. **Enable APIs:**
   - APIs & Services → Enable APIs
   - Enable: `Google+ API` (for profile data)
4. **Configure OAuth Consent Screen:**
   - User Type: `External`
   - App name: `powiadomienia.info`
   - User support email: `your-email@example.com`
   - Developer contact: `your-email@example.com`
   - Scopes: `email`, `profile` (default)
   - Test users: Not needed (app will be published)
   - Publishing status: Submit for verification (optional for < 100 users)

### 3.2 Create OAuth Credentials

**APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**

Settings:
- Application type: `Web application`
- Name: `powiadomienia.info Production`
- Authorized JavaScript origins:
  - `https://powiadomienia.info`
- Authorized redirect URIs:
  - `https://powiadomienia.info/api/auth/callback/google`

**Save → Copy:**
- Client ID: `xxx.apps.googleusercontent.com`
- Client secret: `GOCSPX-xxx`

**Repeat for Stage Environment:**
- Name: `powiadomienia.info Stage`
- Origins: `https://stage.powiadomienia.info`
- Redirect: `https://stage.powiadomienia.info/api/auth/callback/google`

### 3.3 Better Auth Configuration

Already configured in `packages/data-ops/src/auth/setup.ts`:
- `emailAndPassword.enabled: true`
- `accountLinking.enabled: true` (auto-links Google and email/password)
- `socialProviders.google` (configured at runtime)

OAuth flow handled by Better Auth automatically:
- Client: `apps/user-application/src/components/auth/google-login.tsx`
- Server: `apps/user-application/src/server.ts` (setAuth with Google provider)

### 3.4 Google OAuth Environment Variables

**For user-application:**
- `GOOGLE_CLIENT_ID` - `xxx.apps.googleusercontent.com`
- `GOOGLE_CLIENT_SECRET` - `GOCSPX-xxx`

**Note:** Both apps share same auth config via data-ops package

---

## 4. SerwerSMS Configuration

### 4.1 SerwerSMS Account Setup

**Action:** Create account and get API token

1. **Register:** https://www.serwersms.pl/rejestracja
2. **Verify:** Email + phone verification
3. **Add Credits:** Minimum 50 PLN for production testing
4. **Get API Token:**
   - Dashboard → Ustawienia → API
   - Create new token → Copy: `xxx-yyy-zzz`

### 4.2 SMS Configuration

**Options:**
- **SMS ECO:** 0.035 PLN/SMS (no sender name, shows gateway number)
- **SMS FULL:** 0.055 PLN/SMS (custom sender name)

**Implementation:** `apps/data-service/src/services/sms.ts`

Sender name configured via `SERWERSMS_SENDER_NAME`:
- If set: Uses SMS FULL with custom sender
- If empty: Uses SMS ECO (cheaper)

**Rate Limiting:**
- Implementation: 200ms delay between sends (5 SMS/sec)
- SerwerSMS API limit: 50-200 req/sec (we're well below)

### 4.3 SerwerSMS Environment Variables

**For data-service:**
- `SERWERSMS_API_TOKEN` (secret) - API token from dashboard
- `SERWERSMS_SENDER_NAME` (optional) - `"Odbiór"` or similar (11 chars max)

### 4.4 SMS Flow Verification

**Implementation:** `apps/data-service/src/scheduled/index.ts` → Queue → `src/queues/index.ts`

**Process:**
1. Cron runs hourly (0 * * * *)
2. Queries users needing notifications (with active subscription)
3. Batches to Cloudflare Queue
4. Queue consumer sends SMS via SerwerSMS
5. Logs to `notification_logs` table

**SMS Gating:** Only sends to users with `subscriptions.status = 'active'`

---

## 5. Cloudflare Workers Infrastructure

### 5.1 Cloudflare Account Setup

1. **Create Account:** https://dash.cloudflare.com/sign-up
2. **Add Domain:** `powiadomienia.info`
   - Update nameservers at registrar
   - Wait for DNS propagation (can take 24-48h)
3. **Install Wrangler CLI:**
   ```bash
   npm install -g wrangler
   wrangler login
   ```

### 5.2 KV Namespaces

**Purpose:** Cache coverage stats (cities/streets/users counts)

**Create namespaces:**

```bash
# Production
wrangler kv:namespace create CACHE --env prod
# Copy ID: 7688a332f25e416795f71a004b557f65

# Stage
wrangler kv:namespace create CACHE --env stage
# Copy ID: eb683052a4dd40b3a87d212c23b36c0c
```

**Already configured in:** `apps/data-service/wrangler.jsonc`
```jsonc
"kv_namespaces": [
  { "binding": "CACHE", "id": "7688a332f25e416795f71a004b557f65" }
]
```

### 5.3 Queues

**Purpose:** Reliable SMS delivery with retries and DLQ

**Create queues:**

```bash
# Production
wrangler queues create notification-queue-prod
wrangler queues create notification-dlq-prod

# Stage
wrangler queues create notification-queue-stage
wrangler queues create notification-dlq-stage
```

**Already configured in:** `apps/data-service/wrangler.jsonc`
```jsonc
"queues": {
  "producers": [
    { "queue": "notification-queue-prod", "binding": "NOTIFICATION_QUEUE" }
  ],
  "consumers": [{
    "queue": "notification-queue-prod",
    "max_batch_size": 10,
    "max_batch_timeout": 5,
    "max_retries": 3,
    "dead_letter_queue": "notification-dlq-prod"
  }]
}
```

### 5.4 Cron Triggers

**Already configured in:** `apps/data-service/wrangler.jsonc`
```jsonc
"triggers": {
  "crons": ["0 * * * *"]  // Every hour at :00
}
```

**Handler:** `apps/data-service/src/scheduled/index.ts`
- Converts UTC to CET/CEST (handles DST)
- Queries users by notification preference hour
- Batches to queue

### 5.5 Custom Domains

**Already configured in wrangler.jsonc:**

**user-application (prod):**
```jsonc
"routes": [{
  "custom_domain": true,
  "pattern": "powiadomienia.info"
}]
```

**data-service (prod):**
```jsonc
"routes": [{
  "zone_name": "powiadomienia.info",
  "pattern": "powiadomienia.info/worker/*"
}]
```

**Cloudflare Dashboard Setup:**

1. Workers & Pages → Overview
2. After first deploy, verify custom domain routes
3. Check DNS records auto-created:
   - `powiadomienia.info` → Worker (user-application)
   - `powiadomienia.info/worker/*` → Worker (data-service)

---

## 6. Environment Secrets Configuration

### 6.1 data-service Secrets

**Set via Wrangler CLI:**

```bash
# Database credentials
wrangler secret put DATABASE_HOST --env prod
# Paste: ep-xxx-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require

wrangler secret put DATABASE_USERNAME --env prod
# Paste: neondb_owner

wrangler secret put DATABASE_PASSWORD --env prod
# Paste: npg_xxx

# Better Auth
wrangler secret put BETTER_AUTH_SECRET --env prod
# Paste: <generated secret from Section 1.2>

# Google OAuth
wrangler secret put GOOGLE_CLIENT_ID --env prod
wrangler secret put GOOGLE_CLIENT_SECRET --env prod

# Stripe (CRITICAL - keep secure)
wrangler secret put STRIPE_SECRET_KEY --env prod
# Paste: sk_live_xxx

wrangler secret put STRIPE_WEBHOOK_SECRET --env prod
# Paste: whsec_xxx

# SerwerSMS
wrangler secret put SERWERSMS_API_TOKEN --env prod
# Paste: <token from SerwerSMS dashboard>

wrangler secret put SERWERSMS_SENDER_NAME --env prod
# Paste: Odbiór (or leave empty for SMS ECO)
```

**Non-secret vars (set in wrangler.jsonc):**
```jsonc
"vars": {
  "CLOUDFLARE_ENV": "prod",
  "STRIPE_CARD_MONTHLY_PRICE_ID": "price_xxx",
  "STRIPE_BLIK_ANNUAL_PRICE_ID": "price_yyy"
}
```

### 6.2 user-application Secrets

**Set via Wrangler CLI:**

```bash
# Database credentials
wrangler secret put DATABASE_HOST --env prod
wrangler secret put DATABASE_USERNAME --env prod
wrangler secret put DATABASE_PASSWORD --env prod

# Better Auth
wrangler secret put BETTER_AUTH_SECRET --env prod

# Google OAuth
wrangler secret put GOOGLE_CLIENT_ID --env prod
wrangler secret put GOOGLE_CLIENT_SECRET --env prod
```

**Non-secret vars (set in wrangler.jsonc):**
```jsonc
"vars": {
  "CLOUDFLARE_ENV": "prod",
  "VITE_STRIPE_PUBLISHABLE_KEY": "pk_live_xxx",
  "VITE_STRIPE_CARD_MONTHLY_PRICE_ID": "price_xxx",
  "VITE_STRIPE_BLIK_ANNUAL_PRICE_ID": "price_yyy"
}
```

### 6.3 Verify Secrets Set

```bash
# List secrets (doesn't show values, just names)
wrangler secret list --env prod

# Expected for data-service:
# - DATABASE_HOST
# - DATABASE_USERNAME
# - DATABASE_PASSWORD
# - BETTER_AUTH_SECRET
# - GOOGLE_CLIENT_ID
# - GOOGLE_CLIENT_SECRET
# - STRIPE_SECRET_KEY
# - STRIPE_WEBHOOK_SECRET
# - SERWERSMS_API_TOKEN
# - SERWERSMS_SENDER_NAME
```

---

## 7. Deployment Steps

### 7.1 Pre-Deployment Checklist

**Verify:**
- [ ] Neon production database created + migrated (Section 1)
- [ ] Stripe products/prices created in LIVE MODE (Section 2)
- [ ] Stripe webhook endpoint configured (Section 2.4)
- [ ] Google OAuth credentials created (Section 3)
- [ ] SerwerSMS account funded (Section 4)
- [ ] Cloudflare KV namespaces created (Section 5.2)
- [ ] Cloudflare Queues created (Section 5.3)
- [ ] All secrets set via `wrangler secret put` (Section 6)
- [ ] Subscription plans seeded in database (Section 1.4)
- [ ] Domain nameservers updated to Cloudflare (Section 5.1)

### 7.2 Build and Deploy data-service

**From:** `apps/data-service/`

```bash
# 1. Build data-ops (required dependency)
cd ../../packages/data-ops
pnpm build

# 2. Return to data-service
cd ../../apps/data-service

# 3. Deploy to production
pnpm deploy:prod

# Wait for deployment...
# Output will show:
# ✨ Uploaded worker successfully
# ✨ Published data-service to:
#    https://powiadomienia.info/worker/*
```

**Verify deployment:**
```bash
# Check health endpoint
curl https://powiadomienia.info/worker/health

# Expected response:
# {"status":"ok","timestamp":"2026-01-28T..."}
```

### 7.3 Build and Deploy user-application

**From:** `apps/user-application/`

```bash
# 1. Build for production
pnpm build:prod

# 2. Deploy to production
pnpm deploy:prod

# Wait for deployment...
# Output will show:
# ✨ Uploaded worker successfully
# ✨ Published user-application to:
#    https://powiadomienia.info
```

**Verify deployment:**
```bash
# Check website loads
curl -I https://powiadomienia.info

# Expected:
# HTTP/2 200
# content-type: text/html
```

### 7.4 Verify Service Binding

**Check:** data-service accessible from user-application

**Test:** Open browser → `https://powiadomienia.info`
- Should load landing page
- Backend calls should work (coverage stats on homepage)

**If service binding fails:**
- Verify both workers deployed successfully
- Check `wrangler.jsonc` service binding names match:
  - user-application: `"service": "pi-web-data-service-prod"`
  - data-service: `"name": "pi-web-data-service-prod"`

---

## 8. Post-Deployment Verification

### 8.1 Database Connectivity

**Test:** Run debug script

```bash
cd packages/data-ops

# Check if schedules exist for a known city
pnpm debug:schedules:prod <cityId> <streetId>

# Should output waste schedules
```

### 8.2 Authentication Flow

**Test:** Complete registration and login

1. Navigate to `https://powiadomienia.info`
2. Click "Zarejestruj się" (Register)
3. **Email/Password Registration:**
   - Fill form with test email
   - Submit → Should redirect to `/app`
   - Verify session created
4. **Logout → Login:**
   - Test email/password login
   - Verify redirect to dashboard
5. **Google OAuth:**
   - Logout → Click "Zaloguj przez Google"
   - Complete Google OAuth flow
   - Verify account linking (if using same email)

**Check Database:**
```sql
-- Verify user created
SELECT id, email, name, created_at FROM auth_user ORDER BY created_at DESC LIMIT 1;

-- Verify auth accounts
SELECT provider_id, account_id FROM auth_account WHERE user_id = '<user-id>';
-- Should show "credential" or "google" provider
```

### 8.3 Payment Flow (CRITICAL)

**Test with real payment methods (small amount):**

#### 8.3.1 Card Monthly Subscription

1. Login → Dashboard → Click "Kup Subskrypcję"
2. Select "Karta (10 PLN/miesiąc)"
3. Enter test card: Use your real card OR Stripe test cards in test mode
4. Complete checkout
5. **Verify redirect:** Should return to `/app` with success message
6. **Check subscription status:** Dashboard should show "Premium Active"
7. **Check database:**
   ```sql
   SELECT id, status, current_period_end FROM subscriptions
   WHERE user_id = '<user-id>' ORDER BY created_at DESC LIMIT 1;
   -- Status should be "active"
   ```

#### 8.3.2 BLIK Annual Payment

1. Login → Dashboard → Click "Kup Subskrypcję"
2. Select "BLIK (100 PLN/rok)"
3. Enter BLIK code (6 digits from banking app)
4. Confirm payment in banking app
5. **Verify redirect:** Return to `/app` with success
6. **Check subscription:** Should show active until +1 year
7. **Check database:** Subscription created with 1-year period

#### 8.3.3 Webhook Verification

**Check webhook events:**
```sql
SELECT id, type, processed, created_at FROM webhook_events
ORDER BY created_at DESC LIMIT 10;

-- Should show:
-- checkout.session.completed (processed: true)
-- payment_intent.succeeded (processed: true)
```

**Check Stripe Dashboard:**
- Events → Recent events
- Should see webhook delivery success (200 response)
- If failures: Check data-service logs in Cloudflare dashboard

### 8.4 SMS Notification System

**Test notification scheduling:**

1. **Setup test user:**
   - Login with real Polish phone (+48XXXXXXXXX)
   - Add address with city/street that has waste schedule tomorrow
   - Verify notification preferences created (default: 19:00 day before, 07:00 same day)
2. **Ensure active subscription:**
   - User must have active paid subscription
   - Verify in database: `subscriptions.status = 'active'`
3. **Wait for cron:**
   - Cron runs hourly at :00
   - When current CET hour matches preference hour (e.g., 19:00 CET)
   - SMS should send within 5-10 minutes
4. **Check notification log:**
   ```sql
   SELECT id, status, sms_content, sent_at FROM notification_logs
   WHERE user_id = '<user-id>' ORDER BY created_at DESC LIMIT 5;
   -- Status should progress: pending → sent
   ```
5. **Verify SMS received:**
   - Check phone for SMS
   - Content format: "Przypomnienie: Jutro (date) wywóz śmieci na [address]: [types]."

**Debug if SMS not received:**
```bash
cd packages/data-ops
pnpm debug:notifications:prod <user-email>

# Output will diagnose:
# - Phone format valid?
# - Subscription active?
# - Address configured?
# - Notification preferences enabled?
# - Waste schedules exist?
# - Hour mismatch?
```

### 8.5 Coverage Stats Cache

**Test KV caching:**

1. Navigate to homepage → Check footer stats
2. Should display: "X miast, Y ulic, Z użytkowników"
3. **Check KV:** Cloudflare dashboard → KV → CACHE namespace
   - Key: `coverage-stats`
   - Should exist with JSON value
4. **Test cache refresh:**
   - Wait 1 hour (cache TTL)
   - Reload page → Stats should update if data changed

### 8.6 Monitoring and Logs

**Cloudflare Dashboard:**

1. **Workers & Pages → pi-web-data-service-prod → Logs**
   - Check for errors during cron execution
   - Verify webhook events processed
   - Check SMS sending logs
2. **Workers & Pages → pi-web-user-application-prod → Logs**
   - Check for authentication errors
   - Verify API requests successful
3. **Set up alerts:**
   - Workers & Pages → Settings → Alerts
   - Email notification: Errors > 10/min

**Stripe Dashboard → Developers → Logs:**
- Verify webhook delivery 200 responses
- Check for payment processing errors

**SerwerSMS Dashboard → Historia:**
- Verify SMS delivery status
- Check account balance

---

## 9. Rollback Procedures

### 9.1 Worker Rollback

**If deployment breaks production:**

```bash
# Rollback to previous version
cd apps/data-service
wrangler rollback --env prod

cd ../user-application
wrangler rollback --env prod
```

### 9.2 Database Rollback

**If migration fails:**

1. **Check migration history:**
   ```bash
   cd packages/data-ops
   # List migrations applied
   ls src/drizzle/migrations/prod/
   ```
2. **Manual rollback:**
   - Connect to Neon console
   - Run `DROP TABLE` for new tables
   - Or restore from Neon backup (if available)

**IMPORTANT:** Test migrations on stage BEFORE running on prod

### 9.3 Stripe Rollback

**If webhook issues:**

1. Disable webhook endpoint in Stripe dashboard
2. Fix handler code
3. Redeploy data-service
4. Re-enable webhook endpoint
5. Manually replay failed events (Stripe dashboard → Events → Resend)

---

## 10. Security Checklist

**Verify before going live:**

- [ ] All secrets set via Wrangler (NEVER in git)
- [ ] `.env.prod` files in `.gitignore`
- [ ] HTTPS enforced (Cloudflare automatic)
- [ ] Stripe webhook signature verification enabled
- [ ] Database connection uses SSL (`sslmode=require`)
- [ ] Google OAuth redirect URIs restricted to production domain
- [ ] Better Auth secret is cryptographically random (32+ bytes)
- [ ] Rate limiting configured in Better Auth
- [ ] CORS configured correctly (if needed)
- [ ] No API keys exposed in frontend code

---

## 11. Complete Environment Variables Checklist

### 11.1 data-service (Production)

**Secrets (via `wrangler secret put`):**
- `DATABASE_HOST`
- `DATABASE_USERNAME`
- `DATABASE_PASSWORD`
- `BETTER_AUTH_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `STRIPE_SECRET_KEY` (CRITICAL)
- `STRIPE_WEBHOOK_SECRET` (CRITICAL)
- `SERWERSMS_API_TOKEN`
- `SERWERSMS_SENDER_NAME` (optional)

**Public vars (in wrangler.jsonc):**
- `CLOUDFLARE_ENV=prod`
- `STRIPE_CARD_MONTHLY_PRICE_ID`
- `STRIPE_BLIK_ANNUAL_PRICE_ID`

**Bindings (in wrangler.jsonc):**
- `CACHE` (KV namespace)
- `NOTIFICATION_QUEUE` (Queue producer)

### 11.2 user-application (Production)

**Secrets (via `wrangler secret put`):**
- `DATABASE_HOST`
- `DATABASE_USERNAME`
- `DATABASE_PASSWORD`
- `BETTER_AUTH_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

**Public vars (in wrangler.jsonc):**
- `CLOUDFLARE_ENV=prod`
- `VITE_STRIPE_PUBLISHABLE_KEY` (safe to expose)
- `VITE_STRIPE_CARD_MONTHLY_PRICE_ID`
- `VITE_STRIPE_BLIK_ANNUAL_PRICE_ID`

**Bindings (in wrangler.jsonc):**
- `DATA_SERVICE` (Service binding to data-service worker)

---

## 12. Unresolved Questions

1. **Email Infrastructure:**
   - No email sending configured (no password reset)
   - Do we need email verification for registrations?
   - Do we need payment receipt emails (beyond Stripe defaults)?

2. **Monitoring:**
   - Should we use external monitoring (e.g., Pingdom, UptimeRobot)?
   - Alert thresholds for SMS failures?
   - Budget alerts for Cloudflare/Stripe/SerwerSMS?

3. **Backup Strategy:**
   - Neon automatic backups enabled?
   - Frequency of database exports?
   - KV namespace backup plan?

4. **Rate Limiting:**
   - Better Auth has default rate limits - are they sufficient?
   - Should we add custom rate limiting for checkout endpoints?

5. **GDPR Compliance:**
   - Data retention policy for notification logs?
   - User data export functionality needed?
   - Right to deletion implementation?

6. **Scale Planning:**
   - Current limits: 10 SMS/batch, 5 SMS/sec
   - At what user count do we need to increase limits?
   - Cloudflare Workers limits: 10ms CPU time, 128MB memory - sufficient?

7. **Customer Support:**
   - How do users cancel subscriptions? (Currently Stripe Customer Portal only)
   - Support email/system needed?
   - Refund policy for BLIK annual payments?

8. **Stage Environment:**
   - Should stage use test mode Stripe or separate test account?
   - How to sync prod data to stage for testing?
   - Separate SerwerSMS test account needed?

---

## 13. References

- **Neon Docs:** https://neon.tech/docs/introduction
- **Cloudflare Workers:** https://developers.cloudflare.com/workers/
- **Stripe Payments:** https://stripe.com/docs/payments
- **Stripe Webhooks:** https://stripe.com/docs/webhooks
- **Google OAuth:** https://developers.google.com/identity/protocols/oauth2
- **Better Auth:** https://www.better-auth.com/docs
- **SerwerSMS API:** https://www.serwersms.pl/api
- **Drizzle ORM:** https://orm.drizzle.team/docs/overview

**Internal Docs:**
- [010-payments.md](/Users/tkow/Documents/Code/powiadomienia-info/pi-web/docs/010-payments.md) - Payment system details
- [003-notification-service.md](/Users/tkow/Documents/Code/powiadomienia-info/pi-web/docs/003-notification-service.md) - SMS notification flow
- [009-email-password-authentication.md](/Users/tkow/Documents/Code/powiadomienia-info/pi-web/docs/009-email-password-authentication.md) - Auth implementation

---

**End of Production Deployment Guide**

Next step: Execute deployment in order (Sections 1-8), verify each step before proceeding.
