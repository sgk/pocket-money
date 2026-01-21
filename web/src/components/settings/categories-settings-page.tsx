import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useCategories } from "@/lib/query";
import { useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import type { Category } from "@/lib/types";

type CategoryKind = "expense" | "income";

type DropIndicator = {
  id: string;
  position: "before" | "after";
} | null;

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
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  isDragging,
  indicator,
}: {
  category: Category;
  kind: CategoryKind;
  onToggleActive: (id: string, value: boolean) => void;
  onDragStart: (event: React.DragEvent<HTMLDivElement>, id: string) => void;
  onDragOver: (event: React.DragEvent<HTMLDivElement>, id: string) => void;
  onDrop: (event: React.DragEvent<HTMLDivElement>, id: string) => void;
  onDragEnd: () => void;
  isDragging: boolean;
  indicator: DropIndicator;
}) => {
  const inactive = !category.isActive;
  const showBefore = indicator?.id === category.id && indicator.position === "before";
  const showAfter = indicator?.id === category.id && indicator.position === "after";
  return (
    <div
      className={`relative grid grid-cols-[1fr_96px] items-center gap-3 rounded-lg border px-3 py-2 text-sm ${
        inactive ? "opacity-50" : ""
      } ${isDragging ? "opacity-40" : ""}`}
      draggable
      onDragStart={(event) => onDragStart(event, category.id)}
      onDragOver={(event) => onDragOver(event, category.id)}
      onDrop={(event) => onDrop(event, category.id)}
      onDragEnd={onDragEnd}
    >
      {showBefore ? (
        <span className="absolute left-2 right-2 top-0 h-0.5 -translate-y-1/2 rounded-full bg-sky-400" />
      ) : null}
      {showAfter ? (
        <span className="absolute left-2 right-2 bottom-0 h-0.5 translate-y-1/2 rounded-full bg-sky-400" />
      ) : null}
      <div className="flex items-center gap-2">
        <span className="cursor-move text-muted-foreground">≡</span>
        <span>{category.name}</span>
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
}: {
  kind: CategoryKind;
  categories: Category[];
  order: string[];
  setOrder: (next: string[]) => void;
  onReorder: (next: Category[]) => Promise<void>;
  onToggleActive: (id: string, value: boolean) => void;
}) => {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [indicator, setIndicator] = useState<DropIndicator>(null);

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

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>, id: string) => {
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    const position = event.clientY - bounds.top < bounds.height / 2 ? "before" : "after";
    setIndicator({ id, position });
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>, id: string) => {
    event.preventDefault();
    const payload = event.dataTransfer.getData("text/plain");
    const [dragKind, dragId] = payload.split(":");
    const position = indicator?.id === id ? indicator.position : "after";
    setIndicator(null);
    if (!dragId || dragKind !== kind || dragId === id) {
      return;
    }
    const next = [...ordered];
    const fromIndex = next.findIndex((item) => item.id === dragId);
    const toIndex = next.findIndex((item) => item.id === id);
    if (fromIndex < 0 || toIndex < 0) {
      return;
    }
    const [moved] = next.splice(fromIndex, 1);
    let insertIndex = toIndex;
    if (position === "after") {
      insertIndex = toIndex + (fromIndex < toIndex ? 0 : 1);
    } else if (fromIndex < toIndex) {
      insertIndex = toIndex - 1;
    }
    next.splice(insertIndex, 0, moved);
    setOrder(next.map((item) => item.id));
    await onReorder(next);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setIndicator(null);
  };

  return (
    <div className="grid gap-2">
      <div className="grid grid-cols-[1fr_96px] text-xs text-muted-foreground">
        <span>{CATEGORY_KIND_LABEL[kind]}</span>
        <span className="text-center">つかう</span>
      </div>
      {ordered.map((category) => (
        <CategoryRow
          key={category.id}
          category={category}
          kind={kind}
          onToggleActive={onToggleActive}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onDragEnd={handleDragEnd}
          isDragging={draggingId === category.id}
          indicator={indicator}
        />
      ))}
      {ordered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          まだないよ
        </div>
      ) : null}
    </div>
  );
};

const CategoryRowEditor = ({
  category,
  onSave,
}: {
  category: Category;
  onSave: (id: string, payload: { name: string; kind: CategoryKind }) => Promise<void>;
}) => {
  const [form, setForm] = useState({
    name: category.name,
    kind: normalizeKind(category),
  });

  useEffect(() => {
    setForm({
      name: category.name,
      kind: normalizeKind(category),
    });
  }, [category]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{category.name}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <Input
          placeholder="なまえ"
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
        />
        <Select
          value={form.kind}
          onValueChange={(value) => setForm({ ...form, kind: value as CategoryKind })}
        >
          <SelectTrigger>
            <SelectValue placeholder="しゅるい" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="expense">つかった</SelectItem>
            <SelectItem value="income">もらった</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Button onClick={() => onSave(category.id, form)}>ほぞん</Button>
        </div>
      </CardContent>
    </Card>
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

  const handleSaveCategory = async (id: string, payload: { name: string; kind: CategoryKind }) => {
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
      toast.success("つかいみちを なおしたよ");
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
        <CardContent className="grid gap-3 md:grid-cols-3">
          <Input
            placeholder="なまえ"
            value={newCategory.name}
            onChange={(event) => setNewCategory({ ...newCategory, name: event.target.value })}
          />
          <Select
            value={newCategory.kind}
            onValueChange={(value) =>
              setNewCategory({ ...newCategory, kind: value as CategoryKind })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="しゅるい" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="expense">つかった</SelectItem>
              <SelectItem value="income">もらった</SelectItem>
            </SelectContent>
          </Select>
          <div className="md:col-span-3">
            <Button onClick={handleCreate}>たす</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <CategoryList
          kind="expense"
          categories={categories}
          order={expenseOrder}
          setOrder={setExpenseOrder}
          onReorder={handleReorder}
          onToggleActive={handleToggleActive}
        />
        <CategoryList
          kind="income"
          categories={categories}
          order={incomeOrder}
          setOrder={setIncomeOrder}
          onReorder={handleReorder}
          onToggleActive={handleToggleActive}
        />
      </div>

      <section className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">なまえ・しゅるいの へんこう</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {categories.map((category) => (
              <CategoryRowEditor
                key={category.id}
                category={category}
                onSave={handleSaveCategory}
              />
            ))}
          </CardContent>
        </Card>
      </section>

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
