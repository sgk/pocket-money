import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Trash2, X } from "lucide-react";
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
  isEditing,
  onRequestEdit,
  onRequestClose,
  dragRowProps,
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
  ) => Promise<void>;
  onToggleActive: (id: string, value: boolean) => void;
  onDelete: (id: string) => void;
  onDragEnd: () => void;
  isDragging: boolean;
  isEditing: boolean;
  onRequestEdit: () => void;
  onRequestClose: () => void;
  dragRowProps: {
    draggable: boolean;
    onDragStart: (event: React.DragEvent<HTMLDivElement>) => void;
  };
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
  const rowRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    if (isEditing) {
      return;
    }
    setForm({
      name: asset.name,
      type: asset.type ?? "",
      note: asset.note ?? "",
      initialBalance: String(asset.initialBalance ?? 0),
      isActive: asset.isActive,
    });
    setIsDirty(false);
  }, [asset, isEditing]);

  useEffect(() => {
    if (!isEditing) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      handleCancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isEditing]);

  const handleSave = async () => {
    if (!form.name.trim()) {
      setForm({
        ...form,
        name: asset.name,
      });
      toast.error("なまえを いれてね");
      return false;
    }
    if (!isDirty) {
      return true;
    }
    setIsDirty(false);
    const initialValue = form.initialBalance.trim();
    const parsedInitial = initialValue === "" ? 0 : Number(initialValue);
    if (Number.isNaN(parsedInitial)) {
      toast.error("のこりを いれてね");
      return false;
    }
    await onSave(asset.id, {
      name: form.name.trim(),
      type: form.type.trim(),
      note: form.note.trim(),
      initialBalance: parsedInitial,
      isActive: form.isActive,
    });
    return true;
  };

  const handleChange = (next: Partial<typeof form>) => {
    setForm((prev) => ({ ...prev, ...next }));
    setIsDirty(true);
  };

  const handleRowClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (isEditing) {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (target && target.closest("input, textarea, select, button, a, label")) {
      return;
    }
    onRequestEdit();
  };

  const handleRowBlur = () => {
    window.setTimeout(async () => {
      if (!rowRef.current) {
        return;
      }
      if (rowRef.current.contains(document.activeElement)) {
        return;
      }
      if (!isEditing) {
        return;
      }
      if (isDirty) {
        return;
      }
      onRequestClose();
    }, 0);
  };

  const handleCancel = () => {
    setForm({
      name: asset.name,
      type: asset.type ?? "",
      note: asset.note ?? "",
      initialBalance: String(asset.initialBalance ?? 0),
      isActive: asset.isActive,
    });
    setIsDirty(false);
    onRequestClose();
  };

  const rowOpacityClass = inactive ? (isEditing ? "opacity-50" : "opacity-30") : "";
  const isSaveDisabled = !form.name.trim();

  const DesktopRow = (
    <div
      className={`hidden items-center gap-2 rounded-lg border bg-card/80 px-3 py-1.5 text-sm md:grid md:grid-cols-[16px_minmax(200px,2fr)_minmax(120px,1fr)_minmax(180px,2fr)_104px_48px_112px] md:items-center ${
        rowOpacityClass
      } ${isDragging ? "opacity-40" : ""}`}
      ref={rowRef}
      onClick={handleRowClick}
      onBlurCapture={handleRowBlur}
      {...dragRowProps}
      draggable={!isEditing && dragRowProps.draggable}
      onDragEnd={onDragEnd}
    >
      <div
        className="w-4 cursor-grab text-muted-foreground"
        {...dragHandleProps}
        aria-label="ドラッグ"
      >
        ≡
      </div>
      {isEditing ? (
        <>
          <Input
            placeholder="なまえ"
            value={form.name}
            onChange={(event) => handleChange({ name: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleSave().then((ok) => ok && onRequestClose());
              }
              if (event.key === "Escape") {
                event.preventDefault();
                handleCancel();
              }
            }}
            className="h-8 w-full min-w-0"
          />
          <Input
            placeholder="しゅるい"
            value={form.type}
            onChange={(event) => handleChange({ type: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleSave().then((ok) => ok && onRequestClose());
              }
              if (event.key === "Escape") {
                event.preventDefault();
                handleCancel();
              }
            }}
            className="h-8 w-full min-w-0"
          />
          <Input
            placeholder="メモ"
            value={form.note}
            onChange={(event) => handleChange({ note: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleSave().then((ok) => ok && onRequestClose());
              }
              if (event.key === "Escape") {
                event.preventDefault();
                handleCancel();
              }
            }}
            className="h-8 w-full min-w-0"
          />
          <Input
            type="number"
            placeholder="はじめのおかね"
            value={form.initialBalance}
            onChange={(event) => handleChange({ initialBalance: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleSave().then((ok) => ok && onRequestClose());
              }
              if (event.key === "Escape") {
                event.preventDefault();
                handleCancel();
              }
            }}
            className="h-8 w-full min-w-0 text-right"
          />
        </>
      ) : (
        <>
          <div className="truncate text-sm font-medium">{form.name}</div>
          <div className="truncate text-xs text-muted-foreground">
            {form.type ? form.type : "（しゅるいなし）"}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {form.note ? form.note : "（メモなし）"}
          </div>
          <div className="text-right text-sm tabular-nums">
            {formatJPY(Number(form.initialBalance || 0))}
          </div>
        </>
      )}
      {isEditing ? (
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
      ) : (
        <div />
      )}
      <div className="flex items-center justify-end">
        {isEditing ? (
          <div className="flex items-center justify-end gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(event) => {
                event.stopPropagation();
                void handleSave().then((ok) => ok && onRequestClose());
              }}
              aria-label="ほぞん"
              disabled={isSaveDisabled}
            >
              <Check className="h-4 w-4 text-emerald-600" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(event) => {
                event.stopPropagation();
                handleCancel();
              }}
              aria-label="キャンセル"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(event) => {
                event.stopPropagation();
                onDelete(asset.id);
              }}
              aria-label={`${asset.name} を けす`}
            >
              <Trash2 className="h-4 w-4 text-rose-600" />
            </Button>
          </div>
        ) : (
          <Link
            to={`/assets/${asset.id}/ledger`}
            className="text-sm underline underline-offset-4 text-[LinkText] visited:text-[VisitedText]"
          >
            {formatJPY(asset.currentBalance)}
          </Link>
        )}
      </div>
    </div>
  );

  const MobileRow = (
    <div
      className={`flex flex-col gap-3 rounded-lg border bg-card/80 p-3 text-sm md:hidden ${
        rowOpacityClass
      } ${isDragging ? "opacity-40" : ""}`}
      ref={rowRef}
      onClick={handleRowClick}
      onBlurCapture={handleRowBlur}
      {...dragRowProps}
      draggable={!isEditing && dragRowProps.draggable}
      onDragEnd={onDragEnd}
    >
      <div className="flex items-center gap-3">
        <div
          className="cursor-grab text-muted-foreground p-1"
          {...dragHandleProps}
          aria-label="ドラッグ"
        >
          ≡
        </div>
        <div className="flex-1">
          {isEditing ? (
            <Input
              placeholder="なまえ"
              value={form.name}
              onChange={(event) => handleChange({ name: event.target.value })}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleSave().then((ok) => ok && onRequestClose());
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  handleCancel();
                }
              }}
              className="h-9 font-medium"
            />
          ) : (
            <div className="text-sm font-semibold">{form.name}</div>
          )}
        </div>
      </div>
      
      {isEditing ? (
        <div className="flex gap-2">
          <Input
            placeholder="しゅるい"
            value={form.type}
            onChange={(event) => handleChange({ type: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleSave().then((ok) => ok && onRequestClose());
              }
              if (event.key === "Escape") {
                event.preventDefault();
                handleCancel();
              }
            }}
            className="h-8 flex-1 min-w-0 text-xs"
          />
          <Input
            placeholder="メモ"
            value={form.note}
            onChange={(event) => handleChange({ note: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleSave().then((ok) => ok && onRequestClose());
              }
              if (event.key === "Escape") {
                event.preventDefault();
                handleCancel();
              }
            }}
            className="h-8 flex-1 min-w-0 text-xs"
          />
        </div>
      ) : null}

      <div className="flex flex-col gap-2 pt-1">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">はじめのおかね</span>
            {isEditing ? (
              <Input
                type="number"
                value={form.initialBalance}
                onChange={(event) => handleChange({ initialBalance: event.target.value })}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void handleSave().then((ok) => ok && onRequestClose());
                  }
                  if (event.key === "Escape") {
                    event.preventDefault();
                    handleCancel();
                  }
                }}
                className="h-8 w-24 text-right text-xs"
              />
            ) : (
              <span className="text-xs font-semibold tabular-nums">
                {formatJPY(Number(form.initialBalance || 0))}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">いまののこり</span>
            <Link
              to={`/assets/${asset.id}/ledger`}
              className="font-bold text-sky-700 underline-offset-4 hover:underline whitespace-nowrap"
            >
              {formatJPY(asset.currentBalance)}
            </Link>
          </div>
          <div className="flex items-center gap-3 ml-auto sm:ml-0">
            {isEditing ? (
              <>
                <label className="flex items-center text-xs text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(event) => {
                      const next = event.target.checked;
                      setForm({ ...form, isActive: next });
                      onToggleActive(asset.id, next);
                    }}
                    className="translate-y-px"
                    aria-label="ゆうこう"
                  />
                </label>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                  onClick={(event) => {
                    event.stopPropagation();
                void handleSave().then((ok) => ok && onRequestClose());
                  }}
                  aria-label="ほぞん"
                  disabled={isSaveDisabled}
                >
                  <Check className="h-4 w-4 text-emerald-600" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleCancel();
                  }}
                  aria-label="キャンセル"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(asset.id);
                  }}
                  aria-label={`${asset.name} を けす`}
                >
                  <Trash2 className="h-4 w-4 text-rose-600" />
                </Button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {DesktopRow}
      {MobileRow}
    </>
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
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [savingCount, setSavingCount] = useState(0);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [indicatorIndex, setIndicatorIndex] = useState<number | null>(null);
  const isSaving = savingCount > 0;
  const canCreate = Boolean(newAsset.name.trim());

  useEffect(() => {
    const ids = [...assets]
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((asset) => asset.id);
    setOrder(ids);
  }, [assets]);

  useEffect(() => {
    if (!editingAssetId) {
      return;
    }
    if (!assets.some((asset) => asset.id === editingAssetId)) {
      setEditingAssetId(null);
    }
  }, [assets, editingAssetId]);

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
    const target = event.target as HTMLElement | null;
    if (target && target.closest("input, textarea, select, button, a")) {
      event.preventDefault();
      return;
    }
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
      if (editingAssetId === id) {
        setEditingAssetId(null);
      }
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
        dense
      />

      <div
        className="sticky z-20 -mx-4 border-b bg-card px-4 pb-1 pt-1 backdrop-blur md:-mx-6 md:px-6"
        style={{ top: topbarHeight }}
      >
        <div className="shrink-0">
        <div className="pb-1 md:pb-0 pt-2">
          <div className="text-base font-semibold leading-none">あたらしい いれもの</div>
        </div>
        <div className="grid gap-2 pb-2 md:flex md:items-center">
          <div className="flex gap-2 md:contents">
             <Input
                placeholder="なまえ"
                value={newAsset.name}
                onChange={(event) => setNewAsset({ ...newAsset, name: event.target.value })}
                className="flex-[3] md:flex-[3]"
              />
              <Input
                placeholder="しゅるい"
                value={newAsset.type}
                onChange={(event) => setNewAsset({ ...newAsset, type: event.target.value })}
                className="flex-[2] md:flex-[2]"
              />
          </div>
          <Input
            placeholder="メモ"
            value={newAsset.note}
            onChange={(event) => setNewAsset({ ...newAsset, note: event.target.value })}
            className="md:flex-[3]"
          />
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">さいしょのおかね</span>
            <Input
              type="number"
              placeholder="0"
              value={newAsset.initialBalance}
              onChange={(event) =>
                setNewAsset({ ...newAsset, initialBalance: event.target.value })
              }
              className="w-24 text-right"
            />
            <Button onClick={handleCreate} className="w-auto" disabled={!canCreate || isSaving}>
              ついか
            </Button>
          </div>
        </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 pt-2">
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
            <div className="hidden md:grid grid-cols-[16px_minmax(200px,2fr)_minmax(120px,1fr)_minmax(180px,2fr)_104px_48px_112px] items-center gap-2 px-3 text-xs text-muted-foreground">
              <span />
              <span>なまえ</span>
              <span>しゅるい</span>
              <span>メモ</span>
              <span>はじめのおかね</span>
              <span />
              <span className="text-right">いまののこり</span>
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
                    isEditing={editingAssetId === asset.id}
                    onRequestEdit={() => setEditingAssetId(asset.id)}
                    onRequestClose={() => setEditingAssetId(null)}
                    dragRowProps={{
                      draggable: true,
                      onDragStart: (event) => handleDragStart(event, asset.id),
                    }}
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

    </div>
  );
};
