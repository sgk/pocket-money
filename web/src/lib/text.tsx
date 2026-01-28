import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { storage, STORAGE_KEYS } from "@/lib/storage";
import {
  DEFAULT_GRADE,
  GRADE_OPTIONS,
  isGrade,
  promoteGradeIfNeeded,
  type Grade,
} from "@/lib/grade";

type TextParams = {
  amount?: string;
  balance?: string;
  name?: string;
  assetName?: string;
};

type TextEntry = (params?: TextParams) => string;

const text = (value: string): TextEntry => () => value;
const textWith =
  (builder: (params: TextParams) => string): TextEntry =>
  (params) =>
    builder(params ?? {});

const defineTexts = <T extends Record<string, TextEntry>>(texts: T) => texts;

const lower = defineTexts({
  // 共通
  appTitle: text("おこづかいノート"),
  loading: text("じゅんびちゅう..."),
  menuOpen: text("メニューをひらく"),
  menuClose: text("メニューをとじる"),
  userAvatarAlt: text("ユーザー"),
  noEmail: text("メールなし"),
  logout: text("ログアウト"),

  // ログイン
  loginTitle: text("ログイン"),
  loginSubtitle: text("Googleでログインしよう。"),
  loginProcessing: text("ログイン処理中..."),
  loginMissingGoogleId: text("GoogleのIDが未設定です"),
  loginError: text("ログインに失敗しました。もう一度試してください。"),

  // ナビゲーション
  navSummary: text("まとめ"),
  navAll: text("ぜんぶ"),
  navNoAssets: text("いれものがないよ"),
  navAssetsSettings: text("いれもの設定"),
  navCategoriesSettings: text("うごき設定"),
  navDataSettings: text("データ管理"),
  navPersonalSettings: text("個人設定"),

  // まとめ画面
  dashboardTitle: text("まとめ"),
  dashboardSubtitle: text("いまのようすを みよう"),
  dashboardAllLabel: text("ぜんぶ"),
  dashboardInitialBalance: textWith(({ amount }) => `はじめののこり ${amount ?? ""}`.trim()),
  dashboardMonthIncome: text("こんげつ いれた"),
  dashboardMonthExpense: text("こんげつ だした"),
  dashboardMonthBalance: text("のこり"),
  dashboardRecentTitle: text("さいきんの きろく"),
  dashboardRecentEmpty: text("まだ きろくが ありません"),

  // いれもの
  assetsTitle: text("いれもの"),
  assetsSubtitle: text("いれものごとのノートをみよう"),

  // 元帳タイトル
  ledgerTitleAll: text("いれもの（ぜんぶ）"),
  ledgerSubtitleAll: text("ぜんぶまとめて みよう"),
  assetLedgerTitle: textWith(({ assetName }) =>
    assetName ? `いれもの（${assetName}）` : "いれもの"
  ),
  assetLedgerSubtitle: textWith(({ balance }) => `のこり ${balance ?? ""}`.trim()),

  // サマリー
  summaryLabel: text("まとめ"),
  summaryIncome: text("いれた"),
  summaryExpense: text("だした"),
  summaryBalance: text("のこり"),

  // フィルタ
  filterPresetThisMonth: text("こんげつ"),
  filterPresetLastMonth: text("せんげつ"),
  filterPresetLast30: text("30にち"),
  filterPresetCustom: text("そのた"),
  filterPeriodPlaceholder: text("きかん"),
  filterSearchPlaceholder: text("さがす（あいて/メモ）"),
  filterOrderPlaceholder: text("ならび"),
  filterOrderNew: text("あたらしい"),
  filterOrderOld: text("ふるい"),
  filterRangeSeparator: text("～"),

  // 元帳のラベル
  labelDate: text("ひづけ"),
  labelAsset: text("いれもの"),
  labelCounterparty: text("あいて"),
  labelMemo: text("メモ"),
  labelCategory: text("うごき"),
  labelAmount: text("きんがく"),
  labelBalance: text("のこり"),
  labelExpense: text("だした"),
  labelIncome: text("いれた"),
  labelOther: text("その他"),
  labelTransferFee: text("てすうりょう"),

  // プレースホルダー
  placeholderAsset: text("いれもの"),
  placeholderCategory: text("うごき"),
  placeholderCounterparty: text("あいて"),
  placeholderMemo: text("メモ"),
  placeholderAmount: text("きんがく"),
  placeholderTransferFrom: text("うつすまえ"),
  placeholderTransferTo: text("うつしたい"),
  placeholderTransferFee: text("てすうりょう"),

  // 操作
  actionAdd: text("ついか"),
  actionSave: text("ほぞん"),
  actionCancel: text("キャンセル"),
  actionDelete: text("けす"),
  actionDrag: text("ドラッグ"),
  actionReorder: text("ならびかえ"),

  // トースト・確認
  toastLoginRequired: text("ログインしてね"),
  toastAmountRequired: text("きんがくを いれてね"),
  toastAssetRequired: text("いれものを えらんでね"),
  toastCategoryRequired: text("うごきを えらんでね"),
  toastTransferAssetRequired: text("うつす いれものを えらんでね"),
  toastTransferSameAsset: text("おなじ いれものには うつせないよ"),
  toastEntryAdded: text("きろくを たしたよ"),
  toastEntryUpdated: text("きろくを なおしたよ"),
  toastEntryDeleted: text("きろくを けしたよ"),
  confirmDeleteEntry: text("この きろくを けす？"),
  dialogEditEntryTitle: text("きろくを なおす"),
  unknownError: text("わからないエラー"),
  transferToOption: textWith(({ assetName }) =>
    assetName ? `→${assetName} へ` : "→"
  ),
  transferFromOption: textWith(({ assetName }) =>
    assetName ? `←${assetName} から` : "←"
  ),

  // 個人設定
  personalSettingsTitle: text("個人設定"),
  personalSettingsGradeTitle: text("学年設定"),
  personalSettingsGradeDescription: text("学年にあわせて ことばが かわるよ"),
  personalSettingsGradeLabel: text("いまの学年"),
  personalSettingsGradeNote: text("4月1日をすぎて はじめて ひらいたときに ひとつ すすむよ"),

  // いれもの設定
  assetsSettingsTitle: text("いれもの設定"),
  assetsSettingsSubtitle: text("いれものを ふやす / なおす"),
  assetsSettingsNewTitle: text("あたらしい いれもの"),
  assetsSettingsEmpty: text("まだ いれものが ないよ"),
  assetsSettingsName: text("なまえ"),
  assetsSettingsType: text("しゅるい"),
  assetsSettingsMemo: text("メモ"),
  assetsSettingsInitialBalance: text("はじめのおかね"),
  assetsSettingsInitialBalanceAlt: text("さいしょのおかね"),
  assetsSettingsCurrentBalance: text("いまののこり"),
  assetsSettingsNoType: text("（しゅるいなし）"),
  assetsSettingsNoMemo: text("（メモなし）"),
  assetsSettingsActive: text("ゆうこう"),
  assetsSettingsAdd: text("ついか"),
  assetsSettingsSaveAria: text("ほぞん"),
  assetsSettingsCancelAria: text("キャンセル"),
  assetsSettingsDeleteAria: textWith(({ name }) => `${name ?? ""} を けす`.trim()),
  assetsSettingsDragAria: text("ドラッグ"),
  toastNameRequired: text("なまえを いれてね"),
  toastInitialBalanceRequired: text("のこりを いれてね"),
  toastAssetAdded: text("いれものを たしたよ"),
  toastAssetUpdated: text("いれものを なおしたよ"),
  toastAssetDeleted: text("いれものを けしたよ"),
  confirmDeleteAsset: text("この いれものを けす？"),

  // うごき設定
  categoriesSettingsTitle: text("うごき設定"),
  categoriesSettingsSubtitle: text("うごきを ふやす / なおす"),
  categoriesSettingsNewTitle: text("あたらしい うごき"),
  categoriesSettingsDropHere: text("ここにいれる"),
  categoriesSettingsExpense: text("だした"),
  categoriesSettingsIncome: text("いれた"),
  categoriesSettingsAdd: text("ついか"),
  toastCategoryAdded: text("うごきを たしたよ"),
  toastCategoryUpdated: text("うごきを なおしたよ"),
  toastCategoryDeleted: text("うごきを けしたよ"),
  confirmDeleteCategory: text("この うごきを けす？"),
  toastOtherNotAllowed: text("「その他」は つかえないよ"),
  confirmCategoryMerge: text("おなじ なまえがあるよ。まとめていい？"),

  // データ管理
  dataSettingsTitle: text("データ管理"),
  dataExportTitle: text("エクスポート"),
  dataExportDescription1: text("すべての取引データをダウンロードします。"),
  dataExportDescription2: text(
    "バックアップやExcel・スプレッドシート等での利用に使用できます。"
  ),
  dataExporting: text("エクスポート中..."),
  dataExportJson: text("JSON形式でエクスポート"),
  dataExportCsv: text("CSV形式でエクスポート"),
  toastExportJsonSuccess: text("JSONをエクスポートしました"),
  toastExportCsvSuccess: text("CSVをエクスポートしました"),
  toastExportError: text("エクスポートに失敗しました"),
  dataImportTitle: text("インポート (JSON / CSV)"),
  dataImportDescription1: text("JSONまたはCSVファイルから取引データを読み込みます。"),
  dataImportDescription2: text("ファイル形式は拡張子で自動判別されます。"),
  dataImportDescription3: text("既存のデータと同じIDを持つ記録はスキップされ、重複を防ぎます。"),
  dataImportDescription4: text("ファイルはこのカードへドラッグ&ドロップでも読み込めます。"),
  dataImportConfirm: text(
    "これまでのデータに追加で読み込みます。IDが重複するデータはスキップされます。よろしいですか？"
  ),
  toastImportSuccess: text("インポートしました"),
  toastImportError: text("インポートに失敗しました"),
  dataDangerTitle: text("危険な操作"),
  dataDangerDescription: text("データの削除や退会を行います。これらの操作は取り消せません。"),
  dataResetTitle: text("データのリセット"),
  dataResetDescription: text("すべての取引履歴を削除しますが、アカウントは残ります。"),
  dataResetConfirm: text(
    "本当に全ての取引データを削除しますか？この操作は取り消せません。"
  ),
  dataResetDeleting: text("削除中..."),
  dataResetButton: text("全データを削除"),
  toastResetSuccess: text("全てのデータを削除しました"),
  toastResetError: text("削除に失敗しました"),
  dataDeleteAccountTitle: text("退会"),
  dataDeleteAccountDescription: text(
    "アカウントとすべてのデータを完全に削除します。"
  ),
  dataDeleteAccountConfirm: text(
    "本当に退会しますか？全てのデータが完全に削除され、復元できません。"
  ),
  dataDeleteAccountProcessing: text("処理中..."),
  dataDeleteAccountButton: text("退会する"),
  toastDeleteAccountSuccess: text("退会しました"),
  toastDeleteAccountError: text("退会に失敗しました"),
});

type TextKey = keyof typeof lower;
type TextDictionary = Record<TextKey, TextEntry>;

const kinder = defineTexts({
  ...lower,
  dashboardSubtitle: text("いまのようすを みよう"),
  dashboardMonthIncome: text("こんげつ いれた"),
  dashboardMonthExpense: text("こんげつ だした"),
  labelDate: text("ひづけ"),
  labelAmount: text("きんがく"),
  labelBalance: text("のこり"),
  personalSettingsGradeDescription: text("がくねんで ことばが かわるよ"),
  personalSettingsGradeNote: text("4がつ1にちを すぎて はじめて ひらくと ひとつ すすむよ"),
});

const middle = defineTexts({
  ...lower,
  dashboardSubtitle: text("いまのようすを見よう"),
  dashboardInitialBalance: textWith(({ amount }) => `初めののこり ${amount ?? ""}`.trim()),
  dashboardMonthIncome: text("今月 いれた"),
  dashboardMonthExpense: text("今月 だした"),
  dashboardRecentTitle: text("さいきんの記録"),
  assetsSubtitle: text("いれものごとのノートを見よう"),
  ledgerSubtitleAll: text("ぜんぶまとめて見よう"),
  labelDate: text("日付"),
  labelAmount: text("金がく"),
  labelBalance: text("のこり"),
  filterPresetThisMonth: text("今月"),
  filterPresetLastMonth: text("先月"),
  filterPresetLast30: text("30日"),
  filterPresetCustom: text("その他"),
  unknownError: text("不明なエラー"),
});

const upperElem = defineTexts({
  ...lower,
  navSummary: text("サマリー"),
  navAll: text("一覧"),
  navAssetsSettings: text("資産設定"),
  navCategoriesSettings: text("カテゴリ設定"),
  dashboardTitle: text("サマリー"),
  dashboardSubtitle: text("いまの状況を確認"),
  dashboardAllLabel: text("全体"),
  dashboardInitialBalance: textWith(({ amount }) => `初期残高 ${amount ?? ""}`.trim()),
  dashboardMonthIncome: text("今月の収入"),
  dashboardMonthExpense: text("今月の支出"),
  dashboardMonthBalance: text("残高"),
  dashboardRecentTitle: text("最近の記録"),
  dashboardRecentEmpty: text("まだ記録がありません"),
  assetsTitle: text("資産"),
  assetsSubtitle: text("資産ごとのノートを見よう"),
  ledgerTitleAll: text("資産（全体）"),
  ledgerSubtitleAll: text("全体をまとめて確認"),
  assetLedgerTitle: textWith(({ assetName }) => (assetName ? `資産（${assetName}）` : "資産")),
  assetLedgerSubtitle: textWith(({ balance }) => `残高 ${balance ?? ""}`.trim()),
  summaryLabel: text("サマリー"),
  summaryIncome: text("収入"),
  summaryExpense: text("支出"),
  summaryBalance: text("残高"),
  filterPresetThisMonth: text("今月"),
  filterPresetLastMonth: text("先月"),
  filterPresetLast30: text("30日間"),
  filterPresetCustom: text("その他"),
  filterSearchPlaceholder: text("検索（相手/メモ）"),
  filterOrderPlaceholder: text("並び"),
  filterOrderNew: text("新しい"),
  filterOrderOld: text("古い"),
  labelDate: text("日付"),
  labelAsset: text("資産"),
  labelCounterparty: text("相手"),
  labelCategory: text("カテゴリ"),
  labelAmount: text("金額"),
  labelBalance: text("残高"),
  labelExpense: text("支出"),
  labelIncome: text("収入"),
  labelTransferFee: text("手数料"),
  placeholderAsset: text("資産"),
  placeholderCategory: text("カテゴリ"),
  placeholderCounterparty: text("相手"),
  placeholderAmount: text("金額"),
  placeholderTransferFrom: text("移動元"),
  placeholderTransferTo: text("移動先"),
  placeholderTransferFee: text("手数料"),
  actionAdd: text("追加"),
  actionSave: text("保存"),
  actionDelete: text("削除"),
  actionReorder: text("並び替え"),
  toastAmountRequired: text("金額を入力してね"),
  toastAssetRequired: text("資産を選んでね"),
  toastCategoryRequired: text("カテゴリを選んでね"),
  toastTransferAssetRequired: text("移動先の資産を選んでね"),
  toastTransferSameAsset: text("同じ資産には移動できないよ"),
  toastEntryAdded: text("記録を追加したよ"),
  toastEntryUpdated: text("記録を更新したよ"),
  toastEntryDeleted: text("記録を削除したよ"),
  confirmDeleteEntry: text("この記録を削除する？"),
  dialogEditEntryTitle: text("記録を更新"),
  unknownError: text("不明なエラー"),
  transferToOption: textWith(({ assetName }) => (assetName ? `→${assetName} へ` : "→")),
  transferFromOption: textWith(({ assetName }) => (assetName ? `←${assetName} から` : "←")),
  personalSettingsGradeDescription: text("学年に合わせて表記が変わるよ"),
  personalSettingsGradeNote: text("4月1日以後に初回アクセスすると1学年進むよ"),
  assetsSettingsTitle: text("資産設定"),
  assetsSettingsSubtitle: text("資産を追加・編集する"),
  assetsSettingsNewTitle: text("新しい資産"),
  assetsSettingsEmpty: text("資産がまだありません"),
  assetsSettingsName: text("名前"),
  assetsSettingsType: text("種類"),
  assetsSettingsInitialBalance: text("初期残高"),
  assetsSettingsInitialBalanceAlt: text("初期残高"),
  assetsSettingsCurrentBalance: text("現在残高"),
  assetsSettingsNoType: text("（種類なし）"),
  assetsSettingsNoMemo: text("（メモなし）"),
  assetsSettingsActive: text("有効"),
  assetsSettingsAdd: text("追加"),
  assetsSettingsSaveAria: text("保存"),
  assetsSettingsDeleteAria: textWith(({ name }) => `${name ?? ""} を削除`.trim()),
  toastNameRequired: text("名前を入力してね"),
  toastInitialBalanceRequired: text("残高を入力してね"),
  toastAssetAdded: text("資産を追加したよ"),
  toastAssetUpdated: text("資産を更新したよ"),
  toastAssetDeleted: text("資産を削除したよ"),
  confirmDeleteAsset: text("この資産を削除する？"),
  categoriesSettingsTitle: text("カテゴリ設定"),
  categoriesSettingsSubtitle: text("カテゴリを追加・編集する"),
  categoriesSettingsNewTitle: text("新しいカテゴリ"),
  categoriesSettingsExpense: text("支出"),
  categoriesSettingsIncome: text("収入"),
  categoriesSettingsAdd: text("追加"),
  toastCategoryAdded: text("カテゴリを追加したよ"),
  toastCategoryUpdated: text("カテゴリを更新したよ"),
  toastCategoryDeleted: text("カテゴリを削除したよ"),
  confirmDeleteCategory: text("このカテゴリを削除する？"),
  toastOtherNotAllowed: text("「その他」は使えません"),
  confirmCategoryMerge: text("同じ名前があります。まとめていい？"),
  dataExportDescription1: text("すべての取引データをダウンロードします。"),
  dataExportDescription2: text("バックアップや表計算ソフトでの利用に使えます。"),
});

const upper = defineTexts({
  ...upperElem,
  navSummary: text("概要"),
  navAll: text("取引一覧"),
  dashboardSubtitle: text("現在の状況を確認"),
  assetsSubtitle: text("資産ごとの記録を確認"),
  ledgerSubtitleAll: text("全体をまとめて確認"),
  summaryLabel: text("概要"),
  filterSearchPlaceholder: text("検索（相手/メモ）"),
  dataDeleteAccountButton: text("退会する"),
});

const TEXTS: Record<Grade, TextDictionary> = {
  kinder,
  grade1: lower,
  grade2: lower,
  grade3: middle,
  grade4: middle,
  grade5: upperElem,
  grade6: upperElem,
  upper,
};

type TextContextValue = {
  grade: Grade;
  setGrade: (grade: Grade) => void;
  t: (key: TextKey, params?: TextParams) => string;
};

const TextContext = createContext<TextContextValue | undefined>(undefined);

export const TextProvider = ({ children }: { children: React.ReactNode }) => {
  const storedGradeRef = useRef<Grade | null | "unset">("unset");
  if (storedGradeRef.current === "unset") {
    const raw = storage.getGrade();
    storedGradeRef.current = isGrade(raw) ? raw : null;
  }
  const storedGrade = storedGradeRef.current === "unset" ? null : storedGradeRef.current;
  const [grade, setGradeState] = useState<Grade>(storedGrade ?? DEFAULT_GRADE);

  useEffect(() => {
    const now = new Date();
    const baseGrade = storedGrade ?? DEFAULT_GRADE;
    const promoted = promoteGradeIfNeeded(baseGrade, storage.getLastAccessAt(), now);
    if (promoted !== baseGrade) {
      storage.setGrade(promoted);
      setGradeState(promoted);
    } else if (!storedGrade) {
      storage.setGrade(baseGrade);
    }
    storage.setLastAccessAt(now.toISOString());
  }, []);

  useEffect(() => {
    const handler = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEYS.grade) {
        return;
      }
      const next = isGrade(event.newValue) ? event.newValue : DEFAULT_GRADE;
      if (next === grade) {
        return;
      }
      if (!isGrade(event.newValue)) {
        storage.setGrade(next);
      }
      setGradeState(next);
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [grade]);

  const setGrade = (next: Grade) => {
    storage.setGrade(next);
    setGradeState(next);
  };

  const value = useMemo(
    () => ({
      grade,
      setGrade,
      t: (key: TextKey, params?: TextParams) => TEXTS[grade][key](params),
    }),
    [grade]
  );

  return <TextContext.Provider value={value}>{children}</TextContext.Provider>;
};

export const useText = () => {
  const ctx = useContext(TextContext);
  if (!ctx) {
    throw new Error("TextProvider が見つかりません");
  }
  return ctx;
};

export const useGradeOptions = () => GRADE_OPTIONS;
