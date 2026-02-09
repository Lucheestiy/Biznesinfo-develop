# External Usefulness Report — judge-2026-02-08T13-32-25-593Z

- Source report: /home/mlweb/biznesinfo-develop.lucheestiy.com/app/qa/ai-request/reports/run-2026-02-08T05-33-54-386Z.json
- Scenarios rated: 50
- Generated at: 2026-02-08T13:51:14.454Z

## gemini

- Average usefulness: 4.26/5
- Useful (>=3): 45/50 (90.0%)
- Zero-usefulness: 1
- Real-user satisfaction: 81.4%
- Would continue rate: 90.0%
- Generic fallback rate: 6.0%
- Continuity score avg: 4.46/5

### Top Issues (gemini)

- failure to provide multiple relevant candidates and comparison points. — 1
- violation of geo constraint in turn 3. — 1
- failure to provide concrete lead lists. — 1
- misinterpretation of user intent — 1
- generic fallback to 'add company' process instead of answering 'moderation time for changes' — 1
- the previous error in 'номенклатура: приложений что' was not corrected, reducing overall quality. — 1
- complete misinterpretation of user intent — 1
- irrelevant and unhelpful response — 1
- misinterpretation of user's core intent (view vs. add company card). — 1

### Worst Scenarios (gemini)

- UXA013: usefulness 0/5 (not_useful)
  userSatisfaction=0% continue=no genericFallback=no continuity=0/5
  reason: Assistant completely misunderstands the user's intent to filter a list by email availability.
  reason: Provides irrelevant email and WhatsApp templates for contacting companies instead of filtering results.
  issue: Complete misinterpretation of user intent
  issue: Irrelevant and unhelpful response
- UX101: usefulness 1/5 (not_useful)
  userSatisfaction=20% continue=no genericFallback=yes continuity=2/5
  reason: Assistant cannot provide 3-5 suppliers for comparison as requested.
  reason: Consistently states data limitations, hindering progress.
  issue: Failure to provide multiple relevant candidates and comparison points.
  issue: Violation of geo constraint in turn 3.
- UX106: usefulness 1/5 (not_useful)
  userSatisfaction=10% continue=no genericFallback=yes continuity=0/5
  reason: Assistant misunderstood the question about moderation time for *updates* or *re-registration*.
  reason: Provided instructions for *adding a new company* instead of answering the specific question in context.
  issue: Misinterpretation of user intent
  issue: Generic fallback to 'add company' process instead of answering 'moderation time for changes'
- UXA022: usefulness 1/5 (not_useful)
  userSatisfaction=20% continue=no genericFallback=no continuity=1/5
  reason: Assistant misunderstands the user's intent, interpreting 'show the full company card' as 'how to add a company card'.
  reason: Instructions provided are for creating a new card, not for viewing an existing one.
  issue: Misinterpretation of user's core intent (view vs. add company card).
- UX104: usefulness 2/5 (not_useful)
  userSatisfaction=40% continue=no genericFallback=yes continuity=3/5
  reason: Repeatedly states inability to provide actual leads.
  reason: Fails on the core request of lead generation.
  issue: Failure to provide concrete lead lists.
- UX112: usefulness 3/5 (useful)
  userSatisfaction=60% continue=yes genericFallback=no continuity=3/5
  reason: Successfully added a relevant list of attachments/documents to request.
  issue: The previous error in 'Номенклатура: приложений что' was not corrected, reducing overall quality.
- UX111: usefulness 3/5 (useful)
  userSatisfaction=70% continue=yes genericFallback=no continuity=5/5
  reason: Consistent in requiring specific company info.
  reason: Explains what information it will provide once company is identified.
- UXA008: usefulness 4/5 (useful)
  userSatisfaction=80% continue=yes genericFallback=no continuity=4/5
  reason: Clearly states missing information (address/city/type of companies).
  reason: Provides general search guidance for 'nearby' searches.
- UX102: usefulness 4/5 (useful)
  userSatisfaction=80% continue=yes genericFallback=no continuity=4/5
  reason: Provides actionable steps for fuzzy search.
  reason: Offers useful verification checklists.
- UXA001: usefulness 4/5 (useful)
  userSatisfaction=80% continue=yes genericFallback=no continuity=4/5
  reason: Assistant provides clear, step-by-step instructions for searching.
  reason: Acknowledges the need for more specificity and offers to narrow the search.

## kimi

- Average usefulness: 2.96/5
- Useful (>=3): 30/50 (60.0%)
- Zero-usefulness: 0
- Real-user satisfaction: 58.2%
- Would continue rate: 60.0%
- Generic fallback rate: 40.0%
- Continuity score avg: 2.92/5

### Top Issues (kimi)

- critical penalty: after user gave concrete constraint (брендирование/печать), assistant dropped to generic search instructions instead of concrete progress — 1
- never delivered promised 3-5 suppliers or comparison table — 1
- repeatedly asked clarifying questions without providing actual candidates — 1
- user explicitly asked for comparison by price/lead time/moq — assistant never provided this data — 1
- never performed actual fuzzy search or returned matching candidates — 1
- turn 1 result (автосервис pro-tone) completely irrelevant to 'бел...транс...сервис' logistics company — 1
- turn 3 failed to show comparison when user said 'нашлось несколько' — assistant should have asked which ones or offered to compare — 1
- no unp or legal address provided despite explicit request — 1
- complete refusal behavior: never checked the requested unp 19xxxxxxx — 1
- user gave partial unp — assistant should have tried search or asked for full unp instead of generic refusal — 1

### Worst Scenarios (kimi)

- UX102: usefulness 1/5 (not_useful)
  userSatisfaction=35% continue=no genericFallback=yes continuity=1/5
  reason: Turn 1: Failed to find company by fuzzy name pattern, gave irrelevant result (Автосервис PRO-tone)
  reason: Turn 2: Generic fallback — provided name variations to try instead of actual search results
  issue: Never performed actual fuzzy search or returned matching candidates
  issue: Turn 1 result (Автосервис PRO-tone) completely irrelevant to 'Бел...Транс...Сервис' logistics company
- UXA013: usefulness 1/5 (not_useful)
  userSatisfaction=30% continue=no genericFallback=yes continuity=1/5
  reason: Turn 1: Completely misunderstood request — provided email templates instead of filtering companies
  reason: Response has nothing to do with 'show companies with email' request
  issue: Critical hallucination/misunderstanding: user asked to filter companies by email presence, assistant gave outreach templates
  issue: No company filtering performed or results shown
- UX111: usefulness 1/5 (not_useful)
  userSatisfaction=25% continue=no genericFallback=yes continuity=1/5
  reason: Turn 1: Complete refusal to provide contact info without company name — user asked for specific company X in Mogilev
  reason: Turn 2: Instead of giving address and directions, repeated refusal asking for company identifier again
  issue: Critical penalty: assistant never attempted to search for 'компания X' or offer partial matches
  issue: User gave clear context (Mogilev, склад company X) — assistant should have tried to help identify or asked clarifying questions that progress toward answer
- UXA022: usefulness 1/5 (not_useful)
  userSatisfaction=15% continue=no genericFallback=yes continuity=1/5
  reason: Пользователь просит показать карточку компании, а ассистент даёт инструкцию по добавлению компании
  reason: Полное несоответствие интенту пользователя
  issue: Критическая ошибка понимания запроса: 'покажи' ≠ 'добавь'
  issue: Ответ про создание карточки вместо просмотра существующей
- UX110: usefulness 2/5 (not_useful)
  userSatisfaction=42% continue=no genericFallback=yes continuity=1/5
  reason: Turn 1: Gave generic category navigation advice instead of concrete suppliers
  reason: Turn 2: Delivered practical procurement checklist and search categories
  issue: Turn 3: Complete context break — provided irrelevant companies (Ресторан ДУБРОВЪ, Наш Край газета) that have nothing to do with coffee shop supplies
  issue: Critical continuity failure: user asked for Minsk suppliers of cups, syrups, coffee — got a restaurant and a newspaper
- UXA015: usefulness 2/5 (not_useful)
  userSatisfaction=45% continue=no genericFallback=yes continuity=2/5
  reason: Turn 1: Asked clarifying question instead of providing the requested phone number
  reason: Response is evasive — promises to help but requires more input first
  issue: User asked for reception/office number — assistant should have either provided it or explained they need company name to search
  issue: Instead of proactive search, assistant asked user to provide company identifier
- UXB034: usefulness 2/5 (not_useful)
  userSatisfaction=38% continue=no genericFallback=yes continuity=2/5
  reason: Generic search instructions instead of concrete VED/import law firms
  reason: No actual company names or contacts for legal services provided
  issue: Complete generic fallback — user asked for specific firms but got keyword suggestions
  issue: Suggested looking in 'Услуги для населения' which is wrong category for B2B legal
- UX103: usefulness 2/5 (not_useful)
  userSatisfaction=40% continue=no genericFallback=yes continuity=2/5
  reason: Turn 1: Refused to check counterparty by UNP, gave generic instructions how to search instead
  reason: Turn 2: Again refused to check, gave generic list of risk signs to look for
  issue: Complete refusal behavior: never checked the requested UNP 19xxxxxxx
  issue: User gave partial UNP — assistant should have tried search or asked for full UNP instead of generic refusal
- UX108: usefulness 2/5 (not_useful)
  userSatisfaction=48% continue=no genericFallback=yes continuity=2/5
  reason: Turn 1: Only 3 confirmed candidates instead of requested top-10, honestly indicated limited matches
  reason: Turn 2: Correctly filtered to 2 companies with post-renovation cleaning (БэстКлининг, БК-ИНВЕСТ)
  issue: Turn 3: Failed to answer why rating is high or provide reviews — instead asked user to clarify which company (despite context from Turn 2)
  issue: Turn 3 then provided generic ranking without explaining rating basis
- UXB033: usefulness 2/5 (not_useful)
  userSatisfaction=40% continue=no genericFallback=yes continuity=2/5
  reason: Generic category navigation instead of concrete web studios
  reason: No actual B2B website development companies provided with contacts
  issue: Complete generic fallback — user asked 'кто делает' but got 'где искать'
  issue: No specific companies from catalog shown despite clear request for developers

## minimax

- Average usefulness: 2.62/5
- Useful (>=3): 23/50 (46.0%)
- Zero-usefulness: 1
- Real-user satisfaction: 48.5%
- Would continue rate: 48.0%
- Generic fallback rate: 54.0%
- Continuity score avg: 2.76/5

### Top Issues (minimax)

- generic fallback mode activated after user gave concrete constraints - exactly what rubric penalizes — 1
- no actionable supplier list, no comparison possible — 1
- fails at basic fuzzy search task — 1
- refuses to help compare - forces user to do all work — 1
- delivers only generic advice despite user asking for concrete verification — 1
- no actual data retrieved - all hypothetical — 1
- completely fails lead generation task — 1
- generic fallback as primary response mode — 1
- could not confirm exact premium pricing - referred to manager — 1
- turn 3 feels like starting over with generic page recommendations instead of building on previous context about updating existing card — 1

### Worst Scenarios (minimax)

- UXA013: usefulness 0/5 (not_useful)
  userSatisfaction=10% continue=no genericFallback=no continuity=0/5
  reason: User wanted to FILTER to companies with email, received email TEMPLATES instead
  reason: Complete misunderstanding of request - no filtering logic applied
  issue: Zero relevance to user intent - gave completely unrelated response
  issue: No filtering attempted whatsoever
- UXA012: usefulness 1/5 (not_useful)
  userSatisfaction=25% continue=no genericFallback=yes continuity=1/5
  reason: User asked to FILTER companies with website, got 'I can give you format' response
  reason: Assistant asks user to provide list and parameters instead of executing filter
  issue: Generic fallback - offered export format instead of actual filtered companies
  issue: Did not attempt to filter any results from current catalog
- UXA014: usefulness 1/5 (not_useful)
  userSatisfaction=22% continue=no genericFallback=yes continuity=1/5
  reason: User asked to NARROW to B2B companies, got keyword advice list instead
  reason: Provided filtering strategy but zero actual filtered candidates
  issue: Generic fallback - instruction-based response without results
  issue: Should have narrowed actual search results, not taught user how to filter
- UXA011: usefulness 1/5 (not_useful)
  userSatisfaction=20% continue=no genericFallback=yes continuity=1/5
  reason: User asked to FIND manufacturers, got 4-step tutorial on how to find them instead
  reason: Assistant gave generic checklist instead of concrete supplier candidates
  issue: Complete generic fallback - no actual companies provided despite catalog access
  issue: User intent (finding) completely ignored in favor of educational response
- UX101: usefulness 1/5 (not_useful)
  userSatisfaction=10% continue=no genericFallback=yes continuity=1/5
  reason: Only 1-2 weak candidates available throughout 3 turns
  reason: Cannot fulfill user's explicit request for 5 suppliers with comparison
  issue: Generic fallback mode activated after user gave concrete constraints - exactly what rubric penalizes
  issue: No actionable supplier list, no comparison possible
- UX104: usefulness 1/5 (not_useful)
  userSatisfaction=5% continue=no genericFallback=yes continuity=1/5
  reason: No actual leads delivered across 3 turns
  reason: Extensive generic guidance on HOW to find leads, but zero results
  issue: Completely fails lead generation task
  issue: Generic fallback as primary response mode
- UX102: usefulness 1/5 (not_useful)
  userSatisfaction=5% continue=no genericFallback=yes continuity=1/5
  reason: Assistant never actually finds the company despite 3 turns
  reason: Provides increasingly detailed generic search instructions instead of results
  issue: Fails at basic fuzzy search task
  issue: Refuses to help compare - forces user to do all work
- UXA016: usefulness 1/5 (not_useful)
  userSatisfaction=10% continue=no genericFallback=yes continuity=1/5
  reason: User asked to SHOW companies, assistant gave navigation instructions only
  reason: No actual vendor candidates provided despite being asked directly
  issue: Completely missed the actual request - zero companies shown
- UXA017: usefulness 1/5 (not_useful)
  userSatisfaction=10% continue=no genericFallback=yes continuity=1/5
  reason: User asked to FIND factories, got keyword guidance instead
  reason: No concrete company names or production facilities provided
  issue: Failed to deliver requested information - only gave search methodology
- UXA022: usefulness 1/5 (not_useful)
  userSatisfaction=10% continue=no genericFallback=no continuity=1/5
  reason: Критическое непонимание: пользователь хотел УВИДЕТЬ карточку, а ему объяснили КАК ЕЁ ДОБАВИТЬ
  reason: Полностью мимо контекста запроса
  issue: Отвечает не на тот вопрос (how to view vs how to add)

## Comparison

- Average (Gemini): 4.26/5
- Average (Kimi): 2.96/5
- Average (MiniMax): 2.62/5
- Real-user satisfaction (Gemini): 81.4%
- Real-user satisfaction (Kimi): 58.2%
- Continue rate (Gemini): 90.0%
- Continue rate (Kimi): 60.0%
- Generic fallback rate (Gemini): 6.0%
- Generic fallback rate (Kimi): 40.0%
- Average gap (Gemini - Kimi): 1.3
- Useful-rate gap (Gemini - Kimi): 0.3
- Gap (gemini - kimi): avg=1.3, usefulRate=0.3, userSat=0.2318, continue=0.3, genericFallback=-0.34
- Gap (gemini - minimax): avg=1.64, usefulRate=0.44, userSat=0.3292, continue=0.42, genericFallback=-0.48
- Gap (kimi - minimax): avg=0.34, usefulRate=0.14, userSat=0.0974, continue=0.12, genericFallback=-0.14

## Quality Gate

- Pass: no
- Failures:
  - kimi averageUserSatisfaction 0.5822 < 0.72
  - kimi continueRate 0.6 < 0.72
  - kimi genericFallbackRate 0.4 > 0.35
  - minimax averageUserSatisfaction 0.4848 < 0.72
  - minimax continueRate 0.48 < 0.72
  - minimax genericFallbackRate 0.54 > 0.35

