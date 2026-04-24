import { getAuth } from "@repo/data-ops/auth/server";
import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

async function getAuthContext() {
	const auth = getAuth();
	const req = getRequest();

	const session = await auth.api.getSession(req);
	if (!session) {
		throw new Error("Unauthorized");
	}

	return {
		auth: auth,
		userId: session.user.id,
		email: session.user.email,
	};
}

export const protectedFunctionMiddleware = createMiddleware({
	type: "function",
}).server(async ({ next, context: reqContext }) => {
	console.log("[auth-mw] reqContext keys:", Object.keys(reqContext), "dataService truthy:", !!reqContext.dataService);
	const context = await getAuthContext();
	return next({ context: { ...context, dataService: reqContext.dataService } });
});

export const protectedRequestMiddleware = createMiddleware({
	type: "request",
}).server(async ({ next }) => {
	const context = await getAuthContext();
	return next({ context });
});
