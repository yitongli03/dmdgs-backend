import math
import pandas as pd

from communication.services.event_log_service import (
    detect_event_log_columns,
    normalize_event_log_text,
)

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

def is_identifier_column(col: str) -> bool:
    normalized = normalize_event_log_text(col)
    tokens = set(normalized.split())

    if tokens & {"id", "uuid", "identifier", "key", "reference", "ref"}:
        return True

    numbered_identifier_entities = {
        "case",
        "ticket",
        "row",
        "record",
        "employee",
        "customer",
        "patient",
        "event",
    }
    return bool(tokens & {"no", "num", "nr"}) and bool(tokens & numbered_identifier_entities)

def is_timestamp_column(col: str, series: pd.Series) -> bool:
    normalized = normalize_event_log_text(col)

    timestamp_keywords = [
        "time",
        "timestamp",
        "date",
        "datetime",
    ]

    if any(keyword in normalized.split() for keyword in timestamp_keywords):
        return True

    # Sample evenly across the column so sorted datasets are represented.
    non_null_values = series.dropna().astype(str)

    if non_null_values.empty:
        return False

    sample_size = min(20, len(non_null_values))
    if sample_size == 1:
        sample = non_null_values.iloc[[0]]
    else:
        positions = [
            round(index * (len(non_null_values) - 1) / (sample_size - 1))
            for index in range(sample_size)
        ]
        sample = non_null_values.iloc[positions]

    parsed = pd.to_datetime(sample, errors="coerce", format="mixed", utc=True)
    parse_ratio = parsed.notna().mean()

    return parse_ratio >= 0.8

def is_variant_column(col: str) -> bool:
    normalized = normalize_event_log_text(col)
    tokens = normalized.split()

    return any(token in {"variant", "variants"} for token in tokens)

def get_event_log_feature_exclusions(df: pd.DataFrame) -> set:
    event_log_columns = detect_event_log_columns(df)
    detected_structural_columns = {
        column for column in event_log_columns.values()
        if column is not None
    }

    if not detected_structural_columns:
        return set()

    variant_columns = {
        col for col in df.columns
        if is_variant_column(col)
    }

    return detected_structural_columns | variant_columns

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

    total_categories = len(counts)
    is_truncated = total_categories > 10

    if is_truncated:
        selected = pd.concat([counts.head(5), counts.tail(5)])
    else:
        selected = counts

    return {
        "type": "categorical",
        "values": {str(k): float(v) for k, v in selected.items()},
        "total_categories": int(total_categories),
        "is_truncated": is_truncated,
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

def prepare_event_log_sequence_df(
    df: pd.DataFrame,
    case_id_column: str,
    activity_column: str,
    timestamp_column: str,
) -> tuple[pd.DataFrame, bool]:
    event_log_df = (
        df[[case_id_column, activity_column, timestamp_column]]
        .dropna(subset=[case_id_column, activity_column])
        .copy()
    )

    if event_log_df.empty:
        return event_log_df, False

    event_log_df["_original_order"] = range(len(event_log_df))
    event_log_df["_parsed_timestamp"] = pd.to_datetime(
        event_log_df[timestamp_column],
        errors="coerce",
        format="mixed",
        utc=True,
    )
    timestamp_parse_ratio = event_log_df["_parsed_timestamp"].notna().mean()

    if timestamp_parse_ratio >= 0.8:
        event_log_df = event_log_df.dropna(subset=["_parsed_timestamp"])
        event_log_df = event_log_df.sort_values(
            [case_id_column, "_parsed_timestamp", "_original_order"],
            kind="mergesort",
        )
        return event_log_df, True

    event_log_df = event_log_df.sort_values(
        [case_id_column, "_original_order"],
        kind="mergesort",
    )
    return event_log_df, False

def prepare_event_log_time_df(
    df: pd.DataFrame,
    case_id_column: str,
    timestamp_column: str,
) -> tuple[pd.DataFrame, bool]:
    event_log_df = (
        df[[case_id_column, timestamp_column]]
        .dropna(subset=[case_id_column])
        .copy()
    )

    if event_log_df.empty:
        return event_log_df, False

    event_log_df["_parsed_timestamp"] = pd.to_datetime(
        event_log_df[timestamp_column],
        errors="coerce",
        format="mixed",
        utc=True,
    )
    timestamp_parse_ratio = event_log_df["_parsed_timestamp"].notna().mean()

    if timestamp_parse_ratio < 0.8:
        return event_log_df, False

    return event_log_df.dropna(subset=["_parsed_timestamp"]), True

def format_duration(seconds: float | int | None) -> str:
    if seconds is None or pd.isna(seconds):
        return "Not available"

    seconds = float(seconds)

    if seconds < 60:
        return f"{seconds:.0f} seconds"
    if seconds < 3600:
        return f"{seconds / 60:.1f} minutes"
    if seconds < 86400:
        return f"{seconds / 3600:.1f} hours"

    return f"{seconds / 86400:.1f} days"

def empty_duration_distribution() -> dict:
    return {
        "type": "duration_binned_count_curve",
        "distribution": [],
        "scale": "log_duration",
        "bin_count": 0,
        "min_duration_seconds": None,
        "max_duration_seconds": None,
    }


def compute_duration_distribution_curve(durations: pd.Series, max_bins: int = 20) -> dict:
    clean_durations = durations.dropna()
    clean_durations = clean_durations[clean_durations >= 0]

    if clean_durations.empty:
        return empty_duration_distribution()

    if len(clean_durations) == 1 or float(clean_durations.min()) == float(clean_durations.max()):
        duration = float(clean_durations.iloc[0])
        return {
            "type": "duration_binned_count_curve",
            "distribution": [{
                "index": 0,
                "duration_seconds": duration,
                "range_start_seconds": duration,
                "range_end_seconds": duration,
                "range_label": format_duration(duration),
                "case_count": int(len(clean_durations)),
            }],
            "scale": "log_duration",
            "bin_count": 1,
            "min_duration_seconds": duration,
            "max_duration_seconds": duration,
        }

    minimum = float(clean_durations.min())
    maximum = float(clean_durations.max())
    bin_count = min(max_bins, max(1, math.ceil(math.log2(len(clean_durations)) + 1)))
    log_minimum = math.log1p(minimum)
    log_maximum = math.log1p(maximum)
    log_bin_width = (log_maximum - log_minimum) / bin_count
    counts = [0] * bin_count

    for duration in clean_durations:
        log_duration = math.log1p(float(duration))
        bin_index = min(int((log_duration - log_minimum) / log_bin_width), bin_count - 1)
        counts[bin_index] += 1

    distribution = []
    for index, case_count in enumerate(counts):
        log_range_start = log_minimum + (index * log_bin_width)
        log_range_end = (
            log_maximum
            if index == bin_count - 1
            else log_range_start + log_bin_width
        )
        range_start = math.expm1(log_range_start)
        range_end = math.expm1(log_range_end)
        midpoint = math.expm1((log_range_start + log_range_end) / 2)
        distribution.append({
            "index": index,
            "duration_seconds": midpoint,
            "range_start_seconds": range_start,
            "range_end_seconds": range_end,
            "range_label": f"{format_duration(range_start)} to {format_duration(range_end)}",
            "case_count": case_count,
        })

    return {
        "type": "duration_binned_count_curve",
        "distribution": distribution,
        "scale": "log_duration",
        "bin_count": bin_count,
        "min_duration_seconds": minimum,
        "max_duration_seconds": maximum,
    }

def compute_case_duration_summary(
    df: pd.DataFrame,
    case_id_column: str,
    timestamp_column: str,
) -> dict:
    event_log_df, timestamps_reliable = prepare_event_log_time_df(
        df,
        case_id_column,
        timestamp_column,
    )

    if event_log_df.empty or not timestamps_reliable:
        return {
            "type": "duration",
            "total_cases": 0,
            "min_duration_seconds": None,
            "mean_duration_seconds": None,
            "median_duration_seconds": None,
            "p95_duration_seconds": None,
            "max_duration_seconds": None,
            "min_duration": "Not available",
            "mean_duration": "Not available",
            "median_duration": "Not available",
            "p95_duration": "Not available",
            "max_duration": "Not available",
            "duration_distribution": empty_duration_distribution(),
        }

    case_times = event_log_df.groupby(case_id_column)["_parsed_timestamp"].agg(["min", "max", "count"])
    case_times = case_times[case_times["count"] >= 2].copy()

    if case_times.empty:
        return {
            "type": "duration",
            "total_cases": 0,
            "min_duration_seconds": None,
            "mean_duration_seconds": None,
            "median_duration_seconds": None,
            "p95_duration_seconds": None,
            "max_duration_seconds": None,
            "min_duration": "Not available",
            "mean_duration": "Not available",
            "median_duration": "Not available",
            "p95_duration": "Not available",
            "max_duration": "Not available",
            "duration_distribution": empty_duration_distribution(),
        }

    durations = (case_times["max"] - case_times["min"]).dt.total_seconds()

    min_duration = float(durations.min())
    mean_duration = float(durations.mean())
    median_duration = float(durations.median())
    p95_duration = float(durations.quantile(0.95))
    max_duration = float(durations.max())

    return {
        "type": "duration",
        "total_cases": int(len(durations)),
        "min_duration_seconds": min_duration,
        "mean_duration_seconds": mean_duration,
        "median_duration_seconds": median_duration,
        "p95_duration_seconds": p95_duration,
        "max_duration_seconds": max_duration,
        "min_duration": format_duration(min_duration),
        "mean_duration": format_duration(mean_duration),
        "median_duration": format_duration(median_duration),
        "p95_duration": format_duration(p95_duration),
        "max_duration": format_duration(max_duration),
        "duration_distribution": compute_duration_distribution_curve(durations),
    }

def compute_feature_distribution_summary(
    df: pd.DataFrame,
    target_column: str | None,
    max_features: int = 15,
) -> dict:
    summary = {}
    event_log_exclusions = get_event_log_feature_exclusions(df)

    candidate_columns = [
        col for col in df.columns
        if col != target_column
        and col not in event_log_exclusions
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

def compute_activity_distribution(df: pd.DataFrame, activity_column: str) -> dict:
    return compute_categorical_distribution(df[activity_column])

def compute_top_activity_transitions(
    df: pd.DataFrame,
    case_id_column: str,
    activity_column: str,
    timestamp_column: str,
    max_transitions: int | None = 10,
) -> dict:
    event_log_df, _ = prepare_event_log_sequence_df(
        df,
        case_id_column,
        activity_column,
        timestamp_column,
    )

    if event_log_df.empty:
        return {
            "type": "categorical",
            "values": {},
        }

    event_log_df["next_activity"] = event_log_df.groupby(case_id_column)[activity_column].shift(-1)
    transitions = event_log_df.dropna(subset=["next_activity"]).copy()

    if transitions.empty:
        return {
            "type": "categorical",
            "values": {},
        }

    transitions["transition"] = (
        transitions[activity_column].astype(str)
        + " -> "
        + transitions["next_activity"].astype(str)
    )
    counts = transitions["transition"].value_counts(normalize=True)
    if max_transitions is not None:
        counts = counts.head(max_transitions)

    return {
        "type": "categorical",
        "values": {str(k): float(v) for k, v in counts.items()},
    }

def compute_process_variant_summary(
    df: pd.DataFrame,
    case_id_column: str,
    activity_column: str,
    timestamp_column: str,
    max_variants: int = 5,
) -> dict:
    event_log_df, _ = prepare_event_log_sequence_df(
        df,
        case_id_column,
        activity_column,
        timestamp_column,
    )

    if event_log_df.empty:
        return {
            "type": "categorical",
            "values": {},
            "total_cases": 0,
            "total_variants": 0,
            "rare_variant_count": 0,
        }

    case_variants = event_log_df.groupby(case_id_column)[activity_column].apply(
        lambda activities: " -> ".join(activities.astype(str))
    )

    if case_variants.empty:
        return {
            "type": "categorical",
            "values": {},
            "total_cases": 0,
            "total_variants": 0,
            "rare_variant_count": 0,
        }

    variant_counts = case_variants.value_counts()
    total_cases = int(len(case_variants))
    rare_variant_count = int((variant_counts == 1).sum())
    top_variants = variant_counts.head(max_variants) / total_cases

    return {
        "type": "categorical",
        "values": {str(k): float(v) for k, v in top_variants.items()},
        "total_cases": total_cases,
        "total_variants": int(len(variant_counts)),
        "rare_variant_count": rare_variant_count,
    }

def compute_total_variation_distance(first: dict, second: dict) -> float:
    keys = set(first) | set(second)
    return float(0.5 * sum(abs(first.get(key, 0.0) - second.get(key, 0.0)) for key in keys))


def prepare_variant_distribution_for_shift(
    variant_counts: pd.Series,
    min_frequency: float = 0.01,
) -> tuple[dict, dict]:
    if variant_counts.empty:
        return {}, {}

    normalized = variant_counts / variant_counts.sum()
    rare_mask = (variant_counts == 1) | (normalized < min_frequency)
    grouped = normalized[~rare_mask].to_dict()
    rare_share = float(normalized[rare_mask].sum())

    if rare_share > 0:
        grouped["Other rare variants"] = rare_share

    return normalized.to_dict(), grouped


def compute_distribution_changes(
    early_distribution: dict,
    late_distribution: dict,
    max_changes: int = 5,
    min_absolute_change: float = 0.01,
) -> dict:
    keys = set(early_distribution) | set(late_distribution)
    changes = []

    for key in keys:
        early_value = float(early_distribution.get(key, 0.0))
        late_value = float(late_distribution.get(key, 0.0))
        changes.append({
            "label": str(key),
            "early_frequency": early_value,
            "late_frequency": late_value,
            "absolute_change": abs(late_value - early_value),
            "direction": "increased" if late_value > early_value else "decreased",
        })

    changes.sort(key=lambda item: item["absolute_change"], reverse=True)
    relevant_changes = [
        change for change in changes
        if change["absolute_change"] >= min_absolute_change
    ]

    return {
        "top_changes": relevant_changes[:max_changes],
        "new_late": sorted(
            str(key)
            for key in keys
            if early_distribution.get(key, 0.0) == 0
            and late_distribution.get(key, 0.0) >= min_absolute_change
        ),
        "disappearing_late": sorted(
            str(key)
            for key in keys
            if early_distribution.get(key, 0.0) >= min_absolute_change
            and late_distribution.get(key, 0.0) == 0
        ),
    }

def top_distribution_values(distribution: dict, max_values: int = 5) -> dict:
    return {
        str(key): float(value)
        for key, value in sorted(
            distribution.items(),
            key=lambda item: item[1],
            reverse=True,
        )[:max_values]
    }

def compute_case_variants(
    event_log_df: pd.DataFrame,
    case_id_column: str,
    activity_column: str,
) -> pd.Series:
    return event_log_df.groupby(case_id_column)[activity_column].apply(
        lambda activities: " -> ".join(activities.astype(str))
    )

def compute_event_log_drift_signals(
    df: pd.DataFrame,
    case_id_column: str,
    activity_column: str,
    timestamp_column: str,
    min_cases: int = 10,
    split_timestamp: str | None = None,
) -> dict:
    event_log_df, used_timestamp_order = prepare_event_log_sequence_df(
        df,
        case_id_column,
        activity_column,
        timestamp_column,
    )

    if event_log_df.empty or not used_timestamp_order:
        return {
            "type": "drift_signals",
            "computed": False,
            "reason": "Reliable timestamp, case, and activity information is required.",
        }

    case_starts = (
        event_log_df
        .groupby(case_id_column)["_parsed_timestamp"]
        .min()
        .sort_values(kind="mergesort")
    )

    if len(case_starts) < min_cases:
        return {
            "type": "drift_signals",
            "computed": False,
            "reason": f"At least {min_cases} cases are required for early/late window comparison.",
        }

    earliest_case_start = case_starts.min()
    latest_case_start = case_starts.max()
    split_strategy = "time_midpoint"

    if split_timestamp is not None:
        parsed_split_timestamp = pd.to_datetime(
            split_timestamp,
            errors="coerce",
            format="mixed",
            utc=True,
        )
        if pd.isna(parsed_split_timestamp):
            return {
                "type": "drift_signals",
                "computed": False,
                "reason": "The selected split timestamp could not be parsed.",
            }
        split_timestamp_value = parsed_split_timestamp
        split_strategy = "manual_time_split"
    else:
        split_timestamp_value = earliest_case_start + ((latest_case_start - earliest_case_start) / 2)

    early_case_starts = case_starts[case_starts <= split_timestamp_value]
    late_case_starts = case_starts[case_starts > split_timestamp_value]

    minimum_window_cases = 5
    if len(early_case_starts) < minimum_window_cases or len(late_case_starts) < minimum_window_cases:
        return {
            "type": "drift_signals",
            "computed": False,
            "reason": (
                f"Both time windows need at least {minimum_window_cases} cases "
                "for early/late comparison."
            ),
        }

    early_case_ids = set(early_case_starts.index)
    late_case_ids = set(late_case_starts.index)

    early_events = event_log_df[event_log_df[case_id_column].isin(early_case_ids)]
    late_events = event_log_df[event_log_df[case_id_column].isin(late_case_ids)]

    early_activity_distribution = early_events[activity_column].astype(str).value_counts(normalize=True).to_dict()
    late_activity_distribution = late_events[activity_column].astype(str).value_counts(normalize=True).to_dict()
    activity_changes = compute_distribution_changes(
        early_activity_distribution,
        late_activity_distribution,
    )
    activity_shift_score = compute_total_variation_distance(
        early_activity_distribution,
        late_activity_distribution,
    )

    case_variants = compute_case_variants(event_log_df, case_id_column, activity_column)
    early_variant_counts = case_variants[case_variants.index.isin(early_case_ids)].value_counts()
    late_variant_counts = case_variants[case_variants.index.isin(late_case_ids)].value_counts()
    early_variant_distribution, early_variant_shift_distribution = prepare_variant_distribution_for_shift(
        early_variant_counts
    )
    late_variant_distribution, late_variant_shift_distribution = prepare_variant_distribution_for_shift(
        late_variant_counts
    )
    variant_changes = compute_distribution_changes(
        early_variant_distribution,
        late_variant_distribution,
    )
    grouped_variant_changes = compute_distribution_changes(
        early_variant_shift_distribution,
        late_variant_shift_distribution,
    )
    variant_shift_score = compute_total_variation_distance(
        early_variant_shift_distribution,
        late_variant_shift_distribution,
    )

    dominant_early_variant = next(iter(early_variant_distribution), None)
    dominant_late_variant = next(iter(late_variant_distribution), None)
    dominant_early_count = int(early_variant_counts.iloc[0]) if not early_variant_counts.empty else 0
    dominant_late_count = int(late_variant_counts.iloc[0]) if not late_variant_counts.empty else 0
    dominant_early_share = float(next(iter(early_variant_distribution.values()), 0.0))
    dominant_late_share = float(next(iter(late_variant_distribution.values()), 0.0))
    early_variant_count = len(early_variant_distribution)
    late_variant_count = len(late_variant_distribution)
    variant_diversity_change = late_variant_count - early_variant_count
    early_variant_diversity_ratio = early_variant_count / len(early_case_ids)
    late_variant_diversity_ratio = late_variant_count / len(late_case_ids)

    return {
        "type": "drift_signals",
        "computed": True,
        "split_strategy": split_strategy,
        "split_timestamp": split_timestamp_value.isoformat(),
        "time_range": {
            "start": earliest_case_start.isoformat(),
            "end": latest_case_start.isoformat(),
        },
        "early_window": {
            "case_count": len(early_case_ids),
            "start": early_case_starts.min().isoformat(),
            "end": early_case_starts.max().isoformat(),
        },
        "late_window": {
            "case_count": len(late_case_ids),
            "start": late_case_starts.min().isoformat(),
            "end": late_case_starts.max().isoformat(),
        },
        "activity_shift": {
            "score": float(activity_shift_score),
            "early_distribution": top_distribution_values(early_activity_distribution),
            "late_distribution": top_distribution_values(late_activity_distribution),
            "top_changes": activity_changes["top_changes"],
            "new_late": activity_changes["new_late"][:10],
            "disappearing_late": activity_changes["disappearing_late"][:10],
            "new_late_count": len(activity_changes["new_late"]),
            "disappearing_late_count": len(activity_changes["disappearing_late"]),
        },
        "variant_shift": {
            "score": float(variant_shift_score),
            "early_variant_count": early_variant_count,
            "late_variant_count": late_variant_count,
            "variant_diversity_change": variant_diversity_change,
            "dominant_early_variant": str(dominant_early_variant) if dominant_early_variant else None,
            "dominant_late_variant": str(dominant_late_variant) if dominant_late_variant else None,
            "dominant_early_count": dominant_early_count,
            "dominant_late_count": dominant_late_count,
            "dominant_early_share": dominant_early_share,
            "dominant_late_share": dominant_late_share,
            "early_variant_diversity_ratio": early_variant_diversity_ratio,
            "late_variant_diversity_ratio": late_variant_diversity_ratio,
            "shift_score_basis": "Singleton and sub-1% variants are grouped as Other rare variants",
            "early_distribution": top_distribution_values(early_variant_distribution),
            "late_distribution": top_distribution_values(late_variant_distribution),
            "top_changes": variant_changes["top_changes"],
            "new_late": variant_changes["new_late"][:10],
            "disappearing_late": variant_changes["disappearing_late"][:10],
            "new_late_count": len(variant_changes["new_late"]),
            "disappearing_late_count": len(variant_changes["disappearing_late"]),
            "shift_new_late_count": len(grouped_variant_changes["new_late"]),
            "shift_disappearing_late_count": len(grouped_variant_changes["disappearing_late"]),
        },
    }


def generate_drift_signal_warnings(drift_signals: dict) -> list[str]:
    if not drift_signals.get("computed"):
        return []

    warnings = []
    activity_shift = drift_signals["activity_shift"]
    variant_shift = drift_signals["variant_shift"]

    if activity_shift["score"] > 0.3:
        warnings.append(
            "Activity distribution changes noticeably between early and late time windows, "
            "which may indicate changing activity patterns over time"
        )

    if variant_shift["score"] > 0.3:
        warnings.append(
            "Process variant distribution changes noticeably between early and late time windows, "
            "which may indicate changing process behavior over time"
        )

    return warnings


def compute_event_log_distribution_summary(df: pd.DataFrame) -> dict:
    event_log_columns = detect_event_log_columns(df)
    summary = {}

    activity_column = event_log_columns["activity"]
    case_id_column = event_log_columns["case_id"]
    timestamp_column = event_log_columns["timestamp"]

    if case_id_column is not None and timestamp_column is not None:
        duration_summary = compute_case_duration_summary(
            df,
            case_id_column,
            timestamp_column,
        )
        if duration_summary["total_cases"] > 0:
            summary["Event-log case duration summary"] = duration_summary

    if activity_column is not None:
        summary["Event-log activity distribution"] = compute_activity_distribution(
            df,
            activity_column,
        )

    if (
        case_id_column is not None
        and activity_column is not None
        and timestamp_column is not None
    ):
        transitions = compute_top_activity_transitions(
            df,
            case_id_column,
            activity_column,
            timestamp_column,
        )
        if transitions["values"]:
            summary["Event-log top activity transitions"] = transitions

        variants = compute_process_variant_summary(
            df,
            case_id_column,
            activity_column,
            timestamp_column,
        )
        if variants["values"]:
            summary["Event-log process variants"] = variants

        drift_signals = compute_event_log_drift_signals(
            df,
            case_id_column,
            activity_column,
            timestamp_column,
        )
        if drift_signals["computed"]:
            summary["Event-log drift-oriented signals"] = drift_signals

    return summary

def generate_event_log_bias_warnings(
    df: pd.DataFrame,
    precomputed_event_log_summary: dict | None = None,
) -> list[str]:
    warnings = []
    event_log_columns = detect_event_log_columns(df)
    activity_column = event_log_columns["activity"]
    case_id_column = event_log_columns["case_id"]
    timestamp_column = event_log_columns["timestamp"]
    timestamp_parse_warning_added = False
    timestamp_parse_warning = (
        "Event-log timestamp values appear incomplete or cannot be reliably parsed; "
        "sequence summaries use file row order within each case and duration summaries may be limited"
    )
    partial_timestamp_warning = (
        "Some event-log timestamp values could not be parsed and were excluded from timestamp-based "
        "sequence and duration summaries"
    )

    if case_id_column is not None and timestamp_column is not None:
        duration_df, duration_timestamps_reliable = prepare_event_log_time_df(
            df,
            case_id_column,
            timestamp_column,
        )
        if not duration_df.empty and not duration_timestamps_reliable:
            warnings.append(timestamp_parse_warning)
            timestamp_parse_warning_added = True
        elif not duration_df.empty:
            timestamp_candidates = (
                df[[case_id_column, timestamp_column]]
                .dropna(subset=[case_id_column])
                .copy()
            )
            parsed_timestamps = pd.to_datetime(
                timestamp_candidates[timestamp_column],
                errors="coerce",
                format="mixed",
                utc=True,
            )
            if parsed_timestamps.notna().mean() < 1:
                warnings.append(partial_timestamp_warning)

        case_event_counts = duration_df.dropna(subset=["_parsed_timestamp"]).groupby(case_id_column).size()
        if not case_event_counts.empty:
            one_event_cases = int((case_event_counts == 1).sum())
            one_event_share = one_event_cases / len(case_event_counts)
            if one_event_cases >= 5 and one_event_share > 0.2:
                warnings.append(
                    f"Many cases contain only one event ({one_event_cases} cases; duration cannot be derived for these cases)"
                )

    if activity_column is None:
        if case_id_column is not None or timestamp_column is not None:
            warnings.append(
                "Process variants cannot be computed because no likely activity column was detected"
            )
        return warnings

    activity_counts = df[activity_column].dropna().astype(str).value_counts(normalize=True)

    # 70% threshold for activities mirrors the transition dominance threshold below.
    # Variants use 50% because a single dominant variant already implies a strongly
    # overrepresented workflow path, which is meaningful at a lower share.
    if not activity_counts.empty and float(activity_counts.iloc[0]) > 0.7:
        warnings.append(
            "One activity dominates the event log distribution (>70%), "
            "which may indicate strongly concentrated process behavior"
        )

    rare_activity_count = int((activity_counts < 0.01).sum())
    if rare_activity_count >= 5:
        warnings.append(
            f"Many rare activities detected ({rare_activity_count} activities below 1% frequency), "
            "which may indicate unusual or underrepresented process behavior"
        )

    if (
        case_id_column is not None
        and timestamp_column is not None
    ):
        sequence_df, used_timestamp_order = prepare_event_log_sequence_df(
            df,
            case_id_column,
            activity_column,
            timestamp_column,
        )
        if not sequence_df.empty and not used_timestamp_order:
            if not timestamp_parse_warning_added:
                warnings.append(timestamp_parse_warning)

        transitions = compute_top_activity_transitions(
            df,
            case_id_column,
            activity_column,
            timestamp_column,
            max_transitions=None,
        )
        transition_values = transitions["values"]

        if transition_values and max(transition_values.values()) > 0.7:
            warnings.append(
                "One activity transition dominates the event log distribution (>70%), "
                "which may indicate a strongly dominant process path"
            )

        rare_transition_count = sum(value < 0.01 for value in transition_values.values())
        if rare_transition_count >= 10:
            warnings.append(
                f"Many rare activity transitions detected ({rare_transition_count} transitions below 1% frequency), "
                "which may indicate uncommon or underrepresented process paths"
            )

        variants = (
            precomputed_event_log_summary.get("Event-log process variants")
            if precomputed_event_log_summary is not None
            else None
        ) or compute_process_variant_summary(
            df,
            case_id_column,
            activity_column,
            timestamp_column,
            max_variants=1000,
        )
        variant_values = variants["values"]

        # 50% threshold (lower than the 70% used for activities) because a single
        # variant covering half of all cases already indicates a strongly dominant workflow.
        if variant_values and max(variant_values.values()) > 0.5:
            warnings.append(
                "One process variant dominates the event log (>50% of cases), "
                "which may indicate that one workflow pattern is strongly overrepresented"
            )

        rare_variant_count = variants["rare_variant_count"]
        total_variants = variants["total_variants"]
        if rare_variant_count >= 5 and total_variants > 0:
            warnings.append(
                f"Many process variants occur only once ({rare_variant_count} singleton variants), "
                "which may indicate highly diverse or underrepresented process behavior"
            )

        drift_signals = (
            precomputed_event_log_summary.get("Event-log drift-oriented signals")
            if precomputed_event_log_summary is not None
            else None
        ) or compute_event_log_drift_signals(
            df,
            case_id_column,
            activity_column,
            timestamp_column,
        )
        warnings.extend(generate_drift_signal_warnings(drift_signals))

    elif case_id_column is not None or timestamp_column is not None:
        missing_columns = []
        if case_id_column is None:
            missing_columns.append("case ID")
        if timestamp_column is None:
            missing_columns.append("timestamp")
        warnings.append(
            "Process variants cannot be computed because no likely "
            + " or ".join(missing_columns)
            + " column was detected"
        )

    return warnings

def generate_bias_warnings(
    task_type: str,
    imbalance_ratio: float | None,
    event_log_warnings: list[str] | None = None,
) -> list[str]:
    warnings = []
    task_type = task_type.lower().strip() if task_type else ""

    if task_type == "classification" and imbalance_ratio is not None and imbalance_ratio > 2.0:
        warnings.append(
            "Class imbalance detected (imbalance ratio > 2.0), "
            "which may indicate underrepresented target classes"
        )

    if event_log_warnings:
        warnings.extend(event_log_warnings)

    return warnings
