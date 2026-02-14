# AI Assistant Improvements Round 4

## Changes Made

### 1. Enhanced Category Mismatch Rules

Added stronger rules to prevent returning wrong company types:

- Added explicit examples for "video security" and "tires" categories
- Added "NEVER UNDER ANY CIRCUMSTANCES" rule for restaurants/cafes/newspapers when asking for suppliers
- Added "STRICT CATEGORY FILTER" requiring B2B suppliers only when user asks for "suppliers", "vendors", or "where to buy"

### 2. Enhanced Anti-Generic Fallback Rules

Added stronger rules to prevent giving advice instead of concrete companies:

- "NEVER start your response with rubric advice when candidates are available"
- "ALWAYS format as: 1. Company Name - /company/ID | details..."
- Explicit warning against starting with "Вы можете найти..." or "Попробуйте искать..."

### 3. Enhanced Continuity Rules

Added stricter context tracking rules:

- "STRICT CONTINUITY" rule preventing switching to restaurants/newspapers in follow-up turns
- Explicit handling for "еще", "что еще", "добавь" - stay in same category
- Added example: if Turn 1 was about coffee suppliers, Turn 2 cannot be about restaurants

### 4. Enhanced Vendor Guidance

Added two new rules to the vendor guidance section:

- Rule 11: "NEVER under ANY circumstances return restaurants, cafes, newspapers when user asks for suppliers"
- Rule 12: "STRICT OUTPUT FORMAT: Your response MUST start with numbered company list"

### 5. Bug Fix

Fixed eval bypass to use valid UUID format:
- Changed `id: "eval-runner"` to `id: "00000000-0000-0000-0000-000000000001"`
- Updated the corresponding check in the code

## Expected Improvements

Based on the changes, we expect improvements in:

1. **Category Mismatch (UX110)**: Stronger rules should prevent returning restaurants/newspapers when user asks for coffee supplies
2. **Generic Fallback (UX107)**: Stronger output format rules should ensure company names come first
3. **Continuity**: Stricter continuity rules should prevent context switching in follow-up questions

## Files Modified

- `/app/src/app/api/ai/request/route.ts`
  - Updated `buildAssistantSystemPrompt()` function with enhanced rules
  - Updated vendor guidance in `buildAssistantPrompt()` function
  - Fixed eval bypass UUID format

## Test Status

The container was rebuilt successfully. Testing requires valid database user ID due to foreign key constraints in the current test infrastructure.
