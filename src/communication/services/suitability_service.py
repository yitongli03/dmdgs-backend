import pandas as pd

from communication.services.event_log_service import (
    detect_event_log_columns,
    suggests_event_log_context,
    suggests_next_activity_task,
    suggests_remaining_time_task,
)

def check_suitability(
    df: pd.DataFrame,
    task_type: str,
    target_column: str | None,
    intended_use: str,
    deployment_context: str,
    domain: str = "",
    preprocessing_steps: str = "",
) -> list[str]:
    warnings = []

    task_type = task_type.lower().strip() if task_type else ""
    target_column = target_column.strip() if target_column else None

    # 1. Context completeness checks
    if not intended_use or intended_use.strip() == "":
        warnings.append("Missing intended use information")

    if not deployment_context or deployment_context.strip() == "":
        warnings.append("Missing deployment context information")

    # 2. Target column checks for supervised tasks
    supervised_tasks = ["classification", "regression"]

    if task_type in supervised_tasks:
        if not target_column:
            warnings.append(f"No target column provided for {task_type} task")

        if target_column and target_column not in df.columns:
            warnings.append(f"Target column '{target_column}' not found in dataset")

    # 3. Task-type consistency checks
    if task_type == "classification" and target_column in df.columns:
        unique_values = df[target_column].nunique(dropna=True)

        if unique_values > 20:
            warnings.append(
                "Target column has many unique values; it may not be suitable for classification"
            )

    if task_type == "regression" and target_column in df.columns:
        if not pd.api.types.is_numeric_dtype(df[target_column]):
            warnings.append(
                "Target column is not numeric; it may not be suitable for regression"
            )

    # 4. Unknown task type
    allowed_task_types = ["classification", "regression", "clustering", "other"]

    if task_type and task_type not in allowed_task_types:
        warnings.append(f"Unknown task type: {task_type}")

    # 5. Event-log-oriented structural checks
    context_values = (intended_use, deployment_context, domain, preprocessing_steps)
    event_log_columns = detect_event_log_columns(df)
    has_event_log_context = suggests_event_log_context(task_type, *context_values)
    structural_roles = ("case_id", "activity", "timestamp")
    has_event_log_shape = sum(
        1 for role in structural_roles if event_log_columns[role] is not None
    ) >= 2
    specifically_warned_roles = set()

    if suggests_remaining_time_task(task_type, *context_values):
        for role, label in {"case_id": "case ID", "timestamp": "timestamp"}.items():
            if event_log_columns[role] is None:
                warnings.append(
                    f"Remaining-time-oriented regression requires a likely {label} column"
                )
                specifically_warned_roles.add(role)

    if suggests_next_activity_task(task_type, *context_values):
        for role, label in {"case_id": "case ID", "activity": "activity"}.items():
            if event_log_columns[role] is None:
                warnings.append(
                    f"Next-activity-oriented classification requires a likely {label} column"
                )
                specifically_warned_roles.add(role)

    if has_event_log_context or has_event_log_shape:
        required_columns = {
            "case_id": "case ID",
            "activity": "activity",
            "timestamp": "timestamp",
        }

        for role, label in required_columns.items():
            if event_log_columns[role] is None and role not in specifically_warned_roles:
                warnings.append(
                    f"Event-log-oriented analysis suggested, but no likely {label} column was detected"
                )

    return warnings
