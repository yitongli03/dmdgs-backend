import { StatusBadge, WarningList } from "./components";

export const formatNumber = (value) => {
    if (value === null || value === undefined) return "Not applicable";
    return Number(value).toFixed(3);
};

export const renderWarnings = (warnings) => {
    if (!warnings || warnings.length === 0) {
        return <StatusBadge status="ok" label="No warnings" />;
    }
    return (
        <WarningList warnings={warnings} />
    );
};

export const renderFlagStatus = (warnings) => {
    if (!warnings || warnings.length === 0) {
        return <StatusBadge status="ok" label="OK" />;
    }
    return <StatusBadge status="warning" label={`${warnings.length} warning${warnings.length === 1 ? "" : "s"}`} />;
};

export const renderBooleanMap = (obj) => {
    if (!obj || Object.keys(obj).length === 0) {
        return <p>Not available</p>;
    }
    return (
        <ul className="check-list">
            {Object.entries(obj).map(([key, value]) => (
                <li key={key}>
                    <strong>{key}:</strong>{" "}
                    <StatusBadge status={value ? "ok" : "warning"} label={value ? "Complete" : "Missing"} />
                </li>
            ))}
        </ul>
    );
};

export function getWarningCount(result) {
    const flags = result?.governance_flags || {};
    return Object.values(flags).reduce((total, warnings) => total + (warnings?.length || 0), 0);
}

export const convertDatasetDocumentToResult = (datasetDocument) => {
    const emptyFlags = {
        quality_warnings: [],
        suitability_warnings: [],
        bias_warnings: [],
        privacy_warnings: [],
    };
    const flags = datasetDocument.governance_flags || emptyFlags;
    const normalizedFlags = {
        quality_warnings: flags.quality_warnings || flags.quality_issues || [],
        suitability_warnings: flags.suitability_warnings || flags.suitability_issues || [],
        bias_warnings: flags.bias_warnings || flags.bias_issues || [],
        privacy_warnings: flags.privacy_warnings || flags.privacy_issues || [],
    };

    return {
        dataset_id: datasetDocument.dataset_id || "Unknown",
        file_info: datasetDocument.file_info || {},
        metadata: datasetDocument.metadata || {},
        schema_info: datasetDocument.schema_info || {
            num_rows: 0,
            num_columns: 0,
            column_names: [],
        },
        data_quality_analysis: {
            missing_value_ratio:
                datasetDocument.analysis?.data_quality?.missing_value_ratio ?? null,
            duplicate_rate:
                datasetDocument.analysis?.data_quality?.duplicate_rate ?? null,
            metadata_completeness:
                datasetDocument.analysis?.data_quality?.metadata_completeness || {},
            warnings:
                datasetDocument.analysis?.data_quality?.warnings || normalizedFlags.quality_warnings,
        },
        suitability_analysis: {
            warnings: normalizedFlags.suitability_warnings,
        },
        bias_analysis: {
            class_distribution:
                datasetDocument.analysis?.bias?.class_distribution || {},
            imbalance_ratio:
                datasetDocument.analysis?.bias?.imbalance_ratio ?? null,
            feature_distribution_summary:
                datasetDocument.analysis?.bias?.feature_distribution_summary || {},
            warnings: normalizedFlags.bias_warnings,
        },
        privacy_analysis: {
            user_indicated_personal_data:
                datasetDocument.analysis?.privacy?.user_indicated_personal_data ?? false,
            detected_personal_columns:
                datasetDocument.analysis?.privacy?.detected_personal_columns || [],
            warnings: normalizedFlags.privacy_warnings,
        },
        governance_flags: normalizedFlags,
    };
};
