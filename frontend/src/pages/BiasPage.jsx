import { AssessmentHeader, MethodExplanation, MetricTile } from "../components";
import { renderWarnings } from "../utils";
import { CategoricalChart, FeatureDistributions } from "../Charts";

function BiasPage({ result, onContinue, onBack }) {
    const warnings = result.bias_analysis?.warnings || [];
    const imbalanceRatio = result.bias_analysis?.imbalance_ratio;

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
                    Expand a method to see what the signal means and why it is treated as an early review item.
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
                        how="The tool shows category frequencies for target and categorical features, and shows min, mean, max and sampled value patterns for numeric features. Identifier and date-like columns are skipped."
                        why="Distribution views help users notice dominant categories, skewed values, or sampling patterns that require contextual judgement."
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

                <h4>
                    Class Distribution
                </h4>
                {result.bias_analysis?.class_distribution &&
                    Object.keys(result.bias_analysis.class_distribution).length > 0
                    ? <CategoricalChart
                        featureName="Class Distribution"
                        featureData={{ type: "categorical", values: result.bias_analysis.class_distribution }}
                    />
                    : <p>Not available</p>
                }

                <h4>
                    Feature Distribution Summary
                </h4>
                <p className="section-copy">
                    Skewed or dominated feature distributions can point to sampling problems that deserve human review.
                </p>
                <FeatureDistributions obj={result.bias_analysis?.feature_distribution_summary} />

                <h4>Review Items</h4>
                {renderWarnings(warnings)}
            </div>

            <div className="nav-actions">
                <button className="button-secondary" type="button" onClick={onBack}>Back</button>
                <button type="button" onClick={onContinue}>Continue</button>
            </div>
        </div>
    );
}

export default BiasPage;
