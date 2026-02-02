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

  const showAgeSelection = data?.state === "needsAge";
  const showTerms = data?.state === "needsTerms" || ageGroup === "adult";
  const showChildInvite =
    (data?.state === "needsAge" && ageGroup === "child") || data?.state === "needsParentConsent";

  return (
    <div className="page-shell flex min-h-screen items-center justify-center px-4 py-8">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="font-display text-2xl">{t("onboardingTitle")}</CardTitle>
          <CardDescription>{t("onboardingSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {showAgeSelection ? (
            <section className="space-y-3">
              <div className="text-sm text-muted-foreground">{t("onboardingAgePrompt")}</div>
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

          {showTerms ? (
            <section className="space-y-3">
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

          {showChildInvite ? (
            <section className="space-y-3">
              <div className="text-sm text-muted-foreground">
                {t("onboardingParentEmailPrompt")}
              </div>
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

          {!showAgeSelection ? (
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
