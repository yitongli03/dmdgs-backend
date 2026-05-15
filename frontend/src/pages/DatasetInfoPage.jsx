import { MetricTile, StatusBadge } from "../components";

function DatasetInfoPage({ result, onContinue, onBack }) {
    return (
        <div>
            <h2>Dataset Information</h2>
            <p><strong>Dataset ID:</strong> {result.dataset_id}</p>

            <div className="card">
                <div className="assessment-header">
                    <div>
                        <p className="eyebrow">Input Context</p>
                        <h3>Dataset Profile</h3>
                        <p className="section-copy">
                            This profile anchors the later governance checks. The more concrete the context, the more useful the warnings become.
                        </p>
                    </div>
                    <StatusBadge status="neutral" label={result.metadata?.task_type || "unknown task"} />
                </div>

                <p><strong>Filename:</strong> {result.file_info?.filename || "Not available"}</p>
                <div className="metric-grid">
                    <MetricTile label="Rows" value={result.schema_info?.num_rows ?? 0} />
                    <MetricTile label="Columns" value={result.schema_info?.num_columns ?? 0} />
                    <MetricTile label="File type" value={result.file_info?.content_type || "Not available"} />
                </div>
            </div>

            <div className="card">
                <h3>Dataset Metadata</h3>
                <p><strong>Dataset Name:</strong> {result.metadata?.dataset_name || "Not provided"}</p>
                <p><strong>Origin:</strong> {result.metadata?.origin || "Not provided"}</p>
                <p><strong>Intended Use:</strong> {result.metadata?.intended_use || "Not provided"}</p>
                <p><strong>Task Type:</strong> {result.metadata?.task_type || "Not provided"}</p>
                <p><strong>Target Column Name:</strong> {result.metadata?.target_column || "Not provided"}</p>
                <p><strong>Deployment Context:</strong> {result.metadata?.deployment_context || "Not provided"}</p>
                <p><strong>Domain:</strong> {result.metadata?.domain || "Not provided"}</p>
                <p><strong>Preprocessing Steps:</strong> {result.metadata?.preprocessing_steps || "Not provided"}</p>
                <p><strong>Contains Personal Data:</strong> {result.metadata?.contains_personal_data ? "Yes" : "No"}</p>
                <p><strong>Privacy Notes:</strong> {result.metadata?.privacy_notes || "Not provided"}</p>
            </div>

            <div className="nav-actions">
                <button className="button-secondary" type="button" onClick={onBack}>Back to Home</button>
                <button type="button" onClick={onContinue}>Continue</button>
            </div>
        </div>
    );
}

export default DatasetInfoPage;
