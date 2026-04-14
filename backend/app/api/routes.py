from fastapi import APIRouter

from app.api.endpoints import auth, problems, progress, submissions

router = APIRouter()
router.include_router(auth.router, tags=["auth"])
router.include_router(problems.router, tags=["problems"])
router.include_router(submissions.router, tags=["submissions"])
router.include_router(progress.router, tags=["progress"])
