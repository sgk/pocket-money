import { useState } from "react";
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

const CategoryRow = ({ category }: { category: Category }) => {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: category.name,
    sortOrder: String(category.sortOrder ?? 0),
    isActive: category.isActive,
  });

  const handleSave = async () => {
    if (!token) {
      toast.error("ログインが必要です");
      return;
    }
    try {
      await api.updateCategory(token, category.id, {
        name: form.name,
        sortOrder: Number(form.sortOrder || 0),
        isActive: form.isActive,
      });
      toast.success("費目を更新しました");
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleDelete = async () => {
    if (!token) {
      toast.error("ログインが必要です");
      return;
    }
    const ok = window.confirm("この費目を非アクティブにしますか？");
    if (!ok) {
      return;
    }
    try {
      await api.deleteCategory(token, category.id);
      toast.success("費目を非アクティブにしました");
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{category.name}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <Input
          placeholder="名前"
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
        />
        <Input
          type="number"
          placeholder="並び順"
          value={form.sortOrder}
          onChange={(event) => setForm({ ...form, sortOrder: event.target.value })}
        />
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

export const CategoriesSettingsPage = () => {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const { data: categories = [] } = useCategories();
  const [newCategory, setNewCategory] = useState({
    name: "",
    sortOrder: "0",
  });

  const handleCreate = async () => {
    if (!token) {
      toast.error("ログインが必要です");
      return;
    }
    if (!newCategory.name.trim()) {
      toast.error("費目名を入力してください");
      return;
    }
    try {
      await api.createCategory(token, {
        name: newCategory.name,
        sortOrder: Number(newCategory.sortOrder || 0),
      });
      toast.success("費目を追加しました");
      setNewCategory({ name: "", sortOrder: "0" });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  return (
    <div>
      <Topbar title="費目管理" subtitle="費目の追加と編集" />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">新規費目</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <Input
            placeholder="名前"
            value={newCategory.name}
            onChange={(event) => setNewCategory({ ...newCategory, name: event.target.value })}
          />
          <Input
            type="number"
            placeholder="並び順"
            value={newCategory.sortOrder}
            onChange={(event) =>
              setNewCategory({ ...newCategory, sortOrder: event.target.value })
            }
          />
          <div className="md:col-span-3">
            <Button onClick={handleCreate}>追加</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {categories.map((category) => (
          <CategoryRow key={category.id} category={category} />
        ))}
      </div>
    </div>
  );
};
