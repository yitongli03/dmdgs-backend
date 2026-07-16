import pandas as pd

from communication.services.event_log_service import normalize_event_log_text


def _column_tokens(column_name: str) -> set[str]:
    normalized = normalize_event_log_text(column_name)
    return {token for token in normalized.split() if token}


def detect_potential_personal_data(df: pd.DataFrame) -> list[str]:
    personal_tokens = {
        "name", "firstname", "lastname", "fullname", "email", "mail",
        "phone", "mobile", "address", "street", "city", "zip", "postal",
        "postcode", "ssn", "passport", "birth", "dob", "patient",
        "person",
    }
    identifier_subject_tokens = {
        "patient", "person", "customer", "user", "client", "employee",
        "encounter", "resource",
    }

    detected_columns = []

    for col in df.columns:
        col_name = str(col)
        tokens = _column_tokens(col_name)

        has_personal_token = bool(tokens & personal_tokens)
        has_person_related_id = bool(tokens & {"id", "number", "nbr"}) and bool(tokens & identifier_subject_tokens)

        if has_personal_token or has_person_related_id:
            detected_columns.append(str(col))
    
    return detected_columns

def generate_privacy_warnings(
        contains_personal_data: bool,
        privacy_notes: str | None,
        detected_columns: list[str],
) -> list[str]:
    warnings = []

    # Case 1: Personal data declared but no explanation
    if contains_personal_data and (privacy_notes is None or privacy_notes.strip() == ""):
        warnings.append(
            "Personal data declared but no additional privacy notes provided, which may limit safeguard documentation"
        )

    # Case 2: User declaration conflicts with heuristic column detection
    if not contains_personal_data and len(detected_columns) > 0:
        warnings.append(
            "Possible mismatch: potential personal data detected in columns "
            f"{', '.join(detected_columns)} but not declared, which may indicate incomplete privacy metadata"
        )

    return warnings 
