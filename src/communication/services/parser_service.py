import pandas as pd
import xml.etree.ElementTree as ET
from pathlib import Path

def parse_csv(file_path: str) -> pd.DataFrame:
    for encoding in ("utf-8", "cp1252"):
        try:
            return pd.read_csv(file_path, encoding=encoding)
        except UnicodeDecodeError:
            continue
        except (pd.errors.EmptyDataError, pd.errors.ParserError) as exc:
            raise ValueError(f"Could not parse CSV file: {exc}") from exc

    raise ValueError(
        "Could not decode CSV file. Please provide a UTF-8 or Windows-1252 encoded CSV file"
    )

def parse_xes(file_path: str) -> pd.DataFrame:
    try:
        import pm4py

        df = pm4py.read_xes(file_path)
    except ImportError:
        df = parse_xes_with_elementtree(file_path)
    except Exception as exc:
        raise ValueError(f"Could not parse XES file: {exc}") from exc

    return normalize_event_log_dataframe(df)

def parse_xes_with_elementtree(file_path: str) -> pd.DataFrame:
    try:
        root = ET.parse(file_path).getroot()
    except ET.ParseError as exc:
        raise ValueError(f"Could not parse XES file: {exc}") from exc

    rows = []
    for trace in root.findall(".//{*}trace"):
        trace_attributes = {
            f"case:{key}": value
            for key, value in parse_xes_attributes(trace).items()
        }

        for event in trace.findall("{*}event"):
            event_attributes = parse_xes_attributes(event)
            rows.append({**trace_attributes, **event_attributes})

    if not rows:
        raise ValueError("XES file does not contain events")

    return pd.DataFrame(rows)

def parse_xes_attributes(element: ET.Element) -> dict:
    attributes = {}
    for child in element:
        key = child.attrib.get("key")
        if not key:
            continue

        value = child.attrib.get("value")
        if value is None:
            continue

        attributes[key] = value

    return attributes

def normalize_event_log_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    rename_map = {
        "case:concept:name": "case_id",
        "concept:name": "activity",
        "time:timestamp": "timestamp",
        "org:resource": "resource",
    }

    available_renames = {
        source: target
        for source, target in rename_map.items()
        if source in df.columns and target not in df.columns
    }

    df = df.rename(columns=available_renames)

    for col in df.select_dtypes(include="object").columns:
        cleaned = df[col].str.replace(",", "", regex=False)
        non_blank = cleaned[cleaned.notna() & (cleaned.str.strip() != "")]
        if non_blank.empty:
            continue
        converted_test = pd.to_numeric(non_blank, errors="coerce")
        if converted_test.notna().all():
            df[col] = pd.to_numeric(cleaned, errors="coerce")

    return df

def parse_dataset(file_path: str) -> pd.DataFrame:
    extension = Path(file_path).suffix.lower()

    if extension == ".csv":
        return parse_csv(file_path)
    if extension == ".xes":
        return parse_xes(file_path)

    raise ValueError("Only CSV and XES files are supported")

def extract_schema_info(df: pd.DataFrame) -> dict:
    return {
        "columns": df.columns.tolist(),
        "num_rows": len(df),
        "num_columns": len(df.columns),
    }
