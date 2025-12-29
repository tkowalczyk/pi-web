import { createServerFn } from "@tanstack/react-start";
import { getAuth } from "@repo/data-ops/auth/server";
import { getRequest } from "@tanstack/react-start/server";

/**
 * Check if user has valid session
 * Returns session data or null
 * Use for conditional checks (login/register routes)
 */
export const checkSession = createServerFn({ method: "GET" }).handler(
  async () => {
    const auth = getAuth();
    const req = getRequest();
    const session = await auth.api.getSession(req);

    return session;
  }
);

/**
 * Require valid session
 * Throws if no session
 * Use in beforeLoad for protected routes
 */
export const requireSession = createServerFn({ method: "GET" }).handler(
  async () => {
    const auth = getAuth();
    const req = getRequest();
    const session = await auth.api.getSession(req);

    if (!session) {
      throw new Error("Unauthorized");
    }

    return session;
  }
);
