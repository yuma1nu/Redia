# 開発の現在地

更新: 2026-11-07

## 現在

**Redia 0.1.4：名称変更、テーマグループ末尾の追加欄、表示条件を引き継ぐPNGを実装・確認済み。** ボタン／カレンダーからそのテーマへ追加でき、個別テーマのコピーは該当行、全テーマは見出し付きで出力。内部識別子とデータ保存先・DBスキーマ7は維持。配布と確認の詳細は末尾へ記録。

**0.1.3：計画の「すべてのテーマ」をテーマ別グループ表示へ変更。** 未所属は末尾へまとめ、個別テーマは従来の一覧を維持。タイトル列を閉じても見出しを表示し、直下挿入ではテーマを継承。型チェック・単体54件と計画5段階が合格。配布・追加確認は末尾へ記録。

**0.1.2：ユーザー訂正により、計画のバー幅を超えるタイトルを省略せず右へ表示する形へ復元。** 行高36px・文字14px、今日ボタン・テーマ資料並べ替えの修正は維持。型チェックと計画5段階の操作試験が合格。配布・起動結果は末尾に記録。

**0.1.1修正：計画の行高36px・文字14px維持／バー内省略、今日への移動、テーマ集約資料全行の並べ替えを実装・検証済み。** 単体／DB53件、資料8段階・計画5段階・復元3起動が合格。テーマ独自の順序をスキーマ7へ追加し、ページの関連・メモ・資料順は維持する。最新の配布・起動結果は末尾の0.1.1記録を参照。

**Phase 7の総合回帰・画面検証を実施した初期版候補0.1.0。** Phase 1〜6と資料・貼り付け・初期フォーカスの操作を再確認し、52件の単体／DB試験が合格。1366×768／1920×1080、Electron zoom100／125／150%・明暗の12条件×8画面を確認し、拡大時の資料追加ウィンドウの重なりを修正した。フォルダー版とNSISインストーラーをrelease/phase7へ生成し、通常配布先release/win-unpackedにも反映済み。配布版の2回起動／終了が合格。

**全受入完了とは区別する。** A01・A13・A20・A22・A23には、Windows IME実変換・ネイティブ終了案内・PowerPoint実貼り付け・実UNC長時間停止・実OS倍率の手動未確認が残る。Windows操作ツールでテスト用Electron窓を取得できなかった。NSISのインストール・署名・更新も未確認。

ユーザーの指示どおり、利用しながら修正を継続する。[操作ガイド](USER_GUIDE.md)、[継続改修と手動再確認手順](MAINTENANCE.md)、[受入記録](ACCEPTANCE.md) を整備。既存データ・API境界・原本保護・入力保護を維持して、実機残件と利用中の再現可能な問題を次の作業とする。過去の「次はPhase 6／7」の記述は以下の履歴として扱う。

## 2026-11-06 — 計画の単一タイムラインとカレンダー直接操作

- 最新のユーザー指定を仕様・開発手順・AGENTS・README・受入条件へ反映した。日程はstart／endの1組と1本の薄いバーに集約し、当初予定・実績のUIを非表示にした。旧baseline／actual値は移動・伸縮・再起動後も保持する。ライブラリ追加・版変更・DBスキーマ変更・保存先変更なし。公式資料と互換性・描画値・API境界はDECISIONSに記録。
- 未定行は同じ一覧にバーなしで表示。カレンダーのクリックは単日、逆方向も含むドラッグは両端を含む期間を設定する。バーの移動／端の伸縮・Esc取消・Undo／Redo・キーボード操作を維持した。単日もバーにし、タイトルはバーの右へはみ出して表示する。
- + NEWで末尾に未定行、各行の左+で直下へ挿入する。タイトル列の開閉に関係なく最下段のカレンダーから日付付きの行を作れる。名前へ即フォーカス、Enter／blurで確定、空欄／Escで取消。タイトル列の開閉は旧設定互換の任意フラグとして保存する。
- 詳細は右から表示する縦パネルへ変更。タイトル・テーマ・開始／終了・関連ページと関連付けを表示し、背景のカレンダーも操作できる。狭い画面ではパネルを重ねる。月と日のヘッダーを分離、土日の色と背景、行名14px・行高46pxを採用した。カレンダーの独自の高さ制限をなくし、全体のmain領域で縦スクロールする。
- `pnpm typecheck`、`pnpm test`（47件）、`pnpm build` が合格。日程の正逆選択／閏月・境界、片側日付の伸縮、旧比較値保持、直下挿入、開閉設定の旧版互換を新たに確認した。既存の保存競合・障害・下書き保護等も合格。
- `pnpm test:phase5` が実Electronの5段階で合格（最終証跡 `test-artifacts/phase5-0VP0OU/`）。実マウスで単日クリック・逆方向の期間指定・バー移動／終了伸縮／Esc取消、直下挿入・末尾追加・折りたたみ中の最下段追加、即入力・Enter／Esc、右側パネルと複数ページ関連を確認。日付逆転時の入力保持、DB障害と再試行、画面復帰／再起動後の検索・横位置・開閉状態、削除／Undo、異常終了コード17からの復旧と終了直前保存、ページデータと旧比較値の不変も確認した。
- `timeline-light.png`、`timeline-collapsed.png`、`timeline-panel-light.png`、`timeline-panel-dark.png`、`timeline-panel-125.png`を画像で確認した。最終の1100×700／Electron zoom 125%ではパネルを重ねて、カレンダーがタイトル列程度まで縮まらない構成にした。初回試験ではスライド中の画面境界検査が先行して失敗したため、遷移完了を待つよう試験を調整し、全段階を再実行した。
- `pnpm test:focus` が合格（`test-artifacts/focus-GslH49/`）。旧計画作成モーダルの試験を新しい一覧内入力へ更新し、初期フォーカス・即入力・再作成／取消、ほかの登録画面も回帰確認。`pnpm test:clipboard` の2段階も合格（`test-artifacts/clipboard-Bz0rOy/`）。Phase 1〜4の全操作は今回は再実行していない。
- `pnpm exec electron-builder --dir --win --x64 --config.directories.output=release/timeline-direct` が合格。配布用アプリの非起動を確認し、一式を `release/win-unpacked/` へ反映した。exe／ASARハッシュ一致、ASAR内のHTML・JS・CSS・main／preload一致と試験・DBの非同梱を確認（1508エントリー）。`pnpm test:smoke:packaged` の2回起動／終了も合格（`test-artifacts/smoke-VJ5USL/`）。実運用のDBを試験に使っていない。
- `python scripts/verify-handoff.py --with-prototype` が合格（必須15ファイル・リンク26件・A01〜A23・参考試作）。Viteの既存chunk警告は約767kBで継続。署名・インストーラー・更新機構・Windows IME実入力・実OS表示倍率の未確認は維持する。再確認は `pnpm test:manual`。
- 次の作業: ユーザーの利用確認を受け、Phase 6で単一日程の報告PNGプレビュー／コピー、バックアップ・復元／ロールバック・世代管理を実装する。旧比較表示を再導入しない。

## 2026-11-06 — 新規登録画面の初期入力フォーカス

- 共通Modalで、最初の編集可能な入力欄をnative autofocusの対象にしてshowModalし、初回描画前にfocusを設定する。資料追加ではパス／URL欄を常に対象とし、登録済み資料の検索欄との競合を除いた。再描画ごとに再設定せず、利用者が選んだ検索欄などのフォーカスは保持する。再オープン時には最初の欄へ戻す。
- 修正前の実Electronでは、テーマの資料追加を開いた直後に「閉じる」ボタンへフォーカスが移ることを専用試験で再現した。修正後はHOME／テーマ内のページ、テーマ、関連ページ、目録／テーマ／ページからの資料追加、計画行、ページからの計画追加で、テスト側からfocusを設定せずactiveElementを確認し、そのまま文字入力／登録できることを確認した。
- `pnpm typecheck`、`pnpm build` が合格。`pnpm test:focus`（最終は `node scripts/build-test.mjs` → `node scripts/focus.mjs`）が合格（`test-artifacts/focus-FZnxma/`）。再オープン、150ms後のフォーカス保持、資料検索欄へ移動後の入力と再描画でもフォーカスを奪わないことも確認した。試験中のテーマ／HOMEへの遷移は描画を待ってから次を操作するよう調整した。
- `node scripts/clipboard.mjs` の2段階が回帰合格（`test-artifacts/clipboard-AtKyBC/`）。名前付きリンクの貼り付け・Undo／Redo・既存名保持・再試行・再起動後の検索を維持。`node scripts/phase1.mjs` も4段階合格（`test-artifacts/phase1-pTkh8K/`）。新規作成、保存失敗、下書き保護・異常終了復旧が継続して合格。今回は単体試験一式やPhase 2〜5の全操作は再実行せず、対象に適した操作試験を実施した。
- `pnpm exec electron-builder --dir --win --x64 --config.directories.output=release/initial-input-focus` が合格。生成物は `release/initial-input-focus/win-unpacked/`。起動中だった配布用アプリの終了連絡後、非起動を再確認して `release/win-unpacked/` へ一式を反映した。exe／ASARハッシュ一致と生成ASAR内のHTML・JS・CSS・main／preloadの一致を確認。`pnpm test:smoke:packaged` が2回起動／終了に合格（`test-artifacts/smoke-qp6oFQ/`）。
- 依存・API・DB・保存先の変更なし。React／DOMの公式資料と採用理由はDECISIONSへ記録。Viteの既存chunk警告は約766kBで継続。Windows IME実入力や実OS表示倍率、実際のOfficeコピー形式の従来の未確認は維持する。
- `python scripts/verify-handoff.py --with-prototype` も合格（必須15ファイル・ローカルリンク26件・A01〜A23・参考試作）。次の開発段階はPhase 6の報告画像とバックアップ・復元。

## 2026-11-06 — クリップボードの名前付きリンクを資料へ登録

- 資料追加のパス／URL欄へのpasteイベントで、text/htmlのリンク表示文字を新規資料名、hrefを参照先として取り込む。通常のCtrl+Vで利用でき、取得できた名前をURL欄の下の1行へ表示する。名前がなければ従来名で登録し、既存URLの資料名は上書きしない。複数リンク・既存入力中の選択範囲への挿入・Undo／Redoも維持する。
- HTMLは未接続templateで解析し、リンクの文字と認証情報なしのHTTP/HTTPSだけを採用。通常文字にURLがあればそのURLを優先し、異なるHTMLの参照先へ置き換えない。HTMLを画面へ挿入せず、スクリプトを実行しない。バックグラウンドでクリップボードを読まず、貼り付けデータだけを使う。タイトル取得の通信・Microsoft 365へのログイン・追加依存・DB Migration・保存先変更はない。
- 登録APIの任意nameをmainで厳密に検証し、新規URLの初期名にだけ使う。登録の部分失敗でも名前を保持して再試行する。失敗後に参照先を編集した場合は旧参照先由来の名前を解除する。通常のローカル資料名と既存資料の共通情報は維持する。公式資料・互換性・解析量等の設計値はDECISIONSへ記録した。
- `pnpm typecheck`、`pnpm test`（44件）、`pnpm build` が合格。新規単体／DB試験でURLの正規化と共有トークン保持、危険なURL・名前型／制御文字／長さの拒否、名前の初期適用・DB障害時保持・再試行・既存の手動名の保持・再起動を確認した。
- `pnpm test:clipboard` は2段階合格（`test-artifacts/clipboard-S6OVA9/`）。Office風HTMLのファイル名、URL＋HTMLタイトル、複数リンクと一時実ファイルの混在、ネイティブ入力のUndo／Redo、既存名保持、URLとHTML不一致時のURL優先、通常URL、過大な名前／HTML、危険なリンク拒否を実Electronで確認。SQL登録障害後の名前保持／再試行、参照先変更後の旧名解除、再起動後の名称・検索も合格。HTML内のスクリプト非実行・外部画像／iframe要求0件を確認。clipboard-name-preview.pngを画像で確認した。
- `node scripts/phase3.mjs` は既存8プロセスが回帰合格（`test-artifacts/phase3-AkBx8W/`）。資料登録・原本起動・用途メモ・ドラッグ・共通情報・検索・保存障害分離・異常終了復旧・未登録入力の終了保護を維持。Phase 1／2／4／5の全操作は今回は再実行せず、関連ロジックは44件の単体／DB試験で継続確認した。
- `pnpm exec electron-builder --dir --win --x64 --config.directories.output=release/clipboard-link-names` が合格。配布アプリの非起動を再確認して `release/win-unpacked/` へ一式反映し、exe／ASARのハッシュ一致を確認。`pnpm test:smoke:packaged` は2回起動／終了に合格（`test-artifacts/smoke-KJQmUv/`）。ASAR内1508エントリーの生成物一致・試験／ローカルDBの非同梱を確認。Viteの既存chunk警告は約766kBで継続する。
- 未確認: 実際のWord・SharePoint・OneDriveからコピーした場合に提供される形式・名前の有無。検証は合成ClipboardEventと通常貼り付け動作の補完で行い、ユーザーのシステムクリップボードや実資料を試験で読み書きしていない。実確認はコピー元で「リンクをコピー」→資料追加欄で通常のCtrl+V→資料名プレビューと登録名を確認する。書式なし貼り付けやコピー元に名前がない場合は従来名となる。従来のIME実入力・実OS倍率等の未確認も維持する。
- 次の開発段階はPhase 6の報告画像とバックアップ・復元。A07〜A10に関する追加確認をACCEPTANCEへ記録し、既存の手動未確認は繰り上げない。
- `python scripts/verify-handoff.py --with-prototype` も合格（必須15ファイル・ローカルリンク26件・A01〜A23・参考試作）。文書検証と製品の受入結果は区別する。

## 2026-11-06 — Phase 5: 独立した計画とガント

### 変更

- サイドバーの計画を有効にし、全テーマ横断／テーマ別の計画行の作成・編集・削除・並べ替えを実装。日程なしは別一覧、片側日付はマーカー、単日はマイルストーンとして表示する。日／週／月・前後期間・表示開始日・今日へ移動を用意し、行名固定の時間軸と選択行の編集を同じ画面へ配置した。
- 最新予定・当初予定・実績を独立保存。テーマ全行の当初計画の保存は、フィルターで隠れた行の包含・件数・既存基準の置換を確認する。比較は任意で、未入力の実績を補わず、開始だけの実績は今日までの点線と「進行中」を表示。開始／完了で今日を入力し、後から修正できる。
- バーの実マウス移動／両端伸縮、ドラッグ中の日付プレビュー、Esc／pointercancelによる取消、計画用Undo／Redoを実装。本文と入力欄のUndoを横取りしない。複数ページを行へ関連付け、ページから新規行または検索した既存行へ追加できる。ページの本文・状態・期限・確認日は変更しない。
- Migration 6で計画スナップショット・適用済みトークン・表示条件のテーブルを追加。型付きplans API、mainの厳密検証・関連先実在検査・トランザクション・CAS・冪等な再試行を実装。専用の復旧下書きを退避してから確定し、保存失敗／異常終了／通常終了直前の入力を保護する。アーカイブしたテーマの計画は編集を拒否して保持し、復元後に利用できる。
- 計画の検索・テーマ・比較・表示単位／開始日・選択ID・ガント縦横位置を保存し、関連ページから戻る際と再起動後に復元する。表示条件の障害も入力を保持して再試行。終了・バックアップ・アーカイブ前の保存確認へ組み込み、復元操作は計画の保存エラーがあっても妨げない。
- 依存追加・バージョン変更なし。Electron／Reactの既存DOM・CSSとPointer Eventsを採用し、公式資料の確認先、選定理由、上限と保存境界をDECISIONSへ記録。試作・サンプル配列・固定日付・擬似保存は製品へ流用していない。

### 確認結果

Windows x64、Electron 45.2.1／Node 24.22.1／SQLite 3.53.4。一時データのみで検証し、ユーザーの実資料や製品データは試験に使用していない。

| コマンド／確認 | 結果 |
| --- | --- |
| `pnpm typecheck` | 合格。main／preload／renderer／共有型・検証・テスト |
| `pnpm test` | 42件合格。新規計画8件で日付・うるう年・月目盛り・基準保持／置換・後からの行追加・多対多・冪等性・SQL障害ロールバック・競合・アーカイブ・下書き復旧／バックアップ同梱・遅延応答／IME保留・退避失敗・表示条件の保持／再試行を確認 |
| `pnpm build` | 合格。既存のrenderer chunk警告は約764kBで継続、抑制していない |
| `pnpm test:phase5`、最終画像待機調整後の `node scripts/build-test.mjs` → `node scripts/phase5.mjs` | 5段階合格。作成・直接編集・日程なし／片側／単日・複数関連・フィルター外を含む基準・置換案内・実マウス移動／伸縮／Esc取消／行並べ替え・Undo／Redo・進行中／未入力の区別・実績の今日入力・未来日／逆転拒否・DB障害時の入力保持／再試行を確認。画面復帰と再起動後の条件／位置・異常終了後の復旧・終了直前保存も合格 |
| Phase 1〜4の回帰 | `node scripts/phase1.mjs` 4段階、`node scripts/phase2.mjs` 3段階、`node scripts/phase3.mjs` 8プロセス、`node scripts/phase4.mjs` 7段階が合格。最終の復元ガード調整後はPhase 2も再実行して合格。Phase 4検索API往復p95は32.30ms |
| UI画像 | 1366×768の明暗と1100×700／Electron zoom 125%の画像を確認。名前・時間軸・比較のレーン・日程未定・選択行の編集へ到達できる。切替の100ms遷移が終わってから撮影 |
| 配布 | `pnpm exec electron-builder --dir --win --x64 --config.directories.output=release/phase5` 合格。非起動を確認して `release/win-unpacked/` へ一式反映し、exe／ASARのハッシュ一致を確認。未署名・既定アイコンは従来どおり |
| 起動 | `pnpm test:smoke:packaged` と `pnpm test:smoke:dev` がそれぞれ2回起動／終了に合格。plans APIを含む接続、Node権限分離とSQLiteを確認 |
| 配布内容 | ASAR内1508エントリー。HTML・JS・CSS・main／preloadが生成物と一致し、試験シナリオ・DB・試作の非同梱を確認 |
| 文書 | `python scripts/verify-handoff.py --with-prototype` 合格。必須15ファイル・ローカルリンク26件・A01〜A23・参考試作を確認。製品の受入と文書検証は区別 |

最終Phase 5の証跡: `test-artifacts/phase5-g4aKKH/`（plan-light.png、plan-dark.png、plan-125.png、DB・下書き・ログ）。復元ガード調整後の全操作は `phase5-zTk73d/` でも合格。回帰は `phase1-4xXQgz/`、`phase2-uHvqX4/`、`phase3-d8SBwy/`、`phase4-7VMTCI/`。配布版起動は `smoke-hrpcGq/`、開発起動は `smoke-MYa4so/`。すべてtest-artifacts配下の生成物。

最終の追加試験ではページから新規計画行を作成し、所属テーマ・元ページとの関連を継承し、成功後に作成窓を閉じて元のページを維持することも確認した。新規行は当初予定なしで、関連付け／削除後も元ページの各プロパティは不変。追加後の型チェックと文書検証も合格。

途中の試験で、連続した関連追加が直前の入力を落とす箇所を最新バッファ参照へ修正した。Nodeのstrip-only実行で使えないparameter propertyも通常の型付きフィールドへ変更。操作試験では保存完了待ち、退避完了待ち、実マウスのbuttons状態、明暗切替の描画待ちを調整した。合格は上記の最終実行のみを指す。

### 未確認と次の作業

- A16〜A19は自動DB・実Electron操作の証跡に基づき合格。A11は計画の条件／位置保持も部分追加確認。Windows IME実入力、OS表示倍率125%／150%、ネイティブ終了案内／右クリック項目のOS画面での全実選択は従来どおり未確認。再実行は `pnpm test:manual` で計画を開き、IME・実マウス・終了時の案内を確認する。
- 計画の比較運用の負担・大規模なガントの描画負荷・全画面サイズの操作は継続評価。今回の少量行とElectron zoomの確認を、OS倍率／大規模性能の確認に置き換えない。
- 次はPhase 6。対象行／期間／比較・サイズ・解像度を選ぶ報告PNGとElectron画像コピー、PowerPointへの貼り付け、バックアップ復元／自動実行／世代管理を実装・検証する。A20〜A22は未完了のまま保持する。

## 2026-11-06 — 空のリストに残る本文案内を修正

- 原因は本文の空段落用CSSが子孫のすべてのpへ適用され、リスト内の空段落にも疑似要素を表示していたこと。対象を本文直下の唯一の空段落へ限定し、リスト項目や入力済み本文の空行では表示しない。依存・API・保存データの変更なし。
- 一時データの実Electronで修正前の空箇条書きに案内が1件出ることを再現（`test-artifacts/placeholder-repro-lHHXeb/`、期待どおり失敗）。回帰試験に空の箇条書き／番号／チェックリスト、24行の末尾空項目で上下スクロール、入力済み本文の空行では非表示、本文を全消去すると案内が再表示される確認を追加した。疑似要素の計算済みcontentを実DOMで検査する。試験中の全消去手順はリスト構造を残さないCtrl+A／Backspaceへ修正した。
- `pnpm typecheck`、`pnpm build`、`node scripts/build-test.mjs` 後の `node scripts/phase4.mjs` が合格。Phase 4は7段階すべて通過（`test-artifacts/phase4-fPdwXc/`、`BODY_PLACEHOLDER_OK`）。既存Markdown・メニュー・画像・保存障害・復旧・検索の回帰も合格。`empty-list-scrolled.png` を画像で確認し、空の末尾項目に案内が残らないことを確認した。単体試験一式は今回再実行していない。Viteの既存chunkサイズ警告は継続。
- `pnpm exec electron-builder --dir --win --x64 --config.directories.output=release/body-placeholder-fix` が合格。配布アプリの非起動を確認して `release/win-unpacked/` へ一式反映し、exe／ASARのハッシュ一致を確認。`pnpm test:smoke:packaged` は2回起動／終了に合格（`test-artifacts/smoke-hgJiiI/`）。製品データ・ユーザーの実資料は試験に使っていない。
- 次はPhase 5の独立した計画・ガント。今回の修正による追加未確認事項なし。既存のIME実入力・メニュー項目のOS実選択・終了案内・OS倍率の手動未確認は維持する。

## 2026-11-06 — 本文の書式を右クリックへ集約

- 本文上部の標準／見出し・太字等の常設ボタンと入力補足を除去し、約38pxの縦スペースを削減。段落、太字・斜体、各リスト、リンク、画像追加、画像の拡大／参照削除、チェック項目のページ化を右クリックへ集約した。Shift+F10でも開く。Markdown入力と既存のキーボード操作は維持する。
- Electron 45.2.1の公式Menu／MenuItem資料で互換性を確認。mainが固定メニューを構築し、共有型・入力検証付きbodyMenu APIで固定コマンドだけを返す。選択済み文字を右クリックしても選択を保持し、アーカイブ本文では編集を禁止する。追加依存・DB形式・データ保存先の変更なし。理由と境界はDECISIONSへ記録した。
- `pnpm typecheck`、`pnpm test`（34件）、`pnpm build` が合格。`node scripts/build-test.mjs` 後の `node scripts/phase4.mjs` は7段階合格（`test-artifacts/phase4-5ozFRo/`）。書式の適用、選択保持、Undo／Redo、各リスト、画像操作・ページ化・読み取り専用、Markdown・保存失敗・復旧を確認。検索API往復p95は34.00ms。`node scripts/phase3.mjs` も8プロセス合格（`test-artifacts/phase3-WaleHZ/`）。
- メニュー選択の自動試験はMenu.popupの選択部分を差し替え、実IPCと実MenuItemからエディターまで確認した。実際のpopup／closePopupも別途実行。Windows操作ツールでは独立テスト窓を取得できず、OS画面上で項目を選ぶ実操作は未確認とする。再実行は `pnpm test:manual` で本文を右クリックし、文字選択後の太字、見出し、Undo、画像操作を手動確認する。Shift+F10も同じ入口。既存のIME実入力・終了案内・OS倍率の手動未確認は維持する。
- `pnpm exec electron-builder --dir --win --x64 --config.directories.output=release/body-context-menu` が合格。非起動を確認して `release/win-unpacked/` へ生成物一式を反映し、exe／ASARハッシュ一致を確認。`pnpm test:smoke:packaged` の2回起動／終了が合格（最終 `test-artifacts/smoke-hG27kn/`）。Viteの既存chunkサイズ警告は継続する。本文の証跡画像は `test-artifacts/phase4-5ozFRo/body-without-toolbar.png`。
- 次の作業はPhase 5の独立した計画・ガント。未確認のWindows実操作は引き続き別途確認する。
- 配布ASAR内のmain／preload・HTML・JS・CSSが生成物と一致することを検証。`python scripts/verify-handoff.py --with-prototype` も合格（必須15ファイル・ローカルリンク26件・A01〜A23・試作）。文書検証と製品の受入を区別する。

## 2026-11-06 — 資料追加時のテーマ初期条件

- ページで「資料を追加」を開くと、登録済み資料を現在の所属テーマで絞り込む。候補0件でも条件を保持し、手動変更・「条件を解除」で全資料へ切り替えられる。開き直すと所属テーマを初期条件に戻す。未所属は「すべての関連」を表示する。
- モーダル初期化時だけ条件を設定するため、開いた後の手動フィルターを親画面の再描画で上書きしない。新規登録・関連付け先・資料目録の保存条件やDB／API／依存には変更なし。
- `pnpm typecheck`、`pnpm build` が合格。`node scripts/build-test.mjs` 後の `node scripts/phase3.mjs` が8プロセス合格（`test-artifacts/phase3-Frltvz/`）。所属テーマ／候補0件の初期表示、解除後の全件、所属テーマだけの候補表示、再オープン時の初期化、未所属への変更直後のall表示を確認。既存の資料追加・編集・ドラッグ・保存失敗・下書き復旧も回帰合格。
- `pnpm exec electron-builder --dir --win --x64 --config.directories.output=release/document-theme-default` が合格。非起動を確認して `release/win-unpacked/` へ生成物一式を反映し、exe／ASARのハッシュ一致を確認。`pnpm test:smoke:packaged` の2回起動／終了が合格（`test-artifacts/smoke-KGgIHG/`）。Viteの既存chunkサイズ警告は継続する。
- 今回の追加未確認事項なし。既存のWindows IME・OS倍率・ネイティブ終了案内の手動未確認は維持する。次の開発段階はPhase 5。

## 2026-11-05 — Phase 4: 本文・画像・横断検索

- 公式資料と公開peer情報で確認したTiptap 3.32.3を導入し、React 19.3.1との互換性をstrictPeerDependenciesで確認。react／core／pm／starter-kit／task-list／task-item／imageを同版で固定。選定理由・公式リンク・上限値と境界はDECISIONSへ記録した。
- 本文をリッチテキストへ変更。行頭の#〜######＋半角スペースで見出し1〜6、-で箇条書き、1.で番号、[ ]／[x]でチェックリストへ変換する。既存本文をMarkdownとして自動解釈せず、書式ツールからも操作可能。プロパティ→本文→関連資料→関連ページと見出し非表示を維持する。チェック項目の「ページにする」はタイトルを関連追加画面へ引き継ぎ、元の本文・チェック状態を保持する。
- Migration 5でbodyJsonとrecent_targetsを追加。旧本文の改行・末尾改行、状態・関連・資料を保持し、編集時に構造化JSONと検索用文字を同時保存する。mainでノード・属性・リンク・画像IDと実在を検証。本文を開いただけでは更新を作らず、IME中のDB確定を保留し、下書き・CAS・古い応答からの入力保護を継続する。容量超過時も編集バッファを残し、理由を表示する。
- PNG/JPEGのファイル選択・貼り付けを実装。20MiB／2400万画素をシグネチャ・寸法・デコードで検証し、元ファイルを変更せず、UUID名の管理PNGへflush／renameしてから本文へ挿入する。専用workspace-imageスキームは管理画像だけを返す。クリックで拡大し、本文の参照削除後も画像ファイルを保持する。既存バックアップへ画像と本文を同梱する。
- 画像保存失敗はページごとのキューへ保持し、画面移動後の再試行／確認後の未保存画像入力だけの破棄に対応。終了・バックアップ・対象アーカイブ前に成功を確認し、保存できていない画像が残ると安全な終了扱いにしない。管理保存前に失敗した画像のバイト列はメモリー保持で、強制終了後に復旧できると誤表示しない。
- サイドバーとCtrl+Kを共通の横断検索ウィンドウへ統合。テーマ名／説明、ページのタイトル／サマリ／本文文字、資料の名前／説明／用途メモ／参照先を全語ANDで検索する。最近開いた対象は永続化し、検索中・失敗・結果なしと古い返信を処理する。上下・Enter・Esc、完了／中止、アーカイブ切り替え、資料の原本起動を実装。原本本文と画像内文字は検索しない。
- `pnpm typecheck`、`pnpm test`（33件）、`pnpm build` が合格。旧v4データの移行と改行保持、JSONの危険なノード／参照拒否、容量超過時の編集保持、管理画像欠落時のDB拒否と下書き保護、検索対象・アーカイブ・最近開いた対象・遅い応答の破棄を確認した。
- `node scripts/build-test.mjs` 後の `node scripts/phase4.mjs` が6段階合格（最終証跡 `test-artifacts/phase4-bhBblG/`）。実キーの#／##／-／1.／[ ]変換、チェック状態とページ化、リンク、本文の合成IME保留と確定後保存を確認。PNG選択・実ClipboardEvent貼り付け、JPEG正規化、元画像移動後の表示、画像拡大、失敗時の入力保持・画面移動・再試行・明示的破棄、安全に終了できない場合の案内、バックアップ画像同梱が合格。本文からの画像参照削除で実ファイルを消さないことも確認した。書式・チェック・画像付きの異常終了下書き復旧と、通常終了直前保存・再起動も合格。
- 検索の実キー操作・Escで元画面維持・アーカイブ済みの読み取り専用・資料原本起動・最近開いた対象の再起動保持・障害後の検索語保持と再試行が合格。100テーマ／10,000ページ／5,000資料を少量の既存テストデータへ追加し、ウォーム50クエリのAPI往復p95は34.4ms（目標200ms以内）。先頭50件の描画も150ms debounce込み650ms以内で、問い合わせ後500msの目標を確認。`search-performance.json`へ計測値を保存した。コールド検索や大量関連リンクの全ケースを保証する測定ではない。
- 最終コードで `node scripts/phase1.mjs` が4段階合格（`test-artifacts/phase1-3QKJeS/`）、`node scripts/phase2.mjs` が3段階合格（`test-artifacts/phase2-JNYTUW/`）、`node scripts/phase3.mjs` が8プロセス合格（`test-artifacts/phase3-7XJs8u/`）。旧textarea／ページ専用検索を前提にした試験は新しい編集欄・検索ウィンドウの同等操作へ更新した。資料詳細・ドラッグ・保存障害分離・復旧・空の追加画面からの終了も合格。
- 途中の試験で、Tiptapのリンクtitle属性の検証漏れ、画像クリックのイベント経路、検索を開いた際の入力フォーカス、チェックボックスと文字の配置を修正した。本文の初期表示で保存が走らないことも確認。合格は最終実行のみとする。型検査前のpnpmはsandbox内のストア登録でEPERMとなり、許可された実行で再試行した。実施していない検証を合格へ含めない。
- `phase4-body-light.png`、`phase4-body-dark.png`、`phase4-search-light.png`、`phase4-recovered.png`、`phase4-search-many.png` を生成。本文と検索の明暗画像を確認した。`pnpm exec electron-builder --dir --win --x64 --config.directories.output=release/phase4` が合格。生成中の一時フォルダrenameはEPERMを再試行して完了。Viteは約738kBのrenderer chunkにサイズ警告を出すが、ビルド・実操作は合格。初版では記録上の制約とし、警告を抑制していない。
- 非起動を確認して `release/win-unpacked/` へ配布物一式を反映。exe／ASARハッシュ一致、ASAR内のHTML・JS・CSS・main／preloadが生成物と一致し、試験シナリオ・DB・試作の非同梱を確認（1508エントリー）。`pnpm test:smoke:packaged` が2回起動／終了に合格（`test-artifacts/smoke-7ib5a8/`）。署名・インストーラー・自動更新は今回の対象外。
- 手動未確認: Windows IME実入力、ネイティブファイル選択／終了案内の全選択肢、OS表示倍率125%／150%等。合成IMEとネイティブ選択の試験内差し替えで確認した結果と区別する。再確認は `pnpm test:manual`。A13全体は未確認を維持。次の作業はPhase 5の計画行・日付・ガント・Undo、後続Phaseでバックアップ復元と実OS操作を仕上げる。
## 2026-11-05 — ページ配置・関連追加・資料タイトル操作を整理

- テーマの「完了・中止を含む」を検索・フィルターの行へ移動し、独立した段を廃止。HOME／テーマのフィルター下、ページ一覧末尾と関連資料表末尾、本文・関連資料・関連ページの間の線を除去。表の列見出しと行間の線は残して読み取りやすさを維持する。
- ページをプロパティ→本文→関連資料→関連ページの順へ変更。可視の「本文」見出しを除き、編集欄のaria-labelは保持。「検討項目」とページを指す「項目」の画面表記を「ページ」へ統一し、最新仕様・開発手順・README・AGENTSも更新した。
- 関連ページの「ページを追加」は、上部でタイトルだけの新規作成、下部で登録済みのタイトル／サマリ／本文検索・状態／テーマのAND絞り込みと追加を行うモーダルへ変更。元ページは候補外、追加済みは無効、成功時は閉じて元ページへ戻る。失敗時はタイトル・条件を保持し、作成途中のタイトルは既存の下書きへ保護する。「気づきを残す」ボタンを非表示にした。
- 新規関連ページの初期状態をユーザー指定の未着手へ統一し、元ページの最新テーマと関連を継承する。既存のoriginIdと作成トランザクションを利用し、ページ・関連の保存失敗時に全体をロールバック。既存のページ状態・derivedリンクは変更せず、DBスキーマ／依存／保存先変更なし。
- 資料タイトルは共通情報をその資料だけflushして原本起動し、種類欄など行の余白は詳細を開く。入力欄・関連先リンク・ドラッグ・メニュー操作は詳細を誤起動しない。原本起動失敗の案内と参照先修正、保存障害分離も維持。
- `pnpm typecheck`、`pnpm test`（30件）、`pnpm build` が合格。新しいDB試験で関連保存だけを失敗させ、孤立ページなし・下書き保持・未着手とテーマ継承・再試行・同一トークン再実行で重複なしを確認。初回の既存試験で旧初期値いつか／旧チェックボックス配置の前提が残っていたため、新仕様へ更新して再実行した。SQLの直接戻り値の行プロトタイプ差は、値を比較する試験へ修正した。
- `node scripts/build-test.mjs` 後の `node scripts/phase1.mjs` が4段階合格（`test-artifacts/phase1-QoTW1k/`）、`node scripts/phase2.mjs` が3段階合格（`test-artifacts/phase2-bllKUN/`）、`node scripts/phase3.mjs` が8プロセス合格（`test-artifacts/phase3-mFJTUW/`）。新しいページ追加画面の検索・複数フィルター・追加済み／自己除外・登録と作成の失敗／再試行・合成IME・元画面維持・逆方向リンクを確認。資料タイトルの原本起動、種類セルからの詳細表示、不要線なし・本文の配置とアクセシブル名、1100×700／Electron zoom 125%の横はみ出しなしも合格。ドラッグ試験はスクロール後の描画を待って実マウス座標を採るよう調整し、既存操作も合格した。
- `page-ui-theme.png`、`page-picker-create.png`、`page-picker-125.png`、`page-ui-detail.png` を画像確認。`pnpm exec electron-builder --dir --win --x64 --config.directories.output=release/page-layout` が合格。非起動を確認して `release/win-unpacked/` へ生成物一式を反映、exe／ASARのハッシュ一致を確認。`pnpm test:smoke:packaged` の2回起動／終了が合格（`test-artifacts/smoke-kvQW8H/`）。
- Windows IME実入力、ネイティブ終了確認の全選択肢、実OS倍率は引き続き手動未確認。再実行は `pnpm test:manual`。今回の依頼作業は完了。次の開発段階はPhase 4の本文・画像・横断検索。

## 2026-11-05 — 保存範囲・状態表示・終了操作を改善

- 資料共通情報を資料ごとのバッファへ分離。詳細を閉じる／関連ページへ移動する際はその資料だけを保存し、失敗時も入力と復旧下書きを保持して移動できる。別資料のエラーで無関係な詳細・保存を止めない。解除／並べ替え／アーカイブのflush範囲も対象に合わせ、終了とバックアップは全体の入力保護を継続する。
- 資料詳細の「保存する」を廃止し、「閉じる」に統一。失敗時のみ「再試行」を出し、成功しても詳細を閉じない。保存ラベルとアイコンの判定を共通化し、資料共通情報／用途メモ・資料一覧の表示設定エラーを上部へ反映する。失敗した共通情報の入力確認・再試行も資料一覧から可能。
- 空の追加画面は正常終了できる。未登録参照先・一括登録の失敗行は専用の終了確認を出し、処理中は完了待ち案内にする。登録前入力と保存障害が同時にある場合は先に保存障害を知らせ、登録前入力の破棄でほかの失敗を迂回しない。型付き終了応答に検証済みの理由を追加。DBスキーマ・保存先・依存バージョン変更なし。
- `pnpm typecheck`、`pnpm test`（29件）、`pnpm build` が合格。`node scripts/build-test.mjs` 後、`node scripts/phase3.mjs` が7プロセス合格（`test-artifacts/phase3-NGcpXL/`）。資料Aの共通情報／用途メモだけをSQLiteトリガーで失敗させ、Bの保存・閉じる、A入力の再表示と再試行を確認。表示設定エラーの画面移動後の表示／再試行、保存障害＋未登録入力、登録失敗行、空の追加画面での実際の終了も確認した。既存の異常終了復旧・終了直前保存・ドラッグ・表示密度も合格。保存失敗画面を画像確認した。
- 追加試験の初回は、同じ「再試行」ラベルを持つ用途メモ側のボタンを選んで詳細全体の成功を待つ試験になっていた。詳細フッターの全体再試行を明示して再実行し、合格は最終コードの上記証跡のみとする。
- `node scripts/phase1.mjs` が4段階合格（`test-artifacts/phase1-xDq3dA/`）、`node scripts/phase2.mjs` が3段階合格（`test-artifacts/phase2-cytmjS/`）。ページ作成／編集・保存障害・復旧、一覧条件・アーカイブ／復元の回帰を確認。
- `pnpm exec electron-builder --dir --win --x64 --config.directories.output=release/save-behavior` が合格。配布先の非起動を確認して `release/win-unpacked/` へ一式反映し、exe／ASARのハッシュ一致を確認。`pnpm test:smoke:packaged` が2回起動／終了に合格（`test-artifacts/smoke-jQKdjj/`）。
- 終了確認の自動試験はネイティブダイアログの選択を差し替え、実IPC・flush・戻る選択後の入力保持を確認した。ネイティブ画面の全選択肢とWindows IMEの実入力は未確認のまま維持。再実行は `pnpm test:manual`。今回の実装作業は完了。次は残りのUI見直し項目をユーザーの優先順で進め、開発段階としてはPhase 4の本文・画像・横断検索。

## 2026-11-05 — 資料詳細の表示密度を調整

- 資料詳細に限定して、外周・見出し・ラベル／入力欄・関連先見出し・行・フッターの上下余白を圧縮。原本起動と説明／種類の折りたたみを横に並べた。フォントサイズは維持し、通常の関連先行は約43pxから33pxへ縮小。既存のメモ入力時の拡張は継続する。
- 多数の関連先はリスト部分だけを縦スクロールし、上部の編集欄と下部の保存／閉じる操作が画面内に残る構成に変更。CSSと操作試験の変更で、DB／API／依存・編集ロジックの変更なし。
- `pnpm typecheck`、`pnpm build` が合格。`node scripts/build-test.mjs` 後の `node scripts/phase3.mjs` が6プロセス合格（既存5段階＋表示密度）。テスト専用の20関連先で、1366×768は10件、1100×700／Electron zoom 125%は4件の完全表示、行高33pxを計測。内部縦スクロール、横はみ出しなし、末尾行のメモ編集・保存も確認。証跡 `test-artifacts/phase3-JMpaa8/`。`document-detail-light.png`、`document-detail-dense-many.png`、`document-detail-dense-many-125.png`、`document-detail-dense-last.png` を画像確認。
- 最初の密度試験では完全表示が9件で目標10件に届かなかった。上部の操作を横にまとめてさらに余白を詰め、同じ条件で10件が見えることを再確認した。合格は最終再実行の結果のみ。OS表示倍率そのものの受入とは区別する。
- `pnpm exec electron-builder --dir --win --x64 --config.directories.output=release/detail-density` が合格。非起動を確認して既存配布先へ一式を反映し、exe／ASARのハッシュ一致と `pnpm test:smoke:packaged` の2回起動／終了が合格（`test-artifacts/smoke-KaorC0/`）。今回の残作業なし。次の段階はPhase 4。

## 2026-11-05 — 資料詳細・関連先の省略表示・ドラッグ並べ替え

- テーマ／資料目録など集約表示する行の用途メモを非表示にし、関連テーマとページ名だけを左詰めで横並びにした。横スクロールを設けず、収まらない場合は「…」を表示。検討項目内の自分の用途メモはインライン編集を維持する。
- 行・資料名クリックで資料詳細モーダルを開く。上部のタイトル／リンクは編集・自動保存可能。説明／種類は折りたたみ欄に保持。下部でテーマとページを縦に並べ、各関連先の隣で用途メモを編集できる。ページ名から移動する前に入力を保存し、原本は詳細の「原本を開く」から開く。
- 行メニューの上下移動を廃止。専用ハンドルからマウスドラッグし、挿入線の位置へドロップして順序を保存する。Alt+上下キーでも操作可能。テーマ上は直接関連した資料が対象で、配下ページから集約した資料は元ページで順序を変更する。
- 型付きAPIにreorderを追加。全対象ID・重複なし・関連先・revisionを検証し、順序を1トランザクションで連続整数として確定する。保存失敗時は旧順序とメモを維持。DBスキーマ・依存・バージョン変更なし。公式HTML Drag and Drop仕様と根拠はDECISIONSに記録した。
- `pnpm typecheck`、`pnpm test`（28件）、`pnpm build` が合格。重複ID、別関連先、古いrevision、SQLエラーによる途中失敗／全ロールバックと、メモ不変をDBテストで確認した。
- テスト用ビルド後の `node scripts/phase3.mjs` が5プロセス合格。CDPマウス押下・移動で実際にドラッグを発生させて保存、DB書込み障害で旧順序を維持、再試行で反映を確認した。集約行のメモ非表示・横スクロールなし・狭い幅で「…」表示、行から詳細を開く操作、全関連先2件とメモ、詳細からページ移動、編集失敗／復旧／再起動も確認。最終証跡 `test-artifacts/phase3-PrTw7s/`。`document-detail-light.png` と `phase3-theme-light.png` でミニマルな詳細とコンパクトな一覧も画像確認した。
- `node scripts/phase1.mjs`、`node scripts/phase2.mjs` も回帰合格（`test-artifacts/phase1-e5IPx0/`、`test-artifacts/phase2-bHQPLA/`）。途中の型チェックでは未使用になった原本起動関数を削除して再実行した。合格は修正後の結果のみ。
- `pnpm exec electron-builder --dir --win --x64 --config.directories.output=release/document-detail-drag-final` で配布生成。アプリが起動していないことを確認して `release/win-unpacked/` へ一式を反映し、exe／ASARのハッシュ一致、`pnpm test:smoke:packaged` の2回起動／終了が合格（`test-artifacts/smoke-HGVtKz/`）。
- ASARは98エントリーで、main／preload／HTMLと全renderer資産の一致、テスト・試作・DBの非収容を確認。資産比較の初回はWindowsのASAR APIへPOSIX区切りのパスを渡したため失敗し、ネイティブ区切りへ正規化して全件合格した。`python scripts/verify-handoff.py --with-prototype` も合格。
- 今回の残作業なし。Windows IME実入力・OS表示倍率等の既存の手動未確認は引き継ぎ、次の開発段階はPhase 4。

## 2026-11-04 — 関連資料を省スペース化、用途メモをインライン編集

- ページ／テーマ内の資料名下の参照先を削除し、名前のホバーで全文を確認できるようにした。資料目録の参照先列は維持する。関連元とその用途メモを横並びにし、長いページ名は省略・ホバーで全文確認する。
- 用途メモを一覧から直接編集可能に変更。通常は1行、入力時は欄を広げて改行も保持する。資料ID＋関連先ごとに編集バッファを分離し、複数行・複数ページを続けて編集しても混ざらない。画面移動後の保存・失敗時保持／再試行・IME確定までの保留・復旧下書き・終了直前保存を維持する。
- 終了・バックアップ・アーカイブ・並べ替え／関連解除／登録解除前にメモもflushする。全画面共通の保存状態と失敗時再試行を追加し、アーカイブした関連先は編集不可。既存の関連先固有メモ、旧group値、原本を保持する。DB・API・依存の変更なし。
- `pnpm typecheck`、`pnpm test`（27件）、`pnpm build` が合格。新しいバッファ分離の単体試験で一方だけ保存失敗しても他方を保存でき、改行を含むメモを保持することを確認。
- テスト用シナリオ再生成後の `node scripts/phase3.mjs` が5プロセス合格。パスの重複表示なし・資料名titleの参照先・関連元2件が同じ縦位置にあることを確認。2関連先のインラインメモをDB書込み障害中に編集して入力保持・個別保存を再試行。共通情報とインラインメモを同時に異常終了から復旧した。証跡 `test-artifacts/phase3-q9gH8W/`。`node scripts/phase2.mjs` の一覧／アーカイブ回帰も合格（`test-artifacts/phase2-TxbOqy/`）。
- ページとテーマの画像で省スペース化を確認。テストでは原本起動先がテスト画面を覆うことで描画待ちがタイムアウトしたため、画面キャプチャ前にテストウィンドウを表示・フォーカスするよう修正して再実行した。合格は最終再実行の結果のみ。
- 配布生成: `pnpm exec electron-builder --dir --win --x64 --config.directories.output=release/compact-related-documents-final`。起動中の製品アプリがないことを確認して既存配布先へ一式を反映し、exe／ASARのハッシュ一致を確認した。`pnpm test:smoke:packaged` が2回とも合格（`test-artifacts/smoke-32dxee/`）。今回の更新は配布用exeにも反映済みで残作業なし。
- 従来のWindows IME実入力や全OS倍率の手動確認は未確認のまま。次の開発段階はPhase 4。

## 2026-11-04 — 未選択の行がハイライトされる表示を修正

- 原因は、前に開いた行のIDを一覧設定から復元し、そのIDに選択色を適用していたこと。検討項目の表・いつか欄・資料目録から行全体の選択背景を外し、行全体のホバー背景も廃止した。資料追加リスト・関連資料も同じ表スタイルを使うため同様に反映される。
- 行の `aria-selected` と選択用CSSクラスは使わず、直前対象は内部の復帰アンカーとして扱う。既存設定のselectedId／selectedは互換性のため保持し、フィルター・並び順・スクロール・フォーカス復元に影響しない。ボタン・入力欄のホバーとキーボードのフォーカス表示、ナビゲーションの現在ページ表示は維持する。依存／DB／API変更なし。
- `pnpm typecheck`、`pnpm build` が合格。テスト用シナリオを再ビルド後、`node scripts/phase2.mjs`（3プロセス）と `node scripts/phase3.mjs`（5プロセス）が合格。戻る操作と再起動後の行背景が透明であること、選択用属性・クラスがないこと、条件・縦横位置とフォーカス操作が維持されることを確認。証跡 `test-artifacts/phase2-KKctZr/`、`test-artifacts/phase3-Kj4mSE/`。明暗画像とHOMEの表示も確認した。
- `pnpm exec electron-builder --dir --win --x64 --config.directories.output=release/list-highlight-fix` が合格。ユーザーの終了連絡後、非起動を確認して既存配布先へ反映。exe／ASARのハッシュ一致と `pnpm test:smoke:packaged` の2回起動・終了が合格。証跡 `test-artifacts/smoke-bsZsF3/`。
- 今回の残作業なし。次はPhase 4。既存のWindows IMEや全OS倍率などの手動未確認項目は引き継ぐ。

## 2026-11-04 — 初版の資料グループ化を廃止

- ユーザー指示により、ページ／テーマの資料グループ見出し（未設定時の「資料」を含む）とグループ名入力欄を削除。行メニューを「用途メモを編集」に変更し、用途メモの自動保存・復旧を維持した。関連資料はpositionで並べ、上下移動は関連先の全資料に適用する。
- 既存のgroup値はDB・復旧下書きの互換性のため内部保存だけ維持し、表示と順序判定には使わない。既存資料・用途メモ・原本を削除／変更する移行は行わない。依存・DBスキーマ・APIの変更なし。仕様、開発計画、AGENTS、README、DECISIONSを更新した。
- `pnpm typecheck`、`pnpm test`（26件）、`pnpm build` が合格。`node scripts/build-test.mjs` 後の `node scripts/phase3.mjs` が5プロセス合格。既存グループ値のある資料と未設定資料をまたぐ上下移動、見出し・入力欄の非表示、用途メモ・保存障害・再試行・復旧・終了直前保存を確認。証跡 `test-artifacts/phase3-UJJ8kW/`。`phase3-item-light.png` で列ラベル直下に資料行が並ぶことも画像確認した。
- `pnpm exec electron-builder --dir --win --x64 --config.directories.output=release/documents-no-groups` で生成。ユーザーの終了連絡後、非起動を確認して `release/win-unpacked/` へ一式を反映。exe／ASARのハッシュ一致と `pnpm test:smoke:packaged` の2回起動・終了が合格。証跡 `test-artifacts/smoke-g7oQDR/`。
- 今回の変更の残作業なし。従来の手動IME・OS表示倍率等の未確認事項は引き継ぐ。次の開発段階はPhase 4。

## 2026-11-04 — 資料追加を新規登録と一覧選択の1画面へ統合

- 検討項目／テーマの「資料を追加」からタブと資料選択プルダウンを廃止。新規登録（ファイル・フォルダー・パス／URL）と登録済み一覧を同時表示し、一覧の各行の「追加」で関連付ける。成功時は閉じて元ページを維持し、追加済みは無効化して重複操作を防ぐ。
- 検索・種類／関連テーマ／未関連・名前／更新日時の並べ替えに対応。資料目録と同じ検索関数を共用し、名称・参照先・説明・用途メモのAND検索を適用する。追加画面の条件は資料目録の保存済み条件と分離した。失敗時は入力・検索条件・一覧を保持して再試行できる。
- 新規登録領域をコンパクトに配置して一覧内をスクロール可能にした。依存・DB・APIの変更はなく、仕様・README・DECISIONSを更新。
- `pnpm typecheck`、`pnpm test`（26件）、`pnpm build` が合格。`node scripts/build-test.mjs` 後の `node scripts/phase3.mjs` が5プロセス合格。証跡 `test-artifacts/phase3-etWgfK/`。34件の一覧、検索、種類・テーマ・未関連、0件表示、追加済みの無効化、DB書込み障害後の再試行、新規登録と既存資料の追加後の閉じる／元ページ保持を確認。既存の原本不変・再起動・保存失敗・異常終了復旧も合格。
- `document-picker-light.png` と `document-picker-125.png` で1366×768、および1100×700／Electron zoom 125%の表示を確認。OS表示倍率の受入とは区別する。
- `pnpm exec electron-builder --dir --win --x64 --config.directories.output=release/document-picker-build` が合格。生成したexeを専用データで2回起動・終了し、資料API・Node分離・SQLite接続も合格。証跡 `test-artifacts/picker-smoke-nnuowz/`。文書・参考試作の `python scripts/verify-handoff.py --with-prototype` も合格。
- **配布反映完了:** ユーザーの終了連絡後、非起動を確認して生成物一式を `release/win-unpacked/` へコピー。exe／ASARのハッシュ一致を確認し、`pnpm test:smoke:packaged` が2回とも合格。資料API・Node分離・SQLite接続も確認した。証跡 `test-artifacts/smoke-0IOkbE/`。今回の更新に関する残作業なし。次の開発段階はPhase 4。

## 2026-11-04 — Phase 3 資料目録と文脈別資料

### 変更

- サイドバーの資料目録を有効化。未関連を含む全資料、名前／参照先／説明／用途メモ検索、種類・テーマ・未関連の絞り込み、名前／更新日時の昇降順、関連ページへの移動、条件・選択・縦位置の復元と再起動保持を実装した。
- ファイル／フォルダー選択、パス／URLの一括貼り付け、複数実ファイルのドロップに対応。パスとURLを別に正規化し、URLのパスやクエリーの大小文字を保持する。同じ参照先は既存資料を再利用し、部分失敗は参照先・理由を表示してその分だけ修正・再試行できる。
- 共通情報と文脈別の用途メモ・グループ・並び順を分離。ページは本文より前に資料を置き、テーマは直接資料と配下ページの資料を重複排除して関連元を示す。行メニューから共通情報／参照先・用途・上下移動・関連解除・登録解除を行う。
- 資料名から既定アプリ／ブラウザーへ起動する。参照切れ時は実参照先とOSの失敗内容を表示し、参照先を修正できる。UNCを登録時に探索せず、外部起動は5秒で応答待ちを打ち切り、ローカル編集の保存キューから分離した。
- 資料の共通情報と用途メモも自動保存へ揃えた。入力は専用の下書きへ退避し、保存失敗時は保持／再試行、異常終了後はHOMEから復旧を案内する。古い保存応答で新しい入力を失わず、正常終了・バックアップ前にflushし、上部の保存状態にも反映する。
- スキーマ版3に資料・関連・目録表示条件、版4に資料編集の適用済みtokenを追加。既存データの移行前退避を継続する。外部原本のコピー・移動・改名・削除は行わず、登録解除は関連数とrevisionを確認して目録・関連だけを削除する。
- 追加依存なし。既存バージョンとElectron／Node公式資料、API境界・保存先・技術上の制限と理由をDECISIONSへ記録した。試作・固定データ・テスト用CJSは製品へ流用していない。

### 実行結果

| コマンド／確認 | 結果 |
| --- | --- |
| `pnpm typecheck` | 合格 |
| `pnpm test` | 26件合格。正規化・同名別資料・重複再利用・用途分離・原本不変・DB障害・下書き障害・古い応答・IME合成イベント・応答なしのタイムアウト等 |
| `pnpm build` | 合格。main／preload／renderer生成 |
| `pnpm test:phase1` 相当の `node scripts/phase1.mjs` | 回帰合格。`test-artifacts/phase1-d6nEKV/`。直前に製品とテストをビルド済み |
| `pnpm test:phase2` 相当の `node scripts/phase2.mjs` | 回帰合格。`test-artifacts/phase2-hmhDJR/` |
| `pnpm test:phase3` 相当の `node scripts/phase3.mjs` | 5プロセス合格。登録／編集／並べ替え／検索・種類／テーマ絞り込み／目録復帰／再起動／DB保存失敗と再試行／異常終了17と復旧／終了直前保存。最終証跡 `test-artifacts/phase3-opqTIh/` |
| 複数ドロップ | CDP経由で2実ファイルをドロップし、実File→preload webUtils→main→DBの経路と既存資料再利用を確認 |
| 原本起動／参照切れ | テスト専用テキストのshell.openPathが成功。存在しない一時ファイルのOSエラー表示と参照先修正を実画面で確認。登録・改名・解除後の原本内容一致 |
| 未接続共有先 | 存在しないUNCへの登録・起動失敗時にローカル取得が継続。応答しないOS起動を模擬した単体試験では5秒で案内し、待機中もDB編集が成功 |
| 配布生成 | `pnpm exec electron-builder --dir --win --x64 --config.directories.output=release/phase3-ready` 合格。未署名・既定アイコンは従来どおり。今回の古い中間生成物5個は整理し、最終生成物と既存配布先を保持 |
| 配布反映 | アプリの非起動を確認して `release/win-unpacked/` へ生成物一式をコピー。exe・app.asarのハッシュ一致を確認 |
| `pnpm test:smoke:packaged` | 更新後のexeを2回起動・終了して合格。資料API／workspaceReady／documentsReady／rendererのNode分離／SQLiteを確認。`test-artifacts/smoke-dhE4vs/` |
| ASAR | 98エントリー。現在のmain・preload・rendererの一致と、テスト・試作・証跡・ローカルDBの非収容を確認 |
| `python scripts/verify-handoff.py --with-prototype` | 合格。文書参照26件・必須15ファイル・A01〜A23・参考試作を確認。製品受入とは区別 |
| 画面画像 | 資料目録の明暗、ページ／テーマの資料、保存失敗モーダル、1100×700、Electron zoom 125%を画像確認。失敗時の案内と再試行／破棄を折り返して配置。頻用操作は表内でスクロールし、長い参照先は表示・title・編集欄から確認可能 |

検証中の失敗も区別する。初回の型チェックではテストの未使用変数・型絞り込みを修正し、Nodeのstrip-only実行に対応しないparameter propertyを通常フィールドへ変更した。DBのBEGIN失敗を部分失敗へ返す位置も修正した。操作テストでは非表示の行メニューを誤選択するヘルパー、再読み込みのイベント待ち、保存済み検索条件の解除漏れを修正。合格は上記の最終再実行結果であり、途中の失敗を合格として扱っていない。

### 受入・未確認・次の作業

- A07〜A10を合格へ更新。A22は資料部分を確認済みだが、ネットワークバックアップ先はPhase 6のため全体を未確認で維持する。A13は資料の障害／復旧も自動確認済み。Windows IME実入力と終了失敗案内の手動確認は未確認のまま。
- ネイティブのファイル／フォルダー選択ダイアログを人手で操作して確定する確認、URLの既定ブラウザーでの表示・接続成功は未確認。`pnpm test:manual` で専用データを起動し、「資料目録→資料を追加→ファイル／フォルダーを選択」を一時資料で確認する。URLは同じ画面で登録して名前から開く。共有先の権限・切断復帰・遅延を含む実ネットワークの全条件も未確認。
- OS表示倍率125%／150%と1920×1080を含む全画面受入、実GPU、署名・インストーラー、大量資料の性能目標は未確認。Electron zoomの画像をOS表示倍率の合格と扱わない。
- 次はPhase 4。本文の構造化編集・チェック項目の切り出し・アプリ管理の画像保存／表示／拡大、Ctrl+Kのテーマ／検討項目／資料横断検索と最近開いた対象を実装し、A12〜A14を確認する。

## 2026-11-04 — テーマページのテーマ列を非表示

- ユーザー指示により、テーマページの項目一覧からテーマ列を非表示に変更。任意列を含む列幅を位置番号ではなく列の意味で指定し、列削除後もサマリ・日付列が整うよう調整した。仕様3.3へ反映。
- 型チェック・ビルドは合格。通常の配布生成はwin-unpackedフォルダのEBUSYで失敗。失敗後の旧exe起動成功を今回変更の反映確認とは扱わず、別出力先で生成してから既存フォルダへ反映する。
- 別出力先 `release/theme-columns-build/win-unpacked/` の生成・起動が合格。対象テーブルを描画して、テーマ列を非表示にする場合と表示する場合の結果を確認した。既存配布先へのコピーはアプリ起動中を検出して中断し、ユーザーに終了を依頼した。既存配布先の更新完了までは反映済みと扱わない。
- ユーザーの終了連絡後、既存配布先 `release/win-unpacked/` へ生成物を反映。exeとapp.asarのハッシュ一致を確認し、更新後の `pnpm test:smoke:packaged` が2回とも合格。証跡は `test-artifacts/smoke-r2w8Gs/`。既存配布先の更新は完了。

## 2026-11-04 — 作成成功時にウィンドウを閉じる

- 最新のユーザー指示に合わせ、作成成功時はモーダルを閉じ、元の一覧・ページをそのまま表示する。詳細への遷移と空の作成ウィンドウの維持をやめた。失敗時は入力とモーダルを保持する。
- 仕様5.1・README・DECISIONSを更新し、既存の操作テストを新しい動作に調整。型チェックと `pnpm test:phase1` が合格し、テーマ／ページ／気づきの作成後の自動閉じ、元画面保持、保存・再起動・失敗時の入力保持・復旧を確認した。証跡は `test-artifacts/phase1-dCWJQg/`。
- `release/create-dialog-build/` で配布生成後、アプリが起動していないことを確認して既存の `release/win-unpacked/` へ反映。exeとapp.asarのハッシュ一致、更新後の2回起動／終了が合格。起動証跡は `test-artifacts/smoke-DNWFee/`。

| 段階 | 状態 |
| --- | --- |
| 仕様と情報構造の検討 | 完了 |
| ホーム・検討項目・資料目録・ガントの操作試作 | 方向性をユーザー確認済み |
| Phase 0 技術選定・起動基盤 | 完了（空のシェル、開発／ビルド／配布フォルダ版の起動確認） |
| Phase 1 永続化と最小導線 | 実装・自動検証済み。Windows IME実入力／終了失敗案内の手動確認待ち |
| Phase 2 ホームと日々の整理 | 完了（18件のテスト・実Electron操作／再起動・配布更新／起動を確認） |
| Phase 3 資料目録 | 実装・自動検証・配布反映済み。A07〜A10合格、A22の資料部分確認済み |
| Phase 4 本文・画像・検索 | 未着手 |
| Phase 5 計画・ガント | 未着手 |
| Phase 6 報告画像・バックアップ | 未着手 |
| Phase 7 実画面の調整・受入確認 | 未着手 |

## 開発開始を妨げる事項

仕様上のブロッカーなし。実行環境はWindows x64 10.0.26300、Node.js 24.22.1、pnpm 11.25.0。npmはPATHにないためpnpmへ統一した。初回依存取得・Electron実行ファイル取得は制限環境では失敗し、権限を伴う再試行で成功した。以後の起動検証も実行権限を得て行った。

## パッケージ作成時の検証

文書内リンク・受入条件ID・試作ソースの構文と簡易動作を確認する。これらは製品の受入条件を確認したものではない。

2026-11-03 実行結果:

- `python scripts/verify-handoff.py --with-prototype`: 合格。必須15ファイル、ローカルリンク23件、A01〜A23、単体試作の外部アセット不要を確認。
- `node scripts/check-prototype.cjs`: 合格。資料目録の検索・登録・編集と用途メモ、状態・初期値・ホーム除外、計画日付と画像生成の簡易動作を確認。
- 一時ディレクトリへパッケージ全体をコピーし、`RenamedProject`へ改名した環境でも上記確認が合格。元のフォルダへ依存しないことを確認。
- 単体試作の実ブラウザー描画とクリップボードは今回未確認。製品の受入確認は全項目未実施。

## 実装後の記録欄

各段階で以下を追記する。

- 実施日・対象Phase
- 実装したことと変更ファイル
- 実行コマンドと結果（未実施は未実施と記録）
- 未解決点・環境の制約
- 次の具体的な作業
- 対応する受入条件IDと確認方法

## 2026-11-03 — Phase 0完了

### 変更

- 指定順でAGENTS.md・README・確定仕様・開発手順・DECISIONS・PROGRESS・ACCEPTANCE・試作READMEと画面ソースを確認。このプロジェクトの外に旧ソースを探していない。
- package.json、pnpm-lock.yaml、pnpm-workspace.yaml、tsconfig.json、vite.config.ts、index.htmlをルート直下に追加。
- `src/main/`・`src/preload/`・`src/shared/`・`src/renderer/` に責務を分離。空のホーム、常設のいつか欄、ナビゲーションを新規作成。未実装操作は無効。サンプル配列・固定日付・ダミーパス・擬似保存は製品に追加していない。
- APIはアプリ情報取得のみ。mainで送信元・フレーム・URL・引数数を検証。sandbox・contextIsolationを有効にし、rendererのNodeを無効化。preloadでも両保護設定を実行時検証する。
- 開発／製品専用のローカル保存先、ログ・添付・下書き・Chromiumセッション等の分離を実装。DBファイルは未作成。テストはプロジェクト内の一時専用領域で実施。
- `scripts/build.mjs`・`dev.mjs`・`launch.mjs`・`smoke.mjs`、境界テストを追加。Electron起動に不要なELECTRON_RUN_AS_NODE環境変数を子プロセスから除去。
- READMEへ導入・開発・ビルド・起動・テスト・配布生成・保存先を追記。DECISIONSへ公式出典・固定版・互換性・ライセンス・Migration設計・入力上限・検索性能目標を記録。

### 実行結果

| コマンド／確認 | 結果 |
| --- | --- |
| `pnpm view ...` | Electron、React、Vite、TypeScript、エディター等の版・engines・peer・ライセンスを照合。公式Web資料と併せてDECISIONSへ記録 |
| `pnpm install` | 初回はpnpm 11で旧設定が無視されビルドスクリプト許可エラー。pnpm-workspace.yamlのallowBuildsへ修正 |
| `pnpm install --frozen-lockfile` | 修正後合格。依存・ロック一致、esbuildビルド成功 |
| `pnpm typecheck` | 合格。初回検出した現行ElectronにないgetLastWebPreferencesの呼出を削除し、preloadの実行時設定検証へ変更 |
| `pnpm test` | 合格、2件。開発／製品／テストの保存先分離、相対パスとテスト先未指定の拒否、IPCの不正引数拒否 |
| `pnpm build` | 合格。main/preload CJS、renderer HTML/CSS/JSを生成 |
| `pnpm test:smoke` | 合格、ビルド済みHTMLで起動・終了・再起動。実rendererでホームと接続済み表示、公開API1メソッド、process/requireがundefined、内蔵SQLite接続を確認 |
| `pnpm test:smoke:dev` | 合格、ViteとReact Refreshを含む開発経路で起動・終了・再起動。初回にテスト用Chromiumファイルの監視EBUSYを検出し、Viteの監視除外を修正。再実行では警告解消 |
| `pnpm package:dir` | 合格。electron-builder 26.18.0でWindows x64のASAR配布フォルダを生成。未署名・既定アイコンの案内あり |
| `pnpm test:smoke:packaged` | 合格。生成したEngineering Workspace.exeそのものを2回起動・終了。テスト保存先でAPI・権限分離・SQLiteを再確認 |
| `python scripts/verify-handoff.py --with-prototype` | 文書更新後も合格。必須15ファイル・ローカルリンク26件・A01〜A23・試作の簡易検証。製品受入とは区別 |
| 画面画像 | `test-artifacts/smoke-fcqy1d/shell.png` を画像として確認。ホーム表、いつか欄、下部接続状態の描画を確認。起動時ウィンドウ1366×768、OSの暗色テーマ |

実測ランタイム: Electron 45.2.1、内蔵Node 24.22.1、SQLite 3.53.4。端末のプロセス終了コードとSMOKE_OKを確認。起動テストではウィンドウを実表示して自動で閉じる。通常の開発／製品保存先を使う手動編集・保存テストは行っていない。

最新の開発版証跡: `test-artifacts/smoke-KAuMSA/`、配布版証跡: `test-artifacts/smoke-T9X9c5/`（画面PNG、起動／終了ログ、セッション）。これらと依存・ビルド出力はgitignore対象。全スモークプロセスは終了済み。

### 未確認・制約

- A01〜A23は全件未確認。空の画面の描画や保護設定の合格を、ホームの一覧条件・DB保存・バックアップ等の受入合格にはしていない。
- NSIS生成／インストール、署名、更新、PowerPoint、IME、表示倍率125%／150%は未確認。再実行はREADMEのコマンドと、該当Phaseの手動確認を使用する。
- node:sqliteはNode 24でRelease candidate。現在は接続確認だけで、永続化・Migration・バックアップの整合性はPhase 1以降に確認する。
- Tiptap・画像処理・検索性能は選定／設計まで。エディターは空シェルで未使用のため未導入。上限と検索目標を実装・測定済みとはしていない。
- CIMによるマシン情報取得は権限制約で失敗。Nodeのos APIでOS・CPU・RAMを読み取り、性能試験の基準PCを記録した。検索性能試験自体は未実施。
- 配布確認時に `pnpm pack` がpnpm組み込みのnpmアーカイブ生成を実行したため、スクリプト名を `package:dir` に変更。自分で作成したtgzを削除して正しいコマンドで確認済み。

### Phase 0終了時に予定した作業 — Phase 1（以下の記録へ継続）

1. main専用DBアダプター・連番Migrationと、一時DBによる適用／失敗／新しい版の拒否テスト。
2. テーマと検討項目、6状態、サマリ、独立した期限／確認日、項目間リンクの永続化と型付きAPI。
3. タイトルだけの作成、通常／気づきの初期状態・テーマ継承、双方向関連の最小導線。
4. 編集バッファ・保存応答の順序制御・復旧下書き・手動バックアップ基盤と障害テスト。
5. A01〜A03・A06についてDB／操作テストとWindows IME・再起動後保持の確認を実施し、ACCEPTANCEへ実際の証跡を記録。

## 2026-11-03 — Phase 1実装と自動検証

### 実装

- ユーザーの「市販アプリ並みのUI完成度、Notionのようにミニマルでアイコンを用いた分かりやすさ」を仕様7章とDECISIONSへ反映。新しい機能・必須入力・プロパティは追加していない。
- `src/shared/model.ts`・`validation.ts` へ6状態と型、UUID・日付・要求の実行時検証を追加。`src/main/db/` に初期Migration、整合性確認、既存DBの変更前スナップショット、リビジョン検査を実装。
- テーマ名のみ、ページのタイトルのみで作成。通常は未着手、気づきはいつかでテーマと派生リンクを同一トランザクションで設定。所属は未所属／1テーマ。双方向の関連参照と一般リンクの追加／解除に対応。
- `src/main/drafts.ts`・`service.ts` とrendererの `editor-store.ts` で、対象別バッファ、順序付きの退避・DB保存、450msの自動保存、失敗保持・再試行・古い応答の保護、復旧確認を実装。作成途中で閉じた入力も下書きに保持。
- main/preloadのAPIは用途別。rendererはDB・Node・任意IPCへ直接アクセスしない。通常終了は保存完了を待つ。失敗時のネイティブ案内と下書き退避済みかの判定を実装。二重起動を抑止。
- `src/main/backup.ts` へDBスナップショット＋管理添付＋復旧下書き＋SHA-256 manifestの手動バックアップを実装。完成前は.partialとし、以前の完成世代を変更しない。
- `src/renderer/components.tsx`・`icons.tsx`・`main.tsx`・`style.css` でホーム、テーマ、詳細、作成モーダル、設定を構成。ニュートラルな明暗テーマ、統一した線画アイコン、状態バッジ、フォーカス、空状態、保存表示、一覧での状態／サマリ編集を追加。日付未設定欄は折りたたみ、関連資料の位置を本文より上に確保。
- 実装した本文はプレーンテキスト。フィルター等はPhase 2、資料はPhase 3、リッチテキストと画像・検索はPhase 4、計画はPhase 5。バックアップの復元UI／自動実行はPhase 6。
- `tests/workspace.test.ts`・`editor-store.test.ts` と別ビルドの `tests/electron-scenarios.ts` を追加。製品にはテストのサンプル・固定日付・テスト用CJSを含めない。依存ライブラリの追加・バージョン変更なし。

### 検証結果

環境: Windows x64 10.0.26300、Node 24.22.1、pnpm 11.25.0、Electron 45.2.1、SQLite 3.53.4。DB・ファイルは新規の `test-artifacts/` 内だけを使い、旧アプリと実資料は参照・変更していない。

| コマンド／対象 | 結果 |
| --- | --- |
| `pnpm typecheck` | 合格。main/preload/renderer・DB・テストをstrictで検査 |
| `pnpm test` | 合格、11件。MigrationのDDL／版のロールバック・変更前スナップショット・将来版／破損DBの保護、通常／派生作成、所属とリンク、6状態とサマリ保持、独立した日付設定／解除／過去日保持、入力検証、DB書込失敗、復旧下書き、競合とトークン、遅い成功／失敗応答、バックアップ内容／ハッシュ／部分失敗を確認 |
| `pnpm test:phase1` | 合格。ビルド後、実Electronの4プロセスで作成→通常終了／再起動→意図的異常終了（17）→再起動／復旧。各PHASE1_OKと全体PHASE1_ALL_PASSED、全体終了0を確認 |
| 実画面の作成・編集 | テーマ作成、テーマ内のタイトルのみ作成、詳細の本文／サマリ／日付、元ページを開いたまま気づき作成、ホームといつかでのサマリ編集、詳細で全6状態へ変更後もサマリ保持、双方向の派生リンクを確認 |
| 実画面の保存失敗／終了 | テストDBへquery_onlyを設定して実際の書込失敗を発生。画面移動後も入力を保持、解除後の再試行で保存。終了直前の入力は通常終了のflushを通じて保存され、次のプロセスからDBを照合 |
| 異常終了／復旧 | 変換中を模した入力をmainの下書きへ退避した後、通常の終了ハンドシェイクを通さず停止。次の起動で復旧候補を表示し、復旧後の入力・DBと下書き掃除を確認 |
| 手動バックアップ | 設定画面から作成成功を確認。単体試験ではスナップショットを別ファイルへ複製してDB内容を照合。添付・下書き・SHA-256を検証し、外部原本の不変・非収容と部分失敗時の既存完成世代保持を確認。復元UIの受入ではない |
| `pnpm build` | 合格、main/preloadのCJSとrendererを生成 |
| `pnpm package:dir` | 合格、Windows x64の配布フォルダを更新。未署名・Electron既定アイコン |
| `pnpm test:smoke:packaged` | 合格、更新した配布exeを一時専用領域で2回起動・終了。React／API／SQLiteとNode権限分離を確認 |
| `pnpm test:smoke:dev` | 合格、Vite開発経路で2回起動・終了。APIとNode権限分離を確認 |
| 配布ASAR検査 | 98エントリー。テストシナリオ・試作・ローカルDB・実行証跡の非収容を確認 |
| `python scripts/verify-handoff.py --with-prototype` | 合格。文書更新後の必須15ファイル・ローカルリンク26件・A01〜A23と参考試作の検証を確認。製品の受入とは区別 |
| UI画像 | 明暗のホームと詳細を実Electronでキャプチャし、画像として確認。1366×768起動時の表・いつか・資料の位置、文字サイズ・コントラスト・状態表示を調整 |
| `pnpm test:manual` | 一時領域で起動しMANUAL_READYを確認。Windows操作ツールのlist_windowsに該当窓が現れず、IME実入力の対象を取得できなかった。実入力は未実施として記録し、テストを中止。残存Electronプロセスなしを確認 |

最終コードの操作証跡: `test-artifacts/phase1-vSWGmf/` のhome-light.png、home-dark.png、detail-light.png、recovered.png、DB、復旧／バックアップ、logs/app.log。配布版の起動証跡: `test-artifacts/smoke-ZzOvm0/`、開発版: `test-artifacts/smoke-j6DOXQ/`。画像としての確認は同じレイアウトの先行実行 `test-artifacts/phase1-XCnclB/` でも実施済み。すべて生成物としてgitignore対象。最終コードでも型チェック・11件のテスト・操作テスト・配布更新／起動・ASAR非収容検査を再実行して合格。

初期の検証では、保存済み下書きのsavedAtを確定用入力へ渡してしまうスキーマ不一致を修正。preloadのfreezeの型付けも修正した。操作テストではイベント後のReact描画待機・説明付きボタンの選択・改行エスケープを修正し、キャプチャのGPU依存エラーはテスト時のソフトウェア描画で解消。修正後の検証結果のみを上表の合格とした。

### 受入条件と未確認

- A02・A03・A06はDB／実Electron操作の証跡に基づき合格。A01は作成経路・初期値と合成IMEイベントのEnter拒否を確認したが、Windows日本語IMEの実入力は未実施なので未確認を維持。
- A13は入力保持・再試行・古い応答・異常終了後の復旧を自動確認済み。保存失敗中に閉じた場合のネイティブ案内の全選択肢は手動確認待ちのため、受入全体は未確認を維持。
- A04以降の未実装機能、全体のA21復元、A23の指定倍率／全画面の操作は未確認。今回の画像だけで初期版UI全体の受入完了とは扱わない。
- 通常終了ハンドシェイクを通さないOS／端末の強制停止では、mainへ退避成功した下書きまでが復旧対象。IME実入力、OS表示倍率125%／150%、実GPUでの操作、保存先の実際の容量枯渇、電源断は未実施。DB失敗はquery_only、下書き失敗は編集ストアのAPI障害を用いて試験した。
- NSISインストール・署名・更新、バックアップ復元UI・自動バックアップ・世代整理は未実施／未実装。実データ運用前に後続Phaseの受入が必要。
- 手動試験用コマンド `pnpm test:manual` を追加。テスト専用CJSだけにCtrl+Shift+F9によるDB書き込み障害切り替えを設け、実画面の終了失敗案内を再確認可能にした。今回のWindows操作ツールではテスト窓を取得できず、IME／ネイティブ案内を実操作したという結果にはしていない。試行の専用領域は `test-artifacts/manual-LKHA4f/`。

### 次の作業

1. `pnpm test:manual` で日本語IMEを使い、テーマ／通常ページ／気づき作成の変換確定Enterと本文の改行を実入力で確認する。
2. 同じテスト画面でCtrl+Shift+F9を押してDB書込障害を発生させ、保存失敗中の終了案内で、画面へ戻る／再試行／下書きを残して終了をWindows上で手動確認する。下書き退避失敗時に安全終了の扱いをしないことも確認する。
3. Phase 2で検索・状態／テーマフィルター・並べ替え・任意列・表示条件保持・戻る位置・日付到来表示・アーカイブ／復元を実装する。いつか欄の独立性を維持し、件数増加時の高さとスクロールを調整する。
4. フィルターや列を追加しても、今回のUIの文字サイズ・余白・アイコン・フォーカス・保存失敗案内を一貫させて実画面で検証する。

## 2026-11-03 — HOME表示と連続作成の調整

- 追加指示により左メニューとパンくずもHOMEへ統一。操作テストのボタン参照を更新。型チェック・ビルド合格。
- 前回のメニュー変更では配布フォルダを更新していなかったため、ユーザー指摘後に `pnpm package:dir` を実行して配布exeへ反映。`pnpm test:smoke:packaged` の2回起動が合格し、`test-artifacts/smoke-LJW76A/shell.png` を画像として確認して左メニュー・見出し・パンくずすべてがHOMEであることを確認した。
- ホーム見出しをHOMEへ変更。ホームの標語、いつかの装飾的キャプション、設定の標語、作成モーダルと気づきボタン等の補足文章を削除。入力・保存・失敗・確認に必要な表示は維持した。
- 新規ページ・気づき・テーマ作成後の自動遷移をやめ、元の画面と作成文脈を維持。作成欄を空にし、入力フォーカスを戻して連続追加できるよう変更した。閉じる操作で元画面の作業へ戻る。空欄Enterは無処理とする。
- 仕様5.1、README、DECISIONSへ新しい動作を反映。既存の実Electron操作テストを調整し、HOME上でのテーマ作成後の画面維持、テーマ内のページ2件の連続作成、入力のクリアとフォーカス維持、気づき作成後の元ページ維持を確認した。
- `pnpm typecheck`、`pnpm test`（11件）、`pnpm test:phase1` は合格。ビルドと再起動／保存障害／復旧も継続して合格。操作証跡は `test-artifacts/phase1-y2VEws/`。
- HOMEの明色画面を画像として確認。文書検証も合格。`pnpm package:dir` で配布exeを更新し、`pnpm test:smoke:packaged` でHOME表示と2回の起動／終了を確認。証跡は `test-artifacts/smoke-oWzYTv/`。
- Phase 1のIME実入力・終了失敗案内の手動確認待ちは従来どおり。次の開発段階は変更していない。

## 2026-11-03 — 所属とページ名のパンくず

- 検討項目のパンくずを「ワークスペース ＞ テーマ名 ＞ 検討項目名」へ変更。テーマ未所属は「未所属」と表示し、テーマ画面では「ワークスペース ＞ テーマ名」とする。ワークスペースはHOME、テーマ名は該当テーマへのボタンとした。
- 未保存の所属・名称の編集も反映。長い名称は省略し、titleで全文確認可能。実体のない未所属テーマへの遷移は作らない。
- `pnpm typecheck`、文書検証、`pnpm test:phase1` が合格。実Electronで3段の名称、テーマ名クリックでの移動、所属解除による未所属表示、所属の再設定を確認。従来の連続作成・再起動・保存障害・復旧も合格。
- 最終の操作証跡は `test-artifacts/phase1-ypTUup/`。背景の描画抑制で古い画面が残らないようテスト側だけ描画抑制を解除し、描画フレームを待機したうえでdetail-light.pngを画像として確認。3段のパンくずを視覚確認した。仕様3.1とDECISIONSへ反映。
- `pnpm package:dir` と `pnpm test:smoke:packaged` も合格。配布exeを更新し、2回起動／終了を確認。配布版の起動証跡は `test-artifacts/smoke-U2YAP9/`。

## 2026-11-03 — Phase 2完了

### 変更

- 既存のHOME表記・3段のパンくず・元の画面に残る連続作成を維持し、Phase 2の一覧整理を追加した。依存の追加・版変更はない。
- `src/shared/lists.ts` へHOMEの固定母集団、いつかの独立抽出、検索・AND条件・安定ソート・日付案内を実装。検索はタイトル／サマリ／本文、状態とテーマ（未所属を含む）で絞り込む。空の日付は昇順／降順とも末尾。
- `src/renderer/overview.tsx`・`lists-ui.tsx` へ検索・状態／テーマフィルター・条件解除・並べ替え・任意3列・固定ヘッダーとタイトル列を追加。主一覧といつかを別スクロールにし、HOMEのいつか見出しが大量の行で押し出されない構成にした。
- 日付案内は期限超過・当日期限・確認日到来。いつかの確認件数から欄内の該当項目へ移動できる。日付到来で状態や日付を自動変更せず、完了・中止・アーカイブを案内から除外する。
- `ViewStore` とスキーマ版2のview_settingsで、HOME／テーマごと／検索／アーカイブの条件・任意列・選択・縦横位置を保存。詳細から戻った時と再起動後の復元、失敗時の条件保持／再試行、正常終了前のflushを追加。
- 変換中にサマリが検索条件へ一致しなくなっても、IME確定まで入力欄を維持する。確定後に条件を再評価し、一覧から外れたことを通知する。状態変更の通知も主一覧といつかに共通化した。
- main/preloadへ検証付きのsaveListView／setArchivedを追加。アーカイブは対象のフラグとリビジョンだけを変更し、テーマ配下の状態・個別アーカイブ・本文・日付・リンクは変更しない。通常の一覧から除外し、設定の管理画面から復元する。アーカイブ内容は復元するまで読み取り専用。
- 左メニューの検索から全検討項目を検索でき、完了・中止の再発見と再開に対応。テーマの「完了・中止を含む」も保存する。テーマ／資料を含むCtrl+K横断検索はPhase 4の範囲であり、今回実装したとは扱わない。
- `tests/phase2.test.ts`、別ビルドの `tests/electron-phase2.ts`、`scripts/phase2.mjs` と `pnpm test:phase2` を追加。テスト専用データ・固定日付・テスト用CJSは配布に含めない。

### 実行結果

Windows x64 10.0.26300 / Node 24.22.1 / Electron 45.2.1 / SQLite 3.53.4。一時データだけを使用し、旧アプリ・ユーザーの実資料へアクセスしていない。

| コマンド／確認 | 結果 |
| --- | --- |
| `pnpm typecheck` | 合格。共有型・実行時検証・main/preload/renderer・テストを確認 |
| `pnpm test` | 合格、18件。母集団／AND条件／いつか独立、安定ソートと未設定日付、日付案内／不変性、設定入力の拒否、版1データの保持と変更前世代、独立したアーカイブ／復元、保存失敗／遅い応答／再試行を含む |
| `pnpm test:phase2` | 合格。78ページ／2テーマの一時データで、3プロセスを通じて検索・複数条件・未所属・任意列・選択／縦横位置・いつかの位置の再起動後保持、完了／中止のテーマ表示と検索からの再開、独立したアーカイブ／復元、日付対象への移動を確認。合成IMEイベントで確定前の入力欄維持と確定後の条件再評価／入力保持も確認 |
| `pnpm test:phase1` | 合格。連続作成・パンくず・全6状態とサマリ保持、通常終了直前の保存、書込障害、異常終了後の下書き復旧が継続して通過 |
| `pnpm build` | 合格。各操作テストと配布生成の前にも実行して成功 |
| `pnpm package:dir` | 合格。最新コードの配布用exeを更新。未署名・Electron既定アイコンは従来どおり |
| `pnpm test:smoke:packaged` | 合格、最終配布exeを2回起動／終了。新しいAPI2メソッド、workspaceReady、Node権限分離、SQLiteを確認 |
| `pnpm test:smoke:dev` | 合格、開発サーバー経路で2回起動／終了。APIとワークスペース取得も確認 |
| UI画像 | 明暗両テーマのHOME、選択と列・位置の復元、日付案内を画像として確認。1366×768で主一覧といつかが別々にスクロールできる |
| 配布内容 | ASAR内98エントリー。テスト・試作・ローカルDB・証跡を含めず、ビルド済みrendererとの一致を確認 |
| `python scripts/verify-handoff.py --with-prototype` | 文書更新後も合格。必須15ファイル・ローカルリンク26件・A01〜A23・参考試作を確認。製品受入とは区別 |

最終操作証跡: `test-artifacts/phase2-nuHytN/`（phase2-home-light.png、phase2-home-dark.png、phase2-parent-archived.png、phase2-restored.png、DB・ログ）。画像確認には同じレイアウトの `test-artifacts/phase2-SpGFZO/` も使用。Phase 1回帰: `test-artifacts/phase1-huFK52/`。最終配布版の起動: `test-artifacts/smoke-xxPldO/`。開発版の起動: `test-artifacts/smoke-pNYVOJ/`。

初回操作試験で、Grid/Flexの最小高さにより主一覧が画面外へ伸び、スクロール位置を保存できない問題を検出。画面のGrid行とmainレイアウトの最小高さを修正した後、縦横位置・選択と再起動後の復元を確認した。テーマ切り替え画像は描画・背景色の遷移完了を待って取得した。合格は修正後の結果のみ。

### 受入・未確認・次の作業

- A04・A05・A11・A15を合格へ更新。既存のA03・A06も回帰試験を実施。A01・A13のWindows IME実入力／終了失敗案内の手動確認は未確認のまま保持する。
- 検索性能の目標測定、10,000件での描画負荷・仮想化、Ctrl+Kとテーマ／資料の横断検索はまだ実施／実装していない。今回の78件の操作検証を性能目標の達成とは扱わない。
- 125%／150%のWindows実表示倍率、1920×1080を含む全画面の受入、実GPU、PowerPoint、バックアップ復元UI・自動バックアップは未確認または後続Phase。
- 次はPhase 3。資料目録、参照先登録・選択・複数ドロップ・正規化／重複再利用、テーマと検討項目ごとの用途メモ・グループ・並べ替え、原本起動と参照切れ修正を実装し、A07〜A10・A22を一時資料で検証する。

## 2026-11-06 — タイムライン追加表記と余白クリック

- タイトル列を閉じた状態では追加テキストを非表示にし、開いた列のボタンを「+ New」へ変更した。空欄カレンダーのクリック／ドラッグによる追加は維持する。
- 右側詳細パネルは外側の余白クリックで閉じる。パネル内、入力欄・ボタン・カレンダー操作、関連付け／削除のモーダルでは誤って閉じない。
- 型チェック、Phase 5の実Electron5段階（phase5-qmJjPT）、初期フォーカス（focus-7vTQBO）が合格。折りたたみ時のテキストなし、パネル内部クリックで維持／外側余白で閉じる操作を追加確認した。
- release/timeline-refinementで生成し、非起動を確認してrelease/win-unpackedへ一式反映。exe／ASAR一致、配布版2回起動／終了（smoke-kecuxx）が合格。
- 続いてユーザー指示によりPhase 6（報告画像コピー、バックアップ・復元）へ進む。

## 2026-11-06 — Phase 6実装・自動検証

- 直前のタイムライン修正（折りたたみ時の追加ラベル非表示、「+ New」、右パネル外の余白クリックで閉じる）は反映済み。その後、ユーザー指示でPhase 6へ進んだ。
- 計画上部の「画像をコピー」から、テーマ・期間・対象行・横幅・解像度を選ぶ白背景プレビューとPNGコピーを実装。長い日本語名を折り返し、スクロール外も全選択行を出力する。空選択・日付不正・過大な画像は説明して拒否する。mainのコピーAPIでPNG署名・形式・寸法を検証し、Electron45のClipboardItem／clipboard.writeへ渡す。
- 設定へバックアップ先変更・世代一覧・復元を追加。30分間隔と正常終了時の自動作成、完成後の30世代整理、失敗通知／再試行を実装した。外部コピーは非同期で、ローカルのDB要求とは別に処理する。終了バックアップは6秒を超えればローカル保存済みと案内し、画面に戻る／バックアップせず終了を選べる。
- 復元前にmanifest全ハッシュ・通常ファイル／相対パス・DB整合性／参照・スキーマ版・本文画像の存在を検証する。現在データをローカルバックアップし、世代をrestore-pendingへコピー・再検証して再起動。SQLiteを開く前にdatabase／attachments／draftsを置換し、before-restore-*へ直前の一式を保持する。途中失敗・中断ジャーナルは巻き戻し、失敗時に空DBで続行しない。
- 新規依存・版変更・Migrationなし。用途別API、保存先設定・復元準備の配置、公式根拠、画像の設計上限はDECISIONS／READMEへ記録した。最初のバックアップ検証で旧方式がWAL／SHMをmanifestへ含める点が判明し、新世代はDELETEモードへ正規化、旧世代の検証は一時コピーへ分離した。旧世代原本を書き換えない。
- `pnpm typecheck`、`pnpm test`（49件）が合格。新規ファイル／DB試験は、画像・下書きとDBの一体復元、ハッシュ破損拒否、途中失敗／中断からの巻き戻し、保存先制約、30世代整理と無関係なフォルダー保持を確認した。初回はNode24のstrip-onlyに非対応のparameter propertyを直して再実行。型チェックで既存本文エディターの暗黙anyが一度出たが、当該ソースを変更せず再実行して合格し、最終型チェックも合格した。
- `pnpm test:phase6` は実Electron3起動で合格。最終証跡は `test-artifacts/phase6-PbEYTm/`。PNG出力／不正形式・空選択拒否、保存先変更・作成・保存先障害中のローカル取得／編集、復元取消、復元要求での終了と次回起動後の旧ページ値・本文画像の再表示を確認した。画像と設定の画面は `phase6-Gum8vu/` も画像確認し、初回の設定スクリーンショットが閉じるアニメーション中だったため待機を補った。出力日付の文字間隔も画像を見て調整した。
- Phase 5の5段階（`phase5-KqmDa1/`）とPhase 1の4段階（`phase1-QzFUj7/`）が回帰合格。Phase 2〜4・フォーカス／クリップボード試験の全操作はPhase 6追加後には再実行していない。関連する単体・DB試験は継続合格。
- `pnpm exec electron-builder --dir --win --x64 --config.directories.output=release/phase6` が合格。非起動を確認し、配布一式を `release/win-unpacked/` へ反映済み。exe／ASARハッシュ一致、ASAR内のHTML・JS・CSS・main／preload一致、テスト／DBの非同梱（1508エントリー）を確認。配布版の2回起動／終了が合格（`test-artifacts/smoke-Q2vaA1/`）。最終の画像復元試験の追加は試験コードだけで、製品生成物に変更なし。
- 未確認: PowerPointへの実貼り付けと16:9実スライド上の可読性、ネイティブ確認ボタンの手操作、実UNC先の長時間無応答、30分の実時間経過、Windows IME実入力・実OS倍率、インストーラーのインストール・署名・更新。試験はクリップボードへのwrite直前でPNGを捕捉し、ユーザーのシステムクリップボードは変更していない。再実行: `pnpm test:phase6`、`pnpm test`、`pnpm test:manual`。手動では計画→画像をコピー→PNG画像をコピー→PowerPointへCtrl+V、設定→バックアップ作成／復元を専用のテスト環境で確認する。
- 次の作業: Phase 7の実画面・キーボード／IME・OS倍率の確認と、残るPowerPoint／ネットワーク／配布の手動受入。A20・A22・A23の未確認部分を完了させるまでは初期版の全受入完了とはしない。

## 2026-11-07 — 通常保存表示の廃止と資料追加・種類アイコン

- 通常の保存中・保存済み・下書き保持・画像保存中とサイドバーのローカル保存表示を外し、保存失敗・入力保護・復旧案内・再試行だけを残した。バックアップの通常成功通知も非表示とし、登録済み参照先の再利用はユーザー指示どおりメッセージで知らせる。計画のドラッグ中は日付プレビューを残してEscの案内文だけを外し、実際のEsc取消は維持した。
- 資料追加では取得した名前／URL・パスの推定名をタイトル入力欄へ表示し、登録前に修正できるようにした。複数件は独立して編集でき、名前なしでも従来の推定名で登録する。既存参照先は読み取り専用の共通名と登録済み案内を表示し、mainも重複を再確認してreused結果を返す。既存の共通名を貼り付けで上書きしない。
- 登録済み一覧は「追加」／「解除」を切り替え、画面を開いたまま続けて操作できる。解除前に該当する用途メモを保存し、最新revisionでこの関連だけを解除する。失敗時は関連と入力を保持し、別ページ・テーマの用途メモと資料登録・原本を維持する。新規登録成功時に閉じて元画面へ残る動作は変更しない。
- 種類は拡張子からPowerPoint・PDF・Word・Excel・画像・テキスト等を共通関数で推定し、左の共通SVGアイコンへ展開した。対象は資料目録・ページ・テーマ・追加一覧／タイトル入力・横断検索。拡張子が見えないリンクは資料名も使い、判定できないものは汎用表示にする。URLの署名／トークンや原本を変更しない。既存のfile／folder／urlとDBスキーマは維持し、種類の表示フィルターをmainで厳密に検証する。追加依存・版変更・保存先変更なし。公式資料とAPIの選択理由はDECISIONSへ記録した。
- `pnpm typecheck`、`pnpm test`（51件）が合格。拡張子・URLパス／パラメーター・共有リンク名・未知拡張子／フォルダー、危険なフィルター値の拒否、表示用判定が参照先を変更しないこと、URLと通常ファイルにまたがるPDF絞り込み、明示した新規資料名・既存名維持と再利用結果を確認した。
- `pnpm test:document-updates` が2起動で合格。最終証跡は `test-artifacts/document-updates-y4J7uQ/`。タイトルの修正／複数件、重複通知と共通名保持、追加／解除の切替、直前の用途メモ保存後の解除・解除失敗／再試行、別関連先の用途メモ保持、全リストのアイコン、検索結果の種類、PDFフィルターと再起動保持、通常保存表示なしを実Electronで確認した。`document-add-title-light.png`、`document-add-existing-dark.png`、`document-types-light.png`／dark、`document-add-title-125.png`を画像確認。1100×700／Electron zoom125%でタイトル欄とフッターが画面内にあることも検査した。
- `pnpm test:clipboard` 2段階（`clipboard-nd8Z12/`）、`pnpm test:phase3` 8段階（`phase3-FIVtvW/`）、`pnpm test:phase5` 5段階（`phase5-1K8uNo/`）、`pnpm test:focus`（`focus-PKJAwz/`）が合格。通常保存／異常終了復旧のPhase 1は4段階（`phase1-dLW7uf/`）、本文画像・右クリック書式・検索のPhase 4は7段階（`phase4-oJdYqY/`）、バックアップ／再起動復元と本文画像表示のPhase 6は3起動（`phase6-u5FAjd/`）が回帰合格。Phase 2の全操作は今回は再実行していない。
- 初回の回帰では、旧試験が保存済み／下書き保持／成功トーストと追加直後の自動閉鎖を待って失敗したため、更新完了・DB／退避ファイル・完成済みバックアップ・ボタン状態を確認する方式へ更新した。新規の操作試験には描画待機も補った。SVGの種別文字を含めても資料の原本起動ボタン名が変わらないよう、資料名のaria-labelを明示した。製品の保存完了を見せるだけの代替ラベルやテスト専用の製品APIは追加していない。
- `pnpm exec electron-builder --dir --win --x64 --config.directories.output=release/document-ui-updates` が合格。非起動を確認し、配布一式を `release/win-unpacked/` へ反映済み。exe／ASARのハッシュ一致、ASAR内の生成物一致と試験・ローカルDBの非同梱（1508エントリー）を確認。`pnpm test:smoke:packaged` の2回起動／終了が合格（`test-artifacts/smoke-PANSzS/`）。最後の125%確認は試験コードだけの追加で、製品生成物は同一。
- `python scripts/verify-handoff.py --with-prototype` が合格。Viteの既存chunk警告は約777kBで継続。Windows IME実入力、実OS表示倍率、実Officeの全クリップボード形式、PowerPoint実貼り付け、実UNC長時間無応答、インストーラー・署名・更新の未確認は維持する。再実行は上記コマンドと `pnpm test:manual`。
- 次の作業はPhase 7の実画面・実機確認と残る手動受入。種類を判定できない共有リンクに対する外部タイトル／ファイル形式取得は追加しない。

## 2026-11-07 — 報告PNGと週・月・クオーターの表示更新

- 報告PNGの左のタイトル一覧を削除し、バーの左端にタイトルを重ねる方式へ変更した。短いバーから右へ文字を表示し、画像右端を超える名前は折り返して行高を確保する。日程未定／期間外の選択行もバーなしの名前で残す。月と日を2段にし、全日または月曜日だけのラベルに統一した。
- 計画の表示単位を週14日・月1か月・クオーター3か月へ変更し、日ビューは外した。カレンダーの実表示幅から日幅を計算して期間全体を収める。月末・閏年・9999年末の範囲を検証し、旧day設定はweekへ読み替える。既存の日程・関連ページ・旧当初予定／実績は保持する。
- クオーターは月曜の日番号のみを表示する。マウスによるバー移動・伸縮、未定行の日付指定、空欄カレンダーからの日付付き作成をロックする。バークリックと右側詳細での日付入力、行追加／挿入・並べ替え・キーボード操作は維持する。週／月は従来の直接操作を利用できる。
- `pnpm typecheck`、`pnpm test`（52件）が合格。暦月の期間長、全日／月曜のみのラベル、旧day→week・quarterの設定検証を追加した。実Electronの `pnpm test:phase5` は5段階合格（最終 `test-artifacts/phase5-uaVRwO/`）。週の14日と画面内幅、月の約1か月、クオーターでの月曜表示・ハンドル非表示、ドラッグ／未定行／空欄操作後に日程・行・プレビューが増えないことを保存待機後も確認した。バークリックで詳細が開くことと、週へ戻した後の移動／伸縮・作成・Undo／保存障害・異常終了復旧も合格。
- `pnpm test:phase6` は3起動合格（`test-artifacts/phase6-g56Ji9/`）。通常の報告PNGと約3か月の密なPNGを生成し、`report.png`／`report-quarter.png`を画像で確認した。アプリの `timeline-quarter.png`／`timeline-month.png`と明暗・狭い画面の証跡も確認。最初の表示で端の短い月区間に欠けた見出しが出たため、32px未満の月見出しは出さないよう調整してPhase 5／6を再実行した。
- 依存・バージョン・DBスキーマ・保存先の変更なし。ResizeObserverの公式資料、日幅・月曜表示の設計値、旧設定互換とロック範囲をDECISIONS、操作方法をREADMEと正本へ反映した。今回はPhase 1〜4や資料追加の全操作は再実行していない。既存ロジック／DBの52件は継続合格。
- `pnpm exec electron-builder --dir --win --x64 --config.directories.output=release/timeline-scales` が合格。非起動を確認して `release/win-unpacked/` へ一式を反映し、exe／ASARハッシュ一致を確認した。`pnpm test:smoke:packaged` の2回起動／終了も合格（`test-artifacts/smoke-MrsiDx/`）。
- Viteの既存chunk警告は約779kBで継続。PowerPointへの実貼り付け・16:9スライドの実判読性、IME実入力、実OS表示倍率、実UNC長時間停止、署名・インストーラーの手動未確認は維持する。再実行は上記コマンドと `pnpm test:manual`。次の作業はPhase 7の実機確認と残る受入条件の完了。

## 2026-11-07 — 検索資料レイアウトと横スクロールの修正

- Ctrl+Kの資料アイコンが広がる原因は、アイコンのspanに本文と同じflex:1が適用されるCSSだった。本文を専用クラスへ分け、資料アイコンを18px固定にした。最近開いた対象と通常検索の両方へ適用し、ページ・テーマの結果と左位置が揃うことを確認した。
- アイコンパックは導入しておらず、既存の独自SVGを継続する。URLの資料を地球アイコンにし、共通linkを24px内に収まる鎖へ変更した。PDF／Office等の形式別アイコンと原本起動は維持する。
- 計画の日幅を画面に合わせて縮める方式をやめ、Full HD・100%のカレンダー幅約1360pxを基準に固定した。週14日・月1か月・クオーター3か月が目安。基準期間の3倍を描画し、横ホイール・Shift＋縦ホイール・スクロールバーで左右へ移動できる。通常の縦ホイール・Ctrlホイールは横操作に置換しない。計画ページだけ1250pxの共通幅制限を外す。他画面と報告PNGの描画は変更しない。
- `pnpm typecheck`、`pnpm test`（52件）が合格。`pnpm test:document-updates` は2起動合格（最終 `test-artifacts/document-updates-A1QHh7/`）。最近開いた資料と検索結果のアイコン幅18px・本文までの間隔を検査し、PDF／URL・ページ・テーマが混在する `recent-documents-light.png`／darkを画像確認した。URLの地球アイコン、資料タイトル編集／追加解除・絞り込みと再起動保持も継続合格。
- `pnpm test:phase5` は5段階合格（`test-artifacts/phase5-r7FjAw/`）。1920×1080ウィンドウ・Electron100%で、週は約14日、月は約1か月、クオーターは約3か月が可視になることを表示幅／日幅で検査。`timeline-fullhd-week.png`／quarterを保存し、週の画面を画像確認した。横方向／ShiftのWheelEventで左右へ動き、画面復帰と再起動後に横位置が復元されること、クオーターの日程ロックと週／月の編集・保存／復旧が継続合格。初回は共通.page-contentの1250px制限が優先されて密度確認が失敗したため、計画専用セレクターを明確にして再実行した。スクロールで見えないハンドルは、試験でも可視位置まで移動してから実マウス入力するよう更新した。
- `pnpm exec electron-builder --dir --win --x64 --config.directories.output=release/search-and-timeline-scroll` が合格。非起動を確認し `release/win-unpacked/` へ一式反映した。exe／ASARハッシュ一致、`pnpm test:smoke:packaged` の2回起動／終了が合格（`test-artifacts/smoke-CHa8aR/`）。依存追加・版変更・DBスキーマ・保存先変更なし。判断の根拠と操作をDECISIONS・README・正本へ記録した。
- 今回はPhase 1〜4／6の全操作は再実行せず、関連する単体試験と資料・計画操作を実施した。実OS表示倍率・実画面最大化の手操作、IME実入力、PowerPoint実貼り付け・実UNC長時間停止、署名／インストーラーの従来の未確認は維持する。次はPhase 7の残る実機確認。

## 2026-11-07 — 月表示を約1.3倍の日数へ変更（配布反映完了）

- 月ビューの日幅のみ1/1.3へ狭め、同じ画面で約1.3倍の日数が見えるようにした。Full HD相当の100%表示では約36〜40日が目安。週・クオーターと報告画像の縮尺は変更しない。
- `pnpm typecheck`、`pnpm test:phase5`の5段階が合格（`test-artifacts/phase5-d55kFX/`）。Full HDでの月の可視日数の検査を更新し、`timeline-fullhd-month.png`を画像確認した。週・クオーター、横スクロールと位置保持、移動／伸縮・取消・Undo、保存障害・異常終了復旧も継続合格。低影響の表示調整のため、単体試験一式や他Phaseの全操作は今回は再実行していない。
- `pnpm exec electron-builder --dir --win --x64 --config.directories.output=release/month-density`が合格。生成済み一式はrelease/month-density/win-unpacked。通常配布先へ反映する直前の再確認でアプリの起動を検出したため、release/win-unpackedは上書きしていない。
- 次の作業: ユーザーのアプリ終了後に通常配布先へ反映し、exe／ASAR一致と `pnpm test:smoke:packaged` の2回起動／終了を確認する。未確認のPowerPoint実貼り付け・実OS倍率等は維持する。

2026-11-07 配布反映の追記: ユーザーの「閉じました」の連絡後、非起動を再確認してrelease/month-density/win-unpackedからrelease/win-unpackedへ一式を反映した。exe／ASARハッシュ一致を確認し、`pnpm test:smoke:packaged`の2回起動／終了が合格（`test-artifacts/smoke-q8Wd24/`）。月表示の配布反映待ちは解消済み。

## 2026-11-07 — Phase 7：総合回帰・画面調整・初期版候補

ユーザー指示によりPhase 7へ進み、初期版候補を用意した。利用しながら修正を続ける方針を正本へ反映し、USER_GUIDEとMAINTENANCEを作成した。機能・製品プロパティ・依存・版・DBスキーマ・保存先の追加変更はない。バージョンは0.1.0、候補の識別日は2026-11-07とする。

### 実装した調整

- 1366×768／1920×1080、Electron zoom100／125／150%、明暗の12条件を反復するtest:phase7を追加。HOME・テーマ・ページ・資料追加（単一／10参照先）・資料目録・計画・報告プレビューの8画面を検査し、96画像と結果JSONを保存する。
- 拡大時の資料追加で、一覧の最小高さが閉じるボタン領域へはみ出す問題を検出。登録領域を縮小・スクロール可能にし、選択領域の高さを確保し、フッターと一覧の重なりを解消した。複数参照先のタイトルのGrid行が縮んで重なる問題も検出し、内容の高さで縦に流す配置へ修正した。
- 最初の修正後、150%で単一タイトル欄が下端で一部欠ける条件を追加検査して検出。狭い高さの余白を詰め、タイトル欄全体の表示と一覧の操作余地を確認してから合格とした。初回の通過だけで完了扱いにしていない。
- 手動確認用のテーマ・ページ・資料・計画を含む専用環境と、同じプロファイルの再起動を追加。--manual --profileはtest-artifacts配下のphase7-*だけを許可し、製品データを受け付けず、再起動時にサンプルを追加しない。製品APIや配布コードに試験用の入口を追加していない。

### 実行した検証

| コマンド／対象 | 結果・証跡 |
| --- | --- |
| pnpm typecheck | 合格。最終の資料追加修正・手動環境の分岐も含む |
| pnpm test | 合格、52件。状態・保存競合・入力退避・画像・資料・計画・バックアップ検証と復元／ロールバック |
| pnpm build / node scripts/build-test.mjs | 合格。Viteの既存chunk警告は約779kBで継続 |
| node scripts/phase1.mjs | 4段階合格、phase1-IPDlaT。通常保存・障害・異常終了17・下書き復旧 |
| node scripts/phase2.mjs | 3段階合格、phase2-HdxFOL。一覧条件・位置・再起動・アーカイブ |
| node scripts/phase3.mjs | 8段階合格、phase3-n0PrTD。資料・用途メモ・原本不変・障害／復旧 |
| node scripts/phase4.mjs | 7段階合格、phase4-oDh75K。本文・画像・検索・復旧。100テーマ／1万ページ／5千資料、検索p95 36.10ms |
| node scripts/phase5.mjs | 5段階合格、phase5-pRSRWs。タイムライン直接操作・横スクロール・表示密度・保存／復旧 |
| node scripts/phase6.mjs | 3起動合格、phase6-AWzsAv。PNG・バックアップ・復元再起動と本文画像 |
| node scripts/clipboard.mjs | 2段階合格、clipboard-CVAm6e。名前付きリンク・貼り付けと再起動保持 |
| node scripts/focus.mjs | 初回focus-yDwtMV、最終focus-Vglfigが合格。新規入力・再作成・検索中にフォーカスを奪わない |
| node scripts/document-updates.mjs | 初回document-updates-8bxHqm、最終document-updates-RArggGの2起動合格。タイトル編集・重複・追加解除・種類・保存・再起動 |
| pnpm test:phase7 | 最終修正で12条件×8画面が合格。phase7-3NjxOzに96画像・layout-results.json。代表画像を視認し、重なり・タイトル入力欄全体・一覧到達性を確認 |
| pnpm exec electron-builder --win nsis --x64 --config.directories.output=release/phase7 | 合格。フォルダー版とEngineering Workspace Setup 0.1.0.exe（123,205,945bytes）を生成。未署名・既定Electronアイコン |
| 配布内容・反映 | ASAR1508エントリー、HTML／JS／CSS／main／preloadの5ファイル一致、試験・DBの非同梱を確認。初回の検証スクリプトがWindowsパス区切りを誤変換して読めなかったため、ネイティブ区切りへ直し一致確認。非起動を確認してrelease/win-unpackedへ一式反映し、候補とのexe／ASARハッシュ一致 |
| pnpm test:smoke:packaged | 2回起動／終了が合格、smoke-sF2PQX。Node権限分離・API・SQLite・HOMEを確認 |
| python scripts/verify-handoff.py --with-prototype | 合格。必須15ファイル・ローカルリンク38件・A01〜A23・参考試作 |

各証跡はtest-artifacts配下。製品ユーザーデータ・実資料・旧アプリは試験していない。DB／画像／下書きを含む保存・復元の自動試験に、今回新たな未解決の不具合は検出していない。

### 未確認・再実行・次の作業

- Windows操作ツール（computer-use）を使うためスキルとAPIを読み、起動したテスト用Electron窓を探したが、一覧に現れず再取得でも対象を取得できなかった。製品の起動試験自体は成功しており、操作ツールでの手入力が制約。A01の実IME変換、A13のネイティブ終了案内全選択肢は未確認を維持する。
- A20のPowerPoint実貼り付け・16:9上の可読性、A22の実UNC長時間停止、A23の実Windows倍率は未確認。PNG取得・保存先障害とローカル編集・Electron zoomの成功で代替合格にしない。NSIS生成は合格だが、インストール／アンインストール・署名・更新と30分の実時間経過の確認は未実施。
- 再実行: pnpm typecheck、pnpm test、pnpm test:phase7。手動環境はpnpm test:phase7:manual。同じ専用データの再起動はnode scripts/phase7.mjs --manual --profile "test-artifacts/phase7-実際の名前"。詳細手順はMAINTENANCEを参照。
- A02〜A12・A14〜A19・A21の18件は合格を維持。A01・A13・A20・A22・A23の5件は部分確認のため未確認。Phase 7の全完了条件達成とはしない。
- 次の作業: 実機手動受入の残件と、利用中に再現した不具合・操作負担を小さく修正する。変更ごとに仕様・根拠・試験・配布反映を記録し、既存データと原本を保護する。

最終追記: プロファイル再使用スクリプトがプロジェクトルート指定を拒否することをPHASE7_PROFILE_GUARD_OKで確認。変更後のスクリプトでも12条件×8画面を再実行し合格（phase7-f38rJe）。製品生成物はphase7-3NjxOzの最終画面試験時と同一。pnpm test:smoke:devも開発サーバー経路の2回起動／終了が合格（smoke-8TonET）。文書参照確認を最終更新後に再実行して合格。配布exe／ASARとインストーラーのSHA-256、ASAR内容検証の結果はphase7-3NjxOz/release-sha256.jsonとpackage-verification.jsonに記録した。

## 2026-11-07 — C案のRアイコンを製品へ反映

- ユーザー選定のC案をassets/app-icon.png／app-icon.icoへ形式・サイズ変換。ICOの16／24／32／48／64／128／256px収録を検査した。ウィンドウ、配布exe、NSISのインストーラー／アンインストーラー、アプリ左上ロゴへ設定。アプリ名・識別子・保存領域は変更していない。
- python scripts/generate-icons.py、pnpm typecheck、pnpm buildが合格。pnpm exec electron-builder --win nsis --x64 --config.directories.output=release/redia-iconで配布一式とインストーラーを生成。未署名、既存のVite約779kB警告は継続。
- ASAR内のPNG／ICOとmain／preload／HTMLがビルド元と一致し、試験・候補画像を同梱しないことを確認。非起動を確認し、release/win-unpackedへ一式反映。候補とのexe／ASARハッシュ一致を確認した。
- pnpm test:smoke:packagedの2回起動／終了が合格（test-artifacts/smoke-MvSPcf）。pnpm test:smoke:devも2回合格（smoke-OZGXgj）。配布のshell.pngで左上のRを視認した。データ機能を変更しないアイコンの反映のため、52件の単体試験やPhase 1〜7の全操作は今回再実行していない。
- 最初のElectron app.getFileIconによる取得では環境の汎用ファイル画像が返ったため、これを合格証跡とはせず、WindowsのExtractIconExで実行ファイルのPEリソースを直接抽出。app-resource.png／installer-resource.pngがC案のRであることを画像確認した（test-artifacts/icon-check）。Windows Explorerのキャッシュ・既存ピン留めの表示、実タスクバーの手操作、インストール／アンインストールは未確認。
- READMEへ生成・再実行方法を記録。再確認はpython scripts/generate-icons.py、pnpm typecheck、pnpm build、pnpm package:dir、pnpm test:smoke:packaged。次の作業は従来の実機受入残件と利用中の改善を継続する。

## 2026-11-07 — 0.1.1：計画の密度・今日・テーマ資料の並べ替え

- 計画の行高46→36px、バー32→30pxへ圧縮。文字は14pxを維持し、バー内で「…」による省略とホバー全文を実装。短いクオーターバーでは横余白も幅に合わせて小さくし、文字領域自体が外へ出ない。報告PNGの折り返しは変更していない。
- 今日ボタンがfromだけを変更し旧scrollLeftを残す原因を修正。今日の7日前を起点に、描画後の可視幅と日幅で横位置を調整する。同じ開始日での再クリックも毎回動く。
- テーマ資料はページ経由も含む全行へハンドルとドロップを適用。テーマ一覧専用の順序をスキーマ7のtheme_document_orderへ保存する。直接関連を増やす方式にはせず、ページ内順序・メモ・関連・revisionを変更しない。mainは集合・revisionを検証し全順序をトランザクションで更新する。依存・appId・データ保存先は維持、更新を識別するため0.1.1へ変更。
- pnpm typecheckが最終合格。pnpm testは53件合格。混在するテーマ資料の完全集合・競合拒否・関連情報不変・DB再起動後保持を追加確認。既存の保存・画像・資料・バックアップ／復元試験も継続合格。
- pnpm test:phase5は5段階合格（最終test-artifacts/phase5-aFEOZs）。行高・14px維持・バー内の文字境界を検査し、週／月／クオーター×タイトル列の開閉で、未来日から今日が画面内に見えることを確認。既存ドラッグ・期間指定・Undo・ロック・異常終了復旧も合格。画面はphase5-o4nYjk/timeline-light.pngで視認した。
- pnpm test:phase3は8段階合格（phase3-wuFbaM）。直接資料と2件のページ資料を混ぜ、ページ→直接資料の前、直接→ページ資料の前、ページ同士を実ドラッグして順序変更、再表示で復元、document_uses全体が不変であることを確認。theme-aggregate-order.pngを画像確認した。既存の資料保存・部分障害・詳細・ドラッグ・復旧も回帰合格。
- pnpm test:phase6は3起動合格（phase6-xvngEu）。スキーマ7でバックアップ作成・障害時の編集、復元再起動と本文画像を確認した。
- 最初の検証で試験コードの型不足を修正し、テーマドラッグ試験は初期の同順位ID順に依存する誤った期待を直して、開始順を明示した上で再実行した。上記の合格は修正後の結果。テスト失敗を製品不具合の解消済みとして混ぜない。
- 再実行: pnpm typecheck、pnpm test、pnpm test:phase3、pnpm test:phase5、pnpm test:phase6。生成はpnpm exec electron-builder --win nsis --x64 --config.directories.output=release/timeline-document-fixes。配布反映・起動結果は下の追記を参照。
- 次は既存の実機受入残件と利用中の改善を継続。Windows実OS倍率・IME実入力・実PowerPoint貼り付け・実UNC長時間停止・インストーラーの手動更新操作は未確認のまま。今回の入力画面調整でA01等を合格へ繰り上げない。

0.1.1配布の最終追記: 最終CSSまで含めてrelease/timeline-document-fixesへ再生成し、Engineering Workspace Setup 0.1.1.exeを作成。ASAR内のrenderer全ファイル・main／preload・ICOのバイト一致、package.jsonのversion=0.1.1、試験・DBの非同梱を確認した。最初はbuilderが整形するpackage.jsonにバイト一致を要求して検証が止まったため、生成物の照合と版の意味的検証へ修正し、合格後に反映した。非起動を確認してrelease/win-unpackedへ一式反映、exe／ASARハッシュ一致、pnpm test:smoke:packagedの2回起動／終了が合格（smoke-Q8GQZV、version=0.1.1）。インストール済みアプリの更新操作は実行していない。利用時は起動中のアプリを閉じ、上記0.1.1インストーラーを実行する。ユーザーの製品DBを試験や起動確認で開いていない。

## 2026-11-07 — 0.1.2：バー内の省略表示だけを取り消し

- ユーザーの訂正どおり、日程バーより長いタイトルは右へはみ出して表示し、「…」で省略しない従来の形へ戻した。行高36px・文字14px・バー高30pxは維持し、縦方向はバー内に収める。今日ボタンとテーマ資料全行の並べ替えは変更しない。
- pnpm typecheck、pnpm test:phase5の5段階が合格（test-artifacts/phase5-d03mcy）。長いラベルがバー幅より広く、overflow:visibleであること、文字14px・行高36px、縦方向の境界、全表示単位とタイトル列開閉での今日ボタンを確認。ドラッグ／伸縮・Undo・保存失敗・異常終了復旧・再起動保持も合格。timeline-light.pngを視認した。
- 変更は表示CSSとアプリ版0.1.2、対応するテスト／文書。DBスキーマ7・データ保存先・API・依存は変更なし。低影響の表示復元のため単体53件・資料／復元の全操作は今回は再実行していない。0.1.1の「バー内省略」の記録は取り消し済みの履歴とする。
- pnpm exec electron-builder --win nsis --x64 --config.directories.output=release/timeline-label-restoreで修正版を生成。配布反映と起動結果は続く追記を参照。次は従来の実機受入残件と利用中の修正を継続する。
0.1.2配布追記: インストーラー生成が合格。ASARの生成物一致・版0.1.2と試験／DBの非同梱を確認し、非起動の通常配布先へ一式反映。exe／ASARハッシュ一致、配布版の2回起動／終了が合格（smoke-gIdVka）。インストール済みアプリの更新操作は未実施。更新用はrelease/timeline-label-restore/Engineering Workspace Setup 0.1.2.exe。

## 2026-11-07 — 0.1.3：全テーマの計画をグループ表示

- 「すべてのテーマ」を選ぶと、テーマ順の見出しの下へ所属行をまとめ、他テーマの日程も同じカレンダーで見られる。未所属は末尾のグループ、検索0件のテーマは非表示。個別テーマ／未所属指定は従来の平坦な一覧。タイトル列を閉じてもカレンダー内にテーマ名を残す。
- 各行の直下挿入で元行のテーマを継承する。グループ間の所属変更は既存の詳細欄、ドラッグ順序変更は同じテーマ内に限定し、表示切替でDBの配列や日程・所属を書き換えない。既存の行高36px・文字14px・省略なしラベル・今日ボタン・期間操作を維持。
- 型チェック、単体／DB54件が合格。新しいグループ関数でテーマ順・内部順・未所属／日付なし・空グループ・入力配列不変を確認。依存・API・スキーマ7・保存先変更なし。React公式Fragmentを根拠としてDECISIONSへ記録。
- pnpm test:phase5が5段階合格（test-artifacts/phase5-VaCP0R）。全テーマ・未所属・検索でグループ再評価、列開閉と見出し、直下挿入のテーマ継承、詳細の所属変更、個別テーマ表示、再起動と既存日程操作／保存障害／異常終了復旧を確認。timeline-grouped.pngとtimeline-grouped-collapsed.pngで複数テーマの日程と見出しを画像確認した。
- 操作試験の初回は、前の試験から残った検索／列の開閉を明示しなかったため待機に失敗。開始条件と列を開いた後の描画待機を補い、最終試験を全段階で実行し合格。pnpmの最初の非昇格実行は作業領域登録のsymlinkがEPERMとなり、通常実行環境で再実行して合格した。
- 再実行: pnpm typecheck、pnpm test、pnpm test:phase5、pnpm test:phase7。配布生成はpnpm exec electron-builder --win nsis --x64 --config.directories.output=release/timeline-theme-groups。追加レイアウト・配布反映・起動結果は追記する。
- 次は利用中の改善と実機受入残件を継続する。実OS倍率・IME・PowerPoint実貼り付け・実UNC無応答・インストーラーの実更新は未確認。機能の実装で未確認項目を合格へ繰り上げない。

0.1.3最終追記: pnpm test:phase7は12条件×8画面が合格（phase7-43f49b）。フォルダー版とEngineering Workspace Setup 0.1.3.exeの生成が合格。ASAR内のrenderer全ファイル・main／preload・ICO一致、version=0.1.3と試験／DB非同梱を確認。非起動の通常配布先release/win-unpackedへ一式反映しexe／ASARハッシュ一致、pnpm test:smoke:packagedの2回起動／終了が合格（smoke-NbG7vS）。既存のVite約781kB警告・未署名は継続。インストール済みアプリの更新は未実施。アプリ終了後にrelease/timeline-theme-groups/Engineering Workspace Setup 0.1.3.exeを実行して更新する。ユーザーの製品DBを試験で開いていない。

## 2026-11-07 — Redia 0.1.4：グループ末尾追加・表示連動PNG・名称変更

- 全テーマ表示の各グループ末尾へ1行の追加欄を実装。「+ New」はそのテーマの未定行を作り、空欄カレンダーのクリックは単日、ドラッグは期間付き行を作る。タイトル列を閉じてもカレンダーから操作でき、未所属はnullを継承する。全テーマ時の末尾追加をグループ末尾へ集約し、空の計画は従来どおり未所属の作成欄を出す。クオーターの日程ロック、行高36px・文字14px・省略しないタイトルを維持。
- PNGは開いた時のテーマ・検索条件・横スクロール／可視期間を初期値へ反映。個別テーマはその行だけ、全テーマはテーマ名の見出し・グループ順・空行を含める。白背景・バー上の名前・日本語折り返し・既存の出力限界を維持し、+ New等の操作UIは描かない。既存プレビューでテーマ・期間・行選択の調整もできる。
- 追加のユーザー指示により名称をRediaへ変更。package.name／productName・ウィンドウ名・HTML title・左上表記・配布exe・NSIS名・起動スクリプトを更新した。appId=jp.engineeringworkspace.desktop、%LOCALAPPDATA%/EngineeringWorkspace/production/・スキーマ7・API・依存は維持。ユーザーのDBを試験用に開かず、既存領域の配置を変えていない。
- pnpm typecheck、pnpm test（54件）が合格。pnpm test:phase5の5段階も合格（test-artifacts/phase5-5pYY84）。テーマ／未所属末尾ボタン、展開時の単日カレンダーと閉じた状態の期間ドラッグ、作成後のthemeIdと日付を検査。画像の初期テーマ、他テーマ行の除外、検索条件、可視開始日、Canvasのテーマ見出し描画を検証。report-selected-theme.pngとreport-all-groups.pngを視認し、画像プレビューも記録した。前半の試験では検索で除外されたグループを期待して失敗したため、条件に合うテーマ行を用意した上で最終再実行した。
- pnpm test:phase6は3起動合格（最終phase6-GrGeDP）。全テーマのグループ付きPNGのコピーAPI、空選択拒否・バックアップ・障害中のローカル編集・復元再起動と本文画像を確認。システムクリップボードはwrite直前で捕捉し、実PowerPoint貼り付けは未確認のまま。
- pnpm test:phase7は12条件×8画面が合格（phase7-t7dGRv）。Redia表示で主要画面・拡大率のレイアウトを確認。テスト用の日本語固定サンプルはtests内だけで、製品コードには持ち込んでいない。
- pnpm exec electron-builder --win nsis --x64 --config.directories.output=release/redia-0.1.4が合格。Redia.exeとRedia Setup 0.1.4.exeを生成。ASAR内のrenderer全ファイル・main／preload・ICOの一致、版／productName、試験・DB非同梱を確認。非起動の通常配布先release/win-unpackedへ一式反映し、Redia.exe／ASARハッシュ一致を確認。旧名の生成exeだけを通常配布先から除き、過去の配布フォルダーは保持した。
- pnpm test:smoke:packagedは2起動合格（smoke-TaMLWh）。pnpm test:smoke:devも2起動合格（smoke-eN0I4F）。titleとbrandがRediaであることも検証。未署名とVite約782kB警告は継続。インストール済みアプリの更新実操作は未実施で、アプリ終了後にrelease/redia-0.1.4/Redia Setup 0.1.4.exeを実行する。
- 再実行: pnpm typecheck、pnpm test、pnpm test:phase5、pnpm test:phase6、pnpm test:phase7、pnpm test:smoke:packaged。次は利用中の改善と従来の実機残件を継続する。実IME・実OS倍率・実UNC長時間停止・実PowerPoint貼り付けの未確認は維持。
# 2026-11-08 GitHub公開準備

- ユーザーの指示により、公開リポジトリ `https://github.com/yuma1nu/Redia` へRedia 0.1.4のソース・仕様・試験コード・アイコンを公開する。既存リポジトリが空であることを `git ls-remote` で確認。
- ルートで `git init -b main` を実行。既存の `.gitignore` に従い、node_modules・dist・dist-electron・release・test-artifacts・ローカルDB・バックアップ・環境変数ファイルを除外。SQLiteの副ファイルも除外対象へ追加。
- 公開対象について秘密鍵・GitHub等のトークンの代表的な形式を走査し、該当なし。これはすべての秘密情報が存在しないことの保証ではない。
- `pnpm typecheck` 合格、`pnpm test` 54件合格、`pnpm build` 合格。ビルドのチャンク容量警告は残る。初回のネットワーク照会は実行環境の接続制約で失敗し、接続許可後の再実行で成功。
- アプリの挙動変更はなく、A01〜A23の受入判定と既存の手動未確認項目は変更しない。インストーラーのRelease添付は今回のソース公開には含めない。

