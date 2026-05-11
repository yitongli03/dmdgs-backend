def compute_missing_value_ratio(df):
    if df.size == 0:
        return 0.0
    return float(df.isnull().sum().sum() / df.size)

def compute_duplicate_rate(df):
    if len(df) == 0:
        return 0.0
    return float(df.duplicated().sum() / len(df))

def check_metadata_completeness(metadata: dict) -> dict:
    required_fields = [
        "dataset_name",
        "origin",
        "intended_use",
        "task_type",
        "deployment_context",
        "domain",
    ]

    return {
        field: bool(metadata.get(field))
        for field in required_fields
    }