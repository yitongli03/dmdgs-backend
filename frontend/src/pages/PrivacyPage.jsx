import { AssessmentHeader, MethodExplanation, MetricTile } from "../components";
import { renderWarnings } from "../utils";

function PrivacyPage({ result, onContinue, onBack }) {
    const warnings = result.privacy_analysis?.warnings || [];
    const detectedColumns = result.privacy_analysis?.detected_personal_columns || [];

    return (
        <div>
            <h2>Privacy Considerations</h2>
            <p><strong>Dataset:</strong> {result.metadata?.dataset_name || result.dataset_id}</p>

            <div className="card">
                <AssessmentHeader
                    title="Privacy Considerations"
                    warnings={warnings}
                >
                    Supports privacy risk identification through user-provided information and simple dataset heuristics. It does not make a final legal or compliance determination.
                </AssessmentHeader>

                <h4>Evaluation Methods</h4>
                <p className="section-copy">
                    Expand a method to see how the privacy signals are identified and why human confirmation is still needed.
                </p>
                <div className="method-grid">
                    <MethodExplanation
                        title="User Declaration Check"
                        computes="Whether the user has indicated that the dataset contains personal data and whether privacy notes are provided."
                        how="If personal data is declared without explanatory notes, the tool creates a warning."
                        why="Privacy assessment depends on documentation and context. User input makes the risk review more transparent."
                    />
                    <MethodExplanation
                        title="Potential Personal Column Detection"
                        computes="Column names that may indicate personal data, such as names, contact fields, patient-related fields, or person-related identifiers."
                        how="The tool splits column names into normalized tokens and compares them with predefined privacy-related keywords. Generic business-process terms such as customer or resource are only flagged when combined with identifier terms such as id, number, or nbr."
                        why="This heuristic can catch obvious privacy signals early, while still requiring human confirmation."
                    />
                </div>

                <h4>Observed Results</h4>
                <div className="metric-grid">
                    <MetricTile
                        label="User indicated personal data"
                        value={result.privacy_analysis?.user_indicated_personal_data ? "Yes" : "No"}
                        status={result.privacy_analysis?.user_indicated_personal_data ? "warning" : "neutral"}
                        helper="A declared personal-data dataset should include privacy notes and safeguards for human review."
                    />
                    <MetricTile
                        label="Detected personal columns"
                        value={detectedColumns.length ? detectedColumns.length : "None"}
                        status={detectedColumns.length ? "warning" : "neutral"}
                        helper="Token-based column-name detection for names, contact fields, patient-related fields, and person-related identifiers such as patient_nbr or customer_id."
                    />
                </div>

                {detectedColumns.length > 0 && (
                    <>
                        <h4>Detected Columns</h4>
                        <p>{detectedColumns.join(", ")}</p>
                    </>
                )}

                <h4>Warnings</h4>
                {renderWarnings(warnings)}
            </div>

            <div className="nav-actions">
                <button className="button-secondary" type="button" onClick={onBack}>Back</button>
                <button type="button" onClick={onContinue}>View Summary</button>
            </div>
        </div>
    );
}

export default PrivacyPage;
