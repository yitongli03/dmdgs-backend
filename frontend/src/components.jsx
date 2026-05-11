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
        return <StatusBadge status="ok" label="No issues detected" />;
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
                label={hasWarnings ? `${warnings.length} review item${warnings.length === 1 ? "" : "s"}` : "Clear"}
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
