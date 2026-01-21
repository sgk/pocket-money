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
      toast.error("ログインしてね");
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
      toast.success("いれものを なおしたよ");
      queryClient.invalidateQueries({ queryKey: ["assets"] });
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleDelete = async () => {
    if (!token) {
      toast.error("ログインしてね");
      return;
    }
    const ok = window.confirm("この いれものを おやすみする？");
    if (!ok) {
      return;
    }
    try {
      await api.deleteAsset(token, asset.id);
      toast.success("いれものを おやすみにしたよ");
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
          placeholder="なまえ"
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
        />
        <Input
          placeholder="しゅるい"
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
          placeholder="ならび"
          value={form.sortOrder}
          onChange={(event) => setForm({ ...form, sortOrder: event.target.value })}
        />
        <div className="text-sm text-muted-foreground">
          いまののこり: {formatJPY(asset.currentBalance)}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
          />
          つかう
        </label>
        <div className="flex gap-2">
          <Button onClick={handleSave}>ほぞん</Button>
          <Button variant="destructive" onClick={handleDelete}>
            おやすみ
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
      toast.error("ログインしてね");
      return;
    }
    if (!newAsset.name.trim()) {
      toast.error("なまえを いれてね");
      return;
    }
    try {
      await api.createAsset(token, {
        name: newAsset.name,
        type: newAsset.type || undefined,
        initialBalance: Number(newAsset.initialBalance || 0),
      });
      toast.success("いれものを たしたよ");
      setNewAsset({ name: "", type: "", initialBalance: "0" });
      queryClient.invalidateQueries({ queryKey: ["assets"] });
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  return (
    <div>
      <Topbar title="いれもの設定" subtitle="いれものを ふやす / なおす" />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">あたらしい いれもの</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <Input
            placeholder="なまえ"
            value={newAsset.name}
            onChange={(event) => setNewAsset({ ...newAsset, name: event.target.value })}
          />
          <Input
            placeholder="しゅるい"
            value={newAsset.type}
            onChange={(event) => setNewAsset({ ...newAsset, type: event.target.value })}
          />
          <Input
            type="number"
            placeholder="はじめののこり"
            value={newAsset.initialBalance}
            onChange={(event) =>
              setNewAsset({ ...newAsset, initialBalance: event.target.value })
            }
          />
          <div className="md:col-span-3">
            <Button onClick={handleCreate}>たす</Button>
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
