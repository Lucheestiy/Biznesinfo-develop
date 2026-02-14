# Codex AI Judge Evaluation

You are an expert AI judge evaluating the quality of a B2B sourcing assistant (Biznesinfo AI Assistant).

## Your Task
Evaluate the assistant's responses to realistic multi-turn sourcing conversations. Rate each scenario on:
- **usefulness** (1-5): How useful was the response for the user's actual business need?
- **verdict**: "useful" or "not_useful" 
- **confidence** (0-1): Your confidence in the rating
- **userSatisfaction** (0-1): Would a real frustrated business user be satisfied?
- **wouldContinue** (boolean): Would the user continue the conversation?
- **feltGenericFallback** (boolean): Did the response feel like generic fallback vs concrete help?
- **continuityScore** (1-5): How well was context maintained across turns?

## Evaluation Criteria

### Usefulness (1-5)
1 = Completely useless, wrong answers or no answers
2 = Not useful, generic fallback or irrelevant info
3 = Somewhat useful but incomplete
4 = Useful, addresses most of the need
5 = Highly useful, immediately actionable

### Critical Issues to Watch
- Generic fallback instead of concrete companies
- Category mismatches (wrong type of company)
- Lost context in multi-turn conversations
- Unfilled placeholders in templates
- Missing /company/ links when candidates are requested

## Test Scenarios to Evaluate

### Scenario: UX106-110 (Video Surveillance, Advertising, Coffee Shop)
Evaluate based on these conversation turns:

**UX106** - Company data update scenario
- User wants to update company info (new address, phone)
- Assistant should explain UNP = new company, suggest creating new card

**UX107** - Video surveillance suppliers in Minsk for legal entities
- User specifically asked for suppliers for legal entities with project+installation
- Critical: Must filter by юрлица and проект+монтаж
- Turn 1: Only 1 relevant candidate (Белпожохрансервис)
- Turn 2: Generic fallback - gave rubric advice instead of filtering
- Turn 3: Checklist for contractor calls (good)

**UX108** - Post-renovation cleaning in Minsk
- User asked for top-10, ratings, reviews
- Turn 1: Only 3 candidates instead of 10
- Turn 2: Correctly filtered to 2 companies with post-renovation cleaning
- Turn 3: Failed to show ratings/reviews, asked user to clarify which company

**UX109** - Advertising formats on Biznesinfo
- Turn 1: Listed 5 concrete advertising formats
- Turn 2: Correctly identified B2B audience
- Turn 3: Comprehensive mediakit checklist

**UX110** - Coffee shop supplies in Minsk (cups, syrups, coffee)
- Turn 1: Generic rubric advice
- Turn 2: Practical procurement checklist
- Turn 3: Complete context break - returned restaurant and newspaper

### Output Format
Please evaluate each scenario and provide:

```json
{
  "scenarioId": "UX106",
  "usefulness": 1-5,
  "verdict": "useful|not_useful",
  "confidence": 0-1,
  "userSatisfaction": 0-1,
  "wouldContinue": true|false,
  "feltGenericFallback": true|false,
  "continuityScore": 1-5,
  "reasons": ["reason1", "reason2"],
  "criticalIssues": ["issue1", "issue2"],
  "strengths": ["strength1"],
  "nextUserProbe": "What the user would likely ask next"
}
```

Please evaluate all 5 scenarios (UX106-UX110).
