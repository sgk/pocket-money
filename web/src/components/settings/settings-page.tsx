import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, isNetworkError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useInvalidateLedger } from "@/lib/query";
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
  const { token, logout } = useAuth();
  const invalidate = useInvalidateLedger();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isDeletingData, setIsDeletingData] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

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
      const data = await api.exportTransactions(token);
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

  const handleExportCsv = async () => {
    if (!token) return;
    try {
      setIsExportingCsv(true);
      const data = await api.exportTransactions(token);
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
      await api.importTransactions(token, json as any);
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
    if (!window.confirm(t("dataDeleteAllConfirm"))) return;
    try {
      setIsDeletingData(true);
      await api.deleteAllTransactions(token);
      toast.success(t("toastDeleteAllSuccess"));
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
      await api.deleteAccount(token);
      toast.success(t("toastDeleteAccountSuccess"));
      logout();
      window.location.href = "/login";
    } catch (e) {
      toast.error(isNetworkError(e) ? t("toastNetworkError") : t("toastUnexpectedError"));
    } finally {
      setIsDeletingAccount(false);
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
                <Select value={grade} onValueChange={(value) => setGrade(value as typeof grade)}>
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
        </div>
      </div>
    </div>
  );
};
