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
      toast.error("ログインしてね");
      return;
    }
    try {
      await api.updateCategory(token, category.id, {
        name: form.name,
        sortOrder: Number(form.sortOrder || 0),
        isActive: form.isActive,
      });
      toast.success("つかいみちを なおしたよ");
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleDelete = async () => {
    if (!token) {
      toast.error("ログインしてね");
      return;
    }
    const ok = window.confirm("この つかいみちを おやすみする？");
    if (!ok) {
      return;
    }
    try {
      await api.deleteCategory(token, category.id);
      toast.success("つかいみちを おやすみにしたよ");
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
          placeholder="なまえ"
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
        />
        <Input
          type="number"
          placeholder="ならび"
          value={form.sortOrder}
          onChange={(event) => setForm({ ...form, sortOrder: event.target.value })}
        />
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
      toast.error("ログインしてね");
      return;
    }
    if (!newCategory.name.trim()) {
      toast.error("なまえを いれてね");
      return;
    }
    try {
      await api.createCategory(token, {
        name: newCategory.name,
        sortOrder: Number(newCategory.sortOrder || 0),
      });
      toast.success("つかいみちを たしたよ");
      setNewCategory({ name: "", sortOrder: "0" });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  return (
    <div>
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
          <Input
            type="number"
            placeholder="ならび"
            value={newCategory.sortOrder}
            onChange={(event) =>
              setNewCategory({ ...newCategory, sortOrder: event.target.value })
            }
          />
          <div className="md:col-span-3">
            <Button onClick={handleCreate}>たす</Button>
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
