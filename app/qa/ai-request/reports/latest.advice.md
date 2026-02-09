# Advisor Report — advisor-2026-02-08T13-51-30-840Z

- Generated: 2026-02-08T13:58:30.080Z
- QA report: /home/mlweb/biznesinfo-develop.lucheestiy.com/app/qa/ai-request/reports/run-2026-02-08T05-33-54-386Z.json
- Judge report: /home/mlweb/biznesinfo-develop.lucheestiy.com/app/qa/ai-request/reports/judge-2026-02-08T13-32-25-593Z.usefulness.json
- Focus scenarios: 30
- Advisors: gemini, kimi, minimax

## Focus Scenarios

- UXA013 (pass, usefulness 0.333/5): Банк A: Поиск компании — запрос 13
- UXA022 (pass, usefulness 1/5): Банк A: Поиск компании — запрос 22
- UX101 (pass, usefulness 1.333/5): Закупка гофрокоробов: Минск, опт, доставка, брендирование
- UX102 (pass, usefulness 2/5): Фаззи-поиск компании по обрывкам названия
- UX104 (pass, usefulness 2/5): Лидоген: логистика в Гомеле, сегментация и ограничения выгрузки
- UX111 (pass, usefulness 2/5): Срочно нужен контакт: телефон/адрес/график компании
- UXA012 (pass, usefulness 2.333/5): Банк A: Поиск компании — запрос 12
- UX106 (pass, usefulness 2.667/5): Администратор обновляет карточку компании
- UXA001 (pass, usefulness 2.667/5): Банк A: Поиск компании — запрос 1
- UXA005 (pass, usefulness 2.667/5): Банк A: Поиск компании — запрос 5
- UXA008 (pass, usefulness 2.667/5): Банк A: Поиск компании — запрос 8
- UXA011 (pass, usefulness 2.667/5): Банк A: Поиск компании — запрос 11
- UXB029 (pass, usefulness 2.667/5): Банк B: Поставщики/подрядчики — запрос 29
- UXB031 (pass, usefulness 2.667/5): Банк B: Поставщики/подрядчики — запрос 31
- UXB033 (pass, usefulness 2.667/5): Банк B: Поставщики/подрядчики — запрос 33
- UXB034 (pass, usefulness 2.667/5): Банк B: Поставщики/подрядчики — запрос 34
- UX103 (pass, usefulness 3/5): Проверка контрагента перед договором (дью-дилидженс)
- UXA002 (pass, usefulness 3/5): Банк A: Поиск компании — запрос 2
- UXA004 (pass, usefulness 3/5): Банк A: Поиск компании — запрос 4
- UXA014 (pass, usefulness 3/5): Банк A: Поиск компании — запрос 14
- UXA015 (pass, usefulness 3/5): Банк A: Поиск компании — запрос 15
- UXA016 (pass, usefulness 3/5): Банк A: Поиск компании — запрос 16
- UX108 (pass, usefulness 3.333/5): Сравнение компаний по рейтингу/отзывам: клининг Минск
- UX110 (pass, usefulness 3.333/5): Подбор для новой кофейни: поставщики и чек-лист закупок
- UXA006 (pass, usefulness 3.333/5): Банк A: Поиск компании — запрос 6
- UXA009 (pass, usefulness 3.333/5): Банк A: Поиск компании — запрос 9
- UXA017 (pass, usefulness 3.333/5): Банк A: Поиск компании — запрос 17
- UXB026 (pass, usefulness 3.333/5): Банк B: Поставщики/подрядчики — запрос 26
- UXB030 (pass, usefulness 3.333/5): Банк B: Поставщики/подрядчики — запрос 30
- UX107 (pass, usefulness 3.667/5): Поиск подрядчика под ключ: видеонаблюдение в офисе

## Consensus

- Top areas:
  - prompt: 8
  - retrieval: 5
  - template: 3
  - guardrails: 3
  - geo: 1
  - ranking: 1
- Recurring recommendations:
  - приоритет прямого поиска и вывода результатов перед инструкциями (1)
  - улучшение дифференциации намерений: 'показать' vs 'как сделать' (1)
  - стандартизация вывода для сравнений и списков лидов (1)
  - внедрение или усиление fuzzy search для названий компаний (1)
  - улучшение контекстной связности в многоходовых диалогах (1)
  - конкретизация сообщений об отсутствии данных или ограничениях (1)
  - add mandatory tool-use trigger for company/supplier queries (1)
  - fix intent classification for filter operations (1)
  - implement fuzzy/prefix search with top-n display (1)
  - add 'limited results' response template (1)
  - add unp-based company lookup endpoint (1)
  - add response type validation layer (1)

## gemini

- Summary: Ассистент демонстрирует высокую надежность по строгим QA проверкам, но имеет существенные недостатки в предоставлении конкретных и полезных результатов пользователям. Вместо прямого выполнения запросов, связанных с поиском или извлечением данных, он часто предлагает общие инструкции по поиску. Это приводит к низким оценкам полезности от судей, особенно в сценариях, требующих поиска компаний, сравнения поставщиков и извлечения специфических данных. Основные направления для улучшения включают повышение точности распознавания намерений, активацию прямого поиска в каталоге и улучшение способности извлекать и представлять структурированные данные.

### Priority Plan

- P0 — Прямое получение и фильтрация данных из каталога
  why: Пользователи ожидают не инструкций по поиску, а непосредственных результатов. Текущее поведение 'инструкций вместо результатов' является критическим препятствием для полезности.
  impact: Значительное повышение полезности, сокращение 'общих советов' и прямое предоставление запрашиваемых списков компаний/данных. Улучшение удовлетворенности пользователей, которым не придется выполнять поиск вручную.
  validate: UXA013, UXA022, UX101, UXA012, UXA001, UXA005, UXA008, UXA011
- P0 — Улучшенное распознавание намерений и управление контекстом
  why: Частое неверное толкование запросов приводит к предоставлению нерелевантной информации (например, 'показать' вместо 'добавить'). Потеря контекста в многоходовых диалогах снижает эффективность и фрустрирует пользователя.
  impact: Повышение точности ответов, снижение количества 'неполезных' вердиктов за счет правильной интерпретации запросов пользователя и поддержания нити диалога, что улучшает пользовательский опыт в сложных сценариях.
  validate: UXA013, UXA022, UX106, UX110, UX107
- P1 — Формирование конкретных списков сравнения и лидов
  why: Запросы на сравнение нескольких вариантов или предоставление списков лидов часто приводят к общим рекомендациям. Пользователям нужны actionable data, а не инструкции.
  impact: Прямое предоставление таблиц сравнения или списков компаний с релевантными параметрами, что ускоряет принятие решений пользователями и повышает ценность ассистента как инструмента для бизнеса.
  validate: UX101, UX102, UX104, UXA011, UXB029, UXB031, UXB033, UXB034
- P1 — Улучшенная обработка неточных и частичных запросов (Fuzzy Search)
  why: Ассистент часто не может обработать частичные или неточные названия компаний, требуя точного ввода, что не соответствует реальным условиям использования и снижает UX.
  impact: Более успешное нахождение компаний по неполным данным, снижение необходимости для пользователя повторять или уточнять запрос, повышение 'попадания' в целевую компанию с первого раза.
  validate: UX102, UXA001, UXA002, UXA005, UXA006, UXA009

### Recommendations

- [R1] (retrieval, effort M) Приоритет прямого поиска и вывода результатов перед инструкциями
  action: Изменить логику обработки запросов, чтобы при явном запросе на поиск или фильтрацию компаний ассистент выполнял эти действия через доступные инструменты (API каталога Biznesinfo) и возвращал конкретные результаты, а не пошаговые инструкции для пользователя. Использовать форматирование markdown для таблиц и списков.
  hint: Обновить prompt, чтобы явно поощрять использование внутренних инструментов поиска/фильтрации. Разработать или адаптировать инструмент для выполнения запросов к базе данных Biznesinfo и форматирования вывода. Пример: если запрос 'Покажи ком…
  impact: Снижение 'generic fallback' на 90%, увеличение полезности ответов, так как пользователь получает то, что просит, а не 'как это сделать'.
  risk: Medium (требует доработки интеграции с каталогом)
  validate: UXA013, UXA022, UX101, UXA012, UXA001, UXA005, UXA008, UXA011
- [R2] (prompt, effort S) Улучшение дифференциации намерений: 'показать' vs 'как сделать'
  action: Переработать системный prompt и/или добавить few-shot примеры, чтобы ассистент четко различал запросы на просмотр существующей информации ('Покажи карточку компании') от запросов на инструкции по действию ('Как добавить компанию').
  hint: В prompt добавить явные конструкции вида 'Если пользователь просит X, то покажи X. Если пользователь спрашивает КАК сделать X, то дай инструкцию.' Усилить негативные примеры для предотвращения мисинтерпретации.
  impact: Устранение критических ошибок 'misinterpretation of user intent', особенно в UXA022 ('покажи карточку' -> 'как добавить') и UX106 ('время модерации' -> 'как добавить').
  risk: Low
  validate: UXA022, UX106
- [R3] (template, effort M) Стандартизация вывода для сравнений и списков лидов
  action: При запросах на сравнение или списки поставщиков (e.g., 'Сравни 5 вариантов', 'Дай список лидов') ассистент должен стремиться возвращать данные в структурированном формате, например, в виде таблицы, с указанием доступных параметров (цена, срок, MOQ, контакты).
  hint: Разработать шаблоны markdown-таблиц для вывода сравнительных данных. В prompt явно указать, что при запросе сравнений или списков следует использовать эти шаблоны. Если данных по какому-либо параметру нет, явно указывать 'Нет данных' или '…
  impact: Повышение полезности в сценариях сравнения (UX101, UX102) и лидогенерации (UX104), делая ответы сразу применимыми для пользователя.
  risk: Medium (требует четкого определения доступных полей)
  validate: UX101, UX102, UX104
- [R4] (retrieval, effort L) Внедрение или усиление Fuzzy Search для названий компаний
  action: Ассистент должен автоматически применять механизмы нечеткого поиска (fuzzy search) для названий компаний, включая вариации написания (кириллица/латиница), частичные совпадения и распространенные сокращения, вместо того чтобы требовать точное название.
  hint: Если в основе лежит Meilisearch или аналоги, обеспечить, что механизм нечеткого поиска активирован и настроен. Если нет, рассмотреть использование более продвинутого поискового инструмента или модифицировать prompt для генерации нескольких…
  impact: Значительное улучшение прохождения сценариев с неполными/неточным названиями (UX102, UXA001, UXA002, UXA005, UXA006, UXA009), уменьшение 'refusal behavior'.
  risk: High (зависит от доступности и настройки поисковой системы)
  validate: UX102, UXA001, UXA002, UXA005, UXA006, UXA009
- [R5] (prompt, effort M) Улучшение контекстной связности в многоходовых диалогах
  action: Обеспечить, чтобы ассистент сохранял и активно использовал контекст предыдущих реплик пользователя (например, географические ограничения, тип компании, ключевые параметры) в последующих ответах, избегая возврата к общим инструкциям или предоставления нерелевантной информации.
  hint: В prompt добавить инструкции по поддержанию контекста: 'всегда учитывай предыдущие уточнения пользователя' и 'не предлагай информацию, которая противоречит установленному контексту'. Использовать более длинный контекст окна или механизм 'm…
  impact: Устранение 'context break' и 'irrelevant response' в многоходовых сценариях (UX101, UX110, UX107), повышение связности и логичности диалога.
  risk: Medium
  validate: UX101, UX110, UX107
- [R6] (guardrails, effort S) Конкретизация сообщений об отсутствии данных или ограничениях
  action: Вместо общих отказов или переключения на инструкции, ассистент должен четко и конкретно объяснять, почему он не может предоставить запрашиваемую информацию (например, 'данных по рейтингу нет', 'нужен полный УНП', 'график работы не указан в карточке'), и что требуется для дальнейшего поиска.
  hint: Добавить в prompt примеры формулировок для различных сценариев отсутствия данных. Разработать guardrails, которые будут перехватывать попытки ассистента дать общий ответ и направлять его на более конкретное объяснение ограничения.
  impact: Повышение доверия пользователя и снижение фрустрации, так как ассистент не 'отказывает', а объясняет причины и пути решения (UX111, UX103, UX108, UXA015).
  risk: Low
  validate: UX111, UX103, UX108, UXA015

## kimi

- Summary: Biznesinfo assistant suffers from a systematic "generic fallback" pattern: instead of executing searches and returning concrete company data from the catalog, it provides search instructions and checklists. This is the root cause of low usefulness scores (2.62-4.26 avg) despite 100% strict-check pass rate. The assistant behaves like a search tutorial rather than a data retrieval service. Priority fixes: (1) Force tool-use for catalog queries, (2) Add retrieval confidence thresholds with graceful degradation, (3) Fix intent recognition for filter/view/add operations.

### Priority Plan

- P0 — Enforce catalog tool invocation on company queries
  why: 80% of low-usefulness scenarios show assistant giving search instructions instead of executing searches. The assistant has catalog access but doesn't use it.
  impact: Converts ~15 'generic fallback' scenarios into concrete data responses. Raises usefulRate from 0.46-0.9 to target 0.8+.
  validate: UXA001, UXA005, UXA008, UXA011, UXA012, UXA013, UXA017, UXB029
- P0 — Fix intent classification for filter/view/add operations
  why: UXA013 (filter by email → got email templates), UXA022 (view card → got add instructions), UX106 (moderation time → got add instructions) show critical intent misclassification.
  impact: Eliminates complete misunderstanding failures. Prevents user frustration from completely irrelevant responses.
  validate: UXA013, UXA022, UX106
- P1 — Implement fuzzy search with partial match display
  why: UX102 (Бел...Транс...Сервис), UXA002 (БелТех…), UXA009 (инвест) show assistant cannot handle partial/fuzzy names. Users expect partial match suggestions.
  impact: Enables successful resolution of fuzzy lookup scenarios. Reduces circular clarification loops.
  validate: UX102, UXA002, UXA009
- P1 — Add retrieval confidence threshold with partial results
  why: Current behavior is all-or-nothing: either full results or generic instructions. When few matches exist (UX101: only 2 companies), assistant should show them with caveats.
  impact: Improves UX101, UX107 scenarios where limited results exist but aren't presented. Increases transparency.
  validate: UX101, UX107, UX108
- P2 — Add UNP/counterparty lookup tool for due diligence
  why: UX103 shows assistant cannot verify UNP 19xxxxxxx. Due diligence is a key use case requiring structured company data retrieval by identifier.
  impact: Enables due diligence workflow. High-value B2B feature.
  validate: UX103

### Recommendations

- [R1] (prompt, effort M) Add mandatory tool-use trigger for company/supplier queries
  action: Modify system prompt to require catalog search tool invocation for any query containing: company names, 'найди', 'покажи', 'кто делает', 'поставщики', 'производители', 'заводы'. Prohibit generic search instructions unless tool returns empty.
  hint: src/prompts/system.ts or similar - add conditional logic: if query matches company_lookup intent AND no tool call made → force retry with tool invocation
  impact: Eliminates 80% of generic fallback responses in Bank A/B scenarios
  risk: May increase latency; requires tool timeout handling
  validate: UXA001, UXA005, UXA011, UXA017, UXB029, UXB031, UXB033, UXB034
- [R2] (prompt, effort S) Fix intent classification for filter operations
  action: Add explicit examples in prompt: 'Покажи только тех, у кого есть email' → filter operation, NOT email template generation. 'Покажи карточку компании' → view operation, NOT add instructions.
  hint: Few-shot examples in system prompt or intent classifier training data. Add negative examples of misclassified scenarios.
  impact: Fixes UXA013, UXA022, UX106 critical failures
  risk: Low - prompt-only change
  validate: UXA013, UXA022, UX106
- [R3] (retrieval, effort M) Implement fuzzy/prefix search with top-N display
  action: When user provides partial name (БелТех…, …инвест, Stroy…), execute search with wildcard/prefix matching and return top 5 candidates with disambiguation data (UNP, city, activity).
  hint: app/lib/search.ts or search service - add fuzzy matching logic with Levenshtein or trigram similarity. Return partial matches with confidence scores.
  impact: Resolves UX102, UXA002, UXA009 without clarification loops
  risk: May return irrelevant matches if threshold too low
  validate: UX102, UXA002, UXA009
- [R4] (template, effort S) Add 'limited results' response template
  action: When search returns <5 results, use template: 'Найдено X компаний: [list with links]. Это все результаты по вашему запросу. Рекомендую уточнить: [suggestions]' instead of generic fallback.
  hint: src/templates/responses.ts - add conditional branch for low-result-count scenarios
  impact: Fixes UX101, UX107 where assistant had data but didn't present it
  risk: Low - template change only
  validate: UX101, UX107
- [R5] (retrieval, effort M) Add UNP-based company lookup endpoint
  action: Create dedicated tool/function for UNP lookup (full or partial). Returns structured company data for due diligence: status, address, director, activity codes.
  hint: app/api/company/unp/route.ts or similar - integrate with EGR/company registry data source
  impact: Enables UX103 due diligence workflow
  risk: Requires external data source integration
  validate: UX103
- [R6] (guardrails, effort M) Add response type validation layer
  action: Post-process assistant responses: if user asked for companies but response contains no company names/links and includes words like 'введите', 'откройте', 'поиск', 'фильтр' → reject and trigger tool call.
  hint: app/lib/response-validator.ts - regex/classifier to detect tutorial-style responses when data was expected
  impact: Safety net for R1 - catches generic fallbacks before they reach user
  risk: False positives on legitimate clarification requests
  validate: UXA001, UXA005, UXA011, UXA012, UXB029, UXB031
- [R7] (geo, effort S) Preserve geo constraints across multi-turn
  action: When user specifies geo (Минск, Гомель) in early turn, enforce it in subsequent searches. Current failure: UX101 turn 3 ignored geo constraint.
  hint: Conversation state management - extract and persist geo entities, append to search queries
  impact: Fixes UX101 geo violation, improves multi-turn consistency
  risk: Low - state management fix
  validate: UX101, UX110
- [R8] (ranking, effort M) Add B2B/relevance scoring for company cards
  action: Score company cards for B2B relevance markers (website, email, 'для юрлиц', 'опт', 'производство') and prioritize in results. Filter out obvious B2C-only entries.
  hint: Search ranking function - add weighted scoring for B2B signals
  impact: Improves UXA014, UXB029 relevance without explicit filtering
  risk: May filter legitimate B2B companies missing markers
  validate: UXA014, UXB029, UXB033

## minimax

- Summary: Biznesinfo assistant has 100% functional pass rate but fails on value delivery—providing search methodology instead of actual company data. Top-3 fixes: (1) Enforce result-first behavior for catalog queries, (2) Add intent classification to distinguish 'show/find' from 'how to add', (3) Store/fetch last-search results across multi-turn conversations to maintain constraints.

### Priority Plan

- P0 — Enforce result-first response for catalog queries
  why: 96% of judge complaints cite 'generic fallback'—providing search instructions instead of actual companies. This is the single biggest usefulness killer.
  impact: Increase minimax usefulness from 2.62 to 3.5+ by eliminating instruction-only responses for lookup queries
  validate: UXA001, UXA004, UXA006, UXA009, UXA011, UXB026, UXB030, UXB031
- P0 — Add intent classifier for 'show/find' vs 'add/How-to' queries
  why: Critical misinterpretation pattern: UXA013, UXA022, UX106 show assistant confuses 'покажи карточку' with 'добавь карточку'. Causes zero usefulness scores.
  impact: Eliminate catastrophic intent failures (usefulness 0-1) for simple lookup queries
  validate: UXA013, UXA022, UX106
- P1 — Implement conversation-scoped search state
  why: UX101, UX102, UX107 show systematic failure: user provides constraints, assistant loses them. Turn 3 always falls back to generic. Turn 1 results don't inform Turn 2-3.
  impact: Multi-turn scenarios should maintain constraint continuity—expected usefulness 4+ for these flows
  validate: UX101, UX102, UX107, UX104, UX111
- P1 — Return comparison tables for multi-candidate queries
  why: UX101, UX102, UX110 explicitly request comparison (price/lead time/MOQ). Assistant never delivers—always generic advice or single candidate.
  impact: Direct fix for 'never delivered promised 3-5 suppliers' complaint across all judges
  validate: UX101, UX102, UX110
- P2 — Add geographic constraint validation
  why: UX101 judge notes 'violation of geo constraint in turn 3'—user said 'Минск', assistant provided non-Minsk results later.
  impact: Eliminate geo drift in multi-turn queries
  validate: UX101, UX110

### Recommendations

- [R1] (prompt, effort S) Add system instruction: 'Lookup queries MUST return data, not instructions'
  action: In system prompt, add explicit rule: When user asks to 'найди/find/покажи' companies, products, or suppliers, FIRST attempt catalog search and return actual results. Only provide search methodology if results are genuinely empty.
  hint: app/src/lib/ai/systemPrompt.ts or equivalent - add 'lookup_results_rule' instruction block
  impact: Eliminates generic fallback pattern—the #1 judge complaint
  risk: Low - makes existing behavior more consistent
  validate: UXA001, UXA004, UXA011, UXB031
- [R2] (prompt, effort S) Add intent classifier for company_card operations
  action: Add system instruction: 'Distinguish: "покажи карточку" = VIEW existing company (search catalog), "добавь карточку" = CREATE new entry (instructions). Never conflate the two.'
  hint: Near existing intent classification in ai/requests.ts or conversation handler
  impact: Fixes catastrophic failures like UXA022 (view vs add confusion)
  risk: Low - clarifies existing logic
  validate: UXA022, UXA013, UX106
- [R3] (retrieval, effort M) Return minimum 3 candidates for supplier/lookup queries
  action: When search returns 0-2 results, fetch additional candidates using relaxed constraints (drop city, broaden category) until 3+ results or exhaust catalog. Always show 3 minimum for comparison requests.
  hint: app/src/lib/ai/requests.ts - searchCompanies function, modify minResults threshold
  impact: Addresses 'only 1-2 weak candidates' complaint across UX101, UX102
  risk: Medium - may affect latency, requires pagination handling
  validate: UX101, UX102, UXB029
- [R4] (prompt, effort M) Add multi-turn constraint preservation rule
  action: System instruction: 'When user provides filters (city, category, B2B, price range), these apply to ALL subsequent turns unless user explicitly changes them. Re-apply last-turn filters to new searches.'
  hint: conversation context handler - persist filters across assistant turns
  impact: Fixes 'violation of geo constraint in turn 3', 'dropped branding constraint' patterns
  risk: Medium - requires state management
  validate: UX101, UX107, UX110
- [R5] (template, effort S) Create structured comparison table template
  action: For queries with 3+ candidates, auto-generate markdown table with columns: Company | City | Website | Phone | MOQ | Lead Time | Price (Y/N)
  hint: app/src/components/SearchBar.tsx or results display component
  impact: Direct fix for 'never provided comparison data' judge feedback
  risk: Low - presentation layer change
  validate: UX101, UX102, UX110
- [R6] (prompt, effort S) Add 'humble refusal' guidelines for missing data
  action: System instruction: 'If company data is incomplete (no MOQ/price), explicitly state "X unavailable in card" rather than silent omission or generic advice. Honesty about limitations scores better than hallucination.'
  hint: System prompt - data_completeness section
  impact: Honest 'data unavailable' responses (UX108) scored 5 from Gemini—replicate this pattern
  risk: Low - improves transparency
  validate: UX108, UX103
- [R7] (guardrails, effort M) Block 'generic rubric advice' when candidates exist
  action: If search returns >0 companies AND user asked for companies (not 'how to search'), reject fallback to search instructions. Force return of results even if imperfect.
  hint: app/src/lib/ai/requests.ts - add fallback_gate logic before returning rubric advice
  impact: Eliminates 'checklist instead of results' pattern—top Kimi complaint
  risk: Medium - may show lower-quality results but scores better
  validate: UXB029, UXB031, UXB033

