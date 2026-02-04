import { useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { api, isNetworkError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useBootstrap, useInvalidateLedger, useInvites } from "@/lib/query";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { useGradeOptions, useText } from "@/lib/text";

const SettingsLink = ({ to, label }: { to: string; label: string }) => (
  <Link
    to={to}
    className="flex items-center justify-between rounded-md border px-3 py-2 text-sm transition hover:bg-secondary"
  >
    <span>{label}</span>
    <span className="text-muted-foreground">›</span>
  </Link>
);

export const SettingsPage = () => {
  const { t, grade, setGrade } = useText();
  const gradeOptions = useGradeOptions();
  const { token, logout, childId } = useAuth();
  const { data } = useBootstrap();
  const profile = data?.profile;
  const ageGroup = profile?.ageGroup;
  const isAdult = ageGroup === "adult";
  const isParent = Boolean(data?.isParent);
  const invitesQuery = useInvites(isAdult);
  const invalidate = useInvalidateLedger();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isDeletingData, setIsDeletingData] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [childEmail, setChildEmail] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [isInviting, setIsInviting] = useState(false);
  const [isAcceptingInvite, setIsAcceptingInvite] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);
  const parent = profile?.parent;
  const parents = profile?.parents ?? [];
  const parentCount = parents.length > 0 ? parents.length : (parent ? 1 : 0);
  const parentLimitReached = parentCount >= 10;
  const invites = invitesQuery.data?.items ?? [];
  const inviteLimit = invitesQuery.data?.limit ?? 10;

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

  const csvToJson = (csv: string) => {
    const lines = csv.split(/\r?\n/).filter((line) => line.trim() !== "");
    if (lines.length === 0) return [];
    const headers = lines[0].split(",");
    const result = [];
    for (let i = 1; i < lines.length; i++) {
      const obj: any = {};
      const currentLine = lines[i];
      const values = [];
      let inQuote = false;
      let val = "";
      for (let char of currentLine) {
        if (char === '"') {
          inQuote = !inQuote;
        } else if (char === "," && !inQuote) {
          values.push(val);
          val = "";
        } else {
          val += char;
        }
      }
      values.push(val);
      const cleanValues = values.map((v) => {
        if (v.startsWith('"') && v.endsWith('"')) {
          return v.slice(1, -1).replace(/""/g, '"');
        }
        return v;
      });

      headers.forEach((header, index) => {
        const value = cleanValues[index];
        if (value !== undefined && value !== "") {
          obj[header] = value;
          if (["amount", "fee", "dayOrder"].includes(header)) {
            obj[header] = Number(value);
          }
        }
      });
      result.push(obj);
    }
    return result;
  };

  const handleExport = async () => {
    if (!token) return;
    try {
      setIsExporting(true);
      const data = await api.exportTransactions(token, childId);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pocket-money-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(t("toastExportJsonSuccess"));
    } catch (e) {
      toast.error(isNetworkError(e) ? t("toastNetworkError") : t("toastUnexpectedError"));
      console.error(e);
    } finally {
      setIsExporting(false);
    }
  };

  const handleInvite = async () => {
    if (!token) return;
    if (!childEmail.trim()) {
      toast.error(t("personalSettingsInviteEmailRequired"));
      return;
    }
    if (invites.length >= inviteLimit) {
      toast.error(t("personalSettingsInviteLimitReached"));
      return;
    }
    setIsInviting(true);
    try {
      await api.createInvite(token, { childEmail: childEmail.trim() });
      toast.success(t("personalSettingsInviteSuccess"));
      setChildEmail("");
      await invitesQuery.refetch();
    } catch (error) {
      toast.error(isNetworkError(error) ? t("toastNetworkError") : t("personalSettingsInviteError"));
      console.error(error);
    } finally {
      setIsInviting(false);
    }
  };

  const handleCancelInvite = async (inviteId: string, isActive: boolean) => {
    if (!token) return;
    const confirmMessage = isActive
      ? `${t("personalSettingsInviteCancelConfirm")} ${t("personalSettingsInviteCancelConfirmActive")}`
      : t("personalSettingsInviteCancelConfirm");
    if (!window.confirm(confirmMessage)) {
      return;
    }
    try {
      await api.cancelInvite(token, inviteId);
      toast.success(t("personalSettingsInviteCancelSuccess"));
      invalidate();
      await invitesQuery.refetch();
    } catch (error) {
      toast.error(isNetworkError(error) ? t("toastNetworkError") : t("personalSettingsInviteCancelError"));
      console.error(error);
    }
  };

  const handleExportCsv = async () => {
    if (!token) return;
    try {
      setIsExportingCsv(true);
      const data = await api.exportTransactions(token, childId);
      const csv = jsonToCsv(data);
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pocket-money-export-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(t("toastExportCsvSuccess"));
    } catch (e) {
      toast.error(isNetworkError(e) ? t("toastNetworkError") : t("toastUnexpectedError"));
      console.error(e);
    } finally {
      setIsExportingCsv(false);
    }
  };

  const handleImportFile = async (file: File) => {
    if (!token) return;
    if (!window.confirm(t("dataImportConfirm"))) {
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    try {
      setIsImporting(true);
      const text = await file.text();
      let json: any[] = [];
      if (file.name.toLowerCase().endsWith(".csv")) {
        json = csvToJson(text);
        if (json.length === 0) throw new Error("No data found in CSV");
      } else {
        json = JSON.parse(text);
      }
      if (!Array.isArray(json)) throw new Error("Invalid format: Root must be an array");
      await api.importTransactions(token, json as any, childId);
      toast.success(t("toastImportSuccess"));
      invalidate();
    } catch (e) {
      toast.error(isNetworkError(e) ? t("toastNetworkError") : t("toastUnexpectedError"));
      console.error(e);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await handleImportFile(file);
  };

  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!event.dataTransfer?.types?.includes("Files")) {
      return;
    }
    dragCounter.current += 1;
    setIsDragActive(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragActive(false);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!event.dataTransfer?.types?.includes("Files")) {
      return;
    }
    event.dataTransfer.dropEffect = "copy";
    if (!isDragActive) {
      setIsDragActive(true);
    }
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragCounter.current = 0;
    setIsDragActive(false);
    if (isImporting) {
      return;
    }
    const file = event.dataTransfer?.files?.[0];
    if (!file) {
      return;
    }
    await handleImportFile(file);
  };

  const handleDeleteAll = async () => {
    if (!token) return;
    if (!window.confirm(t("dataResetConfirm"))) return;
    try {
      setIsDeletingData(true);
      await api.deleteAllTransactions(token, childId);
      toast.success(t("toastResetSuccess"));
      invalidate();
    } catch (e) {
      toast.error(isNetworkError(e) ? t("toastNetworkError") : t("toastUnexpectedError"));
    } finally {
      setIsDeletingData(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!token) return;
    if (!window.confirm(t("dataDeleteAccountConfirm"))) return;
    try {
      setIsDeletingAccount(true);
      await api.deleteAccount(token, childId);
      toast.success(t("toastDeleteAccountSuccess"));
      logout();
      window.location.href = "/login";
    } catch (e) {
      toast.error(isNetworkError(e) ? t("toastNetworkError") : t("toastUnexpectedError"));
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleRecalculate = async () => {
    if (!token) return;
    if (!window.confirm(t("dataRecalculateConfirm"))) return;
    try {
      setIsRecalculating(true);
      await api.updateProfile(token, { recalculate: true }, childId);
      toast.success(t("toastRecalculateSuccess"));
      invalidate();
    } catch (e) {
      toast.error(isNetworkError(e) ? t("toastNetworkError") : t("toastUnexpectedError"));
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleAcceptInvite = async () => {
    if (!token) return;
    if (!parentEmail.trim()) {
      toast.error(t("onboardingParentEmailRequired"));
      return;
    }
    setIsAcceptingInvite(true);
    try {
      await api.acceptInvite(token, { parentEmail: parentEmail.trim() });
      toast.success(t("onboardingInviteSuccess"));
      setParentEmail("");
      invalidate();
    } catch (error) {
      toast.error(isNetworkError(error) ? t("toastNetworkError") : t("onboardingInviteError"));
      console.error(error);
    } finally {
      setIsAcceptingInvite(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <Topbar title={t("settingsTitle")} subtitle={t("settingsSubtitle")} />
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="mx-auto max-w-2xl space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("settingsSectionBasic")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              <SettingsLink to="/settings/assets" label={t("assetsSettingsTitle")} />
              <SettingsLink to="/settings/categories" label={t("categoriesSettingsTitle")} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("personalSettingsGradeTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="grid gap-2">
                <span className="text-sm text-muted-foreground">
                  {t("personalSettingsGradeDescription")}
                </span>
                <Select
                  value={grade}
                  onValueChange={(value) => setGrade(value as typeof grade)}
                >
                  <SelectTrigger className="w-full md:w-64">
                    <SelectValue placeholder={t("personalSettingsGradeLabel")} />
                  </SelectTrigger>
                  <SelectContent>
                    {gradeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {t("personalSettingsGradeNote")}
                </p>
              </div>
            </CardContent>
          </Card>
          {isAdult && !isParent ? (
            <Card>
              <CardHeader>
                <CardTitle>{t("settingsSectionLegal")}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                <SettingsLink to="/settings/terms" label={t("termsPageTitle")} />
              </CardContent>
            </Card>
          ) : null}
          {ageGroup === "child" ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("personalSettingsParentTitle")}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid gap-2">
                  <span className="text-sm text-muted-foreground">
                    保護者から招待が来ているかどうか確認します。
                  </span>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Input
                      type="email"
                      value={parentEmail}
                      onChange={(event) => setParentEmail(event.target.value)}
                      placeholder="保護者のGoogleアカウント"
                      disabled={isAcceptingInvite || parentLimitReached}
                    />
                    <Button
                      type="button"
                      onClick={handleAcceptInvite}
                      disabled={isAcceptingInvite || parentLimitReached}
                    >
                      招待を確認する
                    </Button>
                  </div>
                  {parentLimitReached && (
                    <p className="text-xs text-destructive">
                      {t("personalSettingsParentLimitReached")}
                    </p>
                  )}
                </div>

                <div className="grid gap-2 text-sm">
                  <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                    <span>確認済みの保護者</span>
                  </div>
                  {profile?.parents && profile.parents.length > 0 ? (
                    <div className="grid gap-2">
                      {profile.parents.map((p, idx) => (
                        <div
                          key={p.uid || idx}
                          className="flex flex-col gap-2 rounded-md border px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <span className="truncate font-medium">
                            {p.email ?? "-"}
                            {p.displayName ? ` (${p.displayName})` : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : parent ? (
                    <div className="flex flex-col gap-2 rounded-md border px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                      <span className="truncate font-medium">
                        {parent.email ?? "-"}
                        {parent.displayName ? ` (${parent.displayName})` : ""}
                      </span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">
                      {t("personalSettingsParentEmpty")}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : null}
          {ageGroup === "adult" ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("personalSettingsInviteTitle")}</CardTitle>
                <CardDescription>{t("personalSettingsInviteDescription")}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid gap-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Input
                      type="email"
                      value={childEmail}
                      onChange={(event) => setChildEmail(event.target.value)}
                      placeholder={t("personalSettingsInviteEmailLabel")}
                      disabled={isInviting || invites.length >= inviteLimit}
                    />
                    <Button
                      type="button"
                      onClick={handleInvite}
                      disabled={isInviting || invites.length >= inviteLimit}
                    >
                      {t("personalSettingsInviteSubmit")}
                    </Button>
                  </div>
                  {invites.length >= inviteLimit && (
                    <p className="text-xs text-destructive">
                      {t("personalSettingsInviteLimitReached")}
                    </p>
                  )}
                </div>
                <div className="grid gap-2 text-sm">
                  <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                    <span>{t("personalSettingsInviteListTitle")}</span>
                    <span>
                      {t("personalSettingsInviteLimitNote", {
                        count: String(invites.length),
                        limit: String(inviteLimit),
                      })}
                    </span>
                  </div>
                  {invites.length === 0 ? (
                    <div className="text-sm text-muted-foreground">
                      {t("personalSettingsInviteListEmpty")}
                    </div>
                  ) : (
                    <div className="grid gap-2">
                      {invites.map((invite) => (
                        <div
                          key={invite.id}
                          className="flex flex-col gap-2 rounded-md border px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <div className="truncate font-medium">
                              {invite.childEmail ?? "-"}
                              {invite.usedAt && invite.childName
                                ? ` (${invite.childName})`
                                : ""}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {invite.usedAt
                                ? t("personalSettingsInviteStatusActive")
                                : t("personalSettingsInviteStatusPending")}
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleCancelInvite(invite.id, Boolean(invite.usedAt))}
                            aria-label={t("personalSettingsInviteCancel")}
                          >
                            <Trash2 className="h-4 w-4 text-rose-600" />
                            <span className="sr-only">{t("personalSettingsInviteCancel")}</span>
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>{t("dataExportTitle")}</CardTitle>
              <CardDescription>
                {t("dataExportDescription1")}
                {t("dataExportDescription2")}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 sm:flex-row">
              <Button onClick={handleExport} disabled={isExporting}>
                {isExporting ? t("dataExporting") : t("dataExportJson")}
              </Button>
              <Button onClick={handleExportCsv} disabled={isExportingCsv} variant="outline">
                {isExportingCsv ? t("dataExporting") : t("dataExportCsv")}
              </Button>
            </CardContent>
          </Card>

          <Card
            className={isDragActive ? "border-primary/60 ring-2 ring-primary/30 bg-primary/5" : undefined}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <CardHeader>
              <CardTitle>{t("dataImportTitle")}</CardTitle>
              <CardDescription>
                {t("dataImportDescription1")}
                {t("dataImportDescription2")}
                {t("dataImportDescription3")}
                {t("dataImportDescription4")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.csv,text/csv,application/json"
                  onChange={handleImport}
                  disabled={isImporting}
                  className="max-w-sm"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("dataRecalculateTitle")}</CardTitle>
              <CardDescription>
                {t("dataRecalculateDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                onClick={handleRecalculate}
                disabled={isRecalculating}
              >
                {isRecalculating ? t("dataRecalculating") : t("dataRecalculateButton")}
              </Button>
            </CardContent>
          </Card>

          {isAdult || isParent ? (
            <Card className="border-destructive/50">
              <CardHeader>
                <CardTitle className="text-destructive">{t("dataDangerTitle")}</CardTitle>
                <CardDescription>
                  {t("dataDangerDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-2">
                  <h4 className="font-medium">{t("dataResetTitle")}</h4>
                  <p className="text-sm text-muted-foreground">{t("dataResetDescription")}</p>
                  <Button
                    variant="destructive"
                    onClick={handleDeleteAll}
                    disabled={isDeletingData}
                    className="w-fit"
                  >
                    {isDeletingData ? t("dataResetDeleting") : t("dataResetButton")}
                  </Button>
                </div>
                <div className="border-t pt-4 flex flex-col gap-2">
                  <h4 className="font-medium">{t("dataDeleteAccountTitle")}</h4>
                  <p className="text-sm text-muted-foreground">
                    {t("dataDeleteAccountDescription")}
                  </p>
                  <Button
                    variant="destructive"
                    onClick={handleDeleteAccount}
                    disabled={isDeletingAccount}
                    className="w-fit"
                  >
                    {isDeletingAccount ? t("dataDeleteAccountProcessing") : t("dataDeleteAccountButton")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
};
