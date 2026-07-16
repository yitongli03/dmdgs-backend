import { ArticleReference, AssessmentHeader, MethodExplanation, MetricTile } from "../components";
import { ARTICLE_10_REFERENCES } from "../article10References";
import { formatNumber, renderWarnings, renderBooleanMap } from "../utils";

function QualityPage({ result, onContinue, onBack }) {
    const warnings = result.data_quality_analysis?.warnings || [];
    const missingValueRatio = result.data_quality_analysis?.missing_value_ratio;
    const duplicateRate = result.data_quality_analysis?.duplicate_rate;
    const isXesDataset = result.file_info?.filename?.toLowerCase().endsWith(".xes");
    const isEventLog = isXesDataset || Object.keys(result.bias_analysis?.event_log_summary || {}).length > 0;

    return (
        <div>
            <h2>Data Quality Evaluation</h2>
            <p><strong>Dataset:</strong> {result.metadata?.dataset_name || result.dataset_id}</p>

            <div className="card">
                <AssessmentHeader
                    title="Data Quality"
                    warnings={warnings}
                >
                    Evaluates completeness, duplicate records, and metadata coverage.
                </AssessmentHeader>
                <ArticleReference {...ARTICLE_10_REFERENCES.quality} />

                <h4>Evaluation Methods</h4>
                <p className="section-copy">
                    Expand a method to see what it checks, how it is computed, and why it supports dataset governance.
                </p>
                <div className="method-grid">
                    <MethodExplanation
                        title="Missing Value Ratio"
                        computes="The proportion of empty or missing cells in the dataset."
                        how="The tool divides the number of missing values by the total number of cells. Values above 0.2 are flagged for review."
                        why="Missing values are a signal for data completeness. They may reduce reliability and should be understood before the dataset is used for AI development."
                    />
                    <MethodExplanation
                        title="Duplicate Rate"
                        computes="The proportion of records that are exact duplicates."
                        how="The tool counts duplicated rows and divides them by the total number of rows. Values above 0.2 are flagged for review."
                        why="Duplicates can indicate collection or processing problems and may distort later training or evaluation results."
                    />
                    <MethodExplanation
                        title="Metadata Completeness"
                        computes="Whether key descriptive metadata fields have been provided."
                        how="The tool checks dataset name, origin, intended use, task type, deployment context, and domain. Missing fields are flagged for review."
                        why="Complete metadata supports traceability and helps users interpret later suitability, bias, and privacy results in context."
                    />
                </div>

                <h4>Computed Results</h4>
                <div className="metric-grid">
                    <MetricTile
                        label="Missing value ratio"
                        value={formatNumber(missingValueRatio)}
                        status={missingValueRatio > 0.2 ? "warning" : "neutral"}
                        helper="Completeness indicator: missing cells divided by all dataset cells. The prototype flags values above 0.2."
                    />
                    <MetricTile
                        label="Duplicate rate"
                        value={formatNumber(duplicateRate)}
                        status={duplicateRate > 0.2 ? "warning" : "neutral"}
                        helper="Consistency indicator: exact duplicate rows divided by all records. The prototype flags values above 0.2."
                    />
                </div>
                {isEventLog && (
                    <p className="info-note">
                        Event log datasets may produce high missing-value ratios because not every event or case contains every attribute. This applies to XES files and CSV files derived from XES formats.
                    </p>
                )}

                <h4>
                    Metadata Completeness
                </h4>
                <p className="section-copy">
                    The tool checks whether key descriptive fields are present. This supports traceability and makes later suitability review more meaningful.
                </p>
                {renderBooleanMap(result.data_quality_analysis?.metadata_completeness)}

                <h4>Warnings</h4>
                {renderWarnings(warnings)}
            </div>

            <div className="nav-actions">
                <button className="button-secondary" type="button" onClick={onBack}>Back</button>
                <button type="button" onClick={onContinue}>Continue</button>
            </div>
        </div>
    );
}

export default QualityPage;
