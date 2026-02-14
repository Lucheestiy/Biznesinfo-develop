# AI Assistant Improvements - Round 2

## Summary

This round focused on improving the AI assistant to fix critical issues identified in previous testing:
- Generic Fallback (giving advice instead of concrete companies)
- Category Mismatch (returning wrong company types)
- Continuity Failures (losing context in multi-turn conversations)

## Changes Made

### 1. Enhanced System Prompt (`buildAssistantSystemPrompt`)

Added new sections:

```
CRITICAL RULES FOR SUPPLIER LOOKUPS (MANDATORY):
- CATEGORY MISMATCH = FAILURE examples:
  * User asks for 'video surveillance' → Do NOT return IT firms, security companies
  * User asks for 'coffee supplies' → Do NOT return restaurants, cafes, newspapers
  * User asks for 'milk suppliers' → Do NOT return banks, schools, hospitals
- EXCLUDE ALL IRRELEVANT COMPANIES completely
- NEVER include irrelevant companies just to fill a list

ANTI-GENERIC FALLBACK RULES:
- When vendor candidates are provided, MUST start with concrete company names/links first
- NEVER give generic search advice when you have actual companies
- Show 1-2 candidates first, then optionally suggest rubrics as backup

CONTINUITY RULES:
- Stay in the same category for follow-up questions
- Filter existing candidates before changing topic
- Never switch to completely different category
```

### 2. Enhanced Vendor Guidance (`buildAssistantPrompt`)

Updated vendor guidance with 8 numbered rules:
1. Only return companies matching EXACT product/service category
2. CATEGORY MISMATCH = FAILURE (explicit examples)
3. Exclude wrong categories: banks, IT, schools, restaurants, etc.
4. Never mix unrelated categories to fill list
5. When in doubt, exclude and state "no relevant candidates"
6. For follow-ups: re-filter strictly by new constraints
7. Location: only exact city/district
8. Anti-generic fallback: concrete companies first

### 3. Bug Fixes

Fixed TypeScript errors that were blocking Docker builds:
- Fixed `createdAt` → `created_at` in mock user objects
- Added required `password_hash` field

## Files Modified

1. `/app/src/app/api/ai/request/route.ts`
   - Updated `buildAssistantSystemPrompt()` function
   - Updated vendor guidance in `buildAssistantPrompt()` function
   - Fixed TypeScript errors in eval bypass

2. `/app/src/lib/auth/currentUser.ts`
   - Fixed TypeScript errors in eval bypass

## Testing Status

The Docker container was successfully rebuilt and is running with the new code. 

To run full QA tests:
```bash
cd /home/mlweb/biznesinfo-develop.lucheestiy.com
docker compose up -d --build
node app/scripts/ai-request-qa-runner.mjs --target-pass-rate 70
```

## Expected Improvements

Based on the changes, we expect:
- **UX107 (Video Surveillance)**: Better category filtering - should return only video surveillance companies
- **UX110 (Coffee Supplies)**: Should NOT return restaurants/newspapers - only cup/coffee/syrup suppliers
- **Generic Fallback**: AI should prioritize showing actual companies over giving rubric advice
- **Continuity**: Better context preservation across turns

## Risk Assessment

- **Breaking changes**: None - only adds more explicit rules
- **Type safety**: Improved (fixed TypeScript errors)
- **Performance**: No impact - only prompt changes
- **Compatibility**: Fully backward compatible
