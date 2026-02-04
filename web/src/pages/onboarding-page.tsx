import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { api, isNetworkError } from "@/lib/api";
import { useOnboardingStatus } from "@/lib/query";
import { useText } from "@/lib/text";
import { formatDateSlash } from "@/lib/date";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";

export const OnboardingPage = () => {
  const { t } = useText();
  const { token, logout } = useAuth();
  const { data, refetch, isLoading } = useOnboardingStatus();
  const [ageGroup, setAgeGroup] = useState<"adult" | "child" | null>(null);
  const [parentEmail, setParentEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [step, setStep] = useState<"intro" | "form">("intro");

  useEffect(() => {
    if (data?.state === "needsTerms") {
      setAgeGroup("adult");
    } else if (data?.state === "needsParentConsent") {
      setAgeGroup("child");
    } else if (data?.state === "needsAge") {
      setAgeGroup(null);
    }
  }, [data?.state]);

  const termsMeta = useMemo(() => {
    const terms = data?.terms;
    if (!terms) {
      return { displayStart: "", graceEnd: "" };
    }
    return {
      displayStart: formatDateSlash(terms.displayStartAt),
      graceEnd: formatDateSlash(terms.graceEndsAt),
    };
  }, [data?.terms]);

  const handleAgreeTerms = async () => {
    if (!token) return;
    setIsSubmitting(true);
    try {
      const payload = ageGroup ? { ageGroup } : {};
      await api.agreeTerms(token, payload);
      await refetch();
    } catch (error) {
      toast.error(isNetworkError(error) ? t("toastNetworkError") : t("onboardingAgreeError"));
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAcceptInvite = async () => {
    if (!token) return;
    if (!parentEmail.trim()) {
      toast.error(t("onboardingParentEmailRequired"));
      return;
    }
    setIsSubmitting(true);
    try {
      await api.acceptInvite(token, { parentEmail: parentEmail.trim() });
      await refetch();
    } catch (error) {
      toast.error(isNetworkError(error) ? t("toastNetworkError") : t("onboardingInviteError"));
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const jsonToCsv = (items: any[]) => {
    if (items.length === 0) return "";
    const headers = [
      "id",
      "type",
      "occurredAt",
      "amount",
      "memo",
      "assetName",
      "categoryName",
      "merchant",
      "source",
      "fromAssetName",
      "toAssetName",
      "fee",
      "feeCategoryName",
      "counterparty",
      "dayOrder",
    ];
    const csvRows = [headers.join(",")];
    for (const item of items) {
      const values = headers.map((header) => {
        let val = item[header] ?? "";
        if (typeof val === "string") {
          val = val.replace(/"/g, '""');
          if (val.includes(",") || val.includes('"') || val.includes("\n")) {
            val = `"${val}"`;
          }
        }
        return val;
      });
      csvRows.push(values.join(","));
    }
    return "\uFEFF" + csvRows.join("\n");
  };

  const handleExport = async () => {
    if (!token) return;
    try {
      setIsExporting(true);
      const items = await api.exportTransactions(token);
      const blob = new Blob([JSON.stringify(items, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pocket-money-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(t("onboardingExportSuccess"));
    } catch (error) {
      toast.error(isNetworkError(error) ? t("toastNetworkError") : t("onboardingExportError"));
      console.error(error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCsv = async () => {
    if (!token) return;
    try {
      setIsExportingCsv(true);
      const items = await api.exportTransactions(token);
      const csv = jsonToCsv(items);
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pocket-money-export-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(t("onboardingExportCsvSuccess"));
    } catch (error) {
      toast.error(isNetworkError(error) ? t("toastNetworkError") : t("onboardingExportError"));
      console.error(error);
    } finally {
      setIsExportingCsv(false);
    }
  };

  const showAgeSelection = data?.state === "needsAge";
  const showTerms = data?.state === "needsTerms" || ageGroup === "adult";
  const showChildInvite =
    (data?.state === "needsAge" && ageGroup === "child") || data?.state === "needsParentConsent";
  const isIntro = step === "intro";

  return (
    <div className="page-shell flex min-h-screen items-center justify-center px-4 py-8">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="font-display text-2xl">{t("appTitle")}</CardTitle>
          {!isIntro ? (
            <CardDescription>{t("onboardingSubtitle")}</CardDescription>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-6">
          {isIntro ? (
            <section className="space-y-4">
              <div className="space-y-2">
                <div className="text-sm font-medium">{t("onboardingIntroExportTitle")}</div>
                <div className="text-sm text-muted-foreground">
                  {t("onboardingIntroExportDescription")}
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button onClick={handleExport} disabled={isExporting}>
                    {isExporting ? t("onboardingExporting") : t("onboardingExportJson")}
                  </Button>
                  <Button onClick={handleExportCsv} disabled={isExportingCsv} variant="outline">
                    {isExportingCsv ? t("onboardingExporting") : t("onboardingExportCsv")}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">{t("onboardingIntroNextDescription")}</div>
                <Button type="button" onClick={() => setStep("form")}>
                  {t("onboardingIntroNextButton")}
                </Button>
              </div>
              <div className="flex justify-end">
                <Button type="button" variant="ghost" onClick={logout}>
                  {t("logout")}
                </Button>
              </div>
            </section>
          ) : null}

          {!isIntro && showAgeSelection ? (
            <section className="space-y-3">
              <div className="text-sm font-medium">{t("onboardingStepAgeLabel")}</div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant={ageGroup === "adult" ? "default" : "secondary"}
                  onClick={() => setAgeGroup("adult")}
                >
                  {t("onboardingAgeAdult")}
                </Button>
                <Button
                  type="button"
                  variant={ageGroup === "child" ? "default" : "secondary"}
                  onClick={() => setAgeGroup("child")}
                >
                  {t("onboardingAgeChild")}
                </Button>
              </div>
              <div className="flex justify-end">
                <Button type="button" variant="ghost" onClick={logout}>
                  {t("logout")}
                </Button>
              </div>
            </section>
          ) : null}

          {!isIntro && showTerms ? (
            <section className="space-y-3">
              <div className="text-sm font-medium">{t("onboardingStepAdultLabel")}</div>
              <div className="text-sm text-muted-foreground">
                {t("onboardingTermsHint", {
                  displayStart: termsMeta.displayStart,
                  graceEnd: termsMeta.graceEnd,
                })}
              </div>
              <div className="max-h-64 overflow-y-auto rounded-md border bg-muted/30 p-4 text-sm whitespace-pre-wrap">
                {data?.terms?.body}
              </div>
              <Button type="button" onClick={handleAgreeTerms} disabled={isSubmitting || isLoading}>
                {t("onboardingAgree")}
              </Button>
            </section>
          ) : null}

          {!isIntro && showChildInvite ? (
            <section className="space-y-3">
              <div className="text-sm font-medium">{t("onboardingStepChildLabel")}</div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  type="email"
                  value={parentEmail}
                  onChange={(event) => setParentEmail(event.target.value)}
                  placeholder={t("onboardingParentEmailPlaceholder")}
                />
                <Button type="button" onClick={handleAcceptInvite} disabled={isSubmitting || isLoading}>
                  {t("onboardingInviteSubmit")}
                </Button>
              </div>
            </section>
          ) : null}

          {!isIntro && !showAgeSelection ? (
            <div className="flex justify-end">
              <Button type="button" variant="ghost" onClick={logout}>
                {t("logout")}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
};
