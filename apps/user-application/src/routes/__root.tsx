/// <reference types="vite/client" />
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import * as React from "react";
import type { QueryClient } from "@tanstack/react-query";
import type { User } from "better-auth/types";
import { DefaultCatchBoundary } from "@/components/default-catch-boundary";
import { NotFound } from "@/components/not-found";
import { ThemeProvider } from "@/components/theme";
import { LanguageProvider } from "@/components/language/language-provider";
import appCss from "@/styles.css?url";
import { seo } from "@/utils/seo";
import { Toaster } from "sonner";
import i18n from "@/lib/i18n";

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
  user?: User;
}>()({
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
    return (
      <RootDocument>
        <DefaultCatchBoundary {...props} />
      </RootDocument>
    );
  },
  notFoundComponent: () => <NotFound />,
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
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

function RootDocument({ children }: { children: React.ReactNode }) {
  // Use default language during SSR to prevent hydration mismatch
  // Client-side LanguageProvider will update this after mount
  const [lang, setLang] = React.useState("pl");

  React.useEffect(() => {
    setLang(i18n.language);
  }, []);

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
