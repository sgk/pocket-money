import { useMemo } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAssets, useMonthlySummary, useTransactions } from "@/lib/query";
import { formatJPY } from "@/lib/money";
import { formatDate, formatDateSlash } from "@/lib/date";
import { endOfMonth } from "date-fns";

export const DashboardPage = () => {
  const { data: assets = [] } = useAssets();
  const now = new Date();
  const { data: summary } = useMonthlySummary(now.getFullYear(), now.getMonth() + 1);
  const { data } = useTransactions({
    from: formatDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: formatDate(endOfMonth(new Date(now.getFullYear(), now.getMonth(), 1))),
    limit: 200,
  });
  const transactions = data.items;

  const totalBalance = useMemo(
    () => assets.reduce((sum, asset) => sum + asset.currentBalance, 0),
    [assets]
  );
  const totalInitial = useMemo(
    () => assets.reduce((sum, asset) => sum + asset.initialBalance, 0),
    [assets]
  );

  const recent = transactions.slice(0, 10);

  return (
    <div className="flex min-h-0 flex-col">
      <Topbar title="まとめ" subtitle="いまのようすを みよう" dense />

      <div className="flex-1 min-h-0 overflow-y-auto pt-3 pb-4 md:pt-4 md:pb-6">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Card>
            <Link
              to="/ledger"
              className="block h-full transition hover:-translate-y-1 hover:shadow-elevated focus:outline-none"
            >
              <CardHeader>
                <CardTitle className="text-base">ぜんぶ</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold text-sky-700">
                  {formatJPY(totalBalance)}
                </p>
                <p className="text-xs text-muted-foreground">
                  はじめののこり {formatJPY(totalInitial)}
                </p>
              </CardContent>
            </Link>
          </Card>
          {assets.map((asset) => (
            <Card key={asset.id}>
              <Link
                to={`/assets/${asset.id}/ledger`}
                className="block h-full transition hover:-translate-y-1 hover:shadow-elevated focus:outline-none"
              >
                <CardHeader>
                  <CardTitle className="text-base">{asset.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold text-sky-700">
                    {formatJPY(asset.currentBalance)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    はじめののこり {formatJPY(asset.initialBalance)}
                  </p>
                </CardContent>
              </Link>
            </Card>
          ))}
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">こんげつ いれた</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-emerald-600">
                {formatJPY(summary?.incomeTotal ?? 0)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">こんげつ だした</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-rose-600">
                {formatJPY(summary?.expenseTotal ?? 0)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">のこり</CardTitle>
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
              <CardTitle className="text-base">さいきんの きろく</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recent.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    まだ きろくが ありません
                  </p>
                ) : (
                  recent.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between rounded-md border bg-muted/40 p-3"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {tx.type === "transfer"
                            ? `${tx.fromAssetName ?? ""} → ${tx.toAssetName ?? ""}`
                            : tx.assetName ?? ""}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {tx.type === "expense"
                            ? `${tx.categoryName ?? ""} / ${tx.merchant ?? ""}`
                            : tx.type === "income"
                              ? `${tx.categoryName ?? ""} / ${tx.source ?? ""}`
                              : tx.memo ?? ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">
                          {formatJPY(tx.amount)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateSlash(tx.occurredAt)}
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
    </div>
  );
};
