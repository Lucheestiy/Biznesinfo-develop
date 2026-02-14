import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const BASE_URL = "http://127.0.0.1:8131";
const MOCK_USER_ID = "eval-runner";
const GOLDEN_SET_PATH = path.join(process.cwd(), "devloop", "AI_EVAL_GOLDEN_PROMPTS.json");
const OUTPUT_PATH = path.join(process.cwd(), "devloop", "AI_EVAL_RESULTS.json");

type EvalCase = {
  id: string;
  category: string;
  prompt: string;
  expected_intent?: string;
  expected_tags?: string[];
  expected_geo?: string;
  min_candidates?: number;
  required_blocks?: string[];
  forbidden_patterns?: string[];
  min_numbered_items?: number;
  expected_refusal?: boolean;
};

type EvalResult = {
  id: string;
  prompt: string;
  response: string;
  passed: boolean;
  score: number;
  issues: string[];
  duration_ms: number;
  provider: string;
};

async function runEval() {
  console.log(`Starting AI Evaluation against ${BASE_URL}...`);
  
  let goldenSet: EvalCase[] = [];
  try {
    const raw = await fs.readFile(GOLDEN_SET_PATH, "utf-8");
    goldenSet = JSON.parse(raw);
  } catch (e) {
    console.error(`Failed to load golden set from ${GOLDEN_SET_PATH}`, e);
    process.exit(1);
  }

  const results: EvalResult[] = [];
  let passedCount = 0;

  // We need a way to authenticate. For dev/eval, we might need a bypass or a real token.
  // For now, we'll assume we can hit the endpoint if we mock auth or use a dev token.
  // Since this is a script, we'll try to use a mock user header if the API supports it in dev mode,
  // OR we rely on the fact that we are running locally.
  // ACTUALLY: The API requires a session/cookie. 
  // Workaround: We will use a special header `x-eval-bypass-auth` if we modify the API (not ideal),
  // OR we just log that we can't run full integration tests easily without a token.
  // BUT: We are in the same repo. We can potentially import the handler directly?
  // No, `next/server` imports might break in a standalone script.
  // BEST APPROACH: Assume we have a valid `AI_EVAL_API_KEY` or similar, or just warn if auth fails.
  // For this cycle, let's implement the logic and note the auth requirement.
  
  console.log(`Loaded ${goldenSet.length} test cases.`);

  for (const testCase of goldenSet) {
    console.log(`Running case ${testCase.id}: "${testCase.prompt}"...`);
    const start = Date.now();
    
    let responseText = "";
    let provider = "unknown";
    let fetchError: string | null = null;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
        const res = await fetch(`${BASE_URL}/api/ai/request`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "User-Agent": "AI_EVAL_RUNNER",
                "x-eval-secret": "eval-secret-123"
            },
            body: JSON.stringify({
                message: testCase.prompt,
                history: [],
                payload: { source: "eval_script" }
            }),
            signal: controller.signal
        });

        if (res.status === 401 || res.status === 403) {
            fetchError = `Auth failed (${res.status})`;
        } else {
            const contentType = res.headers.get("content-type") || "";
            if (contentType.includes("application/json")) {
                const data = await res.json();
                if (!res.ok) {
                    fetchError = data?.error || `HTTP ${res.status}`;
                } else {
                    responseText = data?.reply?.text || "";
                    provider = data?.reply?.provider || "unknown";
                }
            } else {
                const text = await res.text();
                fetchError = `Invalid content-type: ${contentType} (Preview: ${text.slice(0, 100)})`;
            }
        }
    } catch (e) {
        fetchError = String(e);
    } finally {
        clearTimeout(timeoutId);
    }

    const duration = Date.now() - start;
    const issues: string[] = [];
    let passed = true;

    if (fetchError) {
        issues.push(`Fetch error: ${fetchError}`);
        passed = false;
        // Skip logic checks if fetch failed
    } else {
        // 1. Check intended refusal
        if (testCase.expected_refusal) {
            const refused = /(не могу|не смогу|cannot|sorry|извините)/i.test(responseText);
            if (!refused) {
                issues.push("Did not refuse unsafe/invalid prompt");
                passed = false;
            }
        }

        // 2. Check required blocks
        if (testCase.required_blocks) {
            for (const block of testCase.required_blocks) {
                if (!responseText.includes(block)) {
                    issues.push(`Missing required block: ${block}`);
                    passed = false;
                }
            }
        }

        // 3. Check forbidden patterns
        if (testCase.forbidden_patterns) {
            for (const pattern of testCase.forbidden_patterns) {
                if (responseText.includes(pattern)) {
                    issues.push(`Contains forbidden pattern: ${pattern}`);
                    passed = false;
                }
            }
        }

        // 4. Check min candidates (regex for /company/ slug or numbered list)
        if (testCase.min_candidates) {
            const links = (responseText.match(/\/company\/[a-z0-9-]+/gi) || []).length;
            const items = (responseText.match(/^\d+\.\s/gm) || []).length;
            if (links < testCase.min_candidates && items < testCase.min_candidates) {
                issues.push(`Found only ${links} links / ${items} items, expected ${testCase.min_candidates}`);
                passed = false;
            }
        }
        
        // 5. Check checklist items
        if (testCase.min_numbered_items) {
             const items = (responseText.match(/^\d+\.\s/gm) || []).length;
             if (items < testCase.min_numbered_items) {
                 issues.push(`Found only ${items} list items, expected ${testCase.min_numbered_items}`);
                 passed = false;
             }
        }
    }

    if (passed) passedCount++;

    results.push({
        id: testCase.id,
        prompt: testCase.prompt,
        response: responseText.slice(0, 200) + (responseText.length > 200 ? "..." : ""),
        passed,
        score: passed ? 1 : 0,
        issues,
        duration_ms: duration,
        provider
    });
  }

  const summary = {
    total: goldenSet.length,
    passed: passedCount,
    failed: goldenSet.length - passedCount,
    timestamp: new Date().toISOString(),
    results
  };

  await fs.writeFile(OUTPUT_PATH, JSON.stringify(summary, null, 2));
  console.log(`Evaluation complete. Passed: ${passedCount}/${goldenSet.length}. Results saved to ${OUTPUT_PATH}`);
}

// Execute
runEval().catch(console.error);
