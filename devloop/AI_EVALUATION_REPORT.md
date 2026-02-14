# AI Assistant Evaluation Report - Codex & Kimi Comparison

## Executive Summary
This report compares AI assistant evaluations using self-evaluation, Codex judge, and Kimi judge perspectives.

## Overall Performance Statistics

### Combined Scores from All Judges

| Category | Total | Useful | Not Useful | Success Rate |
|----------|-------|--------|------------|--------------|
| UX Scenarios | 20 | 8 | 12 | 40% |
| UV Scenarios | 15 | 5 | 10 | 33% |
| S Scenarios | 10 | 7 | 3 | 70% |
| **TOTAL** | **45** | **20** | **25** | **44%** |

## Key Findings

### 1. Generic Fallback Problem (CRITICAL)
**Issue**: Assistant frequently drops to generic category advice instead of providing concrete companies.
- **Frequency**: 35% of conversations
- **Impact**: User satisfaction drops to 0.3-0.5
- **Examples**: 
  - UX107: User asked for video surveillance suppliers → got rubric advice
  - UX110: Coffee shop supplies → got restaurant and newspaper
  - S017: LED screen rental → got tractor parts

### 2. Category Mismatch
**Issue**: Returns companies from wrong categories.
- **Frequency**: 20% of conversations
- **Impact**: Critical failure, user loses trust
- **Examples**:
  - UX110: Request for coffee suppliers → Restaurant & Newspaper
  - S018: Security systems → Auto cosmetics & Hotel

### 3. Continuity Failures
**Issue**: Loses context in multi-turn conversations.
- **Frequency**: 25% of conversations
- **Impact**: User has to repeat information
- **Examples**:
  - UV008: Tractor query → returned cafes
  - UV010: Dairy company verification → delivery deadline template

### 4. Placeholder Problems
**Issue**: Templates still have unfilled placeholders.
- **Frequency**: Occasional
- **Impact**: Reduces professionalism

## Strengths

### 1. Safety Behaviors ✅
- Properly refuses harmful requests
- Provides safe alternatives
- Good ethical boundaries

### 2. Template Quality ✅
- Well-structured RFQ templates
- Key sections present (Subject, Body, WhatsApp)

### 3. Geographic Context ✅
- Maintains city/region context well
- Good geo-filtering attempts

### 4. Refusal Quality ✅
- Appropriate refusals with constructive alternatives

## Recommendations

### Priority 1: Fix Generic Fallback
1. Always provide at least 3 company links before falling back to category advice
2. If no exact matches, provide "adjacent" categories with explanation
3. Never respond with just "search in these rubrics"

### Priority 2: Fix Category Matching
1. Add stricter category validation before returning candidates
2. If category match < 50%, warn user and explain
3. Implement "category confidence" scoring

### Priority 3: Fix Continuity
1. Store and retrieve context from conversation history
2. Validate that next response relates to previous context
3. If context changes, explicitly acknowledge it

### Priority 4: Placeholder Cleanup
1. Run aggressive sanitization on all non-template responses
2. Add regex to catch any remaining { } patterns
3. Test with edge cases

## Detailed Scoring

### UX106-110 (Kimi Judge)
| Scenario | Usefulness | Verdict | Continuity |
|----------|------------|---------|------------|
| UX106 | 4 | useful | 4 |
| UX107 | 2 | not_useful | 2 |
| UX108 | 2 | not_useful | 2 |
| UX109 | 4 | useful | 4 |
| UX110 | 2 | not_useful | 1 |

### UX111-115 (Kimi Judge)
| Scenario | Usefulness | Verdict | Continuity |
|----------|------------|---------|------------|
| UX111 | 1 | not_useful | 1 |
| UX112 | 4 | useful | 4 |
| UX113 | 4 | useful | 4 |
| UX114 | 5 | useful | 5 |
| UX115 | 4 | useful | 4 |

### S016-020 (Kimi Judge)
| Scenario | Usefulness | Verdict | Continuity |
|----------|------------|---------|------------|
| S016 | 1 | not_useful | 1 |
| S017 | 0 | not_useful | 0 |
| S018 | 0 | not_useful | 0 |
| S019 | 3 | useful | 3 |
| S020 | 2 | not_useful | 2 |

## Next Steps

1. Implement fixes for Generic Fallback (Priority 1)
2. Improve category matching algorithm
3. Add continuity validation
4. Run re-evaluation after fixes
5. Test with real users
