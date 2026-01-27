import { useState, useRef } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";

export const DataSettingsPage = () => {
  const { token, logout } = useAuth();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isDeletingData, setIsDeletingData] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      toast.success("エクスポートしました");
    } catch (e) {
      toast.error("エクスポートに失敗しました");
      console.error(e);
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!token) return;
    const file = event.target.files?.[0];
    if (!file) return;

    if (!window.confirm("これまでのデータに追加で読み込みます。IDが重複するデータはスキップされます。よろしいですか？")) {
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
    }

    try {
      setIsImporting(true);
      const text = await file.text();
      const json = JSON.parse(text);
      if (!Array.isArray(json)) throw new Error("Invalid format");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await api.importTransactions(token, json as any);
      toast.success("インポートしました");
    } catch (e) {
      toast.error("インポートに失敗しました");
      console.error(e);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
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
                すべての取引データをJSON形式でダウンロードします。
                データにはIDが含まれており、バックアップや復元に使用できます。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleExport} disabled={isExporting}>
                {isExporting ? "エクスポート中..." : "エクスポート"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>インポート</CardTitle>
              <CardDescription>
                JSONファイルから取引データを読み込みます。
                既存のデータと同じIDを持つ記録はスキップされ、重複を防ぎます。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json"
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
