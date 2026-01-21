import { useEffect, useMemo, useState } from "react";
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
  expense: "つかった",
  income: "もらった",
};

const normalizeKind = (category: Category): CategoryKind =>
  category.kind === "income" ? "income" : "expense";

const CategoryRow = ({
  category,
  kind,
  onToggleActive,
  onUpdateCategory,
  onDragStart,
  onDragEnd,
  isDragging,
  dragHandleProps,
}: {
  category: Category;
  kind: CategoryKind;
  onToggleActive: (id: string, value: boolean) => void;
  onUpdateCategory: (id: string, payload: { name: string; kind: CategoryKind }) => void;
  onDragStart: (event: React.DragEvent<HTMLDivElement>, id: string) => void;
  onDragEnd: () => void;
  isDragging: boolean;
  dragHandleProps: {
    draggable: boolean;
    onDragStart: (event: React.DragEvent<HTMLDivElement>) => void;
  };
}) => {
  const inactive = !category.isActive;
  const [name, setName] = useState(category.name);
  const [currentKind, setCurrentKind] = useState<CategoryKind>(normalizeKind(category));

  useEffect(() => {
    setName(category.name);
    setCurrentKind(normalizeKind(category));
  }, [category]);

  const handleSave = () => {
    if (name.trim() === "") {
      setName(category.name);
      toast.error("なまえを いれてね");
      return;
    }
    if (name !== category.name || currentKind !== normalizeKind(category)) {
      onUpdateCategory(category.id, { name: name.trim(), kind: currentKind });
    }
  };

  return (
    <div
      className={`grid grid-cols-[1fr_72px] items-center gap-2 rounded-lg border px-3 py-1 text-sm ${
        inactive ? "opacity-50" : ""
      } ${isDragging ? "opacity-40" : ""}`}
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
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="h-9"
          onBlur={handleSave}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              handleSave();
            }
          }}
        />
      </div>
      <div className="text-center">
        <input
          type="checkbox"
          checked={category.isActive}
          onChange={(event) => onToggleActive(category.id, event.target.checked)}
          aria-label={`${CATEGORY_KIND_LABEL[kind]} ${category.name}`}
        />
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
  onMoveAcross,
}: {
  kind: CategoryKind;
  categories: Category[];
  order: string[];
  setOrder: (next: string[]) => void;
  onReorder: (next: Category[]) => Promise<void>;
  onToggleActive: (id: string, value: boolean) => void;
  onUpdateCategory: (id: string, payload: { name: string; kind: CategoryKind }) => void;
  onMoveAcross: (
    fromKind: CategoryKind,
    dragId: string,
    toKind: CategoryKind,
    insertIndex: number
  ) => Promise<void>;
}) => {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [indicatorIndex, setIndicatorIndex] = useState<number | null>(null);

  const ordered = useMemo(() => {
    const list = categories
      .filter((category) => normalizeKind(category) === kind)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const ids = list.map((item) => item.id);
    if (order.length !== ids.length || !order.every((id) => ids.includes(id))) {
      return list;
    }
    const map = new Map(list.map((item) => [item.id, item]));
    return order.map((id) => map.get(id)!).filter(Boolean);
  }, [categories, kind, order]);

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>, id: string) => {
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
    <div className="grid gap-1">
      <div className="flex items-center justify-between text-base">
        <span>{CATEGORY_KIND_LABEL[kind]}</span>
        <span className="text-center">つかう</span>
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
        <div className="grid gap-1">
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
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  isDragging={draggingId === category.id}
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
  const [savingCount, setSavingCount] = useState(0);
  const isSaving = savingCount > 0;

  useEffect(() => {
    const expenseIds = categories
      .filter((category) => normalizeKind(category) === "expense")
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((category) => category.id);
    const incomeIds = categories
      .filter((category) => normalizeKind(category) === "income")
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((category) => category.id);
    setExpenseOrder(expenseIds);
    setIncomeOrder(incomeIds);
  }, [categories]);

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
      .filter((category) => normalizeKind(category) === kind)
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

  const handleUpdateCategory = async (id: string, payload: { name: string; kind: CategoryKind }) => {
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
        await api.updateCategory(token, id, payload);
      });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    } catch (error) {
      toast.error((error as Error).message);
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

  return (
    <div className="relative">
      <Topbar title="つかいみち設定" subtitle="つかいみちを ふやす / なおす" />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">あたらしい つかいみち</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-center">
          <Input
            placeholder="なまえ"
            value={newCategory.name}
            onChange={(event) => setNewCategory({ ...newCategory, name: event.target.value })}
          />
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
                つかった
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
                もらった
              </Button>
            </div>
          </div>
          <div className="md:flex md:justify-end">
            <Button onClick={handleCreate}>たす</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6">
        <CategoryList
          kind="expense"
          categories={categories}
          order={expenseOrder}
          setOrder={setExpenseOrder}
          onReorder={handleReorder}
          onToggleActive={handleToggleActive}
          onUpdateCategory={handleUpdateCategory}
          onMoveAcross={handleMoveAcross}
        />
        <CategoryList
          kind="income"
          categories={categories}
          order={incomeOrder}
          setOrder={setIncomeOrder}
          onReorder={handleReorder}
          onToggleActive={handleToggleActive}
          onUpdateCategory={handleUpdateCategory}
          onMoveAcross={handleMoveAcross}
        />
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
