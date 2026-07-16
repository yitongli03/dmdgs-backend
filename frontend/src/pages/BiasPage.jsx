import { useMemo, useState } from "react";
import axios from "axios";
import { ArticleReference, AssessmentHeader, MethodExplanation, MetricTile, StatusBadge } from "../components";
import { renderWarnings } from "../utils";
import { CategoricalChart, DurationDistributionChart, FeatureDistributions } from "../Charts";
import { isTargetActivityColumn } from "../eventLogUtils";
import { ARTICLE_10_REFERENCES } from "../article10References";

const API_URL = "http://localhost:5002";

const DISTINCT_COLORS = [
    "#2563eb", "#dc2626", "#16a34a", "#9333ea",
    "#ea580c", "#0891b2", "#ca8a04", "#be123c",
    "#4f46e5", "#0f766e", "#7c2d12", "#7e22ce",
    "#0369a1", "#65a30d", "#c2410c", "#475569",
    "#db2777", "#15803d", "#1d4ed8", "#854d0e",
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

function getBiasWarningGroups(warnings) {
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
        } else if (includesAny(normalized, ["timestamp", "sequence", "row order"])) {
            groups.eventLogReliability.push(warning);
        } else if (includesAny(normalized, ["duration", "durations", "one event", "95th percentile"])) {
            groups.duration.push(warning);
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

function EventLogSignalDetail({ title, children, warnings = [] }) {
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

function formatShiftScore(score) {
    if (score === null || score === undefined) {
        return "Not available";
    }

    return Number(score).toFixed(3);
}

function formatWindowRange(window) {
    if (!window?.start || !window?.end) {
        return "Not available";
    }

    return `${formatDateTime(window.start)} - ${formatDateTime(window.end)}`;
}

function formatDateTime(value) {
    if (!value) {
        return "Not available";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleString();
}

function getTimestampMs(value) {
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? timestamp : null;
}

function CompactList({ label, values = [] }) {
    if (!values.length) {
        return null;
    }

    return (
        <div className="compact-list">
            <p><strong>{label}</strong></p>
            <ul>
                {values.slice(0, 5).map((value) => (
                    <li key={value}>{value}</li>
                ))}
            </ul>
        </div>
    );
}

function distributionToChartData(distribution = {}) {
    return {
        type: "categorical",
        values: distribution,
    };
}

function createCategoricalColorMap(labels = []) {
    const uniqueLabels = [...new Set(labels.map(String))].sort();

    return Object.fromEntries(
        uniqueLabels.map((label, index) => [
            label,
            DISTINCT_COLORS[index % DISTINCT_COLORS.length],
        ])
    );
}

function ChangesTable({ changes = [], itemLabel = "Item", helper, emptyText }) {
    return (
        <div className={`change-table-wrap ${changes.length ? "" : "change-table-wrap-empty"}`}>
            {helper && changes.length > 0 && <p className="change-table-helper">{helper}</p>}
            {!changes.length ? (
                <p className="section-copy">
                    {emptyText || "No changes above the reporting threshold were found."}
                </p>
            ) : (
            <table className="change-table">
                <thead>
                    <tr>
                        <th>{itemLabel}</th>
                        <th>Early</th>
                        <th>Late</th>
                        <th>Change</th>
                    </tr>
                </thead>
                <tbody>
                    {changes.slice(0, 5).map((change) => (
                        <tr key={change.label}>
                            <td>{change.label}</td>
                            <td>{Number(change.early_frequency).toFixed(3)}</td>
                            <td>{Number(change.late_frequency).toFixed(3)}</td>
                            <td>
                                {change.direction === "increased" ? "+" : "-"}
                                {Number(change.absolute_change).toFixed(3)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            )}
        </div>
    );
}

function DriftSignalsSummary({ driftSignals, datasetId, onPreviewWarningsChange }) {
    const [activeDriftSignals, setActiveDriftSignals] = useState(driftSignals);
    const [pendingSplitMs, setPendingSplitMs] = useState(() => getTimestampMs(driftSignals?.split_timestamp));
    const [isUpdatingSplit, setIsUpdatingSplit] = useState(false);
    const [splitError, setSplitError] = useState("");

    const timeRange = useMemo(() => {
        const start = activeDriftSignals.time_range?.start || activeDriftSignals.early_window?.start;
        const end = activeDriftSignals.time_range?.end || activeDriftSignals.late_window?.end;
        const startMs = getTimestampMs(start);
        const endMs = getTimestampMs(end);

        if (startMs === null || endMs === null || startMs >= endMs) {
            return null;
        }

        return {
            start,
            end,
            startMs,
            endMs,
            step: Math.max(1, Math.floor((endMs - startMs) / 1000)),
        };
    }, [activeDriftSignals]);

    const activityShift = activeDriftSignals.activity_shift || {};
    const variantShift = activeDriftSignals.variant_shift || {};
    const earlyActivityChart = distributionToChartData(activityShift.early_distribution);
    const lateActivityChart = distributionToChartData(activityShift.late_distribution);
    const earlyVariantChart = distributionToChartData(variantShift.early_distribution);
    const lateVariantChart = distributionToChartData(variantShift.late_distribution);
    const activityColorMap = createCategoricalColorMap([
        ...Object.keys(earlyActivityChart.values),
        ...Object.keys(lateActivityChart.values),
    ]);
    const variantColorMap = createCategoricalColorMap([
        ...Object.keys(earlyVariantChart.values),
        ...Object.keys(lateVariantChart.values),
    ]);
    const canAdjustSplit = Boolean(datasetId && timeRange);
    const selectedSplitMs = pendingSplitMs ?? getTimestampMs(activeDriftSignals.split_timestamp) ?? timeRange?.startMs;
    const selectedSplitLabel = selectedSplitMs ? formatDateTime(new Date(selectedSplitMs).toISOString()) : "Not available";
    const splitAtBoundary = Boolean(
        timeRange && selectedSplitMs !== null && (selectedSplitMs <= timeRange.startMs || selectedSplitMs >= timeRange.endMs)
    );

    const handleApplySplit = async () => {
        if (!canAdjustSplit || selectedSplitMs === null || splitAtBoundary) {
            return;
        }

        setIsUpdatingSplit(true);
        setSplitError("");

        try {
            const response = await axios.post(
                `${API_URL}/datasets/${datasetId}/event-log-drift-preview`,
                { split_timestamp: new Date(selectedSplitMs).toISOString() },
            );
            setActiveDriftSignals(response.data.drift_signals);
            setPendingSplitMs(getTimestampMs(response.data.drift_signals.split_timestamp));
            onPreviewWarningsChange(response.data.warnings || []);
        } catch (error) {
            setSplitError(error.response?.data?.detail || "Could not recompute drift-oriented signals for this split point.");
        } finally {
            setIsUpdatingSplit(false);
        }
    };

    const handleResetSplit = () => {
        setActiveDriftSignals(driftSignals);
        setPendingSplitMs(getTimestampMs(driftSignals?.split_timestamp));
        setSplitError("");
        onPreviewWarningsChange(null);
    };

    return (
        <>
            {canAdjustSplit && (
                <div className="split-control">
                    <div>
                        <strong>Time-window split</strong>
                        <p className="section-copy">
                            Move the split point to preview early/late distribution changes for a different time period. The stored report is not overwritten.
                        </p>
                    </div>
                    <input
                        type="range"
                        min={timeRange.startMs}
                        max={timeRange.endMs}
                        step={timeRange.step}
                        value={selectedSplitMs}
                        onChange={(event) => setPendingSplitMs(Number(event.target.value))}
                    />
                    <div className="split-label-row">
                        <span>{formatDateTime(timeRange.start)}</span>
                        <span><strong>Split:</strong> {selectedSplitLabel}</span>
                        <span>{formatDateTime(timeRange.end)}</span>
                    </div>
                    <div className="inline-actions">
                        <button
                            type="button"
                            onClick={handleApplySplit}
                            disabled={isUpdatingSplit || splitAtBoundary}
                        >
                            {isUpdatingSplit ? "Applying..." : "Apply split"}
                        </button>
                        <button
                            type="button"
                            className="button-secondary"
                            onClick={handleResetSplit}
                            disabled={isUpdatingSplit}
                        >
                            Reset default
                        </button>
                    </div>
                    {splitAtBoundary && (
                        <p className="form-message error">
                            Choose a split point between the first and last case start time.
                        </p>
                    )}
                    {splitError && <p className="form-message error">{splitError}</p>}
                </div>
            )}

            <div className="metric-grid">
                <MetricTile
                    label="Early cases"
                    value={activeDriftSignals.early_window?.case_count ?? "Not available"}
                    helper={formatWindowRange(activeDriftSignals.early_window)}
                />
                <MetricTile
                    label="Late cases"
                    value={activeDriftSignals.late_window?.case_count ?? "Not available"}
                    helper={formatWindowRange(activeDriftSignals.late_window)}
                />
                <MetricTile
                    label="Activity shift score"
                    value={formatShiftScore(activityShift.score)}
                    helper="Summarizes the overall difference between early and late activity frequency distributions."
                    status={activityShift.score > 0.3 ? "warning" : "neutral"}
                />
                <MetricTile
                    label="Variant shift score"
                    value={formatShiftScore(variantShift.score)}
                    helper="Summarizes the overall difference between early and late process-variant frequencies. Singleton and sub-1% variants are grouped to reduce noise from very rare paths."
                    status={variantShift.score > 0.3 ? "warning" : "neutral"}
                />
                <MetricTile
                    label="Early variants"
                    value={variantShift.early_variant_count ?? "Not available"}
                />
                <MetricTile
                    label="Late variants"
                    value={variantShift.late_variant_count ?? "Not available"}
                />
            </div>
            <p className="section-copy">
                Shift scores range from 0 to 1. A score of 0 means no distribution change, while higher values indicate stronger changes between the early and late time windows.
            </p>

            <div className="drift-review-block">
                <h5>Activity Changes Over Time</h5>
                <p className="section-copy">
                    Compares activity frequencies in the early and late windows. This supports data-drift-oriented review.
                </p>
                <div className="two-column-detail">
                    {Object.keys(earlyActivityChart.values).length > 0 && (
                        <CategoricalChart
                            featureName="Top activity distribution in early time period"
                            featureData={earlyActivityChart}
                            colorMap={activityColorMap}
                        />
                    )}
                    {Object.keys(lateActivityChart.values).length > 0 && (
                        <CategoricalChart
                            featureName="Top activity distribution in late time period"
                            featureData={lateActivityChart}
                            colorMap={activityColorMap}
                        />
                    )}
                </div>
                <ChangesTable
                    changes={activityShift.top_changes}
                    itemLabel="Activity"
                    helper="The following table lists up to 5 activities with the largest absolute frequency changes between the early and late time windows, only including changes of at least 1 percentage point."
                    emptyText="No activity changes of at least 1 percentage point were found."
                />
                <div className="two-column-detail">
                    <CompactList
                        label="New activities in late window (>= 1%)"
                        values={activityShift.new_late}
                    />
                    <CompactList
                        label="Disappearing activities from early window (>= 1%)"
                        values={activityShift.disappearing_late}
                    />
                </div>
            </div>

            <div className="drift-review-block">
                <h5>Process Variant Changes Over Time</h5>
                <p className="section-copy">
                    Compares process-variant frequencies in the early and late windows. This supports concept-drift-oriented review.
                </p>
                <div className="two-column-detail">
                    {Object.keys(earlyVariantChart.values).length > 0 && (
                        <CategoricalChart
                            featureName="Top process variants in early time period"
                            featureData={earlyVariantChart}
                            colorMap={variantColorMap}
                        />
                    )}
                    {Object.keys(lateVariantChart.values).length > 0 && (
                        <CategoricalChart
                            featureName="Top process variants in late time period"
                            featureData={lateVariantChart}
                            colorMap={variantColorMap}
                        />
                    )}
                </div>
                <ChangesTable
                    changes={variantShift.top_changes}
                    itemLabel="Process variant"
                    helper="The following table lists up to 5 process variants with the largest absolute frequency changes between the early and late time windows, only including changes of at least 1 percentage point."
                    emptyText="No process-variant changes of at least 1 percentage point were found."
                />
                <div className="two-column-detail">
                    <CompactList
                        label="New variants in late window (>= 1%)"
                        values={variantShift.new_late}
                    />
                    <CompactList
                        label="Disappearing variants from early window (>= 1%)"
                        values={variantShift.disappearing_late}
                    />
                </div>
            </div>
        </>
    );
}

function BiasPage({ result, onContinue, onBack }) {
    const storedWarnings = result.bias_analysis?.warnings || [];
    const storedWarningGroups = getBiasWarningGroups(storedWarnings);
    const [previewDriftState, setPreviewDriftState] = useState({
        datasetId: null,
        warnings: null,
    });
    const previewDriftWarnings = previewDriftState.datasetId === result.dataset_id
        ? previewDriftState.warnings
        : null;

    const storedDriftWarnings = new Set(storedWarningGroups.drift);
    const warnings = previewDriftWarnings === null
        ? storedWarnings
        : [
            ...storedWarnings.filter((warning) => !storedDriftWarnings.has(warning)),
            ...previewDriftWarnings,
        ];
    const warningGroups = getBiasWarningGroups(warnings);
    const imbalanceRatio = result.bias_analysis?.imbalance_ratio;
    const regularFeatureSummary = result.bias_analysis?.feature_distribution_summary || {};
    const storedEventLogSummary = result.bias_analysis?.event_log_summary || {};
    const hideDuplicateActivityDistribution = isTargetActivityColumn(result);

    const eventLogSummary = hideDuplicateActivityDistribution
        ? Object.fromEntries(
            Object.entries(storedEventLogSummary)
                .filter(([key]) => key !== "Event-log activity distribution")
        )
        : storedEventLogSummary;
    const hasEventLogSignals = Object.keys(eventLogSummary).length > 0;
    const durationSummary = eventLogSummary["Event-log case duration summary"];
    const activityDistribution = eventLogSummary["Event-log activity distribution"];
    const topActivityTransitions = eventLogSummary["Event-log top activity transitions"];
    const processVariants = eventLogSummary["Event-log process variants"];
    const driftSignals = eventLogSummary["Event-log drift-oriented signals"];
    const classDistribution = result.bias_analysis?.class_distribution || {};

    return (
        <div>
            <h2>Bias Awareness</h2>
            <p><strong>Dataset:</strong> {result.metadata?.dataset_name || result.dataset_id}</p>

            <div className="card">
                <AssessmentHeader
                    title="Bias Awareness"
                    warnings={warnings}
                >
                    Highlights imbalance, distribution patterns, and event-log process signals.
                </AssessmentHeader>
                <ArticleReference {...ARTICLE_10_REFERENCES.bias} />

                <h4>Evaluation Methods</h4>
                <p className="section-copy">
                    Expand a method to see what the signal means and why it may produce an early warning.
                </p>
                <div className="method-grid">
                    <MethodExplanation
                        title="Imbalance Ratio"
                        computes="The ratio between the largest and smallest target class frequencies for classification datasets."
                        how="For the selected target column, the tool counts how often each class appears. It then divides the largest class count by the smallest class count and compares the result with the threshold of 2.0."
                        why="Class imbalance can cause some outcomes to be underrepresented, which may affect model behaviour later."
                    />
                    <MethodExplanation
                        title="Class and Feature Distributions"
                        computes="The relative frequency of target classes and summaries of selected dataset features."
                        how="The tool shows category frequencies for the target and selected categorical features, and shows min, mean, max and sampled value patterns for selected numeric features. Identifier and date-like columns are skipped."
                        why="Distribution views help users notice dominant categories, skewed values, or sampling patterns that require contextual judgement."
                    />
                    <MethodExplanation
                        title="Event-log Governance Signals"
                        computes="Case duration statistics, activity frequencies, common transitions, process variants, and drift-oriented distribution-change signals when event-log columns are detected."
                        how="The tool groups events by case, orders them by timestamp where possible, then summarizes durations, activity patterns, direct transitions, ordered process paths, and early/late distribution changes."
                        why="These signals support human review of temporal structure, dominant paths, rare behaviour, unusual process patterns, and changes over time."
                    />
                </div>

                <h4>Computed Results</h4>
                <div className="metric-grid">
                    <MetricTile
                        label="Imbalance ratio"
                        value={imbalanceRatio ?? "Not applicable"}
                        status={imbalanceRatio !== null && imbalanceRatio !== undefined && imbalanceRatio > 2 ? "warning" : "neutral"}
                        helper="For classification: majority class count divided by minority class count. The prototype flags ratios above 2.0."
                    />
                </div>

                <h4>Class Distribution</h4>
                {Object.keys(classDistribution).length > 0
                    ? <CategoricalChart
                        featureName="Class Distribution"
                        featureData={{ type: "categorical", values: classDistribution }}
                        showTitle={false}
                    />
                    : <p>Not available</p>
                }
                <RelatedWarnings warnings={warningGroups.classDistribution} />

                <h4>
                    Feature Distribution Summary
                </h4>
                <FeatureDistributions obj={regularFeatureSummary} />
                <RelatedWarnings warnings={warningGroups.featureDistribution} />

                <h4>Event-log Signals</h4>
                <p className="section-copy" style={{ marginBottom: "12px" }}>
                    Expand a signal to inspect the corresponding event-log distribution.
                    {hideDuplicateActivityDistribution
                        ? " Activity distribution is already represented by the class distribution above."
                        : ""}
                </p>
                {hasEventLogSignals ? (
                    <div>
                        <RelatedWarnings warnings={warningGroups.eventLogReliability} />

                        {durationSummary && (
                            <EventLogSignalDetail
                                title="Case Duration Summary"
                                warnings={warningGroups.duration}
                            >
                                <div className="metric-grid">
                                    <MetricTile
                                        label="Cases with duration"
                                        value={durationSummary.total_cases}
                                        helper="Number of cases with at least two valid timestamped events."
                                    />
                                    <MetricTile
                                        label="Minimum duration"
                                        value={durationSummary.min_duration}
                                    />
                                    <MetricTile
                                        label="Mean duration"
                                        value={durationSummary.mean_duration}
                                    />
                                    <MetricTile
                                        label="Median duration"
                                        value={durationSummary.median_duration}
                                    />
                                    <MetricTile
                                        label="95th percentile"
                                        value={durationSummary.p95_duration}
                                        helper="95% of cases have a duration at or below this value. Cases above it form the upper 5% of the observed duration distribution."
                                    />
                                    <MetricTile
                                        label="Maximum duration"
                                        value={durationSummary.max_duration}
                                    />
                                </div>
                                {durationSummary.duration_distribution && (
                                    <DurationDistributionChart
                                        featureName="Case duration distribution (logarithmic scale)"
                                        featureData={durationSummary.duration_distribution}
                                        markerSeconds={durationSummary.mean_duration_seconds}
                                        medianSeconds={durationSummary.median_duration_seconds}
                                        p95Seconds={durationSummary.p95_duration_seconds}
                                        helperText="Case durations are grouped into logarithmically spaced intervals. The curve shows the number of cases in each interval. Red dashed: mean. Green dashed: median. Orange dashed: 95th percentile. A large gap between mean and median indicates a skewed distribution."
                                    />
                                )}
                                <RelatedWarnings warnings={warningGroups.duration} />
                            </EventLogSignalDetail>
                        )}

                        {!durationSummary && (
                            <RelatedWarnings
                                warnings={warningGroups.duration}
                                title="Duration-related warnings"
                            />
                        )}

                        {activityDistribution && (
                            <EventLogSignalDetail
                                title="Activity Distribution"
                                warnings={warningGroups.activity}
                            >
                                <CategoricalChart
                                    featureName="Event-log activity distribution"
                                    featureData={activityDistribution}
                                />
                                <RelatedWarnings warnings={warningGroups.activity} />
                            </EventLogSignalDetail>
                        )}

                        {!activityDistribution && (
                            <RelatedWarnings
                                warnings={warningGroups.activity}
                                title="Activity-related warnings"
                            />
                        )}

                        {topActivityTransitions && (
                            <EventLogSignalDetail
                                title="Top Activity Transitions"
                                warnings={warningGroups.transitions}
                            >
                                <CategoricalChart
                                    featureName="Top activity transitions"
                                    featureData={topActivityTransitions}
                                />
                                <RelatedWarnings warnings={warningGroups.transitions} />
                            </EventLogSignalDetail>
                        )}

                        {!topActivityTransitions && (
                            <RelatedWarnings
                                warnings={warningGroups.transitions}
                                title="Transition-related warnings"
                            />
                        )}

                        {processVariants && (
                            <EventLogSignalDetail
                                title="Process Variants"
                                warnings={warningGroups.variants}
                            >
                                <div className="metric-grid">
                                    {processVariants.total_cases !== undefined && (
                                        <MetricTile
                                            label="Total cases"
                                            value={processVariants.total_cases}
                                            helper="Number of process instances used to derive the variant summary."
                                        />
                                    )}
                                    {processVariants.total_variants !== undefined && (
                                        <MetricTile
                                            label="Total variants"
                                            value={processVariants.total_variants}
                                            helper="Number of distinct ordered activity sequences found across cases."
                                        />
                                    )}
                                    {processVariants.rare_variant_count !== undefined && (
                                        <MetricTile
                                            label="Singleton variants"
                                            value={processVariants.rare_variant_count}
                                            helper="Number of process variants that occur only once."
                                        />
                                    )}
                                </div>
                                <CategoricalChart
                                    featureName="Top process variants"
                                    featureData={processVariants}
                                />
                                <RelatedWarnings warnings={warningGroups.variants} />
                            </EventLogSignalDetail>
                        )}

                        {!processVariants && (
                            <RelatedWarnings
                                warnings={warningGroups.variants}
                                title="Variant-related warnings"
                            />
                        )}

                        {driftSignals && (
                            <EventLogSignalDetail
                                title="Drift-Oriented Signals"
                                warnings={warningGroups.drift}
                            >
                                <p className="section-copy">
                                    Compares early and late time windows based on case start times. The default split uses the midpoint of the timeline, and the split can be adjusted for review. These are distribution-change signals, not formal drift detection.
                                </p>
                                <DriftSignalsSummary
                                    key={result.dataset_id}
                                    driftSignals={driftSignals}
                                    datasetId={result.dataset_id}
                                    onPreviewWarningsChange={(updatedWarnings) => {
                                        setPreviewDriftState({
                                            datasetId: result.dataset_id,
                                            warnings: updatedWarnings,
                                        });
                                    }}
                                />
                                <RelatedWarnings warnings={warningGroups.drift} />
                            </EventLogSignalDetail>
                        )}

                    </div>
                ) : (
                    <>
                        <p>No event-log structure detected for this dataset.</p>
                        <RelatedWarnings
                            warnings={[
                                ...warningGroups.eventLogReliability,
                                ...warningGroups.duration,
                                ...warningGroups.activity,
                                ...warningGroups.transitions,
                                ...warningGroups.variants,
                                ...warningGroups.drift,
                            ]}
                            title="Event-log warnings"
                        />
                    </>
                )}

                <RelatedWarnings warnings={warningGroups.other} />
            </div>

            <div className="nav-actions">
                <button className="button-secondary" type="button" onClick={onBack}>Back</button>
                <button type="button" onClick={onContinue}>Continue</button>
            </div>
        </div>
    );
}

export default BiasPage;
