import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useAssets } from "@/lib/query";
import { useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { formatJPY } from "@/lib/money";
import type { Asset } from "@/lib/types";

const AssetRow = ({ asset }: { asset: Asset }) => {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: asset.name,
    type: asset.type ?? "",
    note: asset.note ?? "",
    sortOrder: String(asset.sortOrder ?? 0),
    isActive: asset.isActive,
  });

  const handleSave = async () => {
    if (!token) {
      toast.error("ログインが必要です");
      return;
    }
    try {
      await api.updateAsset(token, asset.id, {
        name: form.name,
        type: form.type || undefined,
        note: form.note || undefined,
        sortOrder: Number(form.sortOrder || 0),
        isActive: form.isActive,
      });
      toast.success("資産を更新しました");
      queryClient.invalidateQueries({ queryKey: ["assets"] });
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleDelete = async () => {
    if (!token) {
      toast.error("ログインが必要です");
      return;
    }
    const ok = window.confirm("この資産を非アクティブにしますか？");
    if (!ok) {
      return;
    }
    try {
      await api.deleteAsset(token, asset.id);
      toast.success("資産を非アクティブにしました");
      queryClient.invalidateQueries({ queryKey: ["assets"] });
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{asset.name}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <Input
          placeholder="名前"
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
        />
        <Input
          placeholder="種別"
          value={form.type}
          onChange={(event) => setForm({ ...form, type: event.target.value })}
        />
        <Input
          placeholder="メモ"
          value={form.note}
          onChange={(event) => setForm({ ...form, note: event.target.value })}
        />
        <Input
          type="number"
          placeholder="並び順"
          value={form.sortOrder}
          onChange={(event) => setForm({ ...form, sortOrder: event.target.value })}
        />
        <div className="text-sm text-muted-foreground">
          現在残高: {formatJPY(asset.currentBalance)}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
          />
          アクティブ
        </label>
        <div className="flex gap-2">
          <Button onClick={handleSave}>保存</Button>
          <Button variant="destructive" onClick={handleDelete}>
            非アクティブ化
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export const AssetsSettingsPage = () => {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const { data: assets = [] } = useAssets();
  const [newAsset, setNewAsset] = useState({
    name: "",
    type: "",
    initialBalance: "0",
  });

  const handleCreate = async () => {
    if (!token) {
      toast.error("ログインが必要です");
      return;
    }
    if (!newAsset.name.trim()) {
      toast.error("資産名を入力してください");
      return;
    }
    try {
      await api.createAsset(token, {
        name: newAsset.name,
        type: newAsset.type || undefined,
        initialBalance: Number(newAsset.initialBalance || 0),
      });
      toast.success("資産を追加しました");
      setNewAsset({ name: "", type: "", initialBalance: "0" });
      queryClient.invalidateQueries({ queryKey: ["assets"] });
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  return (
    <div>
      <Topbar title="資産管理" subtitle="資産の追加と編集" />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">新規資産</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <Input
            placeholder="名前"
            value={newAsset.name}
            onChange={(event) => setNewAsset({ ...newAsset, name: event.target.value })}
          />
          <Input
            placeholder="種別"
            value={newAsset.type}
            onChange={(event) => setNewAsset({ ...newAsset, type: event.target.value })}
          />
          <Input
            type="number"
            placeholder="初期残高"
            value={newAsset.initialBalance}
            onChange={(event) =>
              setNewAsset({ ...newAsset, initialBalance: event.target.value })
            }
          />
          <div className="md:col-span-3">
            <Button onClick={handleCreate}>追加</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {assets.map((asset) => (
          <AssetRow key={asset.id} asset={asset} />
        ))}
      </div>
    </div>
  );
};
