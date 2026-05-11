import pandas as pd


def detect_potential_personal_data(df: pd.DataFrame) -> list[str]:
    suspicious_keywords = [
        "name", "first_name", "last_name", "fullname",
        "email", "mail",
        "phone", "mobile",
        "address", "street", "city", "zip", "postal", "postcode",
        "id", "user_id", "person_id", "customer_id",
        "ssn", "passport",
        "birth", "dob",
    ]

    detected_columns = []

    for col in df.columns:
        col_lower = str(col).lower()
        if any(keyword in col_lower for keyword in suspicious_keywords):
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