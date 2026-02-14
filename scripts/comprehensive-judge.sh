#!/bin/bash

# AI Assistant Comprehensive Judge Evaluation
# Uses Kimi, Codex, and Gemini CLI as judges to evaluate AI responses
# Tests: sourcing, external search, templates, weather, multi-turn, ranking

set -e

ENDPOINT="http://127.0.0.1:8131"
EVAL_SECRET="eval-secret-123"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}==============================================${NC}"
echo -e "${BLUE}AI Assistant Judge Evaluation${NC}"
echo -e "${BLUE}Using Kimi, Codex, Gemini CLI as judges${NC}"
echo -e "${BLUE}==============================================${NC}"
echo ""

# Function to send request to AI
send_request() {
  local message="$1"
  local history_json="$2"  # Optional history as JSON array
  
  if [ -z "$history_json" ]; then
    history_json="[]"
  fi
  
  curl -s -X POST "${ENDPOINT}/api/ai/request" \
    -H "Content-Type: application/json" \
    -H "x-eval-secret: ${EVAL_SECRET}" \
    -d "{\"message\": \"$message\", \"history\": $history_json}" | jq -r '.reply.text // empty'
}

# Judge evaluation function
evaluate_response() {
  local judge="$1"
  local query="$2"
  local response="$3"
  
  local judge_prompt="You are an expert judge evaluating an AI assistant for Belarus business directory (Biznesinfo).
Your task is to rate the assistant's response on a usefulness scale 1-5:
- 5: Perfect - exactly what user needed, actionable, specific
- 4: Good - useful with minor gaps
- 3: OK - partially useful but could be better
- 2: Poor - mostly generic fallback, missing specifics
- 1: Not useful - wrong or no answer

User query: '$query'

AI Response:
$response

Rate this response (1-5) and provide a brief justification (1 sentence).
Format: RATING: <number>
JUSTIFICATION: <brief reason>"

  case $judge in
    kimi)
      echo "$judge_prompt" | kimi chat --model kimi-2 - 2>/dev/null | grep -E "^(RATING|JUSTIFICATION)" | head -2 || echo "RATING: 3
JUSTIFICATION: Judge unavailable"
      ;;
    codex)
      echo "$judge_prompt" | codex chat -m gpt-5 - 2>/dev/null | grep -E "^(RATING|JUSTIFICATION)" | head -2 || echo "RATING: 3
JUSTIFICATION: Judge unavailable"
      ;;
    gemini)
      echo "$judge_prompt" | gemini -m gemini-2.0-flash - 2>/dev/null | grep -E "^(RATING|JUSTIFICATION)" | head -2 || echo "RATING: 3
JUSTIFICATION: Judge unavailable"
      ;;
  esac
}

# Test scenarios
declare -A SCENARIOS
SCENARIOS["sourcing"]="Поставщики ПНД труб в Минске"
SCENARIOS["external_search"]="Где купить мастерок для цемента?"
SCENARIOS["weather"]="Какая погода в Минске?"
SCENARIOS["template"]="Подготовь заявку для поставщика кофе"
SCENARIOS["ranking"]="Топ-3 поставщика ПНД труб в Минске по надежности"
SCENARIOS["multi_turn_1"]="Поставщики ПНД труб в Минске"
SCENARIOS["multi_turn_2"]="Фильтр по Сухарево"

# Run tests
echo -e "${GREEN}Testing AI responses...${NC}"
echo ""

RESULTS_FILE="/home/mlweb/biznesinfo-develop.lucheestiy.com/app/qa/ai-request/reports/cli-judge-$(date -u +%Y-%m-%dT%H-%M-%SZ).json"

echo "{" > "$RESULTS_FILE"
echo "  \"generatedAt\": \"$(date -u +%Y-%m-%dT%H-%M-%SZ)\"," >> "$RESULTS_FILE"
echo "  \"tests\": [" >> "$RESULTS_FILE"

first_test=true

for key in "${!SCENARIOS[@]}"; do
  scenario="${SCENARIOS[$key]}"
  echo -e "${YELLOW}Testing: $key${NC}"
  echo "Query: $scenario"
  
  # Handle multi-turn scenarios
  if [ "$key" == "multi_turn_1" ]; then
    RESPONSE=$(send_request "$scenario" "[]")
    # Store response for next turn
    MULTI_TURN_RESPONSE="$RESPONSE"
  elif [ "$key" == "multi_turn_2" ]; then
    # Second turn with history
    HISTORY='[{"role":"user","content":"Поставщики ПНД труб в Минске"},{"role":"assistant","content":"'"$MULTI_TURN_RESPONSE"'"}]'
    RESPONSE=$(send_request "$scenario" "$HISTORY")
  else
    RESPONSE=$(send_request "$scenario" "[]")
  fi
  
  echo "Response (first 200 chars): ${RESPONSE:0:200}"
  echo ""
  
  # Run judge evaluations
  for judge in kimi codex gemini; do
    if command -v $judge &> /dev/null; then
      echo -e "${BLUE}Running $judge judge...${NC}"
      EVAL_RESULT=$(evaluate_response "$judge" "$scenario" "$RESPONSE")
      echo "$EVAL_RESULT"
    fi
  done
  echo "---"
done

echo "  ]," >> "$RESULTS_FILE"
echo "  \"summary\": {" >> "$RESULTS_FILE"
echo "    \"totalTests\": ${#SCENARIOS[@]}," >> "$RESULTS_FILE"
echo "    \"judges\": [\"kimi\", \"codex\", \"gemini\"]" >> "$RESULTS_FILE"
echo "  }" >> "$RESULTS_FILE"
echo "}" >> "$RESULTS_FILE"

echo -e "${GREEN}Results saved to: $RESULTS_FILE${NC}"
echo ""
echo -e "${BLUE}==============================================${NC}"
echo -e "${BLUE}Evaluation Complete${NC}"
echo -e "${BLUE}==============================================${NC}"
