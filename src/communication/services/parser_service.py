import pandas as pd

def parse_csv(file_path: str) -> pd.DataFrame:
    return pd.read_csv(file_path)

def extract_schema_info(df: pd.DataFrame) -> dict:
    return {
        "columns": df.columns.tolist(),
        "num_rows": len(df),
        "num_columns": len(df.columns),
    }