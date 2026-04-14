from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.models import Problem, Submission
from app.schemas.schemas import RunSubmitRequest, SubmissionOut
from app.services.judge.runner import run_code_in_sandbox

router = APIRouter(prefix="/submissions")

DEFAULT_USER_ID = 1


def _canonical_language(language: str) -> str:
    lang = language.lower()
    if lang in {"pyspark", "pyspa"}:
        return "python"
    return lang


def _create_submission(db: Session, payload: RunSubmitRequest, is_run: bool) -> Submission:
    problem = db.query(Problem).filter(Problem.slug == payload.problem_slug).first()
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")
    tests = problem.sample_tests if is_run else problem.hidden_tests
    requested_language = _canonical_language(payload.language)
    compatible_tests = [
        item
        for item in tests
        if _canonical_language(str(item.get("kind", requested_language))) == requested_language
    ]
    if not compatible_tests:
        supported = sorted(
            {
                str(item.get("kind", "")).lower()
                for item in (problem.sample_tests or []) + (problem.hidden_tests or [])
                if item.get("kind")
            }
        )
        raise HTTPException(
            status_code=400,
            detail=f"Language '{payload.language}' is not supported for this problem. Supported: {', '.join(supported)}",
        )
    result = run_code_in_sandbox(
        problem.slug,
        payload.language,
        payload.code,
        compatible_tests,
        reveal_case_details=is_run,
    )
    submission = Submission(
        user_id=DEFAULT_USER_ID,
        problem_id=problem.id,
        language=payload.language,
        code=payload.code,
        status=result["status"],
        passed_cases=result["passed_cases"],
        total_cases=result["total_cases"],
        runtime_ms=result["runtime_ms"],
        memory_kb=result["memory_kb"],
        logs=result["logs"],
        is_run=is_run,
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)
    submission.case_results = result.get("case_results", [])
    return submission


def _first_compatible_test(problem: Problem, language: str) -> dict:
    requested_language = _canonical_language(language)
    for case in (problem.sample_tests or []):
        if _canonical_language(str(case.get("kind", requested_language))) == requested_language:
            return case
    raise HTTPException(
        status_code=400,
        detail=f"Language '{language}' is not supported for this problem custom run.",
    )


@router.post("/run", response_model=SubmissionOut)
def run_code(payload: RunSubmitRequest, db: Session = Depends(get_db)):
    return _create_submission(db, payload, is_run=True)


@router.post("/submit", response_model=SubmissionOut)
def submit_code(payload: RunSubmitRequest, db: Session = Depends(get_db)):
    return _create_submission(db, payload, is_run=False)


@router.post("/run-custom", response_model=SubmissionOut)
def run_custom_code(payload: RunSubmitRequest, db: Session = Depends(get_db)):
    problem = db.query(Problem).filter(Problem.slug == payload.problem_slug).first()
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")
    template_case = _first_compatible_test(problem, payload.language)
    custom_case = dict(template_case)
    custom_case["input"] = payload.custom_input
    result = run_code_in_sandbox(
        problem.slug,
        payload.language,
        payload.code,
        [custom_case],
        reveal_case_details=True,
    )
    submission = Submission(
        user_id=DEFAULT_USER_ID,
        problem_id=problem.id,
        language=payload.language,
        code=payload.code,
        status=result["status"],
        passed_cases=result["passed_cases"],
        total_cases=result["total_cases"],
        runtime_ms=result["runtime_ms"],
        memory_kb=result["memory_kb"],
        logs=result["logs"],
        is_run=True,
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)
    submission.case_results = result.get("case_results", [])
    return submission


@router.get("/history", response_model=list[SubmissionOut])
def history(problem_slug: str, db: Session = Depends(get_db)):
    problem = db.query(Problem).filter(Problem.slug == problem_slug).first()
    if not problem:
        return []
    return (
        db.query(Submission)
        .filter(Submission.problem_id == problem.id)
        .order_by(Submission.created_at.desc())
        .all()
    )
