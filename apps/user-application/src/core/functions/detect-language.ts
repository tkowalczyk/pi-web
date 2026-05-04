import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { parseAcceptLanguage, type SupportedLanguage } from "@/lib/parse-accept-language";

export const detectInitialLanguage = createServerFn({ method: "GET" }).handler(
	async (): Promise<SupportedLanguage> => {
		const req = getRequest();
		return parseAcceptLanguage(req.headers.get("accept-language"));
	},
);
