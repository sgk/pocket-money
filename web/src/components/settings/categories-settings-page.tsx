import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Trash2, X } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useCategories } from "@/lib/query";
import { useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import type { Category } from "@/lib/types";

type CategoryKind = "expense" | "income";

const CATEGORY_KIND_LABEL: Record<CategoryKind, string> = {
  expense: "だした",
  income: "いれた",
};

const normalizeKind = (category: Category): CategoryKind =>
  category.kind === "income" ? "income" : "expense";

const CategoryRow = ({
  category,
  kind,
  onToggleActive,
  onUpdateCategory,
  onDeleteCategory,
  onDragEnd,
  isDragging,
  isEditing,
  onRequestEdit,
  onRequestClose,
  dragRowProps,
  dragHandleProps,
}: {
  category: Category;
  kind: CategoryKind;
  onToggleActive: (id: string, value: boolean) => void;
  onUpdateCategory: (id: string, payload: { name: string }) => Promise<boolean>;
  onDeleteCategory: (id: string) => void;
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
  const inactive = !category.isActive;
  const [name, setName] = useState(category.name);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSubmittedName, setLastSubmittedName] = useState<string | null>(null);
  const rowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setName(category.name);
    setIsSaving(false);
    setLastSubmittedName(null);
  }, [category]);

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

  useEffect(() => {
    if (isEditing) {
      return;
    }
    setName(category.name);
    setLastSubmittedName(null);
  }, [category, isEditing]);

  const handleSave = async () => {
    if (isSaving) {
      return false;
    }
    const trimmed = name.trim();
    if (trimmed === "") {
      setName(category.name);
      toast.error("なまえを いれてね");
      return false;
    }
    if (trimmed === category.name || trimmed === lastSubmittedName) {
      return true;
    }
    setIsSaving(true);
    setLastSubmittedName(trimmed);
    const ok = await onUpdateCategory(category.id, { name: trimmed });
    setIsSaving(false);
    if (!ok) {
      setLastSubmittedName(null);
      setName(category.name);
      return false;
    }
    return true;
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
      if (isSaving || lastSubmittedName !== null) {
        return;
      }
      if (name.trim() !== category.name) {
        return;
      }
      onRequestClose();
    }, 0);
  };

  const handleCancel = () => {
    setName(category.name);
    setLastSubmittedName(null);
    onRequestClose();
  };

  const rowOpacityClass = inactive ? (isEditing ? "opacity-50" : "opacity-30") : "";

  return (
    <div
      className={`grid grid-cols-[1fr_72px_112px] items-center gap-2 rounded-lg border px-3 py-0.5 text-sm ${
        rowOpacityClass
      } ${isDragging ? "opacity-40" : ""}`}
      ref={rowRef}
      onClick={handleRowClick}
      onBlurCapture={handleRowBlur}
      {...dragRowProps}
      draggable={!isEditing && dragRowProps.draggable}
      onDragEnd={onDragEnd}
    >
      <div className="flex items-center gap-2">
        <div
          className="cursor-grab text-muted-foreground"
          {...dragHandleProps}
          aria-label="ドラッグ"
        >
          ≡
        </div>
        {isEditing ? (
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="h-8"
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
          />
        ) : (
          <span className="text-sm font-medium">{name}</span>
        )}
      </div>
      {isEditing ? (
        <div className="flex items-center justify-center">
          <input
            type="checkbox"
            checked={category.isActive}
            onChange={(event) => onToggleActive(category.id, event.target.checked)}
            aria-label={`${CATEGORY_KIND_LABEL[kind]} ${category.name}`}
          />
        </div>
      ) : (
        <div />
      )}
      <div className="flex items-center justify-center">
        {isEditing ? (
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
                onDeleteCategory(category.id);
              }}
              aria-label={`${category.name} を けす`}
            >
              <Trash2 className="h-4 w-4 text-rose-600" />
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
};

const CategoryList = ({
  kind,
  categories,
  order,
  setOrder,
  onReorder,
  onToggleActive,
  onUpdateCategory,
  onDeleteCategory,
  onMoveAcross,
  editingId,
  onEditingChange,
}: {
  kind: CategoryKind;
  categories: Category[];
  order: string[];
  setOrder: (next: string[]) => void;
  onReorder: (next: Category[]) => Promise<void>;
  onToggleActive: (id: string, value: boolean) => void;
  onUpdateCategory: (id: string, payload: { name: string }) => Promise<boolean>;
  onDeleteCategory: (id: string) => void;
  onMoveAcross: (
    fromKind: CategoryKind,
    dragId: string,
    toKind: CategoryKind,
    insertIndex: number
  ) => Promise<void>;
  editingId: string | null;
  onEditingChange: (next: string | null) => void;
}) => {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [indicatorIndex, setIndicatorIndex] = useState<number | null>(null);

  const ordered = useMemo(() => {
    const list = categories
      .filter(
        (category) =>
          normalizeKind(category) === kind && category.name !== "その他"
      )
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const ids = list.map((item) => item.id);
    if (order.length !== ids.length || !order.every((id) => ids.includes(id))) {
      return list;
    }
    const map = new Map(list.map((item) => [item.id, item]));
    return order.map((id) => map.get(id)!).filter(Boolean);
  }, [categories, kind, order]);

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>, id: string) => {
    const target = event.target as HTMLElement | null;
    if (target && target.closest("input, textarea, select, button, a")) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.setData("text/plain", `${kind}:${id}`);
    event.dataTransfer.effectAllowed = "move";
    setDraggingId(id);
  };

  const handleDropAt = async (
    dragKind: CategoryKind,
    dragId: string,
    insertIndex: number,
    sameKind: boolean
  ) => {
    setIndicatorIndex(null);
    if (sameKind) {
      const next = [...ordered];
      const fromIndex = next.findIndex((item) => item.id === dragId);
      if (fromIndex < 0) {
        return;
      }
      const [moved] = next.splice(fromIndex, 1);
      const adjustedIndex = fromIndex < insertIndex ? insertIndex - 1 : insertIndex;
      next.splice(adjustedIndex, 0, moved);
      setOrder(next.map((item) => item.id));
      await onReorder(next);
      return;
    }
    await onMoveAcross(dragKind, dragId, kind, insertIndex);
  };

  const handleDropOnSlot = async (event: React.DragEvent<HTMLDivElement>, index: number) => {
    event.preventDefault();
    const payload = event.dataTransfer.getData("text/plain");
    const [dragKindRaw, dragId] = payload.split(":");
    const dragKind = dragKindRaw as CategoryKind;
    if (!dragId) {
      return;
    }
    await handleDropAt(dragKind, dragId, index, dragKind === kind);
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
    const payload = event.dataTransfer.getData("text/plain");
    const [dragKindRaw, dragId] = payload.split(":");
    const dragKind = dragKindRaw as CategoryKind;
    if (!dragId) {
      return;
    }
    const bounds = event.currentTarget.getBoundingClientRect();
    const before = event.clientY - bounds.top < bounds.height / 2;
    const insertIndex = before ? index : index + 1;
    await handleDropAt(dragKind, dragId, insertIndex, dragKind === kind);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setIndicatorIndex(null);
  };

  return (
    <div className="grid gap-0.5">
      <div className="grid grid-cols-[1fr_72px_112px] items-center gap-2 px-3 text-base">
        <span>{CATEGORY_KIND_LABEL[kind]}</span>
        <span />
        <span />
      </div>
      {ordered.length === 0 ? (
        <div
          className={`rounded-lg border border-dashed p-3 text-sm text-muted-foreground ${
            indicatorIndex === 0 ? "border-sky-400 bg-sky-50 text-sky-700" : ""
          }`}
          onDragOver={(event) => handleDragOverSlot(event, 0)}
          onDrop={(event) => handleDropOnSlot(event, 0)}
        >
          ここにいれる
        </div>
      ) : (
        <div className="grid gap-0.5">
          {ordered.map((category, index) => (
            <div key={category.id} className="grid gap-0.5">
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
                <CategoryRow
                  category={category}
                  kind={kind}
                  onToggleActive={onToggleActive}
                  onUpdateCategory={onUpdateCategory}
                  onDeleteCategory={onDeleteCategory}
                  onDragEnd={handleDragEnd}
                  isDragging={draggingId === category.id}
                  isEditing={editingId === category.id}
                  onRequestEdit={() => onEditingChange(category.id)}
                  onRequestClose={() => onEditingChange(null)}
                  dragRowProps={{
                    draggable: true,
                    onDragStart: (event) => handleDragStart(event, category.id),
                  }}
                  dragHandleProps={{
                    draggable: true,
                    onDragStart: (event) => handleDragStart(event, category.id),
                  }}
                />
              </div>
            </div>
          ))}
          <div
            className="relative h-0.5"
            onDragOver={(event) => handleDragOverSlot(event, ordered.length)}
            onDrop={(event) => handleDropOnSlot(event, ordered.length)}
          >
            {indicatorIndex === ordered.length ? (
              <span className="absolute left-2 right-2 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-sky-400" />
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

export const CategoriesSettingsPage = () => {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const { data: categories = [] } = useCategories();
  const [newCategory, setNewCategory] = useState({
    name: "",
    kind: "expense" as CategoryKind,
  });
  const [expenseOrder, setExpenseOrder] = useState<string[]>([]);
  const [incomeOrder, setIncomeOrder] = useState<string[]>([]);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [savingCount, setSavingCount] = useState(0);
  const isSaving = savingCount > 0;

  useEffect(() => {
    const expenseIds = categories
      .filter(
        (category) => normalizeKind(category) === "expense" && category.name !== "その他"
      )
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((category) => category.id);
    const incomeIds = categories
      .filter(
        (category) => normalizeKind(category) === "income" && category.name !== "その他"
      )
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((category) => category.id);
    setExpenseOrder(expenseIds);
    setIncomeOrder(incomeIds);
  }, [categories]);

  useEffect(() => {
    if (!editingCategoryId) {
      return;
    }
    if (!categories.some((category) => category.id === editingCategoryId)) {
      setEditingCategoryId(null);
    }
  }, [categories, editingCategoryId]);

  const runSaving = async (fn: () => Promise<void>) => {
    setSavingCount((count) => count + 1);
    try {
      await fn();
    } finally {
      setSavingCount((count) => Math.max(0, count - 1));
    }
  };

  const getOrderedList = (kind: CategoryKind, order: string[]) => {
    const list = categories
      .filter(
        (category) => normalizeKind(category) === kind && category.name !== "その他"
      )
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const ids = list.map((item) => item.id);
    if (order.length !== ids.length || !order.every((id) => ids.includes(id))) {
      return list;
    }
    const map = new Map(list.map((item) => [item.id, item]));
    return order.map((id) => map.get(id)!).filter(Boolean);
  };

  const handleCreate = async () => {
    if (!token) {
      toast.error("ログインしてね");
      return;
    }
    if (!newCategory.name.trim()) {
      toast.error("なまえを いれてね");
      return;
    }
    if (newCategory.name.trim() === "その他") {
      toast.error("「その他」は つかえないよ");
      return;
    }
    try {
      await runSaving(async () => {
        const nextSortOrder =
          categories.filter((category) => normalizeKind(category) === newCategory.kind)
            .length + 1;
        await api.createCategory(token, {
          name: newCategory.name,
          sortOrder: nextSortOrder,
          kind: newCategory.kind,
        });
      });
      toast.success("つかいみちを たしたよ");
      setNewCategory({ name: "", kind: "expense" });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
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
        await api.updateCategory(token, id, { isActive: value });
      });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleReorder = async (list: Category[]) => {
    if (!token) {
      toast.error("ログインしてね");
      return;
    }
    try {
      await runSaving(async () => {
        await Promise.all(
          list.map((category, index) =>
            api.updateCategory(token, category.id, {
              sortOrder: index + 1,
            })
          )
        );
      });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!token) {
      toast.error("ログインしてね");
      return;
    }
    const ok = window.confirm("この つかいみちを けす？");
    if (!ok) {
      return;
    }
    try {
      await runSaving(async () => {
        await api.deleteCategory(token, id);
      });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      if (editingCategoryId === id) {
        setEditingCategoryId(null);
      }
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleUpdateCategory = async (
    id: string,
    payload: { name: string }
  ): Promise<boolean> => {
    if (!token) {
      toast.error("ログインしてね");
      return false;
    }
    const nextName = payload.name.trim();
    if (!nextName) {
      toast.error("なまえを いれてね");
      return false;
    }
    if (nextName === "その他") {
      toast.error("「その他」は つかえないよ");
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      return false;
    }
    const conflicts = categories.filter(
      (category) => category.id !== id && category.name === nextName
    );
    if (conflicts.length > 0) {
      const ok = window.confirm("おなじ なまえがあるよ。まとめていい？");
      if (!ok) {
        queryClient.invalidateQueries({ queryKey: ["categories"] });
        return false;
      }
    }
    try {
      await runSaving(async () => {
        await api.updateCategory(token, id, { name: nextName });
        if (conflicts.length > 0) {
          await Promise.all(conflicts.map((item) => api.deleteCategory(token, item.id)));
        }
      });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      return true;
    } catch (error) {
      toast.error((error as Error).message);
      return false;
    }
  };

  const handleMoveAcross = async (
    fromKind: CategoryKind,
    dragId: string,
    toKind: CategoryKind,
    insertIndex: number
  ) => {
    if (!token) {
      toast.error("ログインしてね");
      return;
    }
    const fromOrder = fromKind === "expense" ? expenseOrder : incomeOrder;
    const toOrder = toKind === "expense" ? expenseOrder : incomeOrder;
    const sourceList = getOrderedList(fromKind, fromOrder);
    const targetList = getOrderedList(toKind, toOrder);
    const moving = sourceList.find((item) => item.id === dragId);
    if (!moving) {
      return;
    }
    const nextSource = sourceList.filter((item) => item.id !== dragId);
    const nextTarget = [...targetList];
    const clampedIndex = Math.max(0, Math.min(insertIndex, nextTarget.length));
    nextTarget.splice(clampedIndex, 0, moving);

    if (fromKind === "expense") {
      setExpenseOrder(nextSource.map((item) => item.id));
    } else {
      setIncomeOrder(nextSource.map((item) => item.id));
    }
    if (toKind === "expense") {
      setExpenseOrder(nextTarget.map((item) => item.id));
    } else {
      setIncomeOrder(nextTarget.map((item) => item.id));
    }

    try {
      await runSaving(async () => {
        await Promise.all([
          api.updateCategory(token, dragId, {
            kind: toKind,
            sortOrder: clampedIndex + 1,
          }),
          ...nextTarget.map((category, index) =>
            api.updateCategory(token, category.id, { sortOrder: index + 1 })
          ),
          ...nextSource.map((category, index) =>
            api.updateCategory(token, category.id, { sortOrder: index + 1 })
          ),
        ]);
      });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
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
        title="つかいみち設定"
        subtitle="つかいみちを ふやす / なおす"
        dense
      />

      <div
        className="sticky z-20 -mx-4 border-b bg-card px-4 pb-3 pt-3 backdrop-blur md:-mx-6 md:px-6"
        style={{ top: topbarHeight }}
      >
        <Card className="shrink-0">
        <CardHeader>
          <CardTitle className="text-base">あたらしい つかいみち</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 grid-cols-[auto_1fr_auto] items-center">
          <div className="flex items-center">
            <div className="inline-flex overflow-hidden rounded-md border border-input">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className={`rounded-none px-4 ${
                  newCategory.kind === "expense"
                    ? "bg-secondary text-secondary-foreground"
                    : ""
                }`}
                onClick={() => setNewCategory({ ...newCategory, kind: "expense" })}
              >
                だした
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className={`rounded-none border-l border-input px-4 ${
                  newCategory.kind === "income"
                    ? "bg-secondary text-secondary-foreground"
                    : ""
                }`}
                onClick={() => setNewCategory({ ...newCategory, kind: "income" })}
              >
                いれた
              </Button>
            </div>
          </div>
          <Input
            placeholder="なまえ"
            value={newCategory.name}
            onChange={(event) => setNewCategory({ ...newCategory, name: event.target.value })}
          />
          <div className="flex justify-end">
            <Button onClick={handleCreate}>ついか</Button>
          </div>
        </CardContent>
        </Card>
      </div>

      <div className="flex-1 min-h-0 pt-4">
        <div className="grid gap-6">
          <CategoryList
            kind="expense"
            categories={categories}
            order={expenseOrder}
            setOrder={setExpenseOrder}
            onReorder={handleReorder}
            onToggleActive={handleToggleActive}
            onUpdateCategory={handleUpdateCategory}
            onDeleteCategory={handleDeleteCategory}
            onMoveAcross={handleMoveAcross}
            editingId={editingCategoryId}
            onEditingChange={setEditingCategoryId}
          />
          <CategoryList
            kind="income"
            categories={categories}
            order={incomeOrder}
            setOrder={setIncomeOrder}
            onReorder={handleReorder}
            onToggleActive={handleToggleActive}
            onUpdateCategory={handleUpdateCategory}
            onDeleteCategory={handleDeleteCategory}
            onMoveAcross={handleMoveAcross}
            editingId={editingCategoryId}
            onEditingChange={setEditingCategoryId}
          />
        </div>
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
