import pandas as pd
import re

def compute_class_distribution(df: pd.DataFrame, target_column: str) -> dict:
    distribution = df[target_column].value_counts(normalize=True).to_dict()
    return {str(k): float(v) for k, v in distribution.items()}


def compute_imbalance_ratio(df: pd.DataFrame, target_column: str) -> float | None:
    counts = df[target_column].value_counts()

    if len(counts) < 2:
        return None

    minority = counts.min()
    majority = counts.max()

    if minority == 0:
        return None

    return float(majority / minority)

def normalize_column_name(col: str) -> str:
    # Split camelCase before lowering
    col = re.sub(r"([a-z])([A-Z])", r"\1 \2", str(col))

    # Normalize common separators
    col = col.lower().replace("_", " ").replace("-", " ")

    return col

def is_identifier_column(col: str) -> bool:
    normalized = normalize_column_name(col)

    identifier_keywords = [
        "id",
        "uuid",
        "identifier",
    ]

    return any(keyword in normalized.split() for keyword in identifier_keywords)

def is_timestamp_column(col: str, series: pd.Series) -> bool:
    normalized = normalize_column_name(col)

    timestamp_keywords = [
        "time",
        "timestamp",
        "date",
        "datetime",
    ]

    if any(keyword in normalized.split() for keyword in timestamp_keywords):
        return True

    # Try to detect datetime-like values from a small sample
    sample = series.dropna().astype(str).head(20)

    if sample.empty:
        return False

    parsed = pd.to_datetime(sample, errors="coerce")
    parse_ratio = parsed.notna().mean()

    return parse_ratio >= 0.8

def compute_categorical_distribution(series: pd.Series) -> dict:
    """
    Return relative category frequencies.
    If there are more than 10 categories, include the 5 most frequent
    and 5 least frequent categories to show both dominant and rare values.
    """
    counts = series.dropna().astype(str).value_counts(normalize=True)

    if counts.empty:
        return {
            "type": "categorical",
            "values": {},
        }

    if len(counts) > 10:
        selected = pd.concat([counts.head(5), counts.tail(5)])
    else:
        selected = counts

    return {
        "type": "categorical",
        "values": {str(k): float(v) for k, v in selected.items()},
    }

def compute_numeric_distribution(series: pd.Series, max_points: int = 50) -> dict:
    """
    Return numeric summary statistics and ordered distribution points.
    The distribution points can be visualized as a line chart in the frontend.
    For large datasets, the sorted values are sampled to keep the response compact.
    """
    clean_series = pd.to_numeric(series, errors="coerce").dropna().sort_values()

    if clean_series.empty:
        return {
            "type": "numeric",
            "min": None,
            "max": None,
            "mean": None,
            "distribution": [],
        }

    if len(clean_series) > max_points:
        sampled_series = clean_series.iloc[
            [round(i * (len(clean_series) - 1) / (max_points - 1)) for i in range(max_points)]
        ]
    else:
        sampled_series = clean_series

    distribution = [
        {
            "index": int(i),
            "value": float(v),
        }
        for i, v in enumerate(sampled_series)
    ]

    return {
        "type": "numeric",
        "min": float(clean_series.min()),
        "max": float(clean_series.max()),
        "mean": float(clean_series.mean()),
        "distribution": distribution,
    }

def compute_feature_distribution_summary(
    df: pd.DataFrame,
    target_column: str | None,
    max_features: int = 15,
) -> dict:
    summary = {}

    candidate_columns = [
        col for col in df.columns
        if col != target_column
        and not is_identifier_column(col)
        and not is_timestamp_column(col, df[col])
    ]

    # Prefer non-numeric columns because categorical distributions are often
    # easier to interpret for dataset profiling. Numeric columns are still
    # included if there is remaining capacity.
    non_numeric_columns = [
        col for col in candidate_columns
        if not pd.api.types.is_numeric_dtype(df[col])
    ]

    numeric_columns = [
        col for col in candidate_columns
        if pd.api.types.is_numeric_dtype(df[col])
    ]

    selected_columns = (non_numeric_columns + numeric_columns)[:max_features]

    for col in selected_columns:
        series = df[col]

        if pd.api.types.is_numeric_dtype(series):
            summary[col] = compute_numeric_distribution(series)
        else:
            summary[col] = compute_categorical_distribution(series)

    return summary

def generate_bias_warnings(
    task_type: str,
    imbalance_ratio: float | None,
) -> list[str]:
    warnings = []

    if task_type == "classification" and imbalance_ratio is not None and imbalance_ratio > 2.0:
        warnings.append("Class imbalance detected (imbalance ratio > 2.0)")

    return warnings