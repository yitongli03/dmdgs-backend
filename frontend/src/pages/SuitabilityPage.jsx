import { AssessmentHeader, MethodExplanation, StatusBadge } from "../components";
import { detectEventLogColumns } from "../eventLogUtils";

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

const EVENT_LOG_WARNING_PATTERNS = [
    "Event-log-oriented",
    "Remaining-time-oriented",
    "Next-activity-oriented",
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
                <StatusBadge status="ok" label="No warnings" />
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

function EventLogStructureSummary({ result, warnings }) {
    const columns = result.schema_info?.columns || result.schema_info?.column_names || [];
    const detected = detectEventLogColumns(columns);
    const eventLogWarnings = warnings.filter((w) => matchesAny(w, EVENT_LOG_WARNING_PATTERNS));
    const hasDetectedStructure = detected.caseId || detected.activity || detected.timestamp;
    const hasEventLogContext = hasDetectedStructure || eventLogWarnings.length > 0;
    const hasMinimumEventLogStructure = detected.caseId && detected.activity && detected.timestamp;

    if (!hasEventLogContext) {
        return null;
    }

    const statusItems = [
        ["Case ID detected", Boolean(detected.caseId)],
        ["Activity column detected", Boolean(detected.activity)],
        ["Timestamp column detected", Boolean(detected.timestamp)],
        ["Overall structure", hasMinimumEventLogStructure],
    ];

    return (
        <div className="check-group">
            <p><strong>Minimum Event-log Structure</strong></p>
            <ul className="check-list">
                {statusItems.map(([label, value]) => (
                    <li key={label}>
                        <strong>{label}:</strong>{" "}
                        <StatusBadge
                            status={value ? "ok" : "warning"}
                            label={label === "Overall structure"
                                ? (value ? "Complete" : "Incomplete")
                                : (value ? "Yes" : "Missing")}
                        />
                    </li>
                ))}
            </ul>
            {eventLogWarnings.length > 0 && (
                <ul className="warning-list">
                    {eventLogWarnings.map((warning, index) => (
                        <li key={`${warning}-${index}`}>{warning}</li>
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
                        how="The tool checks whether these fields are empty and creates warnings when context is missing."
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
                        how="For classification, target columns with more than 20 unique values are flagged. For regression, a non-numeric target is flagged."
                        why="These checks catch common mismatches between dataset structure and intended modelling task before deeper analysis."
                    />
                    <MethodExplanation
                        title="Minimum Event-log Structure Check"
                        computes="Whether likely case ID, activity, and timestamp columns are present for process-oriented analysis."
                        how="The tool detects common event-log column names and checks whether the structural columns needed for event-log, remaining-time, or next-activity use cases are available."
                        why="Process-oriented analysis depends on ordered events within cases. Missing case, activity, or timestamp information limits whether the dataset can be reviewed as an event log."
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

                <EventLogStructureSummary result={result} warnings={warnings} />
            </div>

            <div className="nav-actions">
                <button className="button-secondary" type="button" onClick={onBack}>Back</button>
                <button type="button" onClick={onContinue}>Continue</button>
            </div>
        </div>
    );
}

export default SuitabilityPage;
