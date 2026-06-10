import { ArticleReference, MetricTile, StatusBadge } from "../components";
import { formatNumber, renderWarnings, renderFlagStatus, renderBooleanMap, getWarningCount } from "../utils";
import { CategoricalChart, FeatureDistributions } from "../Charts";
import { EVENT_LOG_FEATURES, detectEventLogColumns, isTargetActivityColumn } from "../eventLogUtils";
import { ARTICLE_10_REFERENCES } from "../article10References";

const SUITABILITY_CONTEXT_PATTERNS = [
    "missing intended use information",
    "missing deployment context information",
];

const SUITABILITY_TARGET_PATTERNS = [
    "no target column provided",
    "not found in dataset",
];

const SUITABILITY_TASK_PATTERNS = [
    "unique values",
    "not numeric",
    "unknown task type",
];

const SUITABILITY_EVENT_LOG_PATTERNS = [
    "event-log-oriented",
    "remaining-time-oriented",
    "next-activity-oriented",
];

const EVENT_LOG_WARNING_PATTERNS = [
    "activity",
    "activities",
    "transition",
    "variant",
    "event-log",
    "process",
    "timestamp",
    "sequence",
    "duration",
    "durations",
    "drift",
    "window",
    "windows",
    "cases",
];

function includesAny(value, patterns) {
    const normalized = String(value).toLowerCase();
    return patterns.some((pattern) => normalized.includes(pattern));
}

function getBiasWarningGroups(warnings = []) {
    const groups = {
        classDistribution: [],
        featureDistribution: [],
        eventLogReliability: [],
        duration: [],
        activity: [],
        transitions: [],
        variants: [],
        drift: [],
        other: [],
    };

    warnings.forEach((warning) => {
        const normalized = String(warning).toLowerCase();

        if (includesAny(normalized, ["early", "late", "time window", "time windows", "drift"])) {
            groups.drift.push(warning);
        } else if (includesAny(normalized, ["transition"])) {
            groups.transitions.push(warning);
        } else if (includesAny(normalized, ["variant"])) {
            groups.variants.push(warning);
        } else if (includesAny(normalized, ["duration", "durations", "one event", "95th percentile"])) {
            groups.duration.push(warning);
        } else if (includesAny(normalized, ["timestamp", "sequence", "row order"])) {
            groups.eventLogReliability.push(warning);
        } else if (includesAny(normalized, ["activity", "activities"])) {
            groups.activity.push(warning);
        } else if (includesAny(normalized, ["class", "imbalance ratio", "imbalance"])) {
            groups.classDistribution.push(warning);
        } else if (includesAny(normalized, ["feature", "distribution", "skewed", "dominated"])) {
            groups.featureDistribution.push(warning);
        } else if (includesAny(normalized, EVENT_LOG_WARNING_PATTERNS)) {
            groups.eventLogReliability.push(warning);
        } else {
            groups.other.push(warning);
        }
    });

    return groups;
}

function WarningSection({ warnings }) {
    return (
        <>
            <h4>Warnings</h4>
            {renderWarnings(warnings || [])}
        </>
    );
}

function countMatchingWarnings(warnings = [], patterns = []) {
    return warnings.filter((warning) => includesAny(warning, patterns)).length;
}

function SuitabilityStatusRow({ label, isOk, okLabel = "OK", warningLabel = "Needs review" }) {
    return (
        <li>
            <strong>{label}:</strong>{" "}
            <StatusBadge status={isOk ? "ok" : "warning"} label={isOk ? okLabel : warningLabel} />
        </li>
    );
}

function SuitabilitySummarySection({ result }) {
    const warnings = result.suitability_analysis?.warnings || [];
    const columns = result.schema_info?.columns || result.schema_info?.column_names || [];
    const detectedEventLogColumns = detectEventLogColumns(columns);
    const eventLogWarningCount = countMatchingWarnings(warnings, SUITABILITY_EVENT_LOG_PATTERNS);
    const hasEventLogContext = Boolean(
        detectedEventLogColumns.caseId
        || detectedEventLogColumns.activity
        || detectedEventLogColumns.timestamp
        || eventLogWarningCount
    );
    const hasMinimumEventLogStructure = Boolean(
        detectedEventLogColumns.caseId
        && detectedEventLogColumns.activity
        && detectedEventLogColumns.timestamp
    );

    const contextWarningCount = countMatchingWarnings(warnings, SUITABILITY_CONTEXT_PATTERNS);
    const targetWarningCount = countMatchingWarnings(warnings, SUITABILITY_TARGET_PATTERNS);
    const taskWarningCount = countMatchingWarnings(warnings, SUITABILITY_TASK_PATTERNS);

    return (
        <>
            <ul className="check-list">
                <SuitabilityStatusRow
                    label="Context metadata"
                    isOk={contextWarningCount === 0}
                    warningLabel={`${contextWarningCount} warning${contextWarningCount === 1 ? "" : "s"}`}
                />
                <SuitabilityStatusRow
                    label="Target validation"
                    isOk={targetWarningCount === 0}
                    warningLabel={`${targetWarningCount} warning${targetWarningCount === 1 ? "" : "s"}`}
                />
                <SuitabilityStatusRow
                    label="Task-type plausibility"
                    isOk={taskWarningCount === 0}
                    warningLabel={`${taskWarningCount} warning${taskWarningCount === 1 ? "" : "s"}`}
                />
                {hasEventLogContext && (
                    <SuitabilityStatusRow
                        label="Minimum event-log structure"
                        isOk={hasMinimumEventLogStructure && eventLogWarningCount === 0}
                        okLabel="Complete"
                        warningLabel={hasMinimumEventLogStructure ? `${eventLogWarningCount} warning${eventLogWarningCount === 1 ? "" : "s"}` : "Incomplete"}
                    />
                )}
            </ul>
            <WarningSection warnings={warnings} />
        </>
    );
}

function formatShiftScore(score) {
    if (score === null || score === undefined) {
        return "Not available";
    }

    return Number(score).toFixed(3);
}

function RelatedWarnings({ warnings, title = "Related warnings" }) {
    if (!warnings?.length) {
        return null;
    }

    return (
        <div className="related-warnings">
            <p><strong>{title}</strong></p>
            {renderWarnings(warnings)}
        </div>
    );
}

function SummaryDetail({ title, warnings = [], children }) {
    return (
        <details className={`feature-detail ${warnings.length ? "feature-detail-warning" : ""}`}>
            <summary>
                <span>{title}</span>
                {warnings.length > 0 && (
                    <StatusBadge
                        status="warning"
                        label={`${warnings.length} warning${warnings.length === 1 ? "" : "s"}`}
                    />
                )}
            </summary>
            <div style={{ marginTop: "15px" }}>
                {children}
            </div>
        </details>
    );
}

function EventLogSummarySection({ eventLogSummary, warningGroups }) {
    const durationSummary = eventLogSummary["Event-log case duration summary"];
    const processVariants = eventLogSummary["Event-log process variants"];
    const driftSignals = eventLogSummary["Event-log drift-oriented signals"];
    const hasEventLogSignals = Object.keys(eventLogSummary).length > 0;

    if (!hasEventLogSignals) {
        return <p>No event-log structure detected for this dataset.</p>;
    }

    return (
        <div>
            {durationSummary && (
                <SummaryDetail title="Case Duration Summary" warnings={warningGroups.duration}>
                        <div className="metric-grid">
                            <MetricTile label="Cases with duration" value={durationSummary.total_cases} />
                            <MetricTile label="Minimum duration" value={durationSummary.min_duration} />
                            <MetricTile label="Mean duration" value={durationSummary.mean_duration} />
                            <MetricTile label="Median duration" value={durationSummary.median_duration} />
                            <MetricTile label="Maximum duration" value={durationSummary.max_duration} />
                        </div>
                        <RelatedWarnings warnings={warningGroups.duration} />
                </SummaryDetail>
            )}

            {!durationSummary && (
                <RelatedWarnings warnings={warningGroups.duration} title="Duration-related warnings" />
            )}

            {eventLogSummary["Event-log activity distribution"] && (
                <SummaryDetail title="Activity Distribution" warnings={warningGroups.activity}>
                        <CategoricalChart
                            featureName="Event-log activity distribution"
                            featureData={eventLogSummary["Event-log activity distribution"]}
                        />
                        <RelatedWarnings warnings={warningGroups.activity} />
                </SummaryDetail>
            )}

            {!eventLogSummary["Event-log activity distribution"] && (
                <RelatedWarnings warnings={warningGroups.activity} title="Activity-related warnings" />
            )}

            {eventLogSummary["Event-log top activity transitions"] && (
                <SummaryDetail title="Top Activity Transitions" warnings={warningGroups.transitions}>
                        <CategoricalChart
                            featureName="Top activity transitions"
                            featureData={eventLogSummary["Event-log top activity transitions"]}
                        />
                        <RelatedWarnings warnings={warningGroups.transitions} />
                </SummaryDetail>
            )}

            {!eventLogSummary["Event-log top activity transitions"] && (
                <RelatedWarnings warnings={warningGroups.transitions} title="Transition-related warnings" />
            )}

            {processVariants && (
                <SummaryDetail title="Process Variants" warnings={warningGroups.variants}>
                        <div className="metric-grid">
                            {processVariants.total_cases !== undefined && (
                                <MetricTile label="Total cases" value={processVariants.total_cases} />
                            )}
                            {processVariants.total_variants !== undefined && (
                                <MetricTile label="Total variants" value={processVariants.total_variants} />
                            )}
                            {processVariants.rare_variant_count !== undefined && (
                                <MetricTile label="Rare variants" value={processVariants.rare_variant_count} />
                            )}
                        </div>
                        <CategoricalChart
                            featureName="Top process variants"
                            featureData={processVariants}
                        />
                        <RelatedWarnings warnings={warningGroups.variants} />
                </SummaryDetail>
            )}

            {!processVariants && (
                <RelatedWarnings warnings={warningGroups.variants} title="Variant-related warnings" />
            )}

            {driftSignals && (
                <SummaryDetail title="Drift-Oriented Signals" warnings={warningGroups.drift}>
                        <div className="metric-grid">
                            <MetricTile label="Early cases" value={driftSignals.early_window?.case_count ?? "Not available"} />
                            <MetricTile label="Late cases" value={driftSignals.late_window?.case_count ?? "Not available"} />
                            <MetricTile
                                label="Activity shift score"
                                value={formatShiftScore(driftSignals.activity_shift?.score)}
                                helper="0 means no activity distribution change; higher values indicate stronger changes."
                            />
                            <MetricTile
                                label="Variant shift score"
                                value={formatShiftScore(driftSignals.variant_shift?.score)}
                                helper="0 means no process-variant distribution change; higher values indicate stronger changes."
                            />
                            <MetricTile label="Early variants" value={driftSignals.variant_shift?.early_variant_count ?? "Not available"} />
                            <MetricTile label="Late variants" value={driftSignals.variant_shift?.late_variant_count ?? "Not available"} />
                        </div>
                        <p className="section-copy">
                            Shift scores range from 0 to 1 and compare early and late time windows. They are distribution-change signals, not formal drift detection.
                        </p>
                        <RelatedWarnings warnings={warningGroups.drift} />
                </SummaryDetail>
            )}

            {!driftSignals && (
                <RelatedWarnings warnings={warningGroups.drift} title="Drift-oriented warnings" />
            )}
        </div>
    );
}

function SummaryPage({ result, onBack, goHome }) {
    const warningCount = getWarningCount(result);
    const featureDistributionSummary = result.bias_analysis?.feature_distribution_summary || {};
    const hideDuplicateActivityDistribution = isTargetActivityColumn(result);
    const eventLogSummary = Object.fromEntries(
        EVENT_LOG_FEATURES
            .filter((key) => featureDistributionSummary[key])
            .filter((key) => !(hideDuplicateActivityDistribution && key === "Event-log activity distribution"))
            .map((key) => [key, featureDistributionSummary[key]])
    );
    const regularFeatureSummary = Object.fromEntries(
        Object.entries(featureDistributionSummary)
            .filter(([key]) => !EVENT_LOG_FEATURES.includes(key))
    );
    const classDistribution = result.bias_analysis?.class_distribution || {};
    const biasWarningGroups = getBiasWarningGroups(result.bias_analysis?.warnings || []);

    return (
        <div>
            <div className="report-title-row">
                <div>
                    <h2>Full Governance Report</h2>
                    <p><strong>Dataset ID:</strong> {result.dataset_id}</p>
                </div>
                <button type="button" onClick={() => window.print()}>
                    Print / Save PDF
                </button>
            </div>

            <div className="card">
                <div className="summary-top">
                    <div>
                        <p className="eyebrow">Assessment Summary</p>
                        <h3>{warningCount === 0 ? "No Warnings" : `${warningCount} Warning${warningCount === 1 ? "" : "s"}`}</h3>
                        <p className="section-copy">
                            Consolidates metadata, indicators, visualizations, and warnings for review.
                        </p>
                    </div>
                    <StatusBadge status={warningCount ? "warning" : "ok"} label={warningCount ? "Needs review" : "OK"} />
                </div>
                <ArticleReference {...ARTICLE_10_REFERENCES.summary} />

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
                <SuitabilitySummarySection result={result} />
            </div>

            <div className="card">
                <h3>Bias Awareness</h3>
                <p>
                    <strong>Imbalance Ratio:</strong>{" "}
                    {result.bias_analysis?.imbalance_ratio ?? "Not applicable"}
                </p>
                <h4>Class Distribution</h4>
                {Object.keys(classDistribution).length > 0
                    ? <CategoricalChart
                        featureName="Class Distribution"
                        featureData={{ type: "categorical", values: classDistribution }}
                        showTitle={false}
                    />
                    : <p>Not available</p>
                }
                <RelatedWarnings warnings={biasWarningGroups.classDistribution} />
                <h4>Feature Distribution Summary</h4>
                <FeatureDistributions obj={regularFeatureSummary} showIntro={false} />
                <RelatedWarnings warnings={biasWarningGroups.featureDistribution} />
                <h4>Event-log Signals</h4>
                <RelatedWarnings warnings={biasWarningGroups.eventLogReliability} />
                <EventLogSummarySection eventLogSummary={eventLogSummary} warningGroups={biasWarningGroups} />
                <RelatedWarnings warnings={biasWarningGroups.other} />
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
