import re
from typing import Optional

import pandas as pd


EVENT_LOG_COLUMN_PATTERNS = {
    "case_id": {"case id", "case", "ticket id", "process id"},
    "activity": {"activity", "event", "action", "task"},
    "timestamp": {"timestamp", "time", "complete timestamp", "date"},
    # resource is detected so bias_service can exclude it from generic feature distributions,
    # but no dedicated governance signal is computed from it at this time.
    "resource": {"resource", "user", "employee", "agent"},
}

EVENT_LOG_CONTEXT_PHRASES = {
    "event log",
    "process mining",
    "process oriented",
    "process prediction",
    "workflow",
    "activity",
    "trace",
    "case id",
    "next activity",
    "remaining time",
}


def normalize_event_log_text(value: object) -> str:
    text = re.sub(r"([a-z])([A-Z])", r"\1 \2", str(value))
    text = re.sub(r"[^a-zA-Z0-9]+", " ", text.lower())
    return re.sub(r"\s+", " ", text).strip()


def detect_event_log_columns(df: pd.DataFrame) -> dict[str, Optional[str]]:
    detected_columns: dict[str, Optional[str]] = {
        "case_id": None,
        "activity": None,
        "timestamp": None,
        "resource": None,
    }

    for col in df.columns:
        normalized = normalize_event_log_text(col)

        for role, patterns in EVENT_LOG_COLUMN_PATTERNS.items():
            if detected_columns[role] is None and normalized in patterns:
                detected_columns[role] = str(col)

    return detected_columns


def suggests_event_log_context(*values: object) -> bool:
    context = " ".join(normalize_event_log_text(value) for value in values if value)
    return any(phrase in context for phrase in EVENT_LOG_CONTEXT_PHRASES)


def suggests_remaining_time_task(task_type: str, *values: object) -> bool:
    context = " ".join(normalize_event_log_text(value) for value in values if value)
    return task_type == "regression" and (
        "remaining time" in context
        or "duration" in context
        or "process mining" in context
        or "process oriented" in context
        or "process prediction" in context
        or "event log" in context
    )


def suggests_next_activity_task(task_type: str, *values: object) -> bool:
    context = " ".join(normalize_event_log_text(value) for value in values if value)
    return task_type == "classification" and (
        "next activity" in context
        or "activity" in context
        or "process mining" in context
        or "process oriented" in context
        or "process prediction" in context
        or "event log" in context
    )
