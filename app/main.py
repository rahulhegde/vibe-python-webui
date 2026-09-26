from __future__ import annotations

import random
from datetime import date
from pathlib import Path
from typing import Literal

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, model_validator


STATIC_DIR = Path(__file__).resolve().parent / "static"

app = FastAPI(
    title="Vibe Python WebUI",
    description="Mock web UI data for reusable gauges and student study hours.",
    version="0.1.0",
)


@app.middleware("http")
async def prevent_stale_frontend(request, call_next):
    response = await call_next(request)
    if request.url.path == "/" or request.url.path in {"/static/app.js", "/static/styles.css"}:
        response.headers["Cache-Control"] = "no-store"
    return response


app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


class GaugeBand(BaseModel):
    start: float
    end: float
    tone: Literal["good", "warning", "danger"]


class GaugeScale(BaseModel):
    min: float
    max: float


class GaugeMetric(BaseModel):
    key: str
    label: str
    value: int | float
    unit: str


class GaugeResponse(BaseModel):
    # Shared data contract: the browser maps these semantic fields to ECharts options.
    kind: Literal["gauge"] = "gauge"
    metric: GaugeMetric
    scale: GaugeScale
    bands: list[GaugeBand]

    @model_validator(mode="after")
    def validate_gauge_ranges(self) -> "GaugeResponse":
        if self.scale.max <= self.scale.min:
            raise ValueError("gauge scale max must be greater than min")
        if not self.scale.min <= self.metric.value <= self.scale.max:
            raise ValueError("gauge value must be within its scale")

        next_start = self.scale.min
        for band in self.bands:
            if band.start != next_start or band.end <= band.start:
                raise ValueError("gauge bands must be ordered, contiguous, and non-empty")
            next_start = band.end
        if next_start != self.scale.max:
            raise ValueError("gauge bands must cover the full scale")
        return self


class StudyHoursRequest(BaseModel):
    date: date


class StudentStudyHours(BaseModel):
    name: str
    hours: float = Field(ge=0, le=10)


class StudyHoursResponse(BaseModel):
    date: date
    students: list[StudentStudyHours]


STUDENT_NAMES = [
    "Aarav Mehta", "Aditi Shah", "Ananya Rao", "Arjun Nair", "Diya Patel",
    "Ishaan Das", "Ira Kapoor", "Kabir Joshi", "Kiara Menon", "Mira Iyer",
    "Neel Gupta", "Pari Khanna", "Rohan Sen", "Saanvi Kulkarni", "Tara Bose",
    "Veer Malhotra", "Zoya Khan", "Advait Pillai", "Myra Reddy", "Reyansh Jain",
    "Anika Sethi", "Devika Roy", "Kian Fernandes", "Nisha Verma", "Om Prakash",
    "Prisha Bhat", "Ritvik Rao", "Samaira Das", "Vivaan Ghosh", "Yashika Arora",
]


@app.get("/", include_in_schema=False)
async def dashboard() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


def make_gauge_response(
    key: str,
    label: str,
    value: int,
    unit: str,
    maximum: int,
    bands: list[GaugeBand],
) -> GaugeResponse:
    return GaugeResponse(
        metric=GaugeMetric(key=key, label=label, value=value, unit=unit),
        scale=GaugeScale(min=0, max=maximum),
        bands=bands,
    )


@app.get("/api/gauges/bike-speed", response_model=GaugeResponse, tags=["Gauges"])
async def get_bike_speed_gauge() -> GaugeResponse:
    """Return a mock bike speed and its gauge scale and zones."""
    return make_gauge_response(
        key="bike.speed",
        label="Bike speed",
        value=random.randint(0, 120),
        unit="km/h",
        maximum=120,
        bands=[
            GaugeBand(start=0, end=60, tone="good"),
            GaugeBand(start=60, end=80, tone="warning"),
            GaugeBand(start=80, end=120, tone="danger"),
        ],
    )


@app.get("/api/gauges/student-score", response_model=GaugeResponse, tags=["Gauges"])
async def get_student_score_gauge() -> GaugeResponse:
    """Return a mock student score and its gauge scale and zones."""
    student_name = random.choice(STUDENT_NAMES)
    return make_gauge_response(
        key="student.score",
        label=f"{student_name}'s score",
        value=random.randint(0, 100),
        unit="points",
        maximum=100,
        bands=[
            GaugeBand(start=0, end=50, tone="danger"),
            GaugeBand(start=50, end=70, tone="warning"),
            GaugeBand(start=70, end=100, tone="good"),
        ],
    )


@app.post(
    "/api/students/study-hours",
    response_model=StudyHoursResponse,
    tags=["Dashboard"],
)
async def get_student_study_hours(
    request: StudyHoursRequest,
) -> StudyHoursResponse:
    """Return mock study hours for 20–30 students on the requested date."""
    student_count = random.randint(20, 30)
    selected_students = random.sample(STUDENT_NAMES, student_count)
    students = [
        StudentStudyHours(name=name, hours=round(random.uniform(0, 10), 1))
        for name in selected_students
    ]
    return StudyHoursResponse(date=request.date, students=students)
