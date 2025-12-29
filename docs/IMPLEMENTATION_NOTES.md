# Implementation Notes - Email/Password Authentication

## Mistakes & Learnings from Implementation (Dec 2025)

### 1. Form Conventions - CHECK EXISTING PATTERNS FIRST ❌
**Mistake:** Initially implemented auth forms with:
- Controlled inputs (individual `useState` per field)
- Manual async/await instead of `useMutation`
- Button `onClick` handlers instead of form `onSubmit`

**Lesson:** ALWAYS check existing form implementations in codebase first. The address forms already had the correct pattern:
```typescript
// ✅ CORRECT Pattern (address-form.tsx)
const formData = new FormData(e.currentTarget);
const email = formData.get("email") as string;
const mutation = useMutation({ ... });
<form onSubmit={handleSubmit}>
```

**Location:** Check `apps/user-application/src/components/addresses/address-form.tsx` for reference

---

### 2. Better Auth Error Handling ❌
**Mistake:** Only checked `err.message` string for error handling

**Correct:** Better Auth returns structured errors:
```typescript
// ❌ WRONG
onError: (err) => {
  if (err.message.includes("invalid")) { ... }
}

// ✅ CORRECT
onError: (err: { message?: string; code?: string }) => {
  const errorCode = err.code?.toLowerCase() || "";
  if (errorCode.includes("invalid_email_or_password")) { ... }
}
```

**Lesson:** Check BOTH `err.code` AND `err.message`. Also capture result from auth calls:
```typescript
const result = await authClient.signIn.email({ ... });
if (result.error) throw result.error; // Important!
```

---

### 3. Architecture Planning - Avoid Redundancy ❌
**Mistake:** Created 3 separate auth components initially:
- `UnifiedLogin` - email/password + Google OAuth
- `EmailLogin` - email/password only
- `EmailRegister` - registration only

**Outcome:** Code duplication, inconsistent UX (UnifiedLogin had Google, EmailLogin didn't)

**Resolution:** Removed UnifiedLogin, added Google OAuth to EmailLogin, kept 2 components total

**Lesson:** Plan authentication flow architecture BEFORE implementing:
- Option 1: Single unified component with modes (login/register)
- Option 2: Separate routes with consistent features (CHOSEN)
- Option 3: Hybrid (BAD - causes duplication)

---

### 5. Form Layout & Centering ❌
**Mistake:** Multiple iterations on form vertical positioning:
1. First: Used `min-h-screen` in form components → Footer pushed off-screen
2. Then: Changed to `py-8` → Forms too close to header
3. Finally: Changed to `py-16` → Properly centered

**Lesson:** When wrapping components in route layouts:
- Route wrapper has `min-h-screen flex flex-col`
- Route wrapper has `flex-1` middle section
- Form components should NOT have `min-h-screen`
- Use moderate padding (`py-16`) for centering

---

### 6. Navigation After Auth State Changes ❌
**Mistake:** Sign out handler didn't include navigation:
```typescript
// ❌ WRONG
const signOut = async () => {
  await authClient.signOut();
  // User still sees authenticated UI
};

// ✅ CORRECT
const signOut = async () => {
  await authClient.signOut();
  navigate({ to: "/auth/login" });
};
```

**Lesson:** Always add explicit navigation after auth state changes (signOut, signIn success)

---

### 7. Validation Error Handling ❌
**Mistake:** Used `result.error.errors` instead of `result.error.issues` for Zod validation

**Correct:**
```typescript
const result = loginSchema.safeParse({ email, password });
if (!result.success) {
  result.error.issues.forEach((err) => { // NOT .errors
    errors[err.path[0].toString()] = t(err.message);
  });
}
```

---

### 8. Conditional Rendering Based on Auth Provider ✅
**Success:** Properly implemented conditional "Change Password" button:
```typescript
const hasCredentialAccount = user.email && user.emailVerified !== undefined;

{hasCredentialAccount && <ChangePassword />}
```

**Lesson:** Check auth provider type before showing credential-specific features. Google-only users shouldn't see "Change Password".

---

## Key Takeaways

1. **RTFC** (Read The F***ing Code) - Check existing implementations first
2. **Error structures matter** - Check both `.code` and `.message`
3. **Plan architecture** - Avoid creating redundant components
4. **Session hooks > getSession()** - Use hooks in components, not in beforeLoad
5. **Layout math** - Parent flex container + child padding, not double min-h-screen
6. **Explicit navigation** - Don't rely on state updates alone after auth changes
7. **Zod uses .issues** - Not .errors
8. **Provider-aware UI** - Show features based on how user authenticated

---

## Future Authentication Work

If implementing OAuth providers (GitHub, etc.):
- Add to EmailLogin alongside Google button
- Ensure all auth forms follow FormData + useMutation pattern
- Test account linking between providers
- Verify "Change Password" conditional rendering logic

---

**Last Updated:** December 29, 2025
**Context:** Initial email/password authentication implementation
**Files Modified:** ~15 files across auth components, routes, locales
