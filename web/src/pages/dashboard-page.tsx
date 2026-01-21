import { useMemo } from "react";
import { addMonths } from "date-fns";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAssets, useCategories, useMonthlySummary, useTransactions } from "@/lib/query";
import { formatJPY } from "@/lib/money";
import { formatDate } from "@/lib/date";

export const DashboardPage = () => {
  const { data: assets = [] } = useAssets();
  const { data: categories = [] } = useCategories();
  const now = new Date();
  const { data: summary } = useMonthlySummary(now.getFullYear(), now.getMonth() + 1);
  const { data } = useTransactions({
    from: formatDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: formatDate(addMonths(new Date(now.getFullYear(), now.getMonth(), 1), 1)),
    limit: 200,
  });
  const transactions = data.items;

  const assetMap = useMemo(
    () => new Map(assets.map((asset) => [asset.id, asset.name])),
    [assets]
  );
  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories]
  );

  const recent = transactions.slice(0, 10);

  return (
    <div>
      <Topbar title="ダッシュボード" subtitle="今月の動きと資産残高" />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {assets.map((asset) => (
          <Card key={asset.id}>
            <CardHeader>
              <CardTitle className="text-base">{asset.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">
                {formatJPY(asset.currentBalance)}
              </p>
              <p className="text-xs text-muted-foreground">
                初期残高 {formatJPY(asset.initialBalance)}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">今月の収入</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-emerald-600">
              {formatJPY(summary?.incomeTotal ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">今月の支出</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-rose-600">
              {formatJPY(summary?.expenseTotal ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">差引</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {formatJPY(summary?.net ?? 0)}
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">最近の取引</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recent.length === 0 ? (
                <p className="text-sm text-muted-foreground">取引がありません</p>
              ) : (
                recent.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between rounded-md border bg-muted/40 p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {tx.type === "transfer"
                          ? `${assetMap.get(tx.fromAssetId) ?? ""} → ${
                              assetMap.get(tx.toAssetId) ?? ""
                            }`
                          : assetMap.get(tx.assetId) ?? ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {tx.type === "expense"
                          ? `${categoryMap.get(tx.categoryId) ?? ""} / ${
                              tx.merchant ?? ""
                            }`
                          : tx.type === "income"
                            ? `${categoryMap.get(tx.categoryId) ?? ""} / ${
                                tx.source ?? ""
                              }`
                            : tx.memo ?? ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">
                        {formatJPY(tx.amount)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(tx.occurredAt)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};
