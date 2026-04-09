# Email/Password Authentication

## Overview

Add email/password authentication to the existing Better Auth implementation alongside the current Google OAuth provider. Users will be able to register, sign in, and manage passwords using traditional credentials while maintaining all existing auth infrastructure.

**Status:** ✅ FINAL - Ready for implementation

**Key Features:**
- Email/password registration + login
- Password strength indicator (weak/normal/strong)
- Remember me (30-day sessions)
- Rate limiting (brute force protection)
- Change password for authenticated users
- Full i18n support (EN/PL)
- NO forgot password (requires email infrastructure)

## Context & Background

Current auth implementation:
- Better Auth with Google OAuth only
- Auth config in `packages/data-ops/config/auth.ts` and `src/auth/setup.ts`
- Server-side auth in `packages/data-ops/src/auth/server.ts`
- Client-side auth in `apps/user-application/src/components/auth/client.ts`
- Auth route handler at `/api/auth/$` (TanStack Start API route)
- Protected routes via `_auth` layout requiring active session
- Database schema in `packages/data-ops/src/drizzle/auth-schema.ts`
- Passwords stored in `auth_account` table with `providerId: "credential"`
- i18n using react-i18next with EN and PL locales

## Goals & Non-Goals

**Goals:**
- Email/password registration with validation
- Email/password login with remember me
- Password change (authenticated users)
- Password strength indicator (weak/normal/strong)
- Rate limiting for auth endpoints
- Account linking between providers (Google ↔ email/password)
- Full locale support (EN/PL)
- NO email verification/sending
- Reuse existing Better Auth infrastructure
- Maintain Google OAuth functionality

**Non-Goals:**
- Email verification links
- Email sending infrastructure
- Forgot password flow (requires email)
- Magic link authentication
- Social providers beyond Google
- Account deletion UI
- Session management UI

## Design / Architecture

### 1. Better Auth Configuration Changes

**File:** `packages/data-ops/src/auth/setup.ts`

```typescript
export const createBetterAuth = (config: {
  database: BetterAuthOptions["database"];
  secret?: BetterAuthOptions["secret"];
  socialProviders?: BetterAuthOptions["socialProviders"];
}): ReturnType<typeof betterAuth> => {
  return betterAuth({
    database: config.database,
    secret: config.secret,
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      // No sendResetPassword - we'll handle UI-based reset
      // No sendVerificationEmail - not required per spec
    },
    accountLinking: {
      enabled: true,
      trustedProviders: ["google", "credential"]
    },
    socialProviders: config.socialProviders,
    user: {
      modelName: "auth_user",
    },
    session: {
      modelName: "auth_session",
    },
    verification: {
      modelName: "auth_verification",
    },
    account: {
      modelName: "auth_account",
    },
  });
};
```

**Key Changes:**
- `emailAndPassword.enabled`: `false` → `true`
- Add password length constraints (8-128 chars)
- `accountLinking.enabled`: Enable automatic account linking
- `trustedProviders`: `["google", "credential"]` - auto-link Google and email/password accounts with same email
- No email sending functions (per requirements)

### 2. Database Schema & Account Linking

**File:** `packages/data-ops/src/drizzle/auth-schema.ts`

**Current schema already supports email/password:**
- `auth_account.password` field exists (line 54)
- Passwords hashed automatically by Better Auth (scrypt)
- No migration needed

**Data pattern:**
- Google OAuth: `providerId: "google"`, `accountId: <google_id>`
- Email/Password: `providerId: "credential"`, `accountId: <email>`

**Account Linking Behavior:**

Better Auth automatically links accounts with matching emails when `accountLinking.enabled: true`:

**Scenario 1: Google First → Email/Password Registration**
- User signs in with Google (email: `user@example.com`)
- Creates `auth_user` with Google account (`providerId: "google"`)
- Later user registers with email/password using same email
- Better Auth detects matching email in `trustedProviders`
- Creates second `auth_account` (`providerId: "credential"`) linked to same `auth_user`
- Result: Single user, two auth methods

**Scenario 2: Email/Password First → Google OAuth**
- User registers with email/password (email: `user@example.com`)
- Creates `auth_user` with credential account (`providerId: "credential"`)
- Later user signs in with Google using same email
- Better Auth detects matching email in `trustedProviders`
- Creates second `auth_account` (`providerId: "google"`) linked to same `auth_user`
- Result: Single user, two auth methods

**Key Points:**
- No user action required - linking is automatic
- Email must match exactly
- Only works for `trustedProviders` (google, credential)
- User can switch between auth methods seamlessly
- Both methods access same profile data

### 3. Frontend Forms & Components

#### 3.1 Registration Form

**File:** `apps/user-application/src/components/auth/email-register.tsx`

**Structure:**
```tsx
<Card>
  <CardHeader>
    <CardTitle>{t("auth.createAccount")}</CardTitle>
    <CardDescription>{t("auth.createAccountDescription")}</CardDescription>
  </CardHeader>
  <CardContent>
    <Form>
      <Input name="name" label={t("auth.fullName")} />
      <Input name="email" type="email" label={t("auth.email")} />
      <Input name="password" type="password" label={t("auth.password")} />
      <PasswordStrengthIndicator password={password} />
      <PasswordPolicyDisplay />
      <Input name="confirmPassword" type="password" label={t("auth.confirmPassword")} />
      <Button onClick={handleRegister}>{t("auth.signUp")}</Button>
    </Form>
    <Separator />
    <Link to="/auth/login">{t("auth.alreadyHaveAccount")}</Link>
  </CardContent>
</Card>
```

**Validation:**
- Name: required, min 2 chars
- Email: valid format via regex
- Password: min 8 chars, max 128 chars, require 1 uppercase, 1 lowercase, 1 number
- Confirm password: matches password

**Password Strength Indicator:**
- Weak: < 8 chars OR missing required char types
- Normal: 8-11 chars with all required types
- Strong: 12+ chars with all required types

**Password Policy Display:**
- Show requirements: "8+ chars, 1 uppercase, 1 lowercase, 1 number"
- Visual checkmarks as requirements met

**Client call:**
```typescript
await authClient.signUp.email({
  name,
  email,
  password,
  callbackURL: "/app"
});
```

#### 3.2 Login Form

**File:** `apps/user-application/src/components/auth/email-login.tsx`

**Structure:**
```tsx
<Card>
  <CardHeader>
    <CardTitle>{t("auth.signIn")}</CardTitle>
    <CardDescription>{t("auth.signInDescription")}</CardDescription>
  </CardHeader>
  <CardContent>
    <Form>
      <Input name="email" type="email" label={t("auth.email")} />
      <Input name="password" type="password" label={t("auth.password")} />
      <Checkbox name="rememberMe" label={t("auth.rememberMe")} />
      <Button onClick={handleLogin}>{t("auth.signIn")}</Button>
    </Form>
    <Separator />
    <Link to="/auth/register">{t("auth.noAccount")}</Link>
  </CardContent>
</Card>
```

**Remember Me:**
- Extends session expiry from default (7 days) to 30 days
- Uses Better Auth session extension

**Client call:**
```typescript
await authClient.signIn.email({
  email,
  password,
  rememberMe, // Extends session duration
  callbackURL: "/app"
});
```

#### 3.3 Change Password (Authenticated)

**File:** `apps/user-application/src/components/auth/change-password.tsx`

**Location:** Inside `AccountDialog` or separate settings page

**Structure:**
```tsx
<Dialog>
  <Form>
    <Input name="currentPassword" type="password" label={t("auth.currentPassword")} />
    <Input name="newPassword" type="password" label={t("auth.newPassword")} />
    <PasswordStrengthIndicator password={newPassword} />
    <PasswordPolicyDisplay />
    <Input name="confirmPassword" type="password" label={t("auth.confirmNewPassword")} />
    <Button onClick={handleChangePassword}>{t("auth.changePassword")}</Button>
  </Form>
</Dialog>
```

**Password Strength Indicator:**
- Same logic as registration (weak/normal/strong)
- Real-time feedback as user types

**Client call:**
```typescript
await authClient.changePassword({
  currentPassword,
  newPassword,
  revokeOtherSessions: true
});
```

#### 3.4 Unified Login Page

**File:** `apps/user-application/src/components/auth/unified-login.tsx`

Replace `GoogleLogin` component with unified page showing both options:

```tsx
<Card>
  <CardHeader>
    <CardTitle>{t("auth.welcomeBack")}</CardTitle>
    <CardDescription>{t("auth.signInDescription")}</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Email/Password Form */}
    <EmailLoginForm />

    <Separator>{t("auth.orContinueWith")}</Separator>

    {/* Google OAuth Button */}
    <GoogleSignInButton />

    <Link to="/auth/register">{t("auth.noAccount")}</Link>
  </CardContent>
</Card>
```

### 4. Routing Changes

**File:** `apps/user-application/src/routes/_auth/route.tsx`

Update to show unified login page:

```typescript
function RouteComponent() {
  const session = authClient.useSession();

  return (
    <>
      {session.isPending ? (
        <LoadingSpinner />
      ) : session.data ? (
        <Outlet />
      ) : (
        <UnifiedLogin /> // Instead of GoogleLogin
      )}
    </>
  );
}
```

**New routes to add:**
- `/auth/register` - Registration form
- `/auth/login` - Login form (or unified)

**Implementation:** Create route files in `apps/user-application/src/routes/auth/`

**Note:** Forgot password routes omitted (out of scope - requires email infrastructure)

### 5. Validation Strategy

#### 5.1 Frontend Validation (Zod)

**File:** `apps/user-application/src/lib/validation/auth-schemas.ts`

```typescript
import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(8, "validation.password.minLength")
  .max(128, "validation.password.maxLength")
  .regex(/[A-Z]/, "validation.password.uppercase")
  .regex(/[a-z]/, "validation.password.lowercase")
  .regex(/[0-9]/, "validation.password.number");

export const emailSchema = z
  .string()
  .email("validation.email.invalid")
  .min(1, "validation.email.required");

export const registerSchema = z.object({
  name: z.string().min(2, "validation.name.minLength"),
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "validation.password.noMatch",
  path: ["confirmPassword"]
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "validation.password.required")
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "validation.password.required"),
  newPassword: passwordSchema,
  confirmPassword: z.string()
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "validation.password.noMatch",
  path: ["confirmPassword"]
});
```

#### 5.2 Backend Validation

Better Auth handles server-side validation automatically:
- Password length constraints (8-128 chars)
- Email uniqueness
- Hash generation with scrypt
- SQL injection prevention via Drizzle ORM

### 6. Rate Limiting

**Strategy:** Simple rate limiting for auth endpoints to prevent brute force attacks.

**Implementation:**

**File:** `apps/user-application/src/middleware/rate-limit.ts`

```typescript
// Simple in-memory rate limiter (suitable for single-worker deployment)
const attempts = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(identifier: string, maxAttempts = 5, windowMs = 15 * 60 * 1000): boolean {
  const now = Date.now();
  const record = attempts.get(identifier);

  if (!record || now > record.resetAt) {
    attempts.set(identifier, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (record.count >= maxAttempts) {
    return false; // Rate limit exceeded
  }

  record.count++;
  return true;
}
```

**Usage in auth endpoints:**
```typescript
// In login/register handlers
const identifier = `${request.headers.get('cf-connecting-ip')}:${email}`;
if (!checkRateLimit(identifier)) {
  throw new Error("Too many attempts. Try again in 15 minutes.");
}
```

**Limits:**
- Login: 5 attempts per IP+email per 15 min
- Register: 3 attempts per IP per 15 min
- Change password: 5 attempts per user per 15 min

**Production Enhancement:**
- Use Cloudflare rate limiting at edge (preferred)
- Or use Workers KV for distributed rate limiting
- Current in-memory solution works for single-worker deployments

### 7. i18n Translation Keys

**Files:**
- `apps/user-application/src/locales/en.json`
- `apps/user-application/src/locales/pl.json`

**New keys to add:**

```json
{
  "auth": {
    "createAccount": "Create Account",
    "createAccountDescription": "Enter your details to create account",
    "fullName": "Full Name",
    "email": "Email",
    "password": "Password",
    "confirmPassword": "Confirm Password",
    "signUp": "Sign Up",
    "signIn": "Sign In",
    "rememberMe": "Remember me",
    "alreadyHaveAccount": "Already have an account? Sign in",
    "noAccount": "Don't have an account? Sign up",
    "orContinueWith": "Or continue with",
    "currentPassword": "Current Password",
    "newPassword": "New Password",
    "confirmNewPassword": "Confirm New Password",
    "changePassword": "Change Password",
    "passwordChanged": "Password changed successfully",
    "passwordChangeFailed": "Failed to change password",
    "passwordStrength": {
      "weak": "Weak",
      "normal": "Normal",
      "strong": "Strong"
    },
    "passwordPolicy": "Password must have 8+ chars, 1 uppercase, 1 lowercase, 1 number"
  },
  "validation": {
    "email": {
      "required": "Email is required",
      "invalid": "Invalid email format"
    },
    "password": {
      "required": "Password is required",
      "minLength": "Password must be at least 8 characters",
      "maxLength": "Password must not exceed 128 characters",
      "uppercase": "Password must contain at least 1 uppercase letter",
      "lowercase": "Password must contain at least 1 lowercase letter",
      "number": "Password must contain at least 1 number",
      "noMatch": "Passwords do not match"
    },
    "name": {
      "minLength": "Name must be at least 2 characters"
    }
  },
  "error": {
    "rateLimitExceeded": "Too many attempts. Please try again in 15 minutes."
  }
}
```

Polish translations follow same structure.

### 8. Error Handling

**Common errors:**
- Invalid credentials → Show "Invalid email or password"
- Rate limit exceeded → Show "Too many attempts. Try again in 15 minutes."
- Network errors → Show generic error with retry
- Validation errors → Show field-specific errors

**Note on "Email already exists":**
- With `accountLinking` enabled, Better Auth automatically links accounts with same email
- No "email already exists" error for trusted providers (google, credential)
- If user registers with email already used by Google, accounts are linked automatically
- Only shows error if email taken by different user already (edge case)

**Implementation pattern:**
```typescript
try {
  // Check rate limit
  if (!checkRateLimit(identifier)) {
    throw new Error(t("error.rateLimitExceeded"));
  }

  await authClient.signUp.email({ name, email, password });
  // Account linking happens automatically if email matches existing Google account
  navigate({ to: "/app" });
} catch (error) {
  if (error.message.includes("rate limit")) {
    setError(t("error.rateLimitExceeded"));
  } else if (error.message.includes("credentials")) {
    setError(t("error.invalidCredentials"));
  } else {
    setError(t("error.defaultMessage"));
  }
}
```

## Implementation Details

### Phase 1: Backend Configuration
1. Update `packages/data-ops/src/auth/setup.ts`:
   - Enable email/password
   - Add `accountLinking` config with `trustedProviders: ["google", "credential"]`
2. Rebuild data-ops: `pnpm run build:data-ops`
3. No migration needed (schema supports it)
4. Test API routes respond correctly
5. Test account linking behavior (Google → email, email → Google)

### Phase 2: Core Components
1. Create validation schemas in `src/lib/validation/auth-schemas.ts`
2. Create rate limiting utility in `src/middleware/rate-limit.ts`
3. Build reusable components:
   - `password-strength-indicator.tsx` (weak/normal/strong display)
   - `password-policy-display.tsx` (requirements checklist)
4. Add i18n keys to `en.json` and `pl.json`

### Phase 3: Auth Forms
1. Build auth components:
   - `email-register.tsx` (with password strength indicator)
   - `email-login.tsx` (with remember me checkbox)
   - `change-password.tsx` (with password strength indicator)
   - `unified-login.tsx` (combines email + Google)
2. Add routes under `/auth/*`
3. Update `_auth/route.tsx` to use unified login

### Phase 4: Integration & Testing
1. Update `AccountDialog` to show "Change Password" option for email users
2. Integrate rate limiting into auth endpoints
3. Test registration flow with password strength
4. Test login flow with remember me
5. Test password change
6. Test rate limiting (brute force protection)
7. Test validation errors
8. Test locale switching
9. Test Google OAuth still works
10. **Test account linking scenarios:**
    - Register with Google → register with same email/password → verify single user
    - Register with email/password → sign in with Google → verify single user
    - Switch between Google and email/password auth methods → verify same profile data

### Phase 5: Production Readiness
1. Review rate limiting strategy (consider Cloudflare edge rules)
2. Test session expiry (7 days vs 30 days with remember me)
3. Security audit of password handling
4. Performance testing of auth flows

## Alternatives Considered

### Alternative 1: Magic Link Authentication
**Pros:** No password management, better UX
**Cons:** Requires email sending (out of scope)
**Decision:** Rejected due to email infrastructure requirement

### Alternative 2: Separate Login Pages
**Pros:** Simpler routing, clearer separation
**Cons:** Extra navigation, worse UX
**Decision:** Use unified page with both options visible

### Alternative 3: Forgot Password with Email
**Pros:** Standard UX, users can self-recover accounts
**Cons:** Requires email infrastructure (SendGrid, Resend, etc.)
**Decision:** SKIPPED. Out of scope. Users must contact admin or provide email for future implementation.

### Alternative 4: Complex Password Strength with Zxcvbn
**Pros:** More accurate strength estimation
**Cons:** Large bundle size, complexity
**Decision:** Use simple rule-based indicator (weak/normal/strong)

### Alternative 5: Cloudflare Turnstile for Rate Limiting
**Pros:** Better bot protection, offloads rate limiting
**Cons:** Additional service dependency
**Decision:** Use simple in-memory rate limiting initially. Document Cloudflare option for production.

## Security Considerations

**Password Security:**
- Scrypt hashing by default (Better Auth)
- Min 8 chars with complexity requirements (1 upper, 1 lower, 1 number)
- Max 128 chars prevents DoS attacks
- Passwords stored in `auth_account.password` (hashed only)
- Password strength indicator guides users to stronger passwords

**Session Security:**
- Better Auth manages sessions automatically
- Session tokens in `auth_session` table
- Default expiry: 7 days
- Remember me extends to 30 days
- HTTPS required in production
- CSRF protection via Better Auth
- `revokeOtherSessions` on password change

**Account Linking Security:**
- Automatic linking only for `trustedProviders` (google, credential)
- Email matching required (case-sensitive)
- Prevents account takeover by requiring email verification from OAuth provider
- Google OAuth validates email ownership before linking
- No manual linking UI reduces social engineering risks
- Single user identity across auth methods

**Input Validation:**
- Client-side: Zod schemas with i18n error messages
- Server-side: Better Auth built-in validation
- SQL injection: Prevented by Drizzle ORM parameterized queries
- XSS: React escapes by default

**Rate Limiting:**
- Simple in-memory implementation (per IP + email)
- Login: 5 attempts per 15 minutes
- Register: 3 attempts per 15 minutes
- Change password: 5 attempts per 15 minutes
- Production: Use Cloudflare rate limiting at edge for distributed protection

**Attack Mitigation:**
- Brute force: Rate limiting + account lockout via Better Auth
- Credential stuffing: Rate limiting per IP+email combination
- Password spray: IP-based rate limiting
- Session fixation: Better Auth generates new session on login
- Timing attacks: Constant-time password comparison via scrypt
- Account takeover: Account linking requires email ownership verification

## Decision Log

All open questions resolved:

1. **Forgot password without email:** ✅ SKIP. Out of scope. User contacts admin or provides email for reset. DB-level password change required.
2. **Password strength indicator:** ✅ YES. Simple weak/normal/strong indicator + policy display.
3. **Remember me:** ✅ YES. Checkbox extends session from 7 to 30 days.
4. **Rate limiting:** ✅ YES. Simple in-memory implementation (5 attempts/15min for login).
5. **Account deletion:** ✅ NO. Not needed for this implementation.
6. **Session management UI:** ✅ NO. Not needed for this implementation.

## References

- [Better Auth Email/Password Docs](https://www.better-auth.com/docs/authentication/email-password)
- Existing auth implementation: `packages/data-ops/src/auth/`
- i18n setup: `apps/user-application/src/lib/i18n.ts`
- Current schema: `packages/data-ops/src/drizzle/auth-schema.ts`
- Related doc: `001-user-profile-and-addresses.md`
