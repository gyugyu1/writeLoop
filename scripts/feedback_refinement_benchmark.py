#!/usr/bin/env python3
import argparse
import concurrent.futures
import datetime as dt
import json
import os
import random
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path

HANGUL_RE = re.compile(r"[\u3131-\u318E\uAC00-\uD7A3]")
GENERIC_RE = re.compile(r"^(On the positive side|On the other hand|However|Overall)\b", re.I)
DIAG_RE = re.compile(
    r"Refinement diagnostics promptId=(?P<prompt>\S+) rawInput=(?P<raw>\d+) "
    r"rawAccepted=(?P<accepted>\d+) modelSupplement=(?P<model>\d+) hintFallback=(?P<hint>\d+) "
    r"rejected\[recommendation=(?P<recommendation>\d+), blank=(?P<blank>\d+), "
    r"duplicate=(?P<duplicate>\d+), novelty=(?P<novelty>\d+)\] finalSources=(?P<sources>.*?) "
    r"rawExpressions=(?P<raw_expr>.*?) finalExpressions=(?P<final_expr>.*?) learnerPreview=(?P<preview>.*)$"
)


def fetch_json(url, payload=None, timeout=120):
    headers = {"Content-Type": "application/json"}
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(url, data=data, headers=headers, method="POST" if payload else "GET")
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def docker_logs_since(container, since_iso):
    result = subprocess.run(
        ["docker", "logs", "--since", since_iso, container],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=True,
    )
    return result.stdout + ("\n" + result.stderr if result.stderr else "")


def subject_from_prompt(prompt):
    topic = prompt.get("topic", "")
    return topic.split(" - ", 1)[1].strip() if " - " in topic else (topic or prompt.get("questionEn", "this topic"))


def generate_answer(prompt, variant):
    category = ((prompt.get("coachProfile") or {}).get("primaryCategory") or "GENERAL").upper()
    subject = subject_from_prompt(prompt)
    variants = {
        "ROUTINE": [
            f"I usually keep a simple routine around {subject.lower()}. I do one or two familiar things because it helps me feel organized.",
            f"During {subject.lower()}, I usually start with something simple and then move on to the next task on my schedule.",
            f"My routine for {subject.lower()} is not very exciting, but it helps me stay calm and focused.",
            f"I often use {subject.lower()} to rest a little and get ready for what comes next.",
            f"I like having a steady routine for {subject.lower()} because it makes daily life easier.",
        ],
        "PREFERENCE": [
            f"My favorite choice related to {subject.lower()} is something I enjoy because it feels familiar and comforting.",
            f"I like it most because it is enjoyable, easy to return to, and always puts me in a good mood.",
            f"My favorite part of {subject.lower()} is that it feels both simple and special to me.",
            f"I keep choosing it because it reminds me of good memories and fits my personality well.",
            f"What I like most is that it feels satisfying in different situations.",
        ],
        "GOAL_PLAN": [
            f"One goal I have related to {subject.lower()} is to improve little by little. I plan to practice every week so I can make steady progress.",
            f"I want to get better at {subject.lower()} this year. My plan is to build a small routine and stay consistent.",
            f"My goal is to improve {subject.lower()} in a realistic way, so I want to take small steps and keep going.",
            f"I hope to make progress in {subject.lower()} by spending time on it regularly, even when I feel busy.",
            f"One thing I want to improve is {subject.lower()}, and I think a steady routine will help me a lot.",
        ],
        "PROBLEM_SOLUTION": [
            f"One challenge I often face with {subject.lower()} is staying consistent. To deal with it, I make a simple plan and review my priorities.",
            f"A common problem for me in {subject.lower()} is losing focus. I try to solve it by breaking the task into smaller steps.",
            f"I still struggle with {subject.lower()} sometimes, so I use a checklist and work on one thing at a time.",
            f"The hardest part of {subject.lower()} for me is keeping a steady rhythm, so I prepare in advance and keep things simple.",
            f"One difficulty I have with {subject.lower()} is managing everything at once. I deal with it by planning the next step clearly.",
        ],
        "BALANCED_OPINION": [
            f"In my view, {subject.lower()} has both benefits and drawbacks. It can help people in useful ways, but it can also create new problems if people use it carelessly.",
            f"I think {subject.lower()} has changed daily life in noticeable ways. On the positive side, it offers convenience, but it can also make people too dependent on it.",
            f"{subject} seems helpful in many situations, but I do not think the effect is completely positive. It depends on how people use it.",
            f"I can see both sides of {subject.lower()}. It creates opportunities, but it also raises concerns that should not be ignored.",
            f"Overall, I think {subject.lower()} is mostly positive if people use it responsibly and understand the limits.",
        ],
        "OPINION_REASON": [
            f"In my opinion, {subject.lower()} should take more responsibility because its influence affects many people every day.",
            f"I think {subject.lower()} should play a clear social role, and that matters because trust is hard to rebuild once it is lost.",
            f"My view is that {subject.lower()} should protect people in practical ways, not just talk about responsibility.",
            f"I believe {subject.lower()} should do more for society because small mistakes can create much bigger problems.",
            f"One important role of {subject.lower()} is to act fairly and explain decisions clearly so people can trust it.",
        ],
        "CHANGE_REFLECTION": [
            f"I used to think differently about {subject.lower()}, but now my view has changed. A few experiences helped me see the issue in a more realistic way.",
            f"My perspective on {subject.lower()} has changed over time because real experience taught me that my first idea was too simple.",
            f"I used to believe one thing about {subject.lower()}, but now I think more carefully about it after seeing different situations.",
            f"What changed my mind about {subject.lower()} was realizing that long-term experience matters more than quick judgment.",
            f"Over time, I changed my view of {subject.lower()} because I learned from mistakes and from watching other people closely.",
        ],
        "GENERAL": [
            f"One thing that stands out to me about {subject.lower()} is that it makes daily life easier and feels meaningful at the same time.",
            f"I would describe {subject.lower()} as something important in my life because it is useful, familiar, and memorable.",
            f"What I like most about {subject.lower()} is that it has practical value and also a personal meaning for me.",
            f"I remember {subject.lower()} clearly because it taught me something or gave me a feeling that stayed with me.",
            f"I would recommend {subject.lower()} because it combines usefulness with a more personal reason that matters to me.",
        ],
    }
    return variants.get(category, variants["GENERAL"])[variant % 5]


def build_samples(prompts, total, seed):
    rng = random.Random(seed)
    prompt_list = list(prompts)
    rng.shuffle(prompt_list)
    base_count = total // len(prompt_list)
    extra = total % len(prompt_list)
    samples = []
    for index, prompt in enumerate(prompt_list):
        count = base_count + (1 if index < extra else 0)
        for variant in range(count):
            samples.append(
                {
                    "promptId": prompt["id"],
                    "topic": prompt["topic"],
                    "primaryCategory": ((prompt.get("coachProfile") or {}).get("primaryCategory") or "UNKNOWN"),
                    "answer": generate_answer(prompt, variant),
                    "variant": variant,
                }
            )
    rng.shuffle(samples)
    return samples[:total]


def post_feedback(api_base, sample, index, run_id, retries=2):
    url = api_base.rstrip("/") + "/api/feedback"
    for attempt in range(retries + 1):
        try:
            payload = {
                "promptId": sample["promptId"],
                "answer": sample["answer"],
                "attemptType": "INITIAL",
                "guestId": f"benchmark-{run_id}-{sample['promptId']}-{index}-{attempt}",
                "sessionId": None,
            }
            response = fetch_json(url, payload=payload, timeout=120)
            return {
                "ok": True,
                "promptId": sample["promptId"],
                "primaryCategory": sample["primaryCategory"],
                "score": response.get("score"),
                "correctionCount": len(response.get("corrections", [])),
                "refinementExpressions": [item.get("expression", "") for item in response.get("refinementExpressions", [])],
            }
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            if exc.code in (429, 500, 502, 503, 504) and attempt < retries:
                time.sleep(1.5 * (attempt + 1))
                continue
            return {"ok": False, "promptId": sample["promptId"], "primaryCategory": sample["primaryCategory"], "error": f"http_{exc.code}", "body": body[:500]}
        except Exception as exc:  # noqa: BLE001
            if attempt < retries:
                time.sleep(1.5 * (attempt + 1))
                continue
            return {"ok": False, "promptId": sample["promptId"], "primaryCategory": sample["primaryCategory"], "error": type(exc).__name__, "body": str(exc)[:500]}


def parse_diagnostics(log_text):
    diagnostics = []
    for line in log_text.splitlines():
        match = DIAG_RE.search(line)
        if not match:
            continue
        data = match.groupdict()
        diagnostics.append(
            {
                "promptId": data["prompt"],
                "rawAccepted": int(data["accepted"]),
                "modelSupplement": int(data["model"]),
                "hintFallback": int(data["hint"]),
                "rejectedNovelty": int(data["novelty"]),
                "finalSources": [part.strip() for part in data["sources"].split("||") if part.strip()],
            }
        )
    return diagnostics


def expression_flags(expression):
    expression = (expression or "").strip()
    token_count = len([token for token in expression.split() if token])
    return {
        "containsHangul": bool(HANGUL_RE.search(expression)),
        "genericMarker": bool(GENERIC_RE.search(expression)),
        "fragmentLike": bool(re.match(r"^(to|for|of|about|with|on|in|at)\b", expression, re.I)) or token_count < 3,
        "ellipsisOrStarter": "..." in expression or expression.startswith('"'),
        "commaHeavy": expression.count(",") >= 3,
    }


def analyze(samples, responses, diagnostics):
    successes = [item for item in responses if item["ok"]]
    failures = [item for item in responses if not item["ok"]]
    prompt_to_category = {sample["promptId"]: sample["primaryCategory"] for sample in samples}
    totals_by_category = Counter(sample["primaryCategory"] for sample in samples)
    scores_by_category = defaultdict(list)
    expression_counts = Counter()
    total_expressions = 0

    for response in successes:
        scores_by_category[response["primaryCategory"]].append(response["score"])
        for expression in response["refinementExpressions"]:
            total_expressions += 1
            for name, active in expression_flags(expression).items():
                if active:
                    expression_counts[name] += 1

    problem_logs_by_category = Counter()
    fallback_logs_by_category = Counter()
    for item in diagnostics:
        category = prompt_to_category.get(item["promptId"], "UNKNOWN")
        problem_logs_by_category[category] += 1
        if item["hintFallback"] > 0:
            fallback_logs_by_category[category] += 1

    category_summary = []
    for category, request_count in sorted(totals_by_category.items()):
        scores = scores_by_category.get(category, [])
        category_summary.append(
            {
                "category": category,
                "requestCount": request_count,
                "avgScore": round(sum(scores) / len(scores), 2) if scores else None,
                "problemLogRate": round(problem_logs_by_category[category] / request_count, 4),
                "hintFallbackLogRate": round(fallback_logs_by_category[category] / request_count, 4),
            }
        )

    prompt_diag = defaultdict(list)
    for item in diagnostics:
        prompt_diag[item["promptId"]].append(item)
    top_fallback = []
    for prompt_id, items in prompt_diag.items():
        fallback_count = sum(1 for item in items if item["hintFallback"] > 0)
        top_fallback.append(
            {
                "promptId": prompt_id,
                "category": prompt_to_category.get(prompt_id, "UNKNOWN"),
                "loggedCount": len(items),
                "hintFallbackCount": fallback_count,
                "avgRejectedNovelty": round(sum(item["rejectedNovelty"] for item in items) / len(items), 2),
            }
        )
    top_fallback.sort(key=lambda item: (-item["hintFallbackCount"], -item["avgRejectedNovelty"], item["promptId"]))

    return {
        "requestCount": len(samples),
        "successCount": len(successes),
        "failureCount": len(failures),
        "avgScore": round(sum(item["score"] for item in successes) / len(successes), 2) if successes else None,
        "expressionTotals": {
            "count": total_expressions,
            "containsHangul": expression_counts["containsHangul"],
            "genericMarker": expression_counts["genericMarker"],
            "fragmentLike": expression_counts["fragmentLike"],
            "ellipsisOrStarter": expression_counts["ellipsisOrStarter"],
            "commaHeavy": expression_counts["commaHeavy"],
        },
        "diagnosticSummary": {
            "loggedIssueCount": len(diagnostics),
            "loggedIssueRate": round(len(diagnostics) / len(successes), 4) if successes else 0.0,
            "withHintFallback": sum(1 for item in diagnostics if item["hintFallback"] > 0),
            "withZeroRawAccepted": sum(1 for item in diagnostics if item["rawAccepted"] == 0),
            "avgRawAcceptedWhenLogged": round(sum(item["rawAccepted"] for item in diagnostics) / len(diagnostics), 2) if diagnostics else 0.0,
            "avgHintFallbackWhenLogged": round(sum(item["hintFallback"] for item in diagnostics) / len(diagnostics), 2) if diagnostics else 0.0,
            "avgRejectedNoveltyWhenLogged": round(sum(item["rejectedNovelty"] for item in diagnostics) / len(diagnostics), 2) if diagnostics else 0.0,
        },
        "categorySummary": category_summary,
        "topPromptFallback": top_fallback[:15],
        "failures": failures[:20],
    }


def print_summary(analysis):
    print("\nBenchmark summary")
    print(f"- Requests: {analysis['requestCount']} (success {analysis['successCount']}, failure {analysis['failureCount']})")
    print(f"- Average score: {analysis['avgScore']}")
    totals = analysis["expressionTotals"]
    print("- Final expression quality flags:")
    print(f"  Hangul in expression: {totals['containsHangul']} / {totals['count']}")
    print(f"  Generic discourse markers: {totals['genericMarker']} / {totals['count']}")
    print(f"  Fragment-like: {totals['fragmentLike']} / {totals['count']}")
    print(f"  Ellipsis/starter-like: {totals['ellipsisOrStarter']} / {totals['count']}")
    print(f"  Comma-heavy list-like: {totals['commaHeavy']} / {totals['count']}")
    diag = analysis["diagnosticSummary"]
    print("- Diagnostics:")
    print(f"  Logged issue rate: {diag['loggedIssueCount']} / {analysis['successCount']} ({diag['loggedIssueRate']})")
    print(f"  Hint fallback in logged cases: {diag['withHintFallback']}")
    print(f"  Zero raw accepted in logged cases: {diag['withZeroRawAccepted']}")
    print(f"  Avg raw accepted when logged: {diag['avgRawAcceptedWhenLogged']}")
    print(f"  Avg hint fallback when logged: {diag['avgHintFallbackWhenLogged']}")
    print(f"  Avg rejected novelty when logged: {diag['avgRejectedNoveltyWhenLogged']}")
    print("- Category summary:")
    for item in analysis["categorySummary"]:
        print("  {category}: requests={requestCount}, avgScore={avgScore}, problemLogRate={problemLogRate}, hintFallbackLogRate={hintFallbackLogRate}".format(**item))
    if analysis["topPromptFallback"]:
        print("- Top prompts with fallback pressure:")
        for item in analysis["topPromptFallback"][:10]:
            print("  {promptId} ({category}): logged={loggedCount}, hintFallback={hintFallbackCount}, avgRejectedNovelty={avgRejectedNovelty}".format(**item))


def main():
    parser = argparse.ArgumentParser(description="Run a large feedback refinement benchmark.")
    parser.add_argument("--api-base", default="http://localhost")
    parser.add_argument("--container", default="writeLoop-backend")
    parser.add_argument("--total", type=int, default=1000)
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--output", default="")
    args = parser.parse_args()

    prompts = fetch_json(args.api_base.rstrip("/") + "/api/prompts")
    samples = build_samples(prompts, args.total, args.seed)
    started_at = dt.datetime.now(dt.timezone.utc).replace(microsecond=0)
    since_iso = started_at.isoformat().replace("+00:00", "Z")
    run_id = started_at.strftime("%Y%m%d%H%M%S")

    print(f"Running {len(samples)} requests with {args.workers} workers...")
    responses = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = {
            executor.submit(post_feedback, args.api_base, sample, index, run_id): (index, sample)
            for index, sample in enumerate(samples, start=1)
        }
        completed = 0
        for future in concurrent.futures.as_completed(futures):
            responses.append(future.result())
            completed += 1
            if completed % 50 == 0 or completed == len(samples):
                print(f"  Completed {completed}/{len(samples)}")

    time.sleep(3)
    diagnostics = parse_diagnostics(docker_logs_since(args.container, since_iso))
    report = {
        "startedAt": since_iso,
        "analysis": analyze(samples, responses, diagnostics),
        "responses": responses,
        "diagnostics": diagnostics,
    }
    output_path = (
        Path(os.path.expandvars(args.output)).expanduser()
        if args.output
        else Path.cwd() / "feedback_refinement_benchmark_report.json"
    )
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print_summary(report["analysis"])
    print(f"\nSaved report: {output_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
