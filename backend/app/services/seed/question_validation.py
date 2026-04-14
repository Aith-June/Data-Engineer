import ast
from pathlib import Path


QUESTION_BANK_DIR = Path(__file__).resolve().parents[3] / "question-bank"
REQUIRED_TOP_LEVEL = {
    "slug",
    "title",
    "difficulty",
    "tags",
    "statement",
    "starter_code",
    "sample_tests",
    "hidden_tests",
}
ALLOWED_CALL_STYLES = {"single", "args", "kwargs"}
PYTHON_LIKE_KINDS = {"python", "pyspark"}


def _python_required_positional_args(starter_code: str, fn_name: str) -> int | None:
    try:
        tree = ast.parse(starter_code)
    except SyntaxError:
        return None
    for node in tree.body:
        if isinstance(node, ast.FunctionDef) and node.name == fn_name:
            total_positional = len(node.args.args)
            defaults_count = len(node.args.defaults)
            required = total_positional - defaults_count
            return max(required, 0)
    return None


def validate_question_payload(raw: dict, path: Path) -> list[str]:
    errors: list[str] = []
    missing = REQUIRED_TOP_LEVEL - set(raw.keys())
    if missing:
        errors.append(f"{path}: missing fields {sorted(missing)}")
        return errors

    if not isinstance(raw["tags"], list) or not raw["tags"]:
        errors.append(f"{path}: 'tags' must be a non-empty list")

    if not isinstance(raw["starter_code"], dict) or not raw["starter_code"]:
        errors.append(f"{path}: 'starter_code' must be a non-empty object")

    for test_group_name in ("sample_tests", "hidden_tests"):
        tests = raw[test_group_name]
        if not isinstance(tests, list) or not tests:
            errors.append(f"{path}: '{test_group_name}' must be a non-empty list")
            continue

        for idx, test_case in enumerate(tests, start=1):
            if not isinstance(test_case, dict):
                errors.append(f"{path}: {test_group_name}[{idx}] must be an object")
                continue
            kind = str(test_case.get("kind", "")).lower()
            if not kind:
                errors.append(f"{path}: {test_group_name}[{idx}] missing 'kind'")
                continue
            if kind not in raw["starter_code"]:
                errors.append(
                    f"{path}: {test_group_name}[{idx}] kind='{kind}' not found in starter_code languages {list(raw['starter_code'].keys())}"
                )
            if kind in PYTHON_LIKE_KINDS:
                fn_name = test_case.get("function_name")
                if not fn_name:
                    errors.append(f"{path}: {test_group_name}[{idx}] {kind} test missing 'function_name'")
                call_style = str(test_case.get("call_style", "single")).lower()
                if call_style not in ALLOWED_CALL_STYLES:
                    errors.append(
                        f"{path}: {test_group_name}[{idx}] invalid call_style '{call_style}', allowed={sorted(ALLOWED_CALL_STYLES)}"
                    )
                input_payload = test_case.get("input")
                if call_style == "args" and not isinstance(input_payload, list):
                    errors.append(f"{path}: {test_group_name}[{idx}] call_style='args' requires list input")
                if call_style == "kwargs" and not isinstance(input_payload, dict):
                    errors.append(f"{path}: {test_group_name}[{idx}] call_style='kwargs' requires object input")

                python_like_source = raw["starter_code"].get(kind) or raw["starter_code"].get("python")
                if fn_name and python_like_source:
                    required_args = _python_required_positional_args(python_like_source, fn_name)
                    if required_args is not None and call_style == "single" and required_args > 1:
                        errors.append(
                            f"{path}: {test_group_name}[{idx}] function '{fn_name}' needs {required_args} args; use call_style='args' or 'kwargs'"
                        )
            if kind == "sql":
                if not test_case.get("schema"):
                    errors.append(f"{path}: {test_group_name}[{idx}] sql test missing 'schema'")
                if not test_case.get("seed_rows"):
                    errors.append(f"{path}: {test_group_name}[{idx}] sql test missing 'seed_rows'")

            if isinstance(test_case.get("input"), dict) and "csv_path" in test_case["input"]:
                csv_path = Path(str(test_case["input"]["csv_path"]))
                candidate = QUESTION_BANK_DIR.parent / csv_path
                if not candidate.exists():
                    errors.append(f"{path}: {test_group_name}[{idx}] csv_path not found -> {csv_path}")

            if "expected" not in test_case:
                errors.append(f"{path}: {test_group_name}[{idx}] missing 'expected'")

    return errors
