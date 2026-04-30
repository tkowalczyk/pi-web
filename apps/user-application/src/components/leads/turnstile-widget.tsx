import { useEffect, useRef } from "react";

declare global {
	interface Window {
		turnstile?: {
			render: (
				el: HTMLElement,
				options: {
					sitekey: string;
					callback?: (token: string) => void;
					"error-callback"?: () => void;
					"expired-callback"?: () => void;
				},
			) => string;
			remove: (widgetId: string) => void;
			reset: (widgetId: string) => void;
		};
	}
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
	if (typeof window === "undefined") return Promise.resolve();
	if (window.turnstile) return Promise.resolve();
	if (scriptPromise) return scriptPromise;

	scriptPromise = new Promise<void>((resolve, reject) => {
		const script = document.createElement("script");
		script.src = SCRIPT_SRC;
		script.async = true;
		script.defer = true;
		script.onload = () => resolve();
		script.onerror = () => reject(new Error("Failed to load Turnstile"));
		document.head.appendChild(script);
	});
	return scriptPromise;
}

interface TurnstileWidgetProps {
	siteKey: string;
	onToken: (token: string) => void;
}

export function TurnstileWidget({ siteKey, onToken }: TurnstileWidgetProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const widgetIdRef = useRef<string | null>(null);

	useEffect(() => {
		let cancelled = false;

		loadScript()
			.then(() => {
				if (cancelled || !containerRef.current || !window.turnstile) return;
				widgetIdRef.current = window.turnstile.render(containerRef.current, {
					sitekey: siteKey,
					callback: (token) => onToken(token),
					"error-callback": () => onToken(""),
					"expired-callback": () => onToken(""),
				});
			})
			.catch(() => onToken(""));

		return () => {
			cancelled = true;
			if (window.turnstile && widgetIdRef.current) {
				try {
					window.turnstile.remove(widgetIdRef.current);
				} catch {
					// widget already removed
				}
				widgetIdRef.current = null;
			}
		};
	}, [siteKey, onToken]);

	return <div ref={containerRef} />;
}
