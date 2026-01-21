import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Link } from "react-router-dom";
import { useAssets } from "@/lib/query";
import { useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { formatJPY } from "@/lib/money";
import type { Asset } from "@/lib/types";

const AssetRow = ({
  asset,
  onSave,
  onToggleActive,
  onDelete,
  onDragEnd,
  isDragging,
  dragHandleProps,
}: {
  asset: Asset;
  onSave: (
    id: string,
    payload: { name: string; type: string; note: string; isActive: boolean }
  ) => void;
  onToggleActive: (id: string, value: boolean) => void;
  onDelete: (id: string) => void;
  onDragEnd: () => void;
  isDragging: boolean;
  dragHandleProps: {
    draggable: boolean;
    onDragStart: (event: React.DragEvent<HTMLDivElement>) => void;
  };
}) => {
  const inactive = !asset.isActive;
  const [form, setForm] = useState({
    name: asset.name,
    type: asset.type ?? "",
    note: asset.note ?? "",
    isActive: asset.isActive,
  });
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setForm({
      name: asset.name,
      type: asset.type ?? "",
      note: asset.note ?? "",
      isActive: asset.isActive,
    });
    setIsDirty(false);
  }, [asset]);

  const handleSave = () => {
    if (!form.name.trim()) {
      setForm({
        ...form,
        name: asset.name,
      });
      toast.error("なまえを いれてね");
      return;
    }
    if (!isDirty) {
      return;
    }
    setIsDirty(false);
    onSave(asset.id, {
      name: form.name.trim(),
      type: form.type.trim(),
      note: form.note.trim(),
      isActive: form.isActive,
    });
  };

  const handleChange = (next: Partial<typeof form>) => {
    setForm((prev) => ({ ...prev, ...next }));
    setIsDirty(true);
  };

  return (
    <div
      className={`flex flex-wrap items-center gap-2 rounded-lg border bg-card/80 px-3 py-1.5 text-sm ${
        inactive ? "opacity-50" : ""
      } ${isDragging ? "opacity-40" : ""}`}
      onDragEnd={onDragEnd}
    >
      <div
        className="cursor-grab text-muted-foreground"
        {...dragHandleProps}
        aria-label="ドラッグ"
      >
        ≡
      </div>
      <Input
        placeholder="なまえ"
        value={form.name}
        onChange={(event) => handleChange({ name: event.target.value })}
        onBlur={handleSave}
        className="h-8 w-40"
      />
      <Input
        placeholder="しゅるい"
        value={form.type}
        onChange={(event) => handleChange({ type: event.target.value })}
        onBlur={handleSave}
        className="h-8 w-28"
      />
      <Input
        placeholder="メモ"
        value={form.note}
        onChange={(event) => handleChange({ note: event.target.value })}
        onBlur={handleSave}
        className="h-8 w-48"
      />
      <Link
        to={`/assets/${asset.id}/ledger`}
        className="w-28 text-right text-sm font-semibold text-sky-700 underline-offset-4 hover:underline"
      >
        {formatJPY(asset.currentBalance)}
      </Link>
      <label className="flex w-16 items-center justify-center">
        <input
          type="checkbox"
          checked={form.isActive}
          onChange={(event) => {
            const next = event.target.checked;
            setForm({ ...form, isActive: next });
            onToggleActive(asset.id, next);
          }}
        />
      </label>
      <div className="flex w-8 items-center justify-center">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-rose-600 hover:text-rose-700"
          onClick={() => onDelete(asset.id)}
          aria-label={`${asset.name} を けす`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
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
  const [order, setOrder] = useState<string[]>([]);
  const [savingCount, setSavingCount] = useState(0);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [indicatorIndex, setIndicatorIndex] = useState<number | null>(null);
  const isSaving = savingCount > 0;

  useEffect(() => {
    const ids = [...assets]
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((asset) => asset.id);
    setOrder(ids);
  }, [assets]);

  const orderedAssets = useMemo(() => {
    const list = [...assets].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const ids = list.map((item) => item.id);
    if (order.length !== ids.length || !order.every((id) => ids.includes(id))) {
      return list;
    }
    const map = new Map(list.map((item) => [item.id, item]));
    return order.map((id) => map.get(id)!).filter(Boolean);
  }, [assets, order]);

  const runSaving = async (fn: () => Promise<void>) => {
    setSavingCount((count) => count + 1);
    try {
      await fn();
    } finally {
      setSavingCount((count) => Math.max(0, count - 1));
    }
  };

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>, id: string) => {
    event.dataTransfer.setData("text/plain", id);
    event.dataTransfer.effectAllowed = "move";
    setDraggingId(id);
  };

  const handleDropAt = async (dragId: string, insertIndex: number) => {
    setIndicatorIndex(null);
    const next = [...orderedAssets];
    const fromIndex = next.findIndex((item) => item.id === dragId);
    if (fromIndex < 0) {
      return;
    }
    const [moved] = next.splice(fromIndex, 1);
    const adjustedIndex = fromIndex < insertIndex ? insertIndex - 1 : insertIndex;
    next.splice(adjustedIndex, 0, moved);
    setOrder(next.map((item) => item.id));
    await handleReorder(next);
  };

  const handleDropOnSlot = async (event: React.DragEvent<HTMLDivElement>, index: number) => {
    event.preventDefault();
    const dragId = event.dataTransfer.getData("text/plain");
    if (!dragId) {
      return;
    }
    await handleDropAt(dragId, index);
  };

  const handleDragOverSlot = (event: React.DragEvent<HTMLDivElement>, index: number) => {
    event.preventDefault();
    setIndicatorIndex(index);
  };

  const handleDragOverRow = (event: React.DragEvent<HTMLDivElement>, index: number) => {
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    const before = event.clientY - bounds.top < bounds.height / 2;
    setIndicatorIndex(before ? index : index + 1);
  };

  const handleDropOnRow = async (event: React.DragEvent<HTMLDivElement>, index: number) => {
    event.preventDefault();
    const dragId = event.dataTransfer.getData("text/plain");
    if (!dragId) {
      return;
    }
    const bounds = event.currentTarget.getBoundingClientRect();
    const before = event.clientY - bounds.top < bounds.height / 2;
    const insertIndex = before ? index : index + 1;
    await handleDropAt(dragId, insertIndex);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setIndicatorIndex(null);
  };

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
      const nextSortOrder =
        Math.max(0, ...assets.map((asset) => asset.sortOrder ?? 0)) + 1;
      await runSaving(async () => {
        await api.createAsset(token, {
          name: newAsset.name,
          type: newAsset.type || undefined,
          initialBalance: Number(newAsset.initialBalance || 0),
          sortOrder: nextSortOrder,
        });
      });
      toast.success("いれものを たしたよ");
      setNewAsset({ name: "", type: "", initialBalance: "0" });
      queryClient.invalidateQueries({ queryKey: ["assets"] });
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleSaveAsset = async (
    id: string,
    payload: { name: string; type: string; note: string; isActive: boolean }
  ) => {
    if (!token) {
      toast.error("ログインしてね");
      return;
    }
    if (!payload.name.trim()) {
      toast.error("なまえを いれてね");
      return;
    }
    try {
      await runSaving(async () => {
        await api.updateAsset(token, id, {
          name: payload.name.trim(),
          type: payload.type || undefined,
          note: payload.note || undefined,
          isActive: payload.isActive,
        });
      });
      toast.success("いれものを なおしたよ");
      queryClient.invalidateQueries({ queryKey: ["assets"] });
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleToggleActive = async (id: string, value: boolean) => {
    if (!token) {
      toast.error("ログインしてね");
      return;
    }
    try {
      await runSaving(async () => {
        await api.updateAsset(token, id, { isActive: value });
      });
      queryClient.invalidateQueries({ queryKey: ["assets"] });
    } catch (error) {
      toast.error((error as Error).message);
      queryClient.invalidateQueries({ queryKey: ["assets"] });
    }
  };

  const handleDeleteAsset = async (id: string) => {
    if (!token) {
      toast.error("ログインしてね");
      return;
    }
    const ok = window.confirm("この いれものを けす？");
    if (!ok) {
      return;
    }
    try {
      await runSaving(async () => {
        await api.deleteAsset(token, id);
      });
      toast.success("いれものを けしたよ");
      queryClient.invalidateQueries({ queryKey: ["assets"] });
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleReorder = async (list: Asset[]) => {
    if (!token) {
      toast.error("ログインしてね");
      return;
    }
    try {
      await runSaving(async () => {
        await Promise.all(
          list.map((asset, index) =>
            api.updateAsset(token, asset.id, { sortOrder: index + 1 })
          )
        );
      });
      queryClient.invalidateQueries({ queryKey: ["assets"] });
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  return (
    <div className="relative">
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

      {orderedAssets.length === 0 ? (
        <div
          className={`rounded-lg border border-dashed p-4 text-sm text-muted-foreground ${
            indicatorIndex === 0 ? "border-sky-400 bg-sky-50 text-sky-700" : ""
          }`}
          onDragOver={(event) => handleDragOverSlot(event, 0)}
          onDrop={(event) => handleDropOnSlot(event, 0)}
        >
          まだ いれものが ないよ
        </div>
      ) : (
        <div className="grid gap-1.5">
          <div className="flex flex-wrap items-center gap-2 px-3 text-xs text-muted-foreground">
            <span className="w-4" />
            <span className="w-40">なまえ</span>
            <span className="w-28">しゅるい</span>
            <span className="w-48">メモ</span>
            <span className="w-28 text-right">ざんだか</span>
            <span className="w-16 text-center">ゆうこう</span>
            <span className="w-8 text-center">けす</span>
          </div>
          {orderedAssets.map((asset, index) => (
            <div key={asset.id} className="grid gap-1.5">
              <div
                className="relative h-0.5"
                onDragOver={(event) => handleDragOverSlot(event, index)}
                onDrop={(event) => handleDropOnSlot(event, index)}
              >
                {indicatorIndex === index ? (
                  <span className="absolute left-2 right-2 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-sky-400" />
                ) : null}
              </div>
              <div
                onDragOver={(event) => handleDragOverRow(event, index)}
                onDrop={(event) => handleDropOnRow(event, index)}
              >
                <AssetRow
                  asset={asset}
                  onSave={handleSaveAsset}
                  onToggleActive={handleToggleActive}
                  onDelete={handleDeleteAsset}
                  onDragEnd={handleDragEnd}
                  isDragging={draggingId === asset.id}
                  dragHandleProps={{
                    draggable: true,
                    onDragStart: (event) => handleDragStart(event, asset.id),
                  }}
                />
              </div>
            </div>
          ))}
          <div
            className="relative h-0.5"
            onDragOver={(event) => handleDragOverSlot(event, orderedAssets.length)}
            onDrop={(event) => handleDropOnSlot(event, orderedAssets.length)}
          >
            {indicatorIndex === orderedAssets.length ? (
              <span className="absolute left-2 right-2 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-sky-400" />
            ) : null}
          </div>
        </div>
      )}

      {isSaving ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-lg bg-white/70 backdrop-blur-sm">
          <div className="rounded-lg border bg-card px-4 py-2 text-sm shadow-sm">
            しょりちゅう...
          </div>
        </div>
      ) : null}
    </div>
  );
};
