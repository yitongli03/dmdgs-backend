import pandas as pd

def check_suitability(
    df: pd.DataFrame,
    task_type: str,
    target_column: str | None,
    intended_use: str,
    deployment_context: str,
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
            return warnings

        if target_column not in df.columns:
            warnings.append(f"Target column '{target_column}' not found in dataset")
            return warnings

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

    return warnings