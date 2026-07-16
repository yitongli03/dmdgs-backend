from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class FileInfo(BaseModel):
    filename: str
    content_type: Optional[str] = None
    stored_path: Optional[str] = None


class MetadataModel(BaseModel):
    dataset_name: str
    origin: str
    intended_use: str
    preprocessing_steps: Optional[str] = ""
    task_type: str # e.g., "classification" or "other"
    target_column: Optional[str] = None
    deployment_context: Optional[str] = ""
    domain: Optional[str] = ""
    contains_personal_data: bool = False
    privacy_notes: Optional[str] = ""


class SchemaInfo(BaseModel):
    columns: List[str] = Field(default_factory=list)
    num_rows: int = 0
    num_columns: int = 0


class DataQualityResult(BaseModel):
    missing_value_ratio: Optional[float] = None
    duplicate_rate: Optional[float] = None
    metadata_completeness: Dict[str, bool] = Field(default_factory=dict)
    consistency_notes: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)


class SuitabilityResult(BaseModel):
    warnings: List[str] = Field(default_factory=list)


class BiasResult(BaseModel):
    class_distribution: Dict[str, float] = Field(default_factory=dict)
    imbalance_ratio: Optional[float] = None
    feature_distribution_summary: Dict[str, Any] = Field(default_factory=dict)
    event_log_summary: Dict[str, Any] = Field(default_factory=dict)
    warnings: List[str] = Field(default_factory=list)


class PrivacyResult(BaseModel):
    user_indicated_personal_data: bool = False
    detected_personal_columns: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)


class AnalysisResult(BaseModel):
    data_quality: DataQualityResult = Field(default_factory=DataQualityResult)
    suitability: SuitabilityResult = Field(default_factory=SuitabilityResult)
    bias: BiasResult = Field(default_factory=BiasResult)
    privacy: PrivacyResult = Field(default_factory=PrivacyResult)


class GovernanceFlags(BaseModel):
    quality_warnings: List[str] = Field(default_factory=list)
    suitability_warnings: List[str] = Field(default_factory=list)
    bias_warnings: List[str] = Field(default_factory=list)
    privacy_warnings: List[str] = Field(default_factory=list)


class DatasetDocument(BaseModel):
    dataset_id: str
    created_at: datetime
    updated_at: datetime
    file_info: FileInfo
    metadata: MetadataModel
    schema_info: SchemaInfo = Field(default_factory=SchemaInfo)
    analysis: AnalysisResult = Field(default_factory=AnalysisResult)
    governance_flags: GovernanceFlags = Field(default_factory=GovernanceFlags)
