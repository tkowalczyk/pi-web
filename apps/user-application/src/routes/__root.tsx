/// <reference types="vite/client" />
import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import type * as React from "react";
import type { QueryClient } from "@tanstack/react-query";
import type { User } from "better-auth/types";
import { DefaultCatchBoundary } from "@/components/default-catch-boundary";
import { NotFound } from "@/components/not-found";
import { ThemeProvider } from "@/components/theme";
import { LanguageProvider } from "@/components/language/language-provider";
import appCss from "@/styles.css?url";
import { seo } from "@/utils/seo";
import { Toaster } from "sonner";
import { detectInitialLanguage } from "@/core/functions/detect-language";
import type { SupportedLanguage } from "@/lib/parse-accept-language";

export const Route = createRootRouteWithContext<{
	queryClient: QueryClient;
	user?: User;
}>()({
	beforeLoad: async () => {
		const initialLanguage = await detectInitialLanguage();
		return { initialLanguage };
	},
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			...seo({
				title: "powiadomienia.info - wywóz śmieci",
				description: "Otrzymuj powiadomienia SMS przed odbiorem śmieci na Twojej ulicy",
			}),
		],
		links: [
			{ rel: "stylesheet", href: appCss },
			{ rel: "canonical", href: "https://powiadomienia.info" },
			{
				rel: "icon",
				type: "image/svg+xml",
				href: "/bell-favicon.svg",
			},
		],
	}),
	errorComponent: (props) => {
		const initialLanguage = Route.useRouteContext({ select: (s) => s.initialLanguage });
		return (
			<RootDocument lang={initialLanguage}>
				<DefaultCatchBoundary {...props} />
			</RootDocument>
		);
	},
	notFoundComponent: () => <NotFound />,
	component: RootComponent,
});

function RootComponent() {
	const initialLanguage = Route.useRouteContext({ select: (s) => s.initialLanguage });

	return (
		<RootDocument lang={initialLanguage}>
			<ThemeProvider
				attribute="class"
				defaultTheme="system"
				enableSystem
				disableTransitionOnChange={false}
			>
				<LanguageProvider>
					<Outlet />
					<Toaster position="top-center" richColors />
				</LanguageProvider>
			</ThemeProvider>
		</RootDocument>
	);
}

function RootDocument({ children, lang }: { children: React.ReactNode; lang: SupportedLanguage }) {
	return (
		<html lang={lang} suppressHydrationWarning>
			<head>
				<HeadContent />
				<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
				<meta name="theme-color" content="#09090b" media="(prefers-color-scheme: dark)" />
			</head>
			<body>
				{children}
				<TanStackRouterDevtools position="bottom-right" />
				<ReactQueryDevtools buttonPosition="bottom-left" />
				<Scripts />
			</body>
		</html>
	);
}
