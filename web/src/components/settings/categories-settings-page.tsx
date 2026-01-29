import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Trash2, X } from "lucide-react";
import { api, isNetworkError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useCategories } from "@/lib/query";
import { useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import type { Category } from "@/lib/types";
import { useText } from "@/lib/text";

type CategoryKind = "expense" | "income";

const OTHER_CATEGORY_NAME = "その他";

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
  const { t } = useText();
  const inactive = !category.isActive;
  const [name, setName] = useState(category.name);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSubmittedName, setLastSubmittedName] = useState<string | null>(null);
  const rowRef = useRef<HTMLDivElement | null>(null);
  const kindLabel = kind === "income" ? t("categoriesSettingsIncome") : t("categoriesSettingsExpense");

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
      toast.error(t("toastNameRequired"));
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
  const trimmedName = name.trim();
  const isDirty =
    trimmedName !== "" &&
    trimmedName !== category.name &&
    trimmedName !== lastSubmittedName;
  const isSaveDisabled = trimmedName === "" || !isDirty;
  const saveIconClass = isSaveDisabled ? "text-muted-foreground/40" : "text-emerald-600";

  return (
    <div
      className={`grid grid-cols-[1fr_112px] items-center gap-2 rounded-lg border px-3 py-0.5 text-sm ${
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
          aria-label={t("assetsSettingsDragAria")}
        >
          ≡
        </div>
        {isEditing ? (
          <button
            type="button"
            role="switch"
            aria-checked={category.isActive}
            aria-label={`${kindLabel} ${category.name}`}
            className={`relative inline-flex h-5 w-9 items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
              category.isActive ? "border-emerald-500 bg-emerald-500" : "border-input bg-muted"
            }`}
            onClick={(event) => {
              event.stopPropagation();
              onToggleActive(category.id, !category.isActive);
            }}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                category.isActive ? "translate-x-4" : "translate-x-1"
              }`}
            />
          </button>
        ) : null}
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
              aria-label={t("actionSave")}
              disabled={isSaveDisabled}
            >
              <Check className={`h-4 w-4 ${saveIconClass}`} />
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
              aria-label={t("actionCancel")}
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
              aria-label={t("assetsSettingsDeleteAria", { name: category.name })}
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
  const { t } = useText();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [indicatorIndex, setIndicatorIndex] = useState<number | null>(null);
  const dragCounter = useRef(0);
  const kindLabel = kind === "income" ? t("categoriesSettingsIncome") : t("categoriesSettingsExpense");

  const ordered = useMemo(() => {
    const list = categories
      .filter(
        (category) =>
          normalizeKind(category) === kind && category.name !== OTHER_CATEGORY_NAME
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

  const resetDragState = () => {
    setDraggingId(null);
    setIndicatorIndex(null);
    dragCounter.current = 0;
  };

  const clearIndicator = () => {
    setIndicatorIndex(null);
    dragCounter.current = 0;
  };

  useEffect(() => {
    const handleDragEnd = () => resetDragState();
    window.addEventListener("dragend", handleDragEnd);
    window.addEventListener("drop", handleDragEnd);
    return () => {
      window.removeEventListener("dragend", handleDragEnd);
      window.removeEventListener("drop", handleDragEnd);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      resetDragState();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const isNoopDrop = (dragId: string, insertIndex: number) => {
    const fromIndex = ordered.findIndex((item) => item.id === dragId);
    if (fromIndex < 0) {
      return false;
    }
    return insertIndex === fromIndex || insertIndex === fromIndex + 1;
  };

  const handleDropAt = async (
    dragKind: CategoryKind,
    dragId: string,
    insertIndex: number,
    sameKind: boolean
  ) => {
    setIndicatorIndex(null);
    if (sameKind) {
      if (isNoopDrop(dragId, insertIndex)) {
        return;
      }
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
    const payload = event.dataTransfer.getData("text/plain");
    const [dragKindRaw, dragId] = payload.split(":");
    const sameKind = dragKindRaw ? dragKindRaw === kind : Boolean(draggingId);
    const effectiveDragId = dragId || draggingId || "";
    if (sameKind && effectiveDragId && isNoopDrop(effectiveDragId, index)) {
      setIndicatorIndex(null);
      return;
    }
    setIndicatorIndex(index);
  };

  const handleDragOverRow = (event: React.DragEvent<HTMLDivElement>, index: number) => {
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    const before = event.clientY - bounds.top < bounds.height / 2;
    const insertIndex = before ? index : index + 1;
    const payload = event.dataTransfer.getData("text/plain");
    const [dragKindRaw, dragId] = payload.split(":");
    const sameKind = dragKindRaw ? dragKindRaw === kind : Boolean(draggingId);
    const effectiveDragId = dragId || draggingId || "";
    if (sameKind && effectiveDragId && isNoopDrop(effectiveDragId, insertIndex)) {
      setIndicatorIndex(null);
      return;
    }
    setIndicatorIndex(insertIndex);
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
    if (dragKind === kind && isNoopDrop(dragId, insertIndex)) {
      setIndicatorIndex(null);
      return;
    }
    await handleDropAt(dragKind, dragId, insertIndex, dragKind === kind);
  };

  const handleDragEnd = () => {
    resetDragState();
  };

  const handleDragEnterList = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragCounter.current += 1;
  };

  const handleDragLeaveList = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      clearIndicator();
    }
  };

  return (
    <div
      className="grid gap-0.5"
      onDragEnter={handleDragEnterList}
      onDragLeave={handleDragLeaveList}
    >
      <div className="grid grid-cols-[1fr_112px] items-center gap-2 px-3 text-base">
        <span>{kindLabel}</span>
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
          {t("categoriesSettingsDropHere")}
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
  const { t } = useText();
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
  const canCreate = Boolean(newCategory.name.trim());

  useEffect(() => {
    const expenseIds = categories
      .filter(
        (category) => normalizeKind(category) === "expense" && category.name !== OTHER_CATEGORY_NAME
      )
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((category) => category.id);
    const incomeIds = categories
      .filter(
        (category) => normalizeKind(category) === "income" && category.name !== OTHER_CATEGORY_NAME
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
        (category) => normalizeKind(category) === kind && category.name !== OTHER_CATEGORY_NAME
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
      toast.error(t("toastLoginRequired"));
      return;
    }
    if (!newCategory.name.trim()) {
      toast.error(t("toastNameRequired"));
      return;
    }
    if (newCategory.name.trim() === OTHER_CATEGORY_NAME) {
      toast.error(t("toastOtherNotAllowed"));
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
      toast.success(t("toastCategoryAdded"));
      setNewCategory({ name: "", kind: "expense" });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    } catch (error) {
      toast.error(isNetworkError(error) ? t("toastNetworkError") : t("toastUnexpectedError"));
    }
  };

  const handleToggleActive = async (id: string, value: boolean) => {
    if (!token) {
      toast.error(t("toastLoginRequired"));
      return;
    }
    try {
      await runSaving(async () => {
        await api.updateCategory(token, id, { isActive: value });
      });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    } catch (error) {
      toast.error(isNetworkError(error) ? t("toastNetworkError") : t("toastUnexpectedError"));
    }
  };

  const handleReorder = async (list: Category[]) => {
    if (!token) {
      toast.error(t("toastLoginRequired"));
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
      toast.error(isNetworkError(error) ? t("toastNetworkError") : t("toastUnexpectedError"));
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!token) {
      toast.error(t("toastLoginRequired"));
      return;
    }
    const ok = window.confirm(t("confirmDeleteCategory"));
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
      toast.error(isNetworkError(error) ? t("toastNetworkError") : t("toastUnexpectedError"));
    }
  };

  const handleUpdateCategory = async (
    id: string,
    payload: { name: string }
  ): Promise<boolean> => {
    if (!token) {
      toast.error(t("toastLoginRequired"));
      return false;
    }
    const nextName = payload.name.trim();
    if (!nextName) {
      toast.error(t("toastNameRequired"));
      return false;
    }
    if (nextName === OTHER_CATEGORY_NAME) {
      toast.error(t("toastOtherNotAllowed"));
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      return false;
    }
    const conflicts = categories.filter(
      (category) => category.id !== id && category.name === nextName
    );
    if (conflicts.length > 0) {
      const ok = window.confirm(t("confirmCategoryMerge"));
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
      toast.error(isNetworkError(error) ? t("toastNetworkError") : t("toastUnexpectedError"));
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
      toast.error(t("toastLoginRequired"));
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
      toast.error(isNetworkError(error) ? t("toastNetworkError") : t("toastUnexpectedError"));
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
        title={t("categoriesSettingsTitle")}
        subtitle={t("categoriesSettingsSubtitle")}
        dense
      />

      <div
        className="sticky z-20 -mx-4 border-b bg-card px-4 pb-2 pt-2 backdrop-blur md:-mx-6 md:px-6"
        style={{ top: topbarHeight }}
      >
        <div className="shrink-0">
        <div className="pb-1">
          <div className="text-base font-semibold">{t("categoriesSettingsNewTitle")}</div>
        </div>
        <div className="grid gap-3 grid-cols-[auto_1fr_auto] items-center">
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
                {t("categoriesSettingsExpense")}
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
                {t("categoriesSettingsIncome")}
              </Button>
            </div>
          </div>
          <Input
            placeholder={t("assetsSettingsName")}
            value={newCategory.name}
            onChange={(event) => setNewCategory({ ...newCategory, name: event.target.value })}
          />
          <div className="flex justify-end">
            <Button onClick={handleCreate} disabled={!canCreate || isSaving}>
              {t("categoriesSettingsAdd")}
            </Button>
          </div>
        </div>
        </div>
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

    </div>
  );
};
