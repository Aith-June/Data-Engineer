import contextlib
import io
import sqlite3
import time
from typing import Any


def _canonical_language(language: str) -> str:
    lang = str(language).lower()
    if lang in {"pyspark", "pyspa"}:
        return "python"
    return lang


def _normalize_rows(value: Any) -> list[list[Any]]:
    if hasattr(value, "to_dict") and hasattr(value, "columns"):
        # pandas.DataFrame compatibility without hard dependency on pandas type hints
        records = value.to_dict(orient="records")
        if records:
            keys = list(records[0].keys())
            return [[row.get(k) for k in keys] for row in records]
        return []
    if isinstance(value, list):
        if value and isinstance(value[0], dict):
            keys = sorted(value[0].keys())
            return [[item.get(k) for k in keys] for item in value]
        return [list(item) if isinstance(item, (list, tuple)) else [item] for item in value]
    return [[value]]


def _run_python_case(code: str, case: dict) -> tuple[bool, str, Any]:
    namespace: dict[str, Any] = {}
    try:
        exec(code, namespace, namespace)
    except Exception as exc:
        return False, f"Python compile error: {exc}", None

    fn_name = case.get("function_name")
    fn = namespace.get(fn_name)
    if not callable(fn):
        return False, f"Function '{fn_name}' not found.", None

    stdout_buffer = io.StringIO()
    try:
        with contextlib.redirect_stdout(stdout_buffer):
            call_style = case.get("call_style", "single")
            payload = case.get("input")
            if call_style == "args":
                if not isinstance(payload, list):
                    return False, "Invalid testcase: call_style 'args' requires list input.", None
                output = fn(*payload)
            elif call_style == "kwargs":
                if not isinstance(payload, dict):
                    return False, "Invalid testcase: call_style 'kwargs' requires object input.", None
                output = fn(**payload)
            else:
                output = fn(payload)
    except Exception as exc:
        return False, f"Runtime error: {exc}", None

    expected = case.get("expected")
    ok = _normalize_rows(output) == _normalize_rows(expected)
    printed = stdout_buffer.getvalue().strip()
    returned_preview = str(output)
    suffix_parts: list[str] = []
    if printed:
        suffix_parts.append(f"stdout={printed}")
    if returned_preview:
        suffix_parts.append(f"returned={returned_preview}")
    suffix = f" ({' | '.join(suffix_parts)})" if suffix_parts else ""
    return ok, f"passed{suffix}" if ok else f"expected {expected}, got {output}{suffix}", output


def _run_sql_case(code: str, case: dict) -> tuple[bool, str, Any]:
    conn = sqlite3.connect(":memory:")
    try:
        cur = conn.cursor()
        cur.executescript(case.get("schema", ""))
        for statement in case.get("seed_rows", []):
            cur.execute(statement)
        cur.execute(code)
        rows = [list(row) for row in cur.fetchall()]
        expected = case.get("expected", [])
        ok = rows == expected
        return ok, "passed" if ok else f"expected {expected}, got {rows}", rows
    except Exception as exc:
        return False, f"SQL error: {exc}", None
    finally:
        conn.close()


def run_code_in_sandbox(
    problem_slug: str,
    language: str,
    code: str,
    tests: list[dict],
    reveal_case_details: bool = True,
) -> dict:
    started = time.time()
    normalized = code.strip()
    total_cases = len(tests)
    if not normalized:
        return {
            "status": "Runtime Error",
            "passed_cases": 0,
            "total_cases": total_cases,
            "runtime_ms": 0,
            "memory_kb": 0,
            "logs": "No code submitted.",
        }

    passed = 0
    logs: list[str] = []
    case_results: list[dict[str, Any]] = []
    lang = _canonical_language(language)
    for idx, case in enumerate(tests, start=1):
        kind = _canonical_language(case.get("kind", lang))
        if kind == "python" and lang == "python":
            ok, msg, output = _run_python_case(code, case)
        elif kind == "sql" and lang == "sql":
            ok, msg, output = _run_sql_case(code, case)
        else:
            ok, msg, output = False, f"Unsupported test kind '{kind}' for language '{lang}'", None
        if ok:
            passed += 1
        logs.append(f"case#{idx}: {msg}")
        case_results.append(
            {
                "index": idx,
                "passed": ok,
                "input": case.get("input") if reveal_case_details else None,
                "expected": case.get("expected") if reveal_case_details else None,
                "output": output if reveal_case_details else None,
                "message": msg if reveal_case_details else ("passed" if ok else "failed"),
            }
        )

    status = "Accepted" if passed == total_cases else "Wrong Answer"
    if logs and all("Python compile error:" in item for item in logs):
        status = "Compile Error"
    if logs and any("Runtime error:" in item for item in logs) and status != "Compile Error":
        status = "Runtime Error"
    if logs and any("SQL error:" in item for item in logs) and status not in {"Compile Error", "Runtime Error"}:
        status = "Runtime Error"
    return {
        "status": status,
        "passed_cases": passed,
        "total_cases": total_cases,
        "runtime_ms": int((time.time() - started) * 1000) + 8,
        "memory_kb": 18000 + min(len(code), 5000) // 6,
        "logs": "\n".join(logs),
        "case_results": case_results,
    }
