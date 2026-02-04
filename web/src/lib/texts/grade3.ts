import { defineTexts, text, textWith, type TextEntry } from "./helpers";
import { grade5Texts } from "./grade5";
import type { TextKey } from "./upper";

export const grade3Texts = defineTexts<Record<TextKey, TextEntry>>({
  ...grade5Texts,
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
  loginNetworkError: text("つうしんエラーが おきたよ。でんぱや つうしんを かくにんしてね。"),

  // ナビゲーション
  navSummary: text("まとめ"),
  navAll: text("ぜんぶ"),
  navNoAssets: text("いれものがないよ"),
  navSettings: text("せってい"),
  navAssetsSettings: text("いれもの設定"),
  navCategoriesSettings: text("うごき設定"),
  navDataSettings: text("データ管理"),
  navPersonalSettings: text("個人設定"),
  settingsTitle: text("せってい"),
  settingsSubtitle: text("せっていを まとめてみる"),
  settingsSectionBasic: text("きほんの せってい"),

  // まとめ画面
  dashboardTitle: text("まとめ"),
  dashboardSubtitle: text("いまのようすを見よう"),
  dashboardAllLabel: text("ぜんぶ"),
  dashboardInitialBalance: textWith(({ amount }) => `初めののこり ${amount ?? ""}`.trim()),
  dashboardMonthIncome: text("今月 いれた"),
  dashboardMonthExpense: text("今月 だした"),
  dashboardMonthBalance: text("のこり"),
  dashboardRecentTitle: text("さいきんの記録"),
  dashboardRecentEmpty: text("まだ きろくが ありません"),

  // いれもの
  assetsTitle: text("いれもの"),
  assetsSubtitle: text("いれものごとのノートを見よう"),

  // 元帳タイトル
  ledgerTitleAll: text("いれもの（ぜんぶ）"),
  ledgerSubtitleAll: text("ぜんぶまとめて見よう"),
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
  filterPresetThisMonth: text("今月"),
  filterPresetLastMonth: text("先月"),
  filterPresetLast30: text("30日"),
  filterPresetCustom: text("その他"),
  filterPeriodPlaceholder: text("きかん"),
  filterSearchPlaceholder: text("さがす（あいて/メモ）"),
  filterOrderPlaceholder: text("ならび"),
  filterOrderNew: text("あたらしい"),
  filterOrderOld: text("ふるい"),
  filterRangeSeparator: text("～"),

  // 元帳のラベル
  labelDate: text("日付"),
  labelAsset: text("いれもの"),
  labelCounterparty: text("あいて"),
  labelMemo: text("メモ"),
  labelCategory: text("うごき"),
  labelAmount: text("金がく"),
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
  toastNetworkError: text("つうしんエラーが おきたよ。でんぱや つうしんを かくにんしてね。"),
  toastUnexpectedError: text(
    "エラーが おきたよ。よく おきるなら アプリを さい読みこみ してね。なおらないなら おとなのひとに つたえてね。"
  ),
  confirmDeleteEntry: text("この きろくを けす？"),
  dialogEditEntryTitle: text("きろくを なおす"),
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
  personalSettingsGradeDescription: text("学年にあわせて ことばが かわるよ"),
  personalSettingsGradeLabel: text("いまの学年"),
  personalSettingsGradeNote: text("4月1日をすぎて はじめて ひらいたときに ひとつ すすむよ"),
  gradeOptionKinder: text("幼稚園以下"),
  gradeOptionGrade1: text("小学校1年生"),
  gradeOptionGrade2: text("小学校2年生"),
  gradeOptionGrade3: text("小学校3年生"),
  gradeOptionGrade4: text("小学校4年生"),
  gradeOptionGrade5: text("小学校5年生"),
  gradeOptionGrade6: text("小学校6年生"),
  gradeOptionUpper: text("中学生以上"),

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
  dataRecalculateTitle: text("残高の再計算"),
  dataRecalculateDescription: text("もし元帳の残高が合わない場合は、再計算を試してください。計算しなおします。"),
  dataRecalculateConfirm: text("全期間の残高を再計算します。よろしいですか？"),
  dataRecalculating: text("計算中..."),
  dataRecalculateButton: text("再計算を実行"),
  toastRecalculateSuccess: text("再計算を予約しました。しばらくすると反映されます。"),
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
