# AI Assistant Improvements Round 3

## Changes Made

### 1. Enhanced Generic Fallback Rules
- Added mandatory minimum company count rules (3-5 expected)
- Added explicit statements about limitations when fewer candidates available
- Added "MANDATORY COMPANY COUNT RULES" section

### 2. Enhanced Continuity Rules
- Added CRITICAL CONTEXT TRACKING section with explicit examples
- Shows model exactly how to handle follow-up questions (stay in category, not switch)
- Examples: Turn 1 coffee → Turn 2 "what else?" must stay in coffee supplies

### 3. Enhanced Category Mismatch Rules
- Added more WRONG CATEGORY EXAMPLES:
  - cups/straws → NOT restaurants, cafes, fast food
  - security systems → NOT banks, police, security guards
  - printing services → NOT newspapers, magazines
  - office supplies → NOT furniture stores, IT shops
  - auto parts → NOT car washes, auto salons, gas stations
- Added "CATEGORY VALIDATION" rule: ask "Does this company sell [product/service]?" before returning

### 4. Enhanced Vendor Guidance
- Added more categories to exclude: gas stations, car washes
- Added rule 9: MINIMUM COUNT - user expects 3-5 suppliers
- Added rule 10: CATEGORY VALIDATION before returning ANY company

## Test Results

### Regression Tests (Critical Issue Areas)
- **switchback-topic**: 1/1 ✅
- **cross-domain**: 4/4 ✅
- **geo**: 3/3 ✅

### Main Scenarios (First 20)
- **Result**: 17/20 passed (85%)
- **Target**: 70% ✅
- **Failed**: S010 (Полиграфия), S011 (IT-аутсорс), S014 (Кофейные зерна)

### Key Improvements Observed
1. Better category filtering - cross-domain tests pass
2. Better geo filtering - geo tests pass
3. Better context tracking - switchback tests pass

## Next Steps
- Run full 50-scenario suite
- Evaluate with Codex and Kimi judges
- Consider additional prompt refinements for edge cases
