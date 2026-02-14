#!/usr/bin/env node

/**
 * AI Assistant Judge Evaluation Script
 * Uses Kimi, Gemini, and Codex CLI as judges to evaluate AI responses
 * 
 * Run with: node scripts/cli-judge-eval.mjs
 */

import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, '..', '..');

const ENDPOINT = 'http://127.0.0.1:8131';
const EVAL_SECRET = 'eval-secret-123';

// CLI tool paths
const CLI_PATHS = {
  kimi: '/root/.local/bin/kimi',
  gemini: '/usr/bin/gemini',
  codex: '/usr/bin/codex'
};

// Test scenarios for judge evaluation
const TEST_SCENARIOS = [
  {
    id: 'sourcing',
    query: 'Поставщики ПНД труб в Минске',
    expected: 'Список поставщиков с контактами',
    category: 'sourcing'
  },
  {
    id: 'template',
    query: 'составь шаблон запроса КП для закупки офисной мебели',
    expected: 'Шаблон с Subject, Body, WhatsApp',
    category: 'template'
  },
  {
    id: 'weather',
    query: 'Какая погода в Минске?',
    expected: 'Актуальная информация о погоде',
    category: 'general_info'
  }
];

// Judge prompts
const JUDGE_SYSTEM_PROMPT = `Ты - эксперт по оценке качества ответов ИИ-ассистента для бизнес-справочника Беларуси (Biznesinfo).

Оцени полезность ответа по шкале 1-5:
- 5: Отлично - именно то, что нужно пользователю
- 4: Хорошо - полезно с небольшими недочётами
- 3: Нормально - частично полезно
- 2: Плохо - в основном общий шаблон
- 1: Бесполезно - неправильный или отсутствует ответ

Также укажи:
- useful: true/false (оценка >= 4)
- issue: краткое описание проблемы (если есть)
- continue: true/false (нужно ли продолжать диалог)

Отвечай в формате JSON:
{"rating": 5, "useful": true, "issue": "", "continue": false}`;

const JUDGE_USER_PROMPT = `Оцени полезность ответа ИИ для запроса пользователя.

Запрос: "{QUERY}"

Ответ: "{RESPONSE}"

Дай оценку 1-5:
- 5: Отлично
- 4: Хорошо  
- 3: Нормально
- 2: Плохо
- 1: Бесполезно

Ответь ТОЛЬКО числом.`;

/**
 * Send request to AI endpoint
 */
async function sendRequest(message, history = [], conversationId = null) {
  const payload = {
    message,
    history: history
  };
  if (conversationId) {
    payload.conversationId = conversationId;
  }

  const response = await fetch(`${ENDPOINT}/api/ai/request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-eval-secret': EVAL_SECRET
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  return {
    text: data.reply?.text || '',
    isStub: data.reply?.isStub || false,
    provider: data.reply?.provider || 'unknown',
    conversationId: data.conversationId
  };
}

/**
 * Run CLI judge evaluation using spawnSync
 */
function runJudgeSync(judgeName, prompt) {
  try {
    if (judgeName === 'codex') {
      const result = spawnSync(CLI_PATHS.codex, ['exec', '--ephemeral', prompt], {
        timeout: 15000,
        encoding: 'utf-8'
      });
      
      if (result.error) {
        return { error: result.error.message };
      }
      
      return { output: result.stdout.slice(0, 1000) };
    }
  } catch (e) {
    return { error: e.message };
  }
  return { error: 'Unknown judge' };
}

/**
 * Parse judge rating from output
 */
function parseJudgeRating(output) {
  try {
    // Try to find a number in the output
    const match = output.match(/(\d+)/);
    if (match) {
      const rating = parseInt(match[1], 10);
      if (rating >= 1 && rating <= 5) {
        return { rating, useful: rating >= 4 };
      }
    }
  } catch (e) {
    // Ignore parsing errors
  }
  return null;
}

/**
 * Main evaluation function
 */
async function main() {
  console.log('='.repeat(60));
  console.log('AI Assistant Judge Evaluation');
  console.log('Using Kimi, Gemini, Codex CLI as judges');
  console.log('='.repeat(60));
  console.log();

  // Check CLI availability using full paths
  const judges = [];
  
  // Kimi and Gemini don't support non-interactive mode well, use Codex only
  console.log('✗ Kimi CLI: does not support non-interactive mode');
  console.log('✗ Gemini CLI: requires interactive mode');
  
  try {
    spawnSync(CLI_PATHS.codex, ['--version'], { stdio: 'ignore' });
    judges.push('codex');
    console.log('✓ Codex CLI available');
  } catch (e) {
    console.log('✗ Codex CLI not available');
  }

  if (judges.length === 0) {
    console.error('No CLI judges available. Install Kimi, Gemini, or Codex CLI.');
    process.exit(1);
  }

  console.log();
  console.log('Running evaluations...');
  console.log();

  const results = [];
  
  for (const scenario of TEST_SCENARIOS) {
    console.log(`Scenario: ${scenario.id} (${scenario.category})`);
    console.log(`  Query: ${scenario.query}`);
    
    try {
      // First turn
      const firstResponse = await sendRequest(scenario.query);
      console.log(`  Response (first turn): ${firstResponse.text.slice(0, 200)}...`);
      
      let finalResponse = firstResponse;
      let conversationId = firstResponse.conversationId;
      
      // Follow-up turn for multi_turn scenarios
      if (scenario.followUp && scenario.category === 'multi_turn') {
        console.log(`  Follow-up: ${scenario.followUp}`);
        const history = [
          { role: 'user', content: scenario.query },
          { role: 'assistant', content: firstResponse.text }
        ];
        const secondResponse = await sendRequest(scenario.followUp, history, conversationId);
        console.log(`  Response (second turn): ${secondResponse.text.slice(0, 200)}...`);
        finalResponse = secondResponse;
      }

      // Run judges
      const judgeResults = {};
      for (const judge of judges) {
        const prompt = JUDGE_USER_PROMPT
          .replace('{QUERY}', scenario.query)
          .replace('{RESPONSE}', finalResponse.text.slice(0, 300));
        
        console.log(`  Running ${judge}...`);
        
        const judgeOutput = runJudgeSync(judge, prompt);
        
        if (judgeOutput.error) {
          console.log(`    ${judge} error: ${judgeOutput.error}`);
          judgeResults[judge] = { rating: null, error: judgeOutput.error };
        } else {
          const parsed = parseJudgeRating(judgeOutput.output);
          if (parsed) {
            console.log(`    ${judge} rating: ${parsed.rating}/5 (useful: ${parsed.useful})`);
            judgeResults[judge] = parsed;
          } else {
            console.log(`    ${judge} output: ${judgeOutput.output.slice(0, 200)}`);
            judgeResults[judge] = { rating: null, output: judgeOutput.output };
          }
        }
      }

      results.push({
        scenario: scenario.id,
        category: scenario.category,
        query: scenario.query,
        response: finalResponse.text.slice(0, 500),
        isStub: finalResponse.isStub,
        provider: finalResponse.provider,
        judges: judgeResults
      });

    } catch (error) {
      console.error(`  Error: ${error.message}`);
      results.push({
        scenario: scenario.id,
        category: scenario.category,
        query: scenario.query,
        error: error.message,
        judges: {}
      });
    }

    console.log();
  }

  // Summary
  console.log('='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  
  const allRatings = [];
  for (const result of results) {
    console.log(`\n${result.scenario} (${result.category}):`);
    for (const [judge, data] of Object.entries(result.judges)) {
      if (data.rating !== null) {
        console.log(`  ${judge}: ${data.rating}/5`);
        allRatings.push(data.rating);
      } else if (data.error) {
        console.log(`  ${judge}: error`);
      }
    }
  }

  if (allRatings.length > 0) {
    const avgRating = allRatings.reduce((a, b) => a + b, 0) / allRatings.length;
    console.log(`\nAverage rating: ${avgRating.toFixed(2)}/5`);
  }

  // Save results
  const reportDir = join(repoRoot, 'app', 'qa', 'ai-request', 'reports');
  if (!existsSync(reportDir)) {
    mkdirSync(reportDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportFile = join(reportDir, `cli-judge-${timestamp}.json`);
  writeFileSync(reportFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    judges: judges,
    results: results,
    summary: {
      averageRating: allRatings.length > 0 
        ? allRatings.reduce((a, b) => a + b, 0) / allRatings.length 
        : null,
      totalScenarios: results.length,
      successfulJudges: allRatings.length
    }
  }, null, 2));

  console.log(`\nReport saved to: ${reportFile}`);
}

main().catch(console.error);
