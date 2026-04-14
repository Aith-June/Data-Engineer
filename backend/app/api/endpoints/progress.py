from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.models import Submission

router = APIRouter(prefix="/progress")


@router.get("/summary")
def summary(db: Session = Depends(get_db)):
    accepted = (
        db.query(Submission)
        .filter(Submission.status == "Accepted", Submission.is_run.is_(False))
        .all()
    )
    solved_problem_ids = list({item.problem_id for item in accepted})
    return {
        "solved_count": len(solved_problem_ids),
        "submissions_count": db.query(Submission).count(),
        "streak": min(7, len(solved_problem_ids)),
    }
