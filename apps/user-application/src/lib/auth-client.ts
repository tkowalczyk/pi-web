import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";

export const authClient = createAuthClient({
	plugins: [
		inferAdditionalFields({
			user: {
				phone: { type: "string", required: false },
				preferredLanguage: { type: "string", required: false },
			},
		}),
	],
});

export const { useSession, signIn, signOut } = authClient;
