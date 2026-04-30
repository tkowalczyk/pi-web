const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export interface TurnstileVerifyResult {
	success: boolean;
}

export async function verifyTurnstileToken(
	token: string,
	secret: string,
	fetcher: typeof fetch = fetch,
): Promise<TurnstileVerifyResult> {
	if (!token) return { success: false };

	const body = new URLSearchParams({ secret, response: token });

	let response: Response;
	try {
		response = await fetcher(SITEVERIFY_URL, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: body.toString(),
		});
	} catch {
		return { success: false };
	}

	if (!response.ok) return { success: false };

	const json = (await response.json().catch(() => null)) as { success?: boolean } | null;
	return { success: !!json?.success };
}
