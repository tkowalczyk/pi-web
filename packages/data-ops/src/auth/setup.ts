import { betterAuth, type BetterAuthOptions } from "better-auth";

export const createBetterAuth = (config: {
	database: BetterAuthOptions["database"];
	secret?: BetterAuthOptions["secret"];
	baseURL?: BetterAuthOptions["baseURL"];
	socialProviders?: BetterAuthOptions["socialProviders"];
}) => {
	return betterAuth({
		database: config.database,
		secret: config.secret,
		baseURL: config.baseURL,
		emailAndPassword: {
			enabled: true,
			minPasswordLength: 8,
			maxPasswordLength: 128,
		},
		accountLinking: {
			enabled: true,
			trustedProviders: ["google", "credential"],
		},
		socialProviders: config.socialProviders,
		user: {
			modelName: "auth_user",
			additionalFields: {
				phone: {
					type: "string",
					required: false,
				},
				preferredLanguage: {
					type: "string",
					required: false,
					defaultValue: "pl",
				},
			},
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
