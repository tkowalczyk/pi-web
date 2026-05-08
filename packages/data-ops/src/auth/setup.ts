import { APIError, betterAuth, type BetterAuthOptions } from "better-auth";

export const createBetterAuth = (config: {
	database: BetterAuthOptions["database"];
	secret?: BetterAuthOptions["secret"];
	baseURL?: BetterAuthOptions["baseURL"];
	socialProviders?: BetterAuthOptions["socialProviders"];
	isEmailAllowed?: (email: string) => Promise<boolean>;
}) => {
	const isEmailAllowed = config.isEmailAllowed;
	return betterAuth({
		database: config.database,
		secret: config.secret,
		baseURL: config.baseURL,
		emailAndPassword: {
			enabled: false,
		},
		accountLinking: {
			enabled: true,
			trustedProviders: ["google"],
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
		databaseHooks: isEmailAllowed
			? {
					user: {
						create: {
							before: async (user) => {
								if (!(await isEmailAllowed(user.email))) {
									throw new APIError("FORBIDDEN", {
										message: "Email not allowed",
									});
								}
							},
						},
					},
					session: {
						create: {
							before: async (session, context) => {
								const user = await context?.context.internalAdapter.findUserById(session.userId);
								if (!user || !(await isEmailAllowed(user.email))) {
									throw new APIError("FORBIDDEN", {
										message: "Email not allowed",
									});
								}
							},
						},
					},
				}
			: undefined,
	});
};
