import { useState } from "react";
import { api, isNetworkError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useOnboardingStatus } from "@/lib/query";
import { useText } from "@/lib/text";
import { formatDateSlash } from "@/lib/date";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Markdown } from "@/components/ui/markdown";
import { toast } from "@/components/ui/toast";

export const TermsPage = () => {
  const { t } = useText();
  const { token, logout } = useAuth();
  const { data, refetch, isLoading } = useOnboardingStatus();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  const currentTerms = data?.terms;
  const agreedTerms = data?.agreedTerms;
  const ageGroup = data?.profile?.ageGroup;
  const agreedGrace = agreedTerms ? new Date(agreedTerms.graceEndsAt).getTime() : null;
  const pendingGrace = currentTerms ? new Date(currentTerms.graceEndsAt).getTime() : null;
  const hasPendingTerms =
    pendingGrace !== null && (agreedGrace === null || agreedGrace < pendingGrace);
  const agreedAt = data?.profile?.termsAgreement?.agreedAt;
  const effectiveDeadline = data?.effectiveDeadline ?? null;
  const effectiveDeadlineText = effectiveDeadline ? formatDateSlash(effectiveDeadline) : "";
  const isChild = ageGroup === "child";

  const handleAgree = async () => {
    if (!token) return;
    setIsSubmitting(true);
    try {
      await api.agreeTerms(token, {});
      await refetch();
      toast.success(t("termsAgreeSuccess"));
    } catch (error) {
      toast.error(isNetworkError(error) ? t("toastNetworkError") : t("termsAgreeError"));
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWithdraw = async () => {
    if (!token) return;
    if (!window.confirm(t("termsAgreedWithdrawConfirm"))) {
      return;
    }
    setIsWithdrawing(true);
    try {
      await api.withdrawTerms(token);
      logout();
    } catch (error) {
      toast.error(
        isNetworkError(error) ? t("toastNetworkError") : t("termsAgreedWithdrawError")
      );
      console.error(error);
    } finally {
      setIsWithdrawing(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-col">
      <Topbar title={t("termsPageTitle")} subtitle={t("termsPageSubtitle")} />
      <div className="flex-1 min-h-0 overflow-y-auto pt-4 pb-6">
        <div className="mx-auto max-w-2xl space-y-6">
          {isChild ? null : (
            <>
              {hasPendingTerms && currentTerms ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{t("termsNewTitle")}</CardTitle>
                    <CardDescription>
                      {t("onboardingTermsHint", {
                        displayStart: formatDateSlash(currentTerms.displayStartAt),
                        graceEnd: formatDateSlash(currentTerms.graceEndsAt),
                      })}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="max-h-80 overflow-y-auto rounded-md border bg-muted/30 p-4">
                      <Markdown content={currentTerms.body} />
                    </div>
                    {ageGroup === "adult" ? (
                      <Button type="button" onClick={handleAgree} disabled={isSubmitting || isLoading}>
                        {t("onboardingAgree")}
                      </Button>
                    ) : (
                      <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        {t("onboardingParentConsentMessage")}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : null}

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t("termsAgreedTitle")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {agreedTerms ? (
                    <>
                      {effectiveDeadline ? (
                        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                          {t("termsAgreedWillExpire", { graceEnd: effectiveDeadlineText })}
                        </div>
                      ) : null}
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{t("termsAgreedAtLabel")}</span>
                        <span>{agreedAt ? formatDateSlash(agreedAt) : "-"}</span>
                      </div>
                      <div className="max-h-80 overflow-y-auto rounded-md border bg-muted/30 p-4">
                        <Markdown content={agreedTerms.body} />
                      </div>
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleWithdraw}
                          disabled={isWithdrawing}
                        >
                          {t("termsAgreedWithdraw")}
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      {t("termsAgreedEmpty")}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
