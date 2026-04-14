from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import re

from app.db.database import get_db
from app.models.models import Problem
from app.schemas.schemas import ProblemDetail, ProblemOut
from app.services.seed.problems import PROBLEMS

router = APIRouter(prefix="/problems")


def _seed_if_empty(db: Session) -> None:
    existing = db.query(Problem).all()
    if existing:
        malformed = False
        expected_slugs = {item["slug"] for item in PROBLEMS}
        existing_slugs = {item.slug for item in existing}
        has_all_expected = expected_slugs.issubset(existing_slugs)
        has_only_expected = expected_slugs == existing_slugs
        for item in existing:
            sample = item.sample_tests or []
            has_detailed_statement = "Input format:" in (item.statement or "")
            has_many_cases = len(sample) >= 10
            has_numbered_title = bool(re.match(r"^Q\d+\.\s+", item.title or ""))
            if (
                not sample
                or "kind" not in sample[0]
                or not has_detailed_statement
                or not has_many_cases
                or not has_numbered_title
            ):
                malformed = True
                break
        if not malformed and has_all_expected and has_only_expected:
            return
        db.query(Problem).delete()
        db.commit()

    for item in PROBLEMS:
        db.add(Problem(**item))
    db.commit()


@router.get("", response_model=list[ProblemOut])
def list_problems(db: Session = Depends(get_db)):
    _seed_if_empty(db)
    return db.query(Problem).all()


@router.get("/{slug}", response_model=ProblemDetail)
def get_problem(slug: str, db: Session = Depends(get_db)):
    _seed_if_empty(db)
    problem = db.query(Problem).filter(Problem.slug == slug).first()
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")
    return problem
