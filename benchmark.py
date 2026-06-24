#!/usr/bin/env python3
"""
Autonomous benchmark suite for NVIDIA API model selection.
Run with: python benchmark.py
Results written to ./benchmark_results/
"""

import os
import json
import time
import asyncio
import statistics
from datetime import datetime
from pathlib import Path

import httpx

API_BASE = "https://integrate.api.nvidia.com/v1"
API_KEY  = os.environ.get("NVIDIA_API_KEY", "")
OUT_DIR  = Path("./benchmark_results")
OUT_DIR.mkdir(exist_ok=True)

MODELS = [
    "nvidia/llama-3.3-nemotron-super-49b-v1.5",
    "nvidia/nemotron-3-super-120b-a12b",
    "nvidia/nemotron-3-nano-30b-a3b",
    "meta/llama-4-maverick-17b-128e-instruct",
    "mistralai/mistral-small-4-119b-2603",
    "deepseek-ai/deepseek-v4-flash",
    "z-ai/glm-5.1",
    "qwen/qwen3.5-397b-a17b",
]

HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
}

TASK_PROMPTS = {
    "orchestration": {
        "system": "You are an orchestrator that breaks complex tasks into subtasks.",
        "user": (
            "A user wants to: refactor a Python monolith into microservices, "
            "add CI/CD, and write integration tests. "
            "Produce a numbered execution plan with dependencies clearly marked. "
            "Be specific, be complete, stop at 15 steps."
        ),
        "eval_criteria": "Clarity of steps, correct dependency ordering, completeness, no hallucinated tools",
    },
    "code": {
        "system": "You are an expert software engineer.",
        "user": (
            "Write a Python function `merge_sorted_streams(*iterables)` that lazily merges "
            "N sorted iterables into one sorted stream using a min-heap. "
            "Include type hints, docstring, and three pytest test cases."
        ),
        "eval_criteria": "Correctness of heap logic, proper lazy evaluation, working tests, clean style",
    },
    "git": {
        "system": "You are a git and DevOps expert.",
        "user": (
            "I have two long-lived branches: `main` and `feature/auth`. "
            "They have diverged by 47 commits. "
            "Walk me through a safe rebase strategy, conflict resolution approach, "
            "and the exact git commands in order. Assume I have uncommitted changes."
        ),
        "eval_criteria": "Command accuracy, safe ordering (stash before rebase), conflict advice, rollback option",
    },
    "testing": {
        "system": "You are a senior QA and test automation engineer.",
        "user": (
            "Given this function signature:\n"
            "  def process_payment(amount: float, currency: str, user_id: int) -> dict\n"
            "Write a complete pytest test suite covering: happy path, boundary values, "
            "invalid inputs, currency edge cases, and mock for external payment API. "
            "Use pytest fixtures properly."
        ),
        "eval_criteria": "Coverage breadth, correct fixture usage, mocking approach, edge case identification",
    },
    "exploration": {
        "system": "You are a research agent that explores codebases and summarizes findings.",
        "user": (
            "You are exploring an unfamiliar Python repo. You find these files: "
            "main.py, config.yaml, models/user.py, services/auth.py, utils/crypto.py. "
            "Describe your exploration strategy, what you read first and why, "
            "what questions you form, and what you would report back to the orchestrator."
        ),
        "eval_criteria": "Logical exploration order, quality of questions formed, structured reporting",
    },
    "general": {
        "system": "You are a helpful, precise assistant.",
        "user": (
            "Explain the CAP theorem. Then give a concrete example of a system that "
            "chooses CP, one that chooses AP, and explain what each sacrifices. "
            "Keep it under 300 words."
        ),
        "eval_criteria": "Technical accuracy, concrete examples, conciseness, stays under word limit",
    },
}

CONTEXT_PADDING = "The quick brown fox jumps over the lazy dog. " * 50


def token_count_estimate(text: str) -> int:
    return len(text) // 4


def make_payload(model: str, system: str, user: str, max_tokens: int = 512) -> dict:
    return {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user",   "content": user},
        ],
        "max_tokens": max_tokens,
        "temperature": 0.2,
    }


async def chat(client, model, system, user, max_tokens=512, timeout=120.0):
    payload = make_payload(model, system, user, max_tokens)
    start = time.perf_counter()
    result = {
        "model": model,
        "status": None,
        "latency_s": None,
        "content": None,
        "tokens_out": None,
        "error": None,
    }
    try:
        resp = await client.post(
            f"{API_BASE}/chat/completions",
            headers=HEADERS,
            json=payload,
            timeout=timeout,
        )
        elapsed = time.perf_counter() - start
        result["status"] = resp.status_code
        result["latency_s"] = round(elapsed, 3)

        if resp.status_code == 200:
            data = resp.json()
            content = data["choices"][0]["message"]["content"]
            tokens_out = data.get("usage", {}).get("completion_tokens", 0)
            result["content"] = content
            result["tokens_out"] = tokens_out
        else:
            result["error"] = resp.text[:300]

    except httpx.TimeoutException:
        result["status"] = "TIMEOUT"
        result["error"] = f"Timed out after {timeout}s"
    except Exception as e:
        result["status"] = "EXCEPTION"
        result["error"] = str(e)

    return result


async def test_availability(client):
    print("\n=== TEST 1: Availability ===")
    results = {}
    for model in MODELS:
        r = await chat(client, model, "You are helpful.", "Say OK.", max_tokens=5)
        status = "OK" if r["status"] == 200 else f"FAIL({r['status']})"
        print(f"  {model:<55} {status}")
        results[model] = r["status"]
    return results


async def test_latency(client, runs=5):
    print(f"\n=== TEST 2: Latency ({runs} runs each) ===")
    results = {}
    for model in MODELS:
        latencies = []
        tps_list = []
        errors = 0
        for i in range(runs):
            r = await chat(client, model, "You are concise.", "List 3 planets.", max_tokens=60)
            if r["status"] == 200:
                latencies.append(r["latency_s"])
                if r["tokens_out"] and r["latency_s"] > 0:
                    tps_list.append(r["tokens_out"] / r["latency_s"])
            else:
                errors += 1
            await asyncio.sleep(0.5)

        if latencies:
            mean_lat = round(statistics.mean(latencies), 3)
            std_lat = round(statistics.stdev(latencies) if len(latencies) > 1 else 0, 3)
            mean_tps = round(statistics.mean(tps_list), 1) if tps_list else 0
            print(f"  {model:<55} mean={mean_lat}s  std={std_lat}s  tps={mean_tps}  errors={errors}")
            results[model] = {
                "mean_latency_s": mean_lat,
                "std_latency_s": std_lat,
                "mean_tokens_per_s": mean_tps,
                "errors": errors,
            }
        else:
            print(f"  {model:<55} ALL FAILED")
            results[model] = {"error": "all_failed", "errors": errors}
    return results


async def test_rate_limits(client):
    print("\n=== TEST 3: Rate Limit Probing ===")
    concurrency_levels = [1, 3, 5, 10]
    results = {}

    for model in MODELS:
        model_results = {}
        for level in concurrency_levels:
            tasks = [
                chat(client, model, "Be brief.", "Say hi.", max_tokens=10)
                for _ in range(level)
            ]
            responses = await asyncio.gather(*tasks)
            statuses = [r["status"] for r in responses]
            n_429 = statuses.count(429)
            n_200 = statuses.count(200)
            hit_limit = n_429 > 0
            print(
                f"  {model:<50} concurrency={level:>2}  "
                f"200s={n_200}  429s={n_429}  {'RATE LIMITED' if hit_limit else 'OK'}"
            )
            model_results[f"concurrency_{level}"] = {
                "200s": n_200,
                "429s": n_429,
                "rate_limited": hit_limit,
            }
            if hit_limit:
                break
            await asyncio.sleep(2)

        results[model] = model_results
    return results


async def test_context_window(client):
    print("\n=== TEST 4: Context Window ===")
    token_targets = [1000, 4000, 8000, 16000, 32000]
    results = {}

    for model in MODELS:
        model_results = {}
        max_ok = 0
        for target in token_targets:
            reps = max(1, target // 400)
            prompt = CONTEXT_PADDING * reps
            actual = token_count_estimate(prompt)

            r = await chat(
                client, model,
                "Summarize the following text in one sentence.",
                prompt,
                max_tokens=50,
                timeout=90.0,
            )
            ok = r["status"] == 200
            print(
                f"  {model:<50} ~{actual:>6} tokens  "
                f"{'OK' if ok else 'FAIL ' + str(r['status'])}"
            )
            model_results[f"tokens_{actual}"] = {
                "ok": ok,
                "status": r["status"],
                "latency_s": r["latency_s"],
            }
            if ok:
                max_ok = actual
            else:
                break
            await asyncio.sleep(1)

        model_results["max_ok_tokens"] = max_ok
        results[model] = model_results
    return results


JUDGE_SYSTEM = """You are an impartial evaluator.
You will receive a task description, evaluation criteria, and a model response.
Score the response 1-10 on each criterion below, then give an overall score.
Reply ONLY with valid JSON in this exact shape:
{
  "criteria_scores": {"criterion_name": <int 1-10>, ...},
  "overall": <int 1-10>,
  "reasoning": "<one sentence>"
}"""


def build_judge_prompt(task_name, criteria, response):
    return (
        f"TASK: {task_name}\n"
        f"CRITERIA: {criteria}\n\n"
        f"MODEL RESPONSE:\n{response}\n\n"
        f"Score this response."
    )


async def judge_response(client, judge_model, task_name, criteria, response):
    prompt = build_judge_prompt(task_name, criteria, response)
    r = await chat(client, judge_model, JUDGE_SYSTEM, prompt, max_tokens=300, timeout=60.0)
    if r["status"] != 200:
        return {"error": f"judge failed: {r['status']}"}
    try:
        content = r["content"] or ""
        start = content.find("{")
        end = content.rfind("}") + 1
        return json.loads(content[start:end])
    except Exception as e:
        raw = (r["content"] or "")[:200]
        return {"error": f"parse_failed: {e}", "raw": raw}


async def test_task_quality(client, judge_model="nvidia/llama-3.3-nemotron-super-49b-v1.5"):
    print(f"\n=== TEST 5: Task Quality (judge={judge_model}) ===")
    results = {}

    for task_name, task in TASK_PROMPTS.items():
        print(f"\n  Task: {task_name}")
        results[task_name] = {}

        for model in MODELS:
            r = await chat(client, model, task["system"], task["user"], max_tokens=800)
            if r["status"] != 200:
                print(f"    {model:<50} FAIL ({r['status']})")
                results[task_name][model] = {"error": r["status"]}
                continue

            score = await judge_response(client, judge_model, task_name, task["eval_criteria"], r["content"])
            overall = score.get("overall", "?")
            reason = score.get("reasoning", "")[:80]
            print(f"    {model:<50} score={overall}/10  {reason}")
            results[task_name][model] = {
                "latency_s": r["latency_s"],
                "tokens_out": r["tokens_out"],
                "score": score,
                "response_preview": (r["content"] or "")[:200],
            }
            await asyncio.sleep(1)

    return results


SUBAGENT_ROLES = {
    "orchestrator": {
        "primary_task": "orchestration",
        "weights": {"quality": 0.6, "latency": 0.2, "context": 0.2},
    },
    "explore": {
        "primary_task": "exploration",
        "weights": {"quality": 0.4, "latency": 0.4, "context": 0.2},
    },
    "general": {
        "primary_task": "general",
        "weights": {"quality": 0.5, "latency": 0.3, "context": 0.2},
    },
    "lane-worker": {
        "primary_task": "code",
        "weights": {"quality": 0.7, "latency": 0.2, "context": 0.1},
    },
    "git-worker": {
        "primary_task": "git",
        "weights": {"quality": 0.7, "latency": 0.2, "context": 0.1},
    },
    "test-engineer": {
        "primary_task": "testing",
        "weights": {"quality": 0.6, "latency": 0.3, "context": 0.1},
    },
}


def compute_recommendations(all_results):
    latency_data = all_results.get("latency", {})
    quality_data = all_results.get("task_quality", {})
    context_data = all_results.get("context_window", {})

    lat_values = {
        m: d.get("mean_latency_s", 999)
        for m, d in latency_data.items()
        if isinstance(d, dict) and "mean_latency_s" in d
    }
    max_lat = max(lat_values.values(), default=1)
    lat_norm = {m: 1 - (v / max_lat) for m, v in lat_values.items()}

    ctx_values = {
        m: d.get("max_ok_tokens", 0)
        for m, d in context_data.items()
        if isinstance(d, dict)
    }
    max_ctx = max(ctx_values.values(), default=1) or 1
    ctx_norm = {m: v / max_ctx for m, v in ctx_values.items()}

    recommendations = {}
    for role, config in SUBAGENT_ROLES.items():
        task = config["primary_task"]
        weights = config["weights"]
        scores = {}

        task_results = quality_data.get(task, {})
        for model in MODELS:
            q_score = task_results.get(model, {}).get("score", {}).get("overall", 0) / 10
            l_score = lat_norm.get(model, 0)
            c_score = ctx_norm.get(model, 0)

            composite = (
                weights["quality"] * q_score
                + weights["latency"] * l_score
                + weights["context"] * c_score
            )
            scores[model] = round(composite, 4)

        best = max(scores, key=scores.get) if scores else "unknown"
        recommendations[role] = {
            "recommended_model": best,
            "scores": scores,
            "primary_task": task,
        }
        print(f"\n  Role: {role:<15} -> {best}")
        print(f"    Scores: " + "  ".join(f"{m.split('/')[-1]}={s}" for m, s in scores.items()))

    return recommendations


async def main():
    if not API_KEY:
        raise RuntimeError("NVIDIA_API_KEY environment variable not set.")

    print("=" * 70)
    print("NVIDIA API Model Benchmark Suite")
    print(f"Started: {datetime.now().isoformat()}")
    print(f"Models: {len(MODELS)}")
    print(f"Judge: nvidia/llama-3.3-nemotron-super-49b-v1.5")
    print("=" * 70)

    all_results = {}

    async with httpx.AsyncClient() as client:
        all_results["availability"] = await test_availability(client)
        all_results["latency"] = await test_latency(client, runs=5)
        all_results["rate_limits"] = await test_rate_limits(client)
        all_results["context_window"] = await test_context_window(client)
        all_results["task_quality"] = await test_task_quality(client)

    print("\n=== RECOMMENDATIONS ===")
    all_results["recommendations"] = compute_recommendations(all_results)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = OUT_DIR / f"benchmark_{timestamp}.json"
    with open(output_file, "w") as f:
        json.dump(all_results, f, indent=2)

    print(f"\nFull results saved to: {output_file}")
    return all_results


if __name__ == "__main__":
    asyncio.run(main())
