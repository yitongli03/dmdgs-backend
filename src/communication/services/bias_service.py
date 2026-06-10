import pandas as pd
import re

from communication.services.event_log_service import detect_event_log_columns

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

    # Normalize common separators and duplicate-column suffixes such as Variant.1
    col = re.sub(r"[^a-zA-Z0-9]+", " ", col.lower())

    return re.sub(r"\s+", " ", col).strip()

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

    parsed = pd.to_datetime(sample, errors="coerce", format="mixed", utc=True)
    parse_ratio = parsed.notna().mean()

    return parse_ratio >= 0.8

def is_variant_column(col: str) -> bool:
    normalized = normalize_column_name(col)
    tokens = normalized.split()

    return "variant" in tokens

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
    event_log_df = df[[case_id_column, activity_column, timestamp_column]].dropna().copy()

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
    event_log_df = df[[case_id_column, timestamp_column]].dropna().copy()

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
            "max_duration_seconds": None,
            "min_duration": "Not available",
            "mean_duration": "Not available",
            "median_duration": "Not available",
            "max_duration": "Not available",
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
            "max_duration_seconds": None,
            "min_duration": "Not available",
            "mean_duration": "Not available",
            "median_duration": "Not available",
            "max_duration": "Not available",
        }

    durations = (case_times["max"] - case_times["min"]).dt.total_seconds()

    min_duration = float(durations.min())
    mean_duration = float(durations.mean())
    median_duration = float(durations.median())
    max_duration = float(durations.max())

    return {
        "type": "duration",
        "total_cases": int(len(durations)),
        "min_duration_seconds": min_duration,
        "mean_duration_seconds": mean_duration,
        "median_duration_seconds": median_duration,
        "max_duration_seconds": max_duration,
        "min_duration": format_duration(min_duration),
        "mean_duration": format_duration(mean_duration),
        "median_duration": format_duration(median_duration),
        "max_duration": format_duration(max_duration),
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
    max_transitions: int = 10,
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
    counts = transitions["transition"].value_counts(normalize=True).head(max_transitions)

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

def compute_distribution_changes(
    early_distribution: dict,
    late_distribution: dict,
    max_changes: int = 5,
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
    return {
        "top_changes": changes[:max_changes],
        "new_late": sorted(str(key) for key in keys if early_distribution.get(key, 0.0) == 0 and late_distribution.get(key, 0.0) > 0),
        "disappearing_late": sorted(str(key) for key in keys if early_distribution.get(key, 0.0) > 0 and late_distribution.get(key, 0.0) == 0),
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
    split_timestamp = earliest_case_start + ((latest_case_start - earliest_case_start) / 2)

    early_case_starts = case_starts[case_starts <= split_timestamp]
    late_case_starts = case_starts[case_starts > split_timestamp]

    if len(early_case_starts) < 2 or len(late_case_starts) < 2:
        return {
            "type": "drift_signals",
            "computed": False,
            "reason": "Both time windows need at least two cases for early/late comparison.",
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
    early_variant_distribution = case_variants[case_variants.index.isin(early_case_ids)].value_counts(normalize=True).to_dict()
    late_variant_distribution = case_variants[case_variants.index.isin(late_case_ids)].value_counts(normalize=True).to_dict()
    variant_changes = compute_distribution_changes(
        early_variant_distribution,
        late_variant_distribution,
    )
    variant_shift_score = compute_total_variation_distance(
        early_variant_distribution,
        late_variant_distribution,
    )

    dominant_early_variant = next(iter(early_variant_distribution), None)
    dominant_late_variant = next(iter(late_variant_distribution), None)
    early_variant_count = len(early_variant_distribution)
    late_variant_count = len(late_variant_distribution)
    variant_diversity_change = late_variant_count - early_variant_count

    return {
        "type": "drift_signals",
        "computed": True,
        "split_strategy": "time_midpoint",
        "split_timestamp": split_timestamp.isoformat(),
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
            "early_distribution": top_distribution_values(early_variant_distribution),
            "late_distribution": top_distribution_values(late_variant_distribution),
            "top_changes": variant_changes["top_changes"],
            "new_late": variant_changes["new_late"][:10],
            "disappearing_late": variant_changes["disappearing_late"][:10],
            "new_late_count": len(variant_changes["new_late"]),
            "disappearing_late_count": len(variant_changes["disappearing_late"]),
        },
    }

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

def generate_event_log_bias_warnings(df: pd.DataFrame) -> list[str]:
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

    if case_id_column is not None and timestamp_column is not None:
        duration_df, duration_timestamps_reliable = prepare_event_log_time_df(
            df,
            case_id_column,
            timestamp_column,
        )
        if not duration_df.empty and not duration_timestamps_reliable:
            warnings.append(timestamp_parse_warning)
            timestamp_parse_warning_added = True

        case_event_counts = df[[case_id_column, timestamp_column]].dropna().groupby(case_id_column).size()
        if not case_event_counts.empty:
            one_event_cases = int((case_event_counts == 1).sum())
            one_event_share = one_event_cases / len(case_event_counts)
            if one_event_cases >= 5 and one_event_share > 0.2:
                warnings.append(
                    f"Many cases contain only one event ({one_event_cases} cases; duration cannot be derived for these cases)"
                )

        if duration_timestamps_reliable:
            case_times = duration_df.groupby(case_id_column)["_parsed_timestamp"].agg(["min", "max", "count"])
            case_times = case_times[case_times["count"] >= 2].copy()
            if not case_times.empty:
                durations = (case_times["max"] - case_times["min"]).dt.total_seconds()
                percentile_95 = float(durations.quantile(0.95))
                max_duration = float(durations.max())

                if percentile_95 > 0 and max_duration > percentile_95 * 3:
                    long_case_count = int((durations > percentile_95).sum())
                    warnings.append(
                        "Some cases have unusually long durations "
                        f"({long_case_count} cases above the 95th percentile; max {format_duration(max_duration)})"
                    )

    if activity_column is None:
        if case_id_column is not None or timestamp_column is not None:
            warnings.append(
                "Process variants cannot be computed because no likely activity column was detected"
            )
        return warnings

    activity_counts = df[activity_column].dropna().astype(str).value_counts(normalize=True)

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
            max_transitions=1000,
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

        variants = compute_process_variant_summary(
            df,
            case_id_column,
            activity_column,
            timestamp_column,
            max_variants=1000,
        )
        variant_values = variants["values"]

        if variant_values and max(variant_values.values()) > 0.5:
            warnings.append(
                "One process variant dominates the event log (>50% of cases), "
                "which may indicate that one workflow pattern is strongly overrepresented"
            )

        rare_variant_count = variants["rare_variant_count"]
        total_variants = variants["total_variants"]
        if rare_variant_count >= 5 and total_variants > 0:
            warnings.append(
                f"Many process variants occur only once ({rare_variant_count} rare variants), "
                "which may indicate highly diverse or underrepresented process behavior"
            )

        drift_signals = compute_event_log_drift_signals(
            df,
            case_id_column,
            activity_column,
            timestamp_column,
        )
        if drift_signals["computed"]:
            activity_shift = drift_signals["activity_shift"]
            variant_shift = drift_signals["variant_shift"]

            if (
                activity_shift["score"] > 0.3
                or activity_shift["new_late_count"] >= 3
                or activity_shift["disappearing_late_count"] >= 3
            ):
                warnings.append(
                    "Activity distribution changes noticeably between early and late time windows, "
                    "which may indicate changing activity patterns over time"
                )

            variant_diversity_change = abs(variant_shift["variant_diversity_change"])
            largest_variant_count = max(
                variant_shift["early_variant_count"],
                variant_shift["late_variant_count"],
                1,
            )
            variant_diversity_change_share = variant_diversity_change / largest_variant_count

            if (
                variant_shift["score"] > 0.3
                or variant_shift["dominant_early_variant"] != variant_shift["dominant_late_variant"]
                or variant_diversity_change_share > 0.3
                or variant_shift["new_late_count"] >= 10
                or variant_shift["disappearing_late_count"] >= 10
            ):
                warnings.append(
                    "Process variant distribution changes noticeably between early and late time windows, "
                    "which may indicate changing process behavior over time"
                )

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
