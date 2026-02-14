#!/bin/bash
# Comprehensive AI Assistant Judge Evaluation
# Uses Kimi CLI, Droid CLI for evaluation

set -e

BASE_URL="http://127.0.0.1:8131"
EVAL_SECRET="eval-secret-123"

# Test queries covering different categories
declare -a TEST_QUERIES=(
  "sourcing:Поставщики молока в Минске"
  "sourcing:Какие есть производители кофе в Беларуси?"
  "external:Где купить профессиональный поварской нож в Минске?"
  "template:RFQ для закупки 1000 литров подсолнечного масла"
  "template:Подготовь заявку для поставщика канцтоваров"
  "general_info:Какая погода в Минске?"
  "general_info:Курс доллара в Беларуси"
  "multi_step:Дай 3 поставщика молока, а потом проверь их контакты"
  "development:Какие есть надежные поставщики стройматериалов?"
  "not_in_db:Мастерок для цемента где купить?"
)

echo "========================================"
echo "AI Assistant Judge Evaluation"
echo "========================================"
echo ""

# Function to make API request
make_request() {
  local message="$1"
  curl -s "$BASE_URL/api/ai/request" \
    -X POST \
    -H "Content-Type: application/json" \
    -H "x-eval-secret: $EVAL_SECRET" \
    -d "{\"message\":\"$message\"}" 2>/dev/null
}

# Function to evaluate with Kimi
evaluate_with_kimi() {
  local query="$1"
  local response="$2"
  
  echo "Evaluating with Kimi CLI..."
  /root/.local/bin/kimi -t "Оцени полезность этого ответа ИИ-ассистента по шкале от 1 до 5, где 5 - очень полезно, 1 - бесполезно. Контекст запроса: $query. Ответ: $response" 2>/dev/null || echo "Kimi evaluation failed"
}

# Function to evaluate with Droid
evaluate_with_droid() {
  local query="$1"
  local response="$2"
  
  echo "Evaluating with Droid CLI..."
  /root/.local/bin/droid -t "Оцени полезность этого ответа ИИ-ассистента по шкале от 1 до 5: $response" 2>/dev/null || echo "Droid evaluation failed"
}

# Run tests
RESULTS_FILE="/tmp/ai_judge_eval_$(date +%s).json"
echo "{" > "$RESULTS_FILE"
echo '"evaluations": [' >> "$RESULTS_FILE"

for i in "${!TEST_QUERIES[@]}"; do
  IFS=':' read -r category query <<< "${TEST_QUERIES[$i]}"
  echo "----------------------------------------"
  echo "Test $((i+1))/$(( ${#TEST_QUERIES[@]} )) - [$category] $query"
  echo "----------------------------------------"
  
  # Make request
  response_json=$(make_request "$query")
  reply=$(echo "$response_json" | jq -r '.reply.text // empty' 2>/dev/null)
  provider=$(echo "$response_json" | jq -r '.reply.provider // "unknown"' 2>/dev/null)
  is_stub=$(echo "$response_json" | jq -r '.reply.isStub // false' 2>/dev/null)
  
  if [ -z "$reply" ] || [ "$reply" = "null" ]; then
    echo "  ERROR: Empty response"
    reply="[No response]"
  fi
  
  echo "  Provider: $provider, Stub: $is_stub"
  echo "  Response preview: ${reply:0:150}..."
  
  # Evaluate with Kimi
  kimi_score=""
  if [ -f /root/.local/bin/kimi ]; then
    echo "  Running Kimi evaluation..."
    kimi_result=$(evaluate_with_kimi "$query" "$reply")
    kimi_score=$(echo "$kimi_result" | grep -oE '[0-9]' | head -1 || echo "")
  fi
  
  # Evaluate with Droid
  droid_score=""
  if [ -f /root/.local/bin/droid ]; then
    echo "  Running Droid evaluation..."
    droid_result=$(evaluate_with_droid "$query" "$reply")
    droid_score=$(echo "$droid_result" | grep -oE '[0-9]' | head -1 || echo "")
  fi
  
  echo "  Scores - Kimi: ${kimi_score:-N/A}, Droid: ${droid_score:-N/A}"
  echo ""
  
  # Save to JSON
  echo "  {" >> "$RESULTS_FILE"
  echo "    \"test_num\": $((i+1))," >> "$RESULTS_FILE"
  echo "    \"category\": \"$category\"," >> "$RESULTS_FILE"
  echo "    \"query\": $(jq -s '.' <<< "$query")," >> "$RESULTS_FILE"
  echo "    \"response\": $(jq -s '.' <<< "$reply")," >> "$RESULTS_FILE"
  echo "    \"provider\": \"$provider\"," >> "$RESULTS_FILE"
  echo "    \"kimi_score\": ${kimi_score:-null}," >> "$RESULTS_FILE"
  echo "    \"droid_score\": ${droid_score:-null}" >> "$RESULTS_FILE"
  echo "  }," >> "$RESULTS_FILE"
done

# Close JSON
sed -i '$ s/,$//' "$RESULTS_FILE"
echo "]" >> "$RESULTS_FILE"
echo "}" >> "$RESULTS_FILE"

echo "Results saved to: $RESULTS_FILE"
echo ""
echo "========================================"
echo "Summary"
echo "========================================"
cat "$RESULTS_FILE" | jq '.evaluations | .[] | {category, kimi_score, droid_score}'
