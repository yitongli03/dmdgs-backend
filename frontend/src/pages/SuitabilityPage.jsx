import { AssessmentHeader, MethodExplanation, StatusBadge } from "../components";

const CONTEXT_PATTERNS = [
    "Missing intended use information",
    "Missing deployment context information",
];

const TARGET_PATTERNS = [
    "No target column provided",
    "not found in dataset",
];

const CONSISTENCY_PATTERNS = [
    "unique values",
    "not numeric",
    "Unknown task type",
];

function matchesAny(warning, patterns) {
    return patterns.some((p) => warning.includes(p));
}

function CheckGroup({ title, description, warnings }) {
    const matched = warnings.filter((w) => matchesAny(w, description));
    return (
        <div className="check-group">
            <p><strong>{title}</strong></p>
            {matched.length === 0 ? (
                <StatusBadge status="ok" label="No issues detected" />
            ) : (
                <ul className="warning-list">
                    {matched.map((w, i) => (
                        <li key={i}>{w}</li>
                    ))}
                </ul>
            )}
        </div>
    );
}

function SuitabilityPage({ result, onContinue, onBack }) {
    const warnings = result.suitability_analysis?.warnings || [];

    return (
        <div>
            <h2>Suitability &amp; Contextual Alignment</h2>
            <p><strong>Dataset:</strong> {result.metadata?.dataset_name || result.dataset_id}</p>

            <div className="card">
                <AssessmentHeader
                    title="Suitability & Contextual Alignment"
                    warnings={warnings}
                >
                    Evaluates whether the dataset appears appropriate for its declared use context. The checks are derived from the thesis focus on contextual alignment, not from a fixed external scoring formula.
                </AssessmentHeader>

                <h4>Evaluation Methods</h4>
                <p className="section-copy">
                    Expand a method to see how the check is derived and interpreted.
                </p>
                <div className="method-grid">
                    <MethodExplanation
                        title="Contextual Metadata Completeness"
                        computes="Whether intended use and deployment context have been provided."
                        how="The tool checks whether these fields are empty and creates review items when context is missing."
                        why="Suitability cannot be assessed from the data alone. The same dataset may be acceptable in one context and inappropriate in another."
                    />
                    <MethodExplanation
                        title="Target Column Validation"
                        computes="Whether the declared target column exists for supervised tasks."
                        how="For classification and regression tasks, the tool checks that a target column is provided and matches a column in the dataset."
                        why="If the target is missing or incorrectly named, the dataset cannot support the declared supervised learning task as described."
                    />
                    <MethodExplanation
                        title="Task-Type Plausibility"
                        computes="Basic consistency between the declared task type and the target column."
                        how="For classification, many unique target values are flagged. For regression, a non-numeric target is flagged."
                        why="These checks catch common mismatches between dataset structure and intended modelling task before deeper analysis."
                    />
                </div>

                <CheckGroup
                    title="Contextual Metadata Completeness"
                    description={CONTEXT_PATTERNS}
                    warnings={warnings}
                />

                <CheckGroup
                    title="Target Column Validation"
                    description={TARGET_PATTERNS}
                    warnings={warnings}
                />

                <CheckGroup
                    title="Task-Type Consistency &amp; Target Variable Plausibility"
                    description={CONSISTENCY_PATTERNS}
                    warnings={warnings}
                />
            </div>

            <div className="nav-actions">
                <button className="button-secondary" type="button" onClick={onBack}>Back</button>
                <button type="button" onClick={onContinue}>Continue</button>
            </div>
        </div>
    );
}

export default SuitabilityPage;
