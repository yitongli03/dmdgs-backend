import { AssessmentHeader, MethodExplanation, MetricTile, StatusBadge } from "../components";
import { renderWarnings } from "../utils";
import { CategoricalChart, FeatureDistributions } from "../Charts";
import { EVENT_LOG_FEATURES, isTargetActivityColumn } from "../eventLogUtils";

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
        other: [],
    };

    warnings.forEach((warning) => {
        const normalized = String(warning).toLowerCase();

        if (includesAny(normalized, ["transition"])) {
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

    return (
        <div>
            <h2>Bias Awareness</h2>
            <p><strong>Dataset:</strong> {result.metadata?.dataset_name || result.dataset_id}</p>

            <div className="card">
                <AssessmentHeader
                    title="Bias Awareness"
                    warnings={warnings}
                >
                    Highlights dataset-level imbalance and distribution patterns that may indicate representativeness concerns. These are early warning signals, not complete fairness metrics.
                </AssessmentHeader>

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
                {result.bias_analysis?.class_distribution &&
                    Object.keys(result.bias_analysis.class_distribution).length > 0
                    ? <CategoricalChart
                        featureName="Class Distribution"
                        featureData={{ type: "categorical", values: result.bias_analysis.class_distribution }}
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
                                    featureName="Process variants"
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
