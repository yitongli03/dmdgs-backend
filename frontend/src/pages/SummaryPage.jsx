import { MetricTile, StatusBadge } from "../components";
import { formatNumber, renderWarnings, renderFlagStatus, renderBooleanMap, getWarningCount } from "../utils";
import { CategoricalChart, FeatureDistributions } from "../Charts";

function WarningSection({ warnings }) {
    return (
        <>
            <h4>Warnings</h4>
            {renderWarnings(warnings || [])}
        </>
    );
}

function SummaryPage({ result, onBack, goHome }) {
    const warningCount = getWarningCount(result);

    return (
        <div>
            <h2>Full Governance Report</h2>
            <p><strong>Dataset ID:</strong> {result.dataset_id}</p>

            <div className="card">
                <div className="summary-top">
                    <div>
                        <p className="eyebrow">Assessment Summary</p>
                        <h3>{warningCount === 0 ? "No Warnings" : `${warningCount} Warning${warningCount === 1 ? "" : "s"}`}</h3>
                        <p className="section-copy">
                            This report is a decision-support artefact. It highlights where a human reviewer should inspect documentation, context, data distribution, or privacy safeguards.
                        </p>
                    </div>
                    <StatusBadge status={warningCount ? "warning" : "ok"} label={warningCount ? "Needs review" : "OK"} />
                </div>

                <div className="flag-grid">
                    <p><strong>Quality:</strong> {renderFlagStatus(result.governance_flags?.quality_warnings || [])}</p>
                    <p><strong>Suitability:</strong> {renderFlagStatus(result.governance_flags?.suitability_warnings || [])}</p>
                    <p><strong>Bias:</strong> {renderFlagStatus(result.governance_flags?.bias_warnings || [])}</p>
                    <p><strong>Privacy:</strong> {renderFlagStatus(result.governance_flags?.privacy_warnings || [])}</p>
                </div>
            </div>

            <div className="card">
                <h3>Dataset Overview</h3>
                <div className="metric-grid">
                    <MetricTile label="Rows" value={result.schema_info?.num_rows ?? 0} />
                    <MetricTile label="Columns" value={result.schema_info?.num_columns ?? 0} />
                    <MetricTile label="Task type" value={result.metadata?.task_type || "Not provided"} />
                    <MetricTile label="Content type" value={result.file_info?.content_type || "Not available"} />
                </div>
                <div className="metadata-grid">
                    <p><strong>Filename:</strong> {result.file_info?.filename || "Not available"}</p>
                    <p><strong>Dataset Name:</strong> {result.metadata?.dataset_name || "Not provided"}</p>
                    <p><strong>Origin:</strong> {result.metadata?.origin || "Not provided"}</p>
                    <p><strong>Intended Use:</strong> {result.metadata?.intended_use || "Not provided"}</p>
                    <p><strong>Target Column Name:</strong> {result.metadata?.target_column || "Not provided"}</p>
                    <p><strong>Deployment Context:</strong> {result.metadata?.deployment_context || "Not provided"}</p>
                    <p><strong>Domain:</strong> {result.metadata?.domain || "Not provided"}</p>
                    <p><strong>Preprocessing Steps:</strong> {result.metadata?.preprocessing_steps || "Not provided"}</p>
                    <p><strong>Contains Personal Data:</strong> {result.metadata?.contains_personal_data ? "Yes" : "No"}</p>
                    <p><strong>Privacy Notes:</strong> {result.metadata?.privacy_notes || "Not provided"}</p>
                </div>
            </div>

            <div className="card">
                <h3>Data Quality</h3>
                <div className="metric-grid">
                    <MetricTile label="Missing value ratio" value={formatNumber(result.data_quality_analysis?.missing_value_ratio)} />
                    <MetricTile label="Duplicate rate" value={formatNumber(result.data_quality_analysis?.duplicate_rate)} />
                </div>
                <h4>Metadata Completeness</h4>
                {renderBooleanMap(result.data_quality_analysis?.metadata_completeness)}
                <WarningSection warnings={result.data_quality_analysis?.warnings} />
            </div>

            <div className="card">
                <h3>Suitability</h3>
                <WarningSection warnings={result.suitability_analysis?.warnings} />
            </div>

            <div className="card">
                <h3>Bias Awareness</h3>
                <p>
                    <strong>Imbalance Ratio:</strong>{" "}
                    {result.bias_analysis?.imbalance_ratio ?? "Not applicable"}
                </p>
                <h4>Class Distribution</h4>
                {result.bias_analysis?.class_distribution &&
                    Object.keys(result.bias_analysis.class_distribution).length > 0
                    ? <CategoricalChart
                        featureName="Class Distribution"
                        featureData={{ type: "categorical", values: result.bias_analysis.class_distribution }}
                    />
                    : <p>Not available</p>
                }
                <h4>Feature Distribution Summary</h4>
                <FeatureDistributions obj={result.bias_analysis?.feature_distribution_summary} />
                <WarningSection warnings={result.bias_analysis?.warnings} />
            </div>

            <div className="card">
                <h3>Privacy</h3>
                <p>
                    <strong>User indicated personal data:</strong>{" "}
                    {result.privacy_analysis?.user_indicated_personal_data ? "Yes" : "No"}
                </p>
                <p>
                    <strong>Detected Personal Columns:</strong>{" "}
                    {result.privacy_analysis?.detected_personal_columns?.length
                        ? result.privacy_analysis.detected_personal_columns.join(", ")
                        : "None"}
                </p>
                <WarningSection warnings={result.privacy_analysis?.warnings} />
            </div>

            <div className="nav-actions">
                <button className="button-secondary" type="button" onClick={onBack}>Back</button>
                <button type="button" onClick={goHome}>Analyse Another Dataset</button>
            </div>
        </div>
    );
}

export default SummaryPage;
