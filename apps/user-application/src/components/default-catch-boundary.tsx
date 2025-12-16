import { Link, rootRouteId, useMatch, useRouter } from "@tanstack/react-router";
import type { ErrorComponentProps } from "@tanstack/react-router";
import {
  AlertTriangle,
  RefreshCw,
  ArrowLeft,
  Home,
  ChevronDown,
  Bug,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useState } from "react";
import { useTranslation } from "react-i18next";

export function DefaultCatchBoundary({ error }: ErrorComponentProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const isRoot = useMatch({
    strict: false,
    select: (state) => state.id === rootRouteId,
  });
  const [showDetails, setShowDetails] = useState(false);

  console.error(error);

  // Format error details for display
  const errorMessage = error?.message || t("error.defaultMessage");
  const errorStack = error?.stack || "";
  const hasStack = errorStack.length > 0;

  const handleReportError = () => {
    const subject = encodeURIComponent("Error Report");
    const body = encodeURIComponent(
      `An error occurred in the application:\n\nError: ${errorMessage}\n\nStack Trace:\n${errorStack}\n\nPlease describe what you were doing when this error occurred:`,
    );
    window.location.href = `mailto:support@example.com?subject=${subject}&body=${body}`;
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center space-x-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <CardTitle className="text-xl">{t("error.title")}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {t("error.description")}
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Error Alert */}
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="font-medium">
              {errorMessage}
            </AlertDescription>
          </Alert>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={() => router.invalidate()}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              {t("error.tryAgain")}
            </Button>

            {isRoot ? (
              <Button variant="outline" asChild>
                <Link to="/" className="flex items-center gap-2">
                  <Home className="h-4 w-4" />
                  {t("error.goToHome")}
                </Link>
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => window.history.back()}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                {t("error.goBack")}
              </Button>
            )}
          </div>

          {/* Error Details (Collapsible) */}
          {hasStack && (
            <Collapsible open={showDetails} onOpenChange={setShowDetails}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
                >
                  <Bug className="h-4 w-4" />
                  {t("error.technicalDetails")}
                  <ChevronDown
                    className={`h-4 w-4 transition-transform duration-200 ${showDetails ? "rotate-180" : ""}`}
                  />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2">
                <div className="rounded-lg bg-muted p-4">
                  <h4 className="text-sm font-medium mb-2">
                    {t("error.stackTrace")}
                  </h4>
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
                    {errorStack}
                  </pre>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Help Section */}
          <div className="border-t pt-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="text-sm text-muted-foreground">
                {t("error.persistMessage")}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleReportError}
                className="flex items-center gap-2"
              >
                <Mail className="h-4 w-4" />
                {t("error.reportError")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
