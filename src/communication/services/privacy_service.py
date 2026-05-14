import pandas as pd
import re


def _column_tokens(column_name: str) -> set[str]:
    normalized = re.sub(r"[^a-zA-Z0-9]+", " ", column_name.lower())
    return {token for token in normalized.split() if token}


def detect_potential_personal_data(df: pd.DataFrame) -> list[str]:
    personal_tokens = {
        "name", "firstname", "lastname", "fullname", "email", "mail",
        "phone", "mobile", "address", "street", "city", "zip", "postal",
        "postcode", "ssn", "passport", "birth", "dob", "patient",
        "person", "customer", "user", "client", "employee", "resource",
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
        has_person_related_id = "id" in tokens and bool(tokens & identifier_subject_tokens)

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
        warnings.append("Personal data declared but no additional privacy notes provided")

    # Case 2: Potential personal data detected automatically
    if len(detected_columns) > 0:
        warnings.append(f"Potential personal data detected in columns: {', '.join(detected_columns)}")

    # Case 3: Mismatch (user says no personal data, but we detect something)
    if not contains_personal_data and len(detected_columns) > 0:
        warnings.append("Possible mismatch: potential personal data detected but not declared")  

    return warnings 
