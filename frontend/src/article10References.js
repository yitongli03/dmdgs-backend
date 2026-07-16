const COMMON_SCOPE_NOTE = "The prototype supports governance review and documentation. It does not provide an automated legal compliance decision.";

export const ARTICLE_10_REFERENCES = {
    datasetInfo: {
        references: [
            "Article 10(2)(b): data collection processes, data origin, and original collection purpose where personal data are involved.",
            "Article 10(2)(c): relevant data-preparation operations such as cleaning, updating, enrichment, aggregation, annotation, or labelling.",
        ],
        coverage: "This page documents the dataset profile, origin, intended use, preprocessing context, privacy indication, and other metadata. These fields support traceability of where the dataset comes from, why it may be used, and how it has been prepared before governance review.",
        scope: COMMON_SCOPE_NOTE,
    },
    quality: {
        references: [
            "Article 10(2)(e): assessment of the availability, quantity, and suitability of datasets.",
            "Article 10(2)(h): identification of relevant data gaps or shortcomings.",
            "Article 10(3): datasets should be, to the best extent possible, relevant, representative, free of errors, and complete.",
        ],
        coverage: "This perspective computes missing-value ratio, duplicate rate, and metadata completeness. These indicators help reviewers identify possible incompleteness, duplicate records, documentation gaps, or structural shortcomings that may need further investigation.",
        scope: COMMON_SCOPE_NOTE,
    },
    suitability: {
        references: [
            "Article 10(2)(d): formulation of assumptions about what the data are supposed to measure and represent.",
            "Article 10(2)(e): assessment of the availability, quantity, and suitability of datasets.",
            "Article 10(3): datasets should be relevant, representative, complete, and free of errors in view of the intended purpose.",
            "Article 10(4): datasets should take into account the specific geographical, contextual, behavioural, or functional setting of intended use.",
        ],
        coverage: "This perspective compares dataset structure, target-column information, task type, deployment context, and event-log structure with the declared intended use. It supports review of whether the dataset appears structurally compatible with the planned analytical task.",
        scope: COMMON_SCOPE_NOTE,
    },
    bias: {
        references: [
            "Article 10(2)(f): examination of possible biases that may affect health, safety, fundamental rights, or lead to prohibited discrimination.",
            "Article 10(2)(g): appropriate measures to detect, prevent, and mitigate possible biases.",
            "Article 10(3): datasets should have appropriate statistical properties and be sufficiently representative.",
        ],
        coverage: "This perspective provides class imbalance, feature distribution, and event-log process-distribution signals. These outputs help reviewers notice dominant, rare, underrepresented, or changing patterns that may indicate representativeness or bias- and fairness-related concerns.",
        scope: "The outputs are warning signals for human review. They do not constitute a full fairness audit, legal bias assessment, formal process mining, or formal drift detection.",
    },
    privacy: {
        references: [
            "Article 10(2)(b): original collection purpose in the case of personal data.",
            "Article 10(5): processing of special categories of personal data for bias detection and correction under specific safeguards.",
        ],
        coverage: "This perspective combines user-provided privacy information with heuristic detection of potentially personal columns. It helps reviewers identify where privacy documentation, safeguards, or additional legal review may be needed.",
        scope: "The prototype does not determine whether processing is legally permissible. Privacy warnings are governance-support signals and require human/legal review.",
    },
    summary: {
        references: [
            "Article 10(2): data governance and management practices for training, validation, and testing data.",
            "Article 10(2)(h): identification of relevant data gaps or shortcomings and how they can be addressed.",
            "Article 10(3): dataset relevance, representativeness, completeness, and statistical properties.",
        ],
        coverage: "The summary consolidates metadata, indicators, visualizations, and warnings into a review artefact. It supports documentation and traceability across the governance perspectives so that reviewers can inspect where potential concerns were identified.",
        scope: COMMON_SCOPE_NOTE,
    },
};
