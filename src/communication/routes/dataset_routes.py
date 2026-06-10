import uuid
from datetime import datetime, UTC
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pymongo.collection import Collection

from communication.database_connector.db_connector import get_database
from communication.services.parser_service import parse_dataset, extract_schema_info
from communication.services.quality_service import (
    compute_missing_value_ratio,
    compute_duplicate_rate,
    check_metadata_completeness,
)
from communication.services.suitability_service import check_suitability
from communication.services.bias_service import (
    compute_class_distribution,
    compute_imbalance_ratio,
    compute_feature_distribution_summary,
    compute_event_log_distribution_summary,
    generate_event_log_bias_warnings,
    generate_bias_warnings,
)
from communication.services.privacy_service import (
    detect_potential_personal_data,
    generate_privacy_warnings,
)
from communication.models.dataset_model import (
    DatasetDocument,
    FileInfo,
    MetadataModel,
    SchemaInfo,
)

router = APIRouter()

PROJECT_ROOT = Path(__file__).resolve().parents[3]
UPLOAD_FOLDER = PROJECT_ROOT / "uploads"

@router.post("/datasets/upload")
async def upload_dataset(
    file: UploadFile = File(...),
    dataset_name: str = Form(...),
    origin: str = Form(...),
    intended_use: str = Form(...),
    task_type: str = Form(...),
    preprocessing_steps: str = Form(""),
    target_column: str | None = Form(None),
    deployment_context: str = Form(""),
    domain: str = Form(""),
    contains_personal_data: bool = Form(False),
    privacy_notes: str = Form(""),
):
    # Validate file type
    supported_extensions = (".csv", ".xes")
    if not file.filename.lower().endswith(supported_extensions):
        raise HTTPException(status_code=400, detail="Only CSV and XES files are supported")

    # Ensure upload folder exists
    UPLOAD_FOLDER.mkdir(parents=True, exist_ok=True)

    # Create unique filename to avoid overwriting files with the same name
    stored_filename = f"{uuid.uuid4()}_{file.filename}"
    file_path = UPLOAD_FOLDER / stored_filename

    # Save file locally
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)

    # Parse dataset
    try:
        df = parse_dataset(str(file_path))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    # Extract schema info
    schema_info = extract_schema_info(df)

    # Compute quality metrics
    mvr = compute_missing_value_ratio(df)
    dr = compute_duplicate_rate(df)

    metadata_dict = {
        "dataset_name": dataset_name,
        "origin": origin,
        "intended_use": intended_use,
        "preprocessing_steps": preprocessing_steps,
        "task_type": task_type,
        "target_column": target_column,
        "deployment_context": deployment_context,
        "domain": domain,
        "contains_personal_data": contains_personal_data,
        "privacy_notes": privacy_notes,
    }

    # Quality analysis
    metadata_completeness = check_metadata_completeness(metadata_dict)

    quality_warnings = []

    if mvr > 0.2:
        quality_warnings.append(
            "High missing value ratio detected (>20%), which may indicate incomplete records or limited data coverage"
        )

    if dr > 0.2:
        quality_warnings.append(
            "High duplicate rate detected (>20%), which may indicate repeated records or insufficient deduplication"
        )

    if not all(metadata_completeness.values()):
        quality_warnings.append(
            "Incomplete metadata fields detected, which may limit documentation and later governance review"
        )

    # Suitability analysis
    suitability_warnings = check_suitability(
        df=df,
        task_type=task_type,
        target_column=target_column,
        intended_use=intended_use,
        deployment_context=deployment_context,
        domain=domain,
        preprocessing_steps=preprocessing_steps,
    )

    # Bias analysis
    class_distribution = {}
    imbalance_ratio = None
    feature_distribution_summary = compute_feature_distribution_summary(df, target_column)
    feature_distribution_summary.update(compute_event_log_distribution_summary(df))

    if task_type == "classification" and target_column is not None:
        if target_column in df.columns:
            class_distribution = compute_class_distribution(df, target_column)
            imbalance_ratio = compute_imbalance_ratio(df, target_column)

    event_log_bias_warnings = generate_event_log_bias_warnings(df)
    bias_warnings = generate_bias_warnings(
        task_type,
        imbalance_ratio,
        event_log_warnings=event_log_bias_warnings,
    )

    # Privacy analysis
    detected_columns = detect_potential_personal_data(df)
    privacy_warnings = generate_privacy_warnings(
        contains_personal_data=contains_personal_data,
        privacy_notes=privacy_notes,
        detected_columns=detected_columns,
    )

    # Create DatasetDocument
    dataset_id = str(uuid.uuid4())
    now = datetime.now(UTC)

    dataset_document = DatasetDocument(
        dataset_id=dataset_id,
        created_at=now,
        updated_at=now,
        file_info=FileInfo(
            filename=file.filename,
            content_type=file.content_type,
            stored_path=str(file_path),
        ),
        metadata=MetadataModel(**metadata_dict),
        schema_info=SchemaInfo(**schema_info),
    )

    # Inject quality results
    dataset_document.analysis.data_quality.missing_value_ratio = mvr
    dataset_document.analysis.data_quality.duplicate_rate = dr
    dataset_document.analysis.data_quality.metadata_completeness = metadata_completeness
    dataset_document.analysis.data_quality.warnings = quality_warnings
    dataset_document.governance_flags.quality_warnings = quality_warnings

    # Inject suitability results
    dataset_document.analysis.suitability.warnings = suitability_warnings
    dataset_document.governance_flags.suitability_warnings = suitability_warnings

    # Inject bias analysis results
    dataset_document.analysis.bias.class_distribution = class_distribution
    dataset_document.analysis.bias.imbalance_ratio = imbalance_ratio
    dataset_document.analysis.bias.feature_distribution_summary = feature_distribution_summary
    dataset_document.analysis.bias.warnings = bias_warnings
    dataset_document.governance_flags.bias_warnings = bias_warnings

    # Inject privacy analysis results
    dataset_document.analysis.privacy.user_indicated_personal_data = contains_personal_data
    dataset_document.analysis.privacy.detected_personal_columns = detected_columns
    dataset_document.analysis.privacy.warnings = privacy_warnings
    dataset_document.governance_flags.privacy_warnings = privacy_warnings

    # Store in MongoDB
    db = get_database()
    collection: Collection = db["datasets"]
    collection.insert_one(dataset_document.model_dump())

    # Return structured response
    return {
        "message": "Dataset uploaded successfully",
        "dataset": dataset_document.model_dump(),
    }

@router.get("/datasets/{dataset_id}")
def get_dataset(dataset_id: str):
    db = get_database()
    collection: Collection = db["datasets"]

    result = collection.find_one({"dataset_id": dataset_id})

    if not result:
        raise HTTPException(status_code=404, detail="Dataset not found")

    result["_id"] = str(result["_id"])
    return result

@router.get("/datasets")
def list_datasets():
    db = get_database()
    collection: Collection = db["datasets"]

    datasets = collection.find(
        {},
        {
            "_id": 0,
            "dataset_id": 1,
            "metadata.dataset_name": 1,
            "metadata.origin": 1,
            "metadata.task_type": 1,
            "created_at": 1,
        },
    )

    return list(datasets)
