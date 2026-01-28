import { defineTexts, text, textWith, type TextEntry } from "./helpers";

export const upperTexts = defineTexts({
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
  navSummary: text("概要"),
  navAll: text("取引一覧"),
  navNoAssets: text("いれものがないよ"),
  navAssetsSettings: text("資産設定"),
  navCategoriesSettings: text("カテゴリ設定"),
  navDataSettings: text("データ管理"),
  navPersonalSettings: text("個人設定"),

  // まとめ画面
  dashboardTitle: text("サマリー"),
  dashboardSubtitle: text("現在の状況を確認"),
  dashboardAllLabel: text("全体"),
  dashboardInitialBalance: textWith(({ amount }) => `初期残高 ${amount ?? ""}`.trim()),
  dashboardMonthIncome: text("今月の収入"),
  dashboardMonthExpense: text("今月の支出"),
  dashboardMonthBalance: text("残高"),
  dashboardRecentTitle: text("最近の記録"),
  dashboardRecentEmpty: text("まだ記録がありません"),

  // いれもの
  assetsTitle: text("資産"),
  assetsSubtitle: text("資産ごとの記録を確認"),

  // 元帳タイトル
  ledgerTitleAll: text("資産（全体）"),
  ledgerSubtitleAll: text("全体をまとめて確認"),
  assetLedgerTitle: textWith(({ assetName }) => (assetName ? `資産（${assetName}）` : "資産")),
  assetLedgerSubtitle: textWith(({ balance }) => `残高 ${balance ?? ""}`.trim()),

  // サマリー
  summaryLabel: text("概要"),
  summaryIncome: text("収入"),
  summaryExpense: text("支出"),
  summaryBalance: text("残高"),

  // フィルタ
  filterPresetThisMonth: text("今月"),
  filterPresetLastMonth: text("先月"),
  filterPresetLast30: text("30日間"),
  filterPresetCustom: text("その他"),
  filterPeriodPlaceholder: text("きかん"),
  filterSearchPlaceholder: text("検索（相手/メモ）"),
  filterOrderPlaceholder: text("並び"),
  filterOrderNew: text("新しい"),
  filterOrderOld: text("古い"),
  filterRangeSeparator: text("～"),

  // 元帳のラベル
  labelDate: text("日付"),
  labelAsset: text("資産"),
  labelCounterparty: text("相手"),
  labelMemo: text("メモ"),
  labelCategory: text("カテゴリ"),
  labelAmount: text("金額"),
  labelBalance: text("残高"),
  labelExpense: text("支出"),
  labelIncome: text("収入"),
  labelOther: text("その他"),
  labelTransferFee: text("手数料"),

  // プレースホルダー
  placeholderAsset: text("資産"),
  placeholderCategory: text("カテゴリ"),
  placeholderCounterparty: text("相手"),
  placeholderMemo: text("メモ"),
  placeholderAmount: text("金額"),
  placeholderTransferFrom: text("移動元"),
  placeholderTransferTo: text("移動先"),
  placeholderTransferFee: text("手数料"),

  // 操作
  actionAdd: text("追加"),
  actionSave: text("保存"),
  actionCancel: text("キャンセル"),
  actionDelete: text("削除"),
  actionDrag: text("ドラッグ"),
  actionReorder: text("並び替え"),

  // トースト・確認
  toastLoginRequired: text("ログインしてね"),
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
  transferToOption: textWith(({ assetName }) =>
    assetName ? `→${assetName} へ` : "→"
  ),
  transferFromOption: textWith(({ assetName }) =>
    assetName ? `←${assetName} から` : "←"
  ),

  // 個人設定
  personalSettingsTitle: text("個人設定"),
  personalSettingsGradeTitle: text("学年設定"),
  personalSettingsGradeDescription: text("学年に合わせて表記が変わるよ"),
  personalSettingsGradeLabel: text("いまの学年"),
  personalSettingsGradeNote: text("4月1日以後に初回アクセスすると1学年進むよ"),
  gradeOptionKinder: text("幼稚園以下"),
  gradeOptionGrade1: text("小学校1年生"),
  gradeOptionGrade2: text("小学校2年生"),
  gradeOptionGrade3: text("小学校3年生"),
  gradeOptionGrade4: text("小学校4年生"),
  gradeOptionGrade5: text("小学校5年生"),
  gradeOptionGrade6: text("小学校6年生"),
  gradeOptionUpper: text("中学生以上"),

  // いれもの設定
  assetsSettingsTitle: text("資産設定"),
  assetsSettingsSubtitle: text("資産を追加・編集する"),
  assetsSettingsNewTitle: text("新しい資産"),
  assetsSettingsEmpty: text("資産がまだありません"),
  assetsSettingsName: text("名前"),
  assetsSettingsType: text("種類"),
  assetsSettingsMemo: text("メモ"),
  assetsSettingsInitialBalance: text("初期残高"),
  assetsSettingsInitialBalanceAlt: text("初期残高"),
  assetsSettingsCurrentBalance: text("現在残高"),
  assetsSettingsNoType: text("（種類なし）"),
  assetsSettingsNoMemo: text("（メモなし）"),
  assetsSettingsActive: text("有効"),
  assetsSettingsAdd: text("追加"),
  assetsSettingsSaveAria: text("保存"),
  assetsSettingsCancelAria: text("キャンセル"),
  assetsSettingsDeleteAria: textWith(({ name }) => `${name ?? ""} を削除`.trim()),
  assetsSettingsDragAria: text("ドラッグ"),
  toastNameRequired: text("名前を入力してね"),
  toastInitialBalanceRequired: text("残高を入力してね"),
  toastAssetAdded: text("資産を追加したよ"),
  toastAssetUpdated: text("資産を更新したよ"),
  toastAssetDeleted: text("資産を削除したよ"),
  confirmDeleteAsset: text("この資産を削除する？"),

  // うごき設定
  categoriesSettingsTitle: text("カテゴリ設定"),
  categoriesSettingsSubtitle: text("カテゴリを追加・編集する"),
  categoriesSettingsNewTitle: text("新しいカテゴリ"),
  categoriesSettingsDropHere: text("ここにいれる"),
  categoriesSettingsExpense: text("支出"),
  categoriesSettingsIncome: text("収入"),
  categoriesSettingsAdd: text("追加"),
  toastCategoryAdded: text("カテゴリを追加したよ"),
  toastCategoryUpdated: text("カテゴリを更新したよ"),
  toastCategoryDeleted: text("カテゴリを削除したよ"),
  confirmDeleteCategory: text("このカテゴリを削除する？"),
  toastOtherNotAllowed: text("「その他」は使えません"),
  confirmCategoryMerge: text("同じ名前があります。まとめていい？"),

  // データ管理
  dataSettingsTitle: text("データ管理"),
  dataExportTitle: text("エクスポート"),
  dataExportDescription1: text("すべての取引データをダウンロードします。"),
  dataExportDescription2: text("バックアップや表計算ソフトでの利用に使えます。"),
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

export type TextKey = keyof typeof upperTexts;
export type TextDictionary = Record<TextKey, TextEntry>;
