#!/bin/bash

# Quick Judge Evaluation using Codex
# Run this script to evaluate AI responses

ENDPOINT="http://127.0.0.1:8131"
EVAL_SECRET="eval-secret-123"

echo "=============================================="
echo "AI Assistant Quick Judge Evaluation"
echo "Using Codex CLI as judge"
echo "=============================================="
echo ""

# Test scenarios
SCENARIOS=(
  "Поставщики ПНД труб в Минске"
  "составь шаблон запроса КП для закупки офисной мебели"
  "Какая погода в Минске?"
  "где купить мастерок для цемента"
)

send_request() {
  local msg="$1"
  curl -s -X POST "${ENDPOINT}/api/ai/request" \
    -H "Content-Type: application/json" \
    -H "x-eval-secret: ${EVAL_SECRET}" \
    -d "{\"message\": \"$msg\"}" | jq -r '.reply.text // empty'
}

# Run tests
total=0
sum=0

for i in "${!SCENARIOS[@]}"; do
  query="${SCENARIOS[$i]}"
  echo "Test $((i+1)): $query"
  
  response=$(send_request "$query")
  echo "Response: ${response:0:200}..."
  
  # Quick evaluation with Codex
  prompt="Запрос: $query
Ответ: $response

Оцени полезность 1-5. Ответь ТОЛЬКО числом."
  
  rating=$(timeout 15 /usr/bin/codex exec --ephemeral "$prompt" 2>/dev/null | grep -oP '^\d+' | head -1)
  
  if [ -z "$rating" ]; then
    rating="?"
  fi
  
  echo "Codex rating: $rating/5"
  echo "---"
  
  if [ "$rating" != "?" ] && [ "$rating" -eq "$rating" ] 2>/dev/null; then
    total=$((total+1))
    sum=$((sum+rating))
  fi
done

if [ $total -gt 0 ]; then
  avg=$(echo "scale=2; $sum / $total" | bc)
  echo ""
  echo "Average rating: $avg/5"
else
  echo ""
  echo "Not enough ratings"
fi
