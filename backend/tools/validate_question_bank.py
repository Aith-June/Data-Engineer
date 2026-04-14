import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.seed.question_validation import validate_question_payload


QUESTION_BANK_DIR = Path(__file__).resolve().parents[1] / "question-bank"


def validate_question_file(path: Path) -> list[str]:
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        return [f"{path}: invalid JSON ({exc})"]
    return validate_question_payload(raw, path)


def main() -> int:
    question_files = sorted(QUESTION_BANK_DIR.glob("*/*.json"))
    question_files = [p for p in question_files if "_templates" not in str(p)]
    if not question_files:
        print("No question files found.")
        return 1

    all_errors: list[str] = []
    slugs: set[str] = set()

    for path in question_files:
        errors = validate_question_file(path)
        all_errors.extend(errors)
        if not errors:
            payload = json.loads(path.read_text(encoding="utf-8"))
            slug = payload["slug"]
            if slug in slugs:
                all_errors.append(f"{path}: duplicate slug '{slug}'")
            slugs.add(slug)

    if all_errors:
        print("Question bank validation failed:")
        for err in all_errors:
            print(f"- {err}")
        return 1

    print(f"Question bank valid. Files checked: {len(question_files)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
