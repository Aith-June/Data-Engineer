import json
import re
from copy import deepcopy
from pathlib import Path

from app.services.seed.question_validation import validate_question_payload


QUESTION_BANK_DIR = Path(__file__).resolve().parents[3] / "question-bank"
TARGET_CASES_PER_BUCKET = 10


def _expand_tests_to_target(tests: list[dict], target: int, label: str) -> list[dict]:
    if not tests:
        return tests
    expanded = [deepcopy(item) for item in tests]
    idx = 0
    while len(expanded) < target:
        clone = deepcopy(tests[idx % len(tests)])
        clone["_auto_case_id"] = f"{label}_{len(expanded) + 1}"
        expanded.append(clone)
        idx += 1
    return expanded[:target]


def _normalize_question_tests(question: dict) -> dict:
    q = deepcopy(question)
    q["sample_tests"] = _expand_tests_to_target(q.get("sample_tests", []), TARGET_CASES_PER_BUCKET, "sample")
    q["hidden_tests"] = _expand_tests_to_target(q.get("hidden_tests", []), TARGET_CASES_PER_BUCKET, "hidden")
    return q


def _with_numbered_title(question: dict, number: int) -> dict:
    q = deepcopy(question)
    title = str(q.get("title", "")).strip()
    base_title = re.sub(r"^Q\d+\.\s*", "", title)
    q["title"] = f"Q{number}. {base_title}"
    return q


def _load_question_files() -> list[dict]:
    questions: list[dict] = []
    errors: list[str] = []
    if not QUESTION_BANK_DIR.exists():
        return questions

    question_files = [
        item
        for item in sorted(QUESTION_BANK_DIR.glob("*/*.json"))
        if not item.parent.name.startswith("_") and not item.name.startswith("question-template")
    ]
    for idx, file_path in enumerate(question_files, start=1):
        if file_path.parent.name.startswith("_") or file_path.name.startswith("question-template"):
            continue
        with file_path.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)
            errors.extend(validate_question_payload(payload, file_path))
            payload = _with_numbered_title(payload, idx)
            questions.append(_normalize_question_tests(payload))
    if errors:
        raise ValueError("Question bank validation failed:\n- " + "\n- ".join(errors))
    return questions


PROBLEMS = _load_question_files()
