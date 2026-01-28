import { useState, useRef } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useInvalidateLedger } from "@/lib/query";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";

export const DataSettingsPage = () => {
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
      // Simple CSV parser ignoring comma inside quotes for now as jsonToCsv escapes them
      // But for robustness, let's use a regex split or similar if we expect complex data.
      // For now, let's stick to simple split but handle quoted strings better if needed.
      // Actually, standard split(",") is risky. Let's do a proper parse.
      const values = [];
      let inQuote = false;
      let val = "";
      for (let char of currentLine) {
          if (char === '"') {
              inQuote = !inQuote;
          } else if (char === ',' && !inQuote) {
              values.push(val);
              val = "";
          } else {
              val += char;
          }
      }
      values.push(val);
      // Handle cleanup of quotes
      const cleanValues = values.map(v => {
          if (v.startsWith('"') && v.endsWith('"')) {
              return v.slice(1, -1).replace(/""/g, '"');
          }
          return v;
      });

      headers.forEach((header, index) => {
        const val = cleanValues[index];
        if (val !== undefined && val !== "") {
          obj[header] = isNaN(Number(val)) ? val : val; // Keep number strings as strings if they look like IDs, but amounts need to be numbers?
          // Actually the API expects numbers for amount/fee/dayOrder.
          if (["amount", "fee", "dayOrder"].includes(header)) {
              obj[header] = Number(val);
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
      toast.success("JSONをエクスポートしました");
    } catch (e) {
      toast.error("エクスポートに失敗しました");
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
      toast.success("CSVをエクスポートしました");
    } catch (e) {
        toast.error("エクスポートに失敗しました");
        console.error(e);
    } finally {
        setIsExportingCsv(false);
    }
  };

  const handleImportFile = async (file: File) => {
    if (!token) return;

    if (!window.confirm("これまでのデータに追加で読み込みます。IDが重複するデータはスキップされます。よろしいですか？")) {
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
          try {
              json = JSON.parse(text);
          } catch(e) {
              throw new Error("Invalid JSON format");
          }
      }

      if (!Array.isArray(json)) throw new Error("Invalid format: Root must be an array");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await api.importTransactions(token, json as any);
      toast.success("インポートしました");
      invalidate();
    } catch (e) {
      toast.error("インポートに失敗しました: " + (e instanceof Error ? e.message : "Unkown error"));
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
    if (!window.confirm("本当に全ての取引データを削除しますか？この操作は取り消せません。")) return;
    try {
      setIsDeletingData(true);
      await api.deleteAllTransactions(token);
      toast.success("全てのデータを削除しました");
    } catch (e) {
      toast.error("削除に失敗しました");
    } finally {
      setIsDeletingData(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!token) return;
    if (!window.confirm("本当に退会しますか？全てのデータが完全に削除され、復元できません。")) return;
    try {
      setIsDeletingAccount(true);
      await api.deleteAccount(token);
      toast.success("退会しました");
      logout();
      // Redirect handled by logout usually, or:
      window.location.href = "/login";
    } catch (e) {
      toast.error("退会に失敗しました");
    } finally {
      setIsDeletingAccount(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <Topbar title="データ管理" />
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="mx-auto max-w-2xl space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>エクスポート</CardTitle>
              <CardDescription>
                すべての取引データをダウンロードします。
                バックアップやExcel・スプレッドシート等での利用に使用できます。
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 sm:flex-row">
              <Button onClick={handleExport} disabled={isExporting}>
                {isExporting ? "エクスポート中..." : "JSON形式でエクスポート"}
              </Button>
              <Button onClick={handleExportCsv} disabled={isExportingCsv} variant="outline">
                {isExportingCsv ? "エクスポート中..." : "CSV形式でエクスポート"}
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
              <CardTitle>インポート (JSON / CSV)</CardTitle>
              <CardDescription>
                JSONまたはCSVファイルから取引データを読み込みます。
                ファイル形式は拡張子で自動判別されます。
                既存のデータと同じIDを持つ記録はスキップされ、重複を防ぎます。
                ファイルはこのカードへドラッグ&ドロップでも読み込めます。
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
              <CardTitle className="text-destructive">危険な操作</CardTitle>
              <CardDescription>
                データの削除や退会を行います。これらの操作は取り消せません。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-2">
                <h4 className="font-medium">データのリセット</h4>
                <p className="text-sm text-muted-foreground">すべての取引履歴を削除しますが、アカウントは残ります。</p>
                <Button variant="destructive" onClick={handleDeleteAll} disabled={isDeletingData} className="w-fit">
                  {isDeletingData ? "削除中..." : "全データを削除"}
                </Button>
              </div>
              <div className="border-t pt-4 flex flex-col gap-2">
                <h4 className="font-medium">退会</h4>
                <p className="text-sm text-muted-foreground">アカウントとすべてのデータを完全に削除します。</p>
                <Button variant="destructive" onClick={handleDeleteAccount} disabled={isDeletingAccount} className="w-fit">
                  {isDeletingAccount ? "処理中..." : "退会する"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
