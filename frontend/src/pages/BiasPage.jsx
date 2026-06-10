import { ArticleReference, AssessmentHeader, MethodExplanation, MetricTile, StatusBadge } from "../components";
import { renderWarnings } from "../utils";
import { CategoricalChart, FeatureDistributions } from "../Charts";
import { EVENT_LOG_FEATURES, isTargetActivityColumn } from "../eventLogUtils";
import { ARTICLE_10_REFERENCES } from "../article10References";

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

    return `${new Date(window.start).toLocaleDateString()} - ${new Date(window.end).toLocaleDateString()}`;
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

function ChangesTable({ changes = [], itemLabel = "Item", helper }) {
    if (!changes.length) {
        return null;
    }

    return (
        <div className="change-table-wrap">
            {helper && <p className="change-table-helper">{helper}</p>}
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
        </div>
    );
}

function DriftSignalsSummary({ driftSignals }) {
    const activityShift = driftSignals.activity_shift || {};
    const variantShift = driftSignals.variant_shift || {};
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

    return (
        <>
            <div className="metric-grid">
                <MetricTile
                    label="Early cases"
                    value={driftSignals.early_window?.case_count ?? "Not available"}
                    helper={formatWindowRange(driftSignals.early_window)}
                />
                <MetricTile
                    label="Late cases"
                    value={driftSignals.late_window?.case_count ?? "Not available"}
                    helper={formatWindowRange(driftSignals.late_window)}
                />
                <MetricTile
                    label="Activity shift score"
                    value={formatShiftScore(activityShift.score)}
                    helper="Total variation distance between early and late activity distributions. 0 means identical distributions."
                    status={activityShift.score > 0.3 ? "warning" : "neutral"}
                />
                <MetricTile
                    label="Variant shift score"
                    value={formatShiftScore(variantShift.score)}
                    helper="Total variation distance between early and late process variant distributions. 0 means identical distributions."
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
                Higher shift scores indicate stronger distribution changes between the early and late period.
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
                    helper="The following table lists the 5 activities with the largest absolute frequency changes between the early and late period."
                />
                <div className="two-column-detail">
                    <CompactList
                        label="New activities in late window"
                        values={activityShift.new_late}
                    />
                    <CompactList
                        label="Disappearing activities in late window"
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
                    helper="The following table lists the 5 process variants with the largest absolute frequency changes between the early and late period."
                />
                <div className="two-column-detail">
                    <CompactList
                        label="New variants in late window"
                        values={variantShift.new_late}
                    />
                    <CompactList
                        label="Disappearing variants in late window"
                        values={variantShift.disappearing_late}
                    />
                </div>
            </div>
        </>
    );
}

function BiasPage({ result, onContinue, onBack }) {
    const warnings = result.bias_analysis?.warnings || [];
    const warningGroups = getBiasWarningGroups(warnings);
    const imbalanceRatio = result.bias_analysis?.imbalance_ratio;
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
                        computes="Case duration statistics, activity frequencies, common transitions, and process variants when event-log columns are detected."
                        how="The tool groups events by case, orders them by timestamp where possible, then summarizes durations, activity patterns, direct transitions, and ordered process paths."
                        why="These signals support human review of temporal structure, dominant paths, rare behaviour, and unusual process patterns."
                    />
                </div>

                <h4>Computed Results</h4>
                <div className="metric-grid">
                    <MetricTile
                        label="Imbalance ratio"
                        value={imbalanceRatio ?? "Not applicable"}
                        status={imbalanceRatio > 2 ? "warning" : "neutral"}
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
                                        label="Maximum duration"
                                        value={durationSummary.max_duration}
                                    />
                                </div>
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
                                            label="Rare variants"
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
                                    Compares early and late time periods split at the midpoint of the case-start timeline. These are distribution-change signals, not formal drift detection.
                                </p>
                                <DriftSignalsSummary driftSignals={driftSignals} />
                                <RelatedWarnings warnings={warningGroups.drift} />
                            </EventLogSignalDetail>
                        )}

                        {!driftSignals && (
                            <RelatedWarnings
                                warnings={warningGroups.drift}
                                title="Drift-oriented warnings"
                            />
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
