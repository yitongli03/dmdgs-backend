import { AssessmentHeader, MethodExplanation, MetricTile } from "../components";
import { formatNumber, renderWarnings, renderBooleanMap } from "../utils";

function QualityPage({ result, onContinue, onBack }) {
    const warnings = result.data_quality_analysis?.warnings || [];
    const missingValueRatio = result.data_quality_analysis?.missing_value_ratio;
    const duplicateRate = result.data_quality_analysis?.duplicate_rate;

    return (
        <div>
            <h2>Data Quality Evaluation</h2>
            <p><strong>Dataset:</strong> {result.metadata?.dataset_name || result.dataset_id}</p>

            <div className="card">
                <AssessmentHeader
                    title="Data Quality"
                    warnings={warnings}
                >
                    Evaluates measurable properties of the dataset and its documentation. The checks are derived from relevant data-quality concepts, but they are prototype methods rather than externally prescribed tests.
                </AssessmentHeader>

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
