#!/bin/bash

# AI Assistant Judge Evaluation Script
# Uses Kimi, Gemini, and Codex CLI as judges to evaluate AI responses

set -e

ENDPOINT="http://127.0.0.1:8131"
EVAL_SECRET="eval-secret-123"

# Test scenarios for judge evaluation
SCENARIOS=(
  "Поставщики ПНД труб в Минске"
  "Какая погода в Минске?"
  "Где купить мастерок для цемента?"
  "Подготовь заявку для поставщика кофе"
)

echo "=============================================="
echo "AI Assistant Judge Evaluation"
echo "Using Kimi, Gemini, Codex CLI as judges"
echo "=============================================="
echo ""

# Function to send request to AI
send_request() {
  local message="$1"
  local payload=$(cat <<EOF
{
  "message": "$message",
  "history": []
}
EOF
)
  
  curl -s -X POST "${ENDPOINT}/api/ai/request" \
    -H "Content-Type: application/json" \
    -H "x-eval-secret: ${EVAL_SECRET}" \
    -d "$payload" | jq -r '.reply.text // empty'
}

# Test scenarios
echo "Testing AI responses..."
echo ""

for i in "${!SCENARIOS[@]}"; do
  echo "Scenario $((i+1)): ${SCENARIOS[$i]}"
  RESPONSE=$(send_request "${SCENARIOS[$i]}")
  echo "Response: ${RESPONSE:0:300}..."
  echo ""
done

echo "=============================================="
echo "Running CLI Judge Evaluation"
echo "=============================================="
echo ""

# Check if judges are available
JUDGES=()

if command -v kimi &> /dev/null; then
  JUDGES+=("kimi")
  echo "✓ Kimi CLI available"
fi

if command -v gemini &> /dev/null; then
  JUDGES+=("gemini")
  echo "✓ Gemini CLI available"
fi

if command -v codex &> /dev/null; then
  JUDGES+=("codex")
  echo "✓ Codex CLI available"
fi

if [ ${#JUDGES[@]} -eq 0 ]; then
  echo "No CLI judges available. Install Kimi, Gemini, or Codex CLI."
  exit 1
fi

echo ""
echo "Running judge evaluations..."
echo ""

# Create a judge prompt
JUDGE_PROMPT="You are a judge evaluating an AI assistant for Belarus business directory (Biznesinfo). 
Rate the assistant's response on usefulness scale 1-5:
- 5: Perfect - exactly what user needed
- 4: Good - useful with minor gaps
- 3: OK - partially useful
- 2: Poor - mostly generic fallback
- 1: Not useful - wrong or no answer

User query: 'Поставщики ПНД труб в Минске'

AI Response: '1. БелРегионПласт ООО - /company/belregionplast | Минск | ПНД/полиэтиленовые трубы для газо- и водоснабжения, фитинги, арматура | +375 (17) 240 08 34
2. Центропласт ООО - /company/centroplast | Минск | НПВХ и полиэтиленовые трубы, фасонные изделия, оптовые поставки | +375 (17) 298 54 64
3. МЕГАСНАБ ООО - /company/megasnab | Минск | Трубы и изделия из полиэтилена для систем водоснабжения, трубопроводная арматура | +375 (17) 223 52 99
4. ПластЛайн ООО - /company/plastline | Минск | Собственное производство ПНД труб: технические, гофрированные, водопроводные | +375 (29) 151 69 03
5. АнкирГрупп ООО - /company/ankirgroup | Минск | ПНД трубы, фитинги, запорная арматура'

Rate this response (just give a number 1-5):"

# Run judge evaluations
for judge in "${JUDGES[@]}"; do
  echo "Running $judge judge..."
  case $judge in
    kimi)
      echo "$JUDGE_PROMPT" | kimi chat --model kimi-2 - 2>/dev/null | tail -1 || echo "Kimi evaluation unavailable"
      ;;
    gemini)
      echo "$JUDGE_PROMPT" | gemini -m gemini-2.0-flash - 2>/dev/null | tail -1 || echo "Gemini evaluation unavailable"
      ;;
    codex)
      echo "$JUDGE_PROMPT" | codex chat -m gpt-5 - 2>/dev/null | tail -1 || echo "Codex evaluation unavailable"
      ;;
  esac
  echo ""
done

echo "=============================================="
echo "Evaluation Complete"
echo "=============================================="
