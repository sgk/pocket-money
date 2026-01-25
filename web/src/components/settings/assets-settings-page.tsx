import { useEffect, useMemo, useRef, useState } from "react";
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
    payload: {
      name: string;
      type: string;
      note: string;
      initialBalance: number;
      isActive: boolean;
    }
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
    initialBalance: String(asset.initialBalance ?? 0),
    isActive: asset.isActive,
  });
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setForm({
      name: asset.name,
      type: asset.type ?? "",
      note: asset.note ?? "",
      initialBalance: String(asset.initialBalance ?? 0),
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
    const initialValue = form.initialBalance.trim();
    const parsedInitial = initialValue === "" ? 0 : Number(initialValue);
    if (Number.isNaN(parsedInitial)) {
      toast.error("のこりを いれてね");
      return;
    }
    onSave(asset.id, {
      name: form.name.trim(),
      type: form.type.trim(),
      note: form.note.trim(),
      initialBalance: parsedInitial,
      isActive: form.isActive,
    });
  };

  const handleChange = (next: Partial<typeof form>) => {
    setForm((prev) => ({ ...prev, ...next }));
    setIsDirty(true);
  };

  return (
    <div
      className={`flex flex-wrap items-center gap-2 rounded-lg border bg-card/80 px-3 py-1.5 text-sm md:grid md:grid-cols-[16px_minmax(200px,2fr)_minmax(140px,1fr)_minmax(200px,2fr)_120px_112px_64px_32px] md:items-center ${
        inactive ? "opacity-50" : ""
      } ${isDragging ? "opacity-40" : ""}`}
      onDragEnd={onDragEnd}
    >
      <div
        className="w-4 cursor-grab text-muted-foreground"
        {...dragHandleProps}
        aria-label="ドラッグ"
      >
        ≡
      </div>
      <Input
        placeholder="なまえ"
        value={form.name}
        onChange={(event) => handleChange({ name: event.target.value })}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            handleSave();
          }
        }}
        onBlur={handleSave}
        className="h-8 w-full min-w-0"
      />
      <Input
        placeholder="しゅるい"
        value={form.type}
        onChange={(event) => handleChange({ type: event.target.value })}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            handleSave();
          }
        }}
        onBlur={handleSave}
        className="h-8 w-full min-w-0"
      />
      <Input
        placeholder="メモ"
        value={form.note}
        onChange={(event) => handleChange({ note: event.target.value })}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            handleSave();
          }
        }}
        onBlur={handleSave}
        className="h-8 w-full min-w-0"
      />
      <Input
        type="number"
        placeholder="はじめののこり"
        value={form.initialBalance}
        onChange={(event) => handleChange({ initialBalance: event.target.value })}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            handleSave();
          }
        }}
        onBlur={handleSave}
        className="h-8 w-full min-w-0 text-right"
      />
      <Link
        to={`/assets/${asset.id}/ledger`}
        className="w-full text-right text-sm font-semibold text-sky-700 underline-offset-4 hover:underline"
      >
        {formatJPY(asset.currentBalance)}
      </Link>
      <label className="flex items-center justify-center">
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
      <div className="flex items-center justify-center">
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
    note: "",
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
          note: newAsset.note || undefined,
          sortOrder: nextSortOrder,
        });
      });
      toast.success("いれものを たしたよ");
      setNewAsset({ name: "", type: "", initialBalance: "0", note: "" });
      queryClient.invalidateQueries({ queryKey: ["assets"] });
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleSaveAsset = async (
    id: string,
    payload: {
      name: string;
      type: string;
      note: string;
      initialBalance: number;
      isActive: boolean;
    }
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
          initialBalance: payload.initialBalance,
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

  const topbarRef = useRef<HTMLElement>(null);
  const [topbarHeight, setTopbarHeight] = useState(0);

  useEffect(() => {
    const update = () => {
      if (topbarRef.current) {
        setTopbarHeight(topbarRef.current.getBoundingClientRect().height);
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return (
    <div className="relative flex min-h-0 flex-col">
      <Topbar
        ref={topbarRef}
        title="いれもの設定"
        subtitle="いれものを ふやす / なおす"
      />

      <div
        className="sticky z-20 -mx-4 border-b bg-card/95 px-4 pb-3 backdrop-blur md:-mx-6 md:px-6"
        style={{ top: topbarHeight }}
      >
        <Card className="mb-4 shrink-0">
        <CardHeader>
          <CardTitle className="text-base">あたらしい いれもの</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-[1.1fr_0.9fr_1.1fr_auto_auto] items-center">
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
            placeholder="メモ"
            value={newAsset.note}
            onChange={(event) => setNewAsset({ ...newAsset, note: event.target.value })}
          />
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">のこり</span>
            <Input
              type="number"
              placeholder="0"
              value={newAsset.initialBalance}
              onChange={(event) =>
                setNewAsset({ ...newAsset, initialBalance: event.target.value })
              }
              className="h-8 w-32"
            />
          </div>
          <Button onClick={handleCreate} className="justify-self-end">
            たす
          </Button>
        </CardContent>
        </Card>
      </div>

      <div className="flex-1 min-h-0">
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
            <div className="grid grid-cols-[16px_minmax(200px,2fr)_minmax(140px,1fr)_minmax(200px,2fr)_120px_112px_64px_32px] items-center gap-2 px-3 text-xs text-muted-foreground">
              <span />
              <span>なまえ</span>
              <span>しゅるい</span>
              <span>メモ</span>
              <span>はじめののこり</span>
              <span className="text-right">いまののこり</span>
              <span className="text-center">ゆうこう</span>
              <span className="text-center">けす</span>
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
      </div>

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
