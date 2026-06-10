import { useState } from "react";

export function InfoTooltip({ text }) {
    const [visible, setVisible] = useState(false);
    return (
        <span className="tooltip-wrap">
            <button
                type="button"
                aria-label="Show explanation"
                className="tooltip-trigger"
                onMouseEnter={() => setVisible(true)}
                onMouseLeave={() => setVisible(false)}
                onFocus={() => setVisible(true)}
                onBlur={() => setVisible(false)}
            >
                i
            </button>
            {visible && (
                <span className="tooltip-panel" role="tooltip">
                    {text}
                </span>
            )}
        </span>
    );
}

export function StatusBadge({ status = "neutral", label }) {
    return <span className={`status-badge status-${status}`}>{label}</span>;
}

export function WarningList({ warnings = [] }) {
    if (!warnings.length) {
        return <StatusBadge status="ok" label="No warnings" />;
    }

    return (
        <ul className="warning-list">
            {warnings.map((warning, index) => (
                <li key={`${warning}-${index}`}>{warning}</li>
            ))}
        </ul>
    );
}

export function MetricTile({ label, value, helper, status = "neutral" }) {
    return (
        <div className="metric-tile">
            <span className="metric-label">
                {label}
                {helper && <InfoTooltip text={helper} />}
            </span>
            <strong className={`metric-value metric-${status}`}>{value}</strong>
        </div>
    );
}

export function AssessmentHeader({ title, eyebrow = "Evaluation perspective", children, warnings = [] }) {
    const hasWarnings = warnings.length > 0;

    return (
        <div className="assessment-header">
            <div>
                <p className="eyebrow">{eyebrow}</p>
                <h3>{title}</h3>
                {children && <p className="section-copy">{children}</p>}
            </div>
            <StatusBadge
                status={hasWarnings ? "warning" : "ok"}
                label={hasWarnings ? `${warnings.length} warning${warnings.length === 1 ? "" : "s"}` : "OK"}
            />
        </div>
    );
}

export function MethodExplanation({ title, computes, how, why }) {
    return (
        <details className="method-note">
            <summary>
                <span>{title}</span>
                <small>{computes}</small>
            </summary>
            <dl>
                <div>
                    <dt>How it works</dt>
                    <dd>{how}</dd>
                </div>
                <div>
                    <dt>Why it is included</dt>
                    <dd>{why}</dd>
                </div>
            </dl>
        </details>
    );
}

export function ArticleReference({ references = [], coverage, scope }) {
    const [open, setOpen] = useState(false);

    return (
        <div className="article-reference">
            <button
                type="button"
                className="button-secondary article-reference-button"
                onClick={() => setOpen(!open)}
                aria-expanded={open}
            >
                <span className="article-reference-icon">i</span>
                Article 10 reference
            </button>

            {open && (
                <div className="article-reference-panel">
                    <div>
                        <p><strong>Relevant Article 10 points</strong></p>
                        <ul>
                            {references.map((reference) => (
                                <li key={reference}>{reference}</li>
                            ))}
                        </ul>
                    </div>
                    {coverage && (
                        <div>
                            <p><strong>How this perspective supports review</strong></p>
                            <p>{coverage}</p>
                        </div>
                    )}
                    {scope && (
                        <div>
                            <p><strong>Scope</strong></p>
                            <p>{scope}</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
