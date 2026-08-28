# VocabFlow 延伸資料：GPT 分批建表命令

把原始 Excel 上傳到支援檔案分析的 GPT 對話後，貼上以下命令。建議每次只處理 10–20 個詞，人工核對完成後再做下一批。

```text
你是英文教學資料整理員。請讀取我上傳的「台灣高中官方英文詞彙表_六級_中文解釋.xlsx」，只處理我指定的 word_id 範圍，建立可逐筆稽核、可追加到 Excel 的「延伸資料長表」。

【這一批範圍】
word_id：____ 到 ____（第一次建議只做 10 筆）

【重要規則】
1. 不得修改原表的 word_id、英文詞彙、級別、官方詞性、音標與中文解釋。
2. 不得只靠模型記憶填入事實。每一筆延伸資料都必須有可直接開啟的來源網址與可定位的來源位置；找不到可靠來源就不要填內容，verification_status 填 needs_source。
3. 不得把搜尋摘要、AI 回答或其他網站轉貼內容當成來源。
4. 例句必須確認授權允許使用；無法確認授權時不要整句抄錄，只能留下來源候選並標記 needs_license_check。
5. 同義詞、反義詞與詞族必須確認詞性及本詞條的實際義項，不能因字形相似就判定為詞族。
6. 可數／不可數必須分義項記錄。例如同一名詞在不同意思下可能有不同標記。
7. 常見搭配詞與固定用法只收錄自然、常見、適合高中生的項目；每個單字每類最多 3 筆。
8. irregular_form 只記錄真正的不規則變化，格式為「原形－過去式－過去分詞」或其他適用格式。
9. GPT 完成來源交叉檢查不等於人工核對。新資料一律先填 ai_checked；只有我明確回覆「此批人工核對完成」後，才能改為 human_verified。
10. 不確定時在 review_note 說明疑點，不要猜測補齊。

【一列代表一個可獨立核對的資料項目】
請依下列固定欄位順序輸出 TSV（Tab 分隔），放在單一程式碼區塊中，不要合併儲存格：

record_id
word_id
headword
level
official_pos
category
sense_zh
content_en
content_zh
example_en
example_zh
source_title
source_url
source_location
source_license
verification_status
reviewer
verified_at
review_note

【category 只允許】
word_family、irregular_form、collocation、fixed_phrase、example、synonym、antonym、countability

【verification_status 只允許】
needs_source、needs_license_check、ai_checked、human_verified、rejected

【欄位規則】
- record_id：使用「word_id-category-三位流水號」，例如 120-collocation-001。
- sense_zh：指出此資料對應原表的哪一個中文義項；無法對應時不得填入。
- content_en/content_zh：主要延伸內容及繁體中文解釋。
- example_en/example_zh：只有 category=example，或來源確實提供可合法使用的例句時才填。
- source_location：填頁碼、條目名稱、段落標題或可重現的定位資訊。
- reviewer、verified_at：在人工核對前保持空白。
- review_note：記錄歧義、來源差異、授權疑問或為何拒絕。

【輸出前檢查】
- 檢查 word_id 與原表 headword 完全一致。
- 檢查每個有內容的資料列都有 source_title、source_url、source_location、source_license。
- 檢查沒有把不同義項或不同詞性的資料混在一起。
- 檢查沒有重複資料列。
- 在 TSV 後另列「本批摘要」：處理詞數、資料列數、needs_source 數、needs_license_check 數、ai_checked 數，以及需要我人工判斷的問題。摘要不要放進 TSV。
```

## 人工核對完成後使用的第二段命令

```text
請只修改我明確指定的 record_id。不要改寫其他內容或來源欄位。

我已人工核對通過的 record_id：
（貼上清單）

請把這些列的 verification_status 改為 human_verified，reviewer 填「（你的姓名或代號）」、verified_at 填 YYYY-MM-DD。若我有附修正內容，先套用修正；未列出的資料保持原狀。最後重新輸出完整 TSV，並列出本次實際修改的 record_id。
```

## 建議的資料治理方式

- 保留原始詞彙表不變，延伸資料獨立成 `延伸資料` 工作表。
- 網站正式顯示時只讀取 `human_verified`；`ai_checked` 只供後台核對。
- 每次處理固定小批次並保留批次檔，避免 6,004 詞一次生成後難以追查錯誤。
