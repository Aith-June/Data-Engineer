from datetime import datetime

from pydantic import BaseModel, EmailStr


class UserSignup(BaseModel):
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ProblemOut(BaseModel):
    id: int
    slug: str
    title: str
    difficulty: str
    tags: list[str]

    class Config:
        from_attributes = True


class ProblemDetail(ProblemOut):
    statement: str
    starter_code: dict[str, str]
    sample_tests: list[dict]


class RunSubmitRequest(BaseModel):
    problem_slug: str
    language: str
    code: str
    custom_input: dict | list | int | float | str | bool | None = None


class SubmissionOut(BaseModel):
    id: int
    status: str
    passed_cases: int
    total_cases: int
    runtime_ms: int
    memory_kb: int
    logs: str
    is_run: bool
    created_at: datetime
    case_results: list[dict] = []

    class Config:
        from_attributes = True
