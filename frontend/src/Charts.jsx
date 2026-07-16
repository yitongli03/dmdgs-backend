import {
    BarChart, Bar, LineChart, Line,
    AreaChart, Area,
    XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
    ResponsiveContainer, Cell,
} from "recharts";
import { formatNumber } from "./utils";

const DISTINCT_COLORS = [
    "#2563eb", "#dc2626", "#16a34a", "#9333ea",
    "#ea580c", "#0891b2", "#ca8a04", "#be123c",
    "#4f46e5", "#0f766e", "#7c2d12", "#7e22ce",
    "#0369a1", "#65a30d", "#c2410c", "#475569",
    "#db2777", "#15803d", "#1d4ed8", "#854d0e",
];

const TIME_LANDMARK_SECONDS = [1, 10, 60, 600, 3600, 21600, 86400, 604800, 2592000, 31536000];
const TIME_LANDMARK_AXIS_VALUES = new Set(TIME_LANDMARK_SECONDS.map((s) => s + 1));

function createLocalColorMap(labels = []) {
    return Object.fromEntries(
        labels.map((label, index) => [
            String(label),
            DISTINCT_COLORS[index % DISTINCT_COLORS.length],
        ])
    );
}

function truncateLabel(value, maxLength = 28) {
    const label = String(value);

    if (label.length <= maxLength) {
        return label;
    }

    return `${label.slice(0, maxLength - 1)}...`;
}

function ChartTooltip({ active, payload, label }) {
    if (!active || !payload?.length) {
        return null;
    }

    return (
        <div className="chart-tooltip">
            <p>{label}</p>
            <strong>{Number(payload[0].value).toFixed(3)}</strong>
        </div>
    );
}

function DurationTooltip({ active, payload }) {
    if (!active || !payload?.length) return null;

    const point = payload[0].payload;

    if (point.is_anchor) return null;

    return (
        <div className="chart-tooltip">
            <p>{point.range_label}</p>
            <strong>{point.case_count} cases</strong>
        </div>
    );
}

export function CategoricalChart({ featureName, featureData, showTitle = true, colorMap = {}, helperText }) {
    const values = featureData?.values || {};
    const truncationText = featureData?.is_truncated
        ? "This chart shows the 5 most frequent and 5 least frequent items to keep the overview compact."
        : "";
    const chartHelperText = helperText || truncationText;

    if (Object.keys(values).length === 0) {
        return (
            <div style={{ marginBottom: "30px" }}>
                {showTitle && <h5>{featureName}</h5>}
                <p>Not available</p>
            </div>
        );
    }

    const chartData = Object.entries(values).map(([name, value]) => ({
        name,
        value: Number(value),
    }));
    const chartColorMap = {
        ...createLocalColorMap(chartData.map((item) => item.name)),
        ...colorMap,
    };

    return (
        <div className="chart-block">
            {showTitle && <h5>{featureName}</h5>}
            {chartHelperText && <p className="chart-helper">{chartHelperText}</p>}
            <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                        dataKey="name"
                        interval={0}
                        angle={-20}
                        textAnchor="end"
                        height={82}
                        tick={{ fontSize: 10, fill: "#64748b" }}
                        tickFormatter={(value) => truncateLabel(value)}
                    />
                    <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                    <Tooltip
                        content={<ChartTooltip />}
                        allowEscapeViewBox={{ x: false, y: true }}
                        wrapperStyle={{ zIndex: 30 }}
                    />
                    <Bar dataKey="value">
                        {chartData.map((item) => (
                            <Cell key={`cell-${item.name}`} fill={chartColorMap[item.name]} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

function formatDurationAxis(seconds) {
    if (!Number.isFinite(Number(seconds))) {
        return "";
    }

    const value = Number(seconds);
    if (value < 60) {
        return `${Math.round(value)}s`;
    }
    if (value < 3600) {
        return `${Math.round(value / 60)}m`;
    }
    if (value < 86400) {
        return `${Math.round(value / 3600)}h`;
    }
    return `${Math.round(value / 86400)}d`;
}

function formatDurationLabel(seconds) {
    if (!Number.isFinite(Number(seconds))) {
        return "";
    }

    const value = Number(seconds);
    if (value < 60) {
        return `${value.toFixed(0)}s`;
    }
    if (value < 3600) {
        return `${(value / 60).toFixed(1)}m`;
    }
    if (value < 86400) {
        return `${(value / 3600).toFixed(1)}h`;
    }
    return `${(value / 86400).toFixed(1)}d`;
}

export function DurationDistributionChart({ featureName, featureData, helperText, markerSeconds, medianSeconds, p95Seconds }) {
    const distribution = featureData?.distribution || [];
    const isBinnedCountDistribution = featureData?.type === "duration_binned_count_curve"
        && distribution.every((point) =>
            Number.isFinite(Number(point.duration_seconds))
            && Number(point.duration_seconds) >= 0
            && Number.isFinite(Number(point.range_start_seconds))
            && Number.isFinite(Number(point.range_end_seconds))
            && Number.isInteger(Number(point.case_count))
            && Number(point.case_count) >= 0
        );

    if (distribution.length === 0) {
        return (
            <div style={{ marginBottom: "30px" }}>
                <h5>{featureName}</h5>
                <p>Not available</p>
            </div>
        );
    }

    if (!isBinnedCountDistribution) {
        return (
            <div style={{ marginBottom: "30px" }}>
                <h5>{featureName}</h5>
                <p className="info-note">
                    This saved result uses an older duration-distribution format. Reprocess the dataset to view case counts by duration interval.
                </p>
            </div>
        );
    }

    const firstBin = distribution[0];
    const lastBin = distribution[distribution.length - 1];
    const domainMin = Math.max(0, Number(firstBin.range_start_seconds)) + 1;
    const domainMax = Number(lastBin.range_end_seconds) + 1;
    const xAxisDomain = domainMin === domainMax
        ? [Math.max(1, domainMin * 0.9), domainMax * 1.1]
        : [domainMin, domainMax];

    const naturalTicks = TIME_LANDMARK_SECONDS
        .map((s) => s + 1)
        .filter((v) => v > xAxisDomain[0] && v < xAxisDomain[1]);
    const xAxisTicks = naturalTicks.length > 0 ? naturalTicks : xAxisDomain;

    const chartData = [
        { duration_axis_value: domainMin, case_count: 0, is_anchor: true },
        ...distribution.map((point) => ({
            ...point,
            duration_axis_value: Number(point.duration_seconds) + 1,
            is_anchor: false,
        })),
        { duration_axis_value: domainMax, case_count: 0, is_anchor: true },
    ];

    const hasMean = markerSeconds !== null
        && markerSeconds !== undefined
        && Number.isFinite(Number(markerSeconds));
    const meanAxisValue = Number(markerSeconds) + 1;
    const meanLabel = hasMean ? `Mean: ${formatDurationLabel(Number(markerSeconds))}` : "";

    const hasMedian = medianSeconds !== null
        && medianSeconds !== undefined
        && Number.isFinite(Number(medianSeconds));
    const medianAxisValue = Number(medianSeconds) + 1;
    const medianLabel = hasMedian ? `Median: ${formatDurationLabel(Number(medianSeconds))}` : "";

    const hasP95 = p95Seconds !== null
        && p95Seconds !== undefined
        && Number.isFinite(Number(p95Seconds));
    const p95AxisValue = Number(p95Seconds) + 1;
    const p95Label = hasP95 ? `P95: ${formatDurationLabel(Number(p95Seconds))}` : "";

    return (
        <div className="chart-block">
            <h5>{featureName}</h5>
            {helperText && <p className="chart-helper">{helperText}</p>}
            <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                        dataKey="duration_axis_value"
                        type="number"
                        scale="log"
                        domain={xAxisDomain}
                        ticks={xAxisTicks}
                        height={68}
                        tick={{ fontSize: 11, fill: "#64748b" }}
                        label={{
                            value: "Case duration",
                            position: "insideBottom",
                            offset: -2,
                            fill: "#64748b",
                        }}
                        tickFormatter={(value) => {
                            const seconds = Number(value) - 1;
                            return TIME_LANDMARK_AXIS_VALUES.has(value)
                                ? formatDurationAxis(seconds)
                                : formatDurationLabel(seconds);
                        }}
                    />
                    <YAxis
                        allowDecimals={false}
                        domain={[0, "auto"]}
                        tick={{ fontSize: 11, fill: "#64748b" }}
                        label={{ value: "Cases", angle: -90, position: "insideLeft", fill: "#64748b" }}
                    />
                    <Tooltip content={<DurationTooltip />} />
                    {hasMedian && (
                        <ReferenceLine
                            x={medianAxisValue}
                            stroke="#16a34a"
                            strokeDasharray="4 4"
                            label={{ value: medianLabel, position: "insideTop", dy: 18, fill: "#16a34a", fontSize: 10 }}
                        />
                    )}
                    {hasMean && (
                        <ReferenceLine
                            x={meanAxisValue}
                            stroke="#dc2626"
                            strokeDasharray="4 4"
                            label={{ value: meanLabel, position: "insideTop", dy: 4, fill: "#dc2626", fontSize: 10 }}
                        />
                    )}
                    {hasP95 && (
                        <ReferenceLine
                            x={p95AxisValue}
                            stroke="#ea580c"
                            strokeDasharray="4 4"
                            label={{ value: p95Label, position: "insideTop", dy: 32, fill: "#ea580c", fontSize: 10 }}
                        />
                    )}
                    <Area
                        type="linear"
                        dataKey="case_count"
                        stroke="#2563eb"
                        fill="#2563eb"
                        fillOpacity={0.15}
                        strokeWidth={1.5}
                        dot={{ r: 2.5, fill: "#2563eb" }}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}

export function NumericChart({ featureName, featureData }) {
    const chartData = featureData?.distribution || [];

    if (chartData.length === 0) {
        return (
            <div style={{ marginBottom: "30px" }}>
                <h5>{featureName}</h5>
                <p>Not available</p>
            </div>
        );
    }

    return (
        <div style={{ marginBottom: "30px" }}>
            <h5>{featureName}</h5>
            <p>
                <strong>Min:</strong> {formatNumber(featureData.min)}{" "}
                <strong>Mean:</strong> {formatNumber(featureData.mean)}{" "}
                <strong>Max:</strong> {formatNumber(featureData.max)}
            </p>
            <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="index" tick={{ fontSize: 11, fill: "#64748b" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2} dot={false} />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}

export function FeatureDistributions({ obj, showIntro = true }) {
    if (!obj || Object.keys(obj).length === 0) {
        return <p>Not available</p>;
    }

    const renderFeatureChart = (featureName, featureData) => {
        if (featureData?.type === "numeric") {
            return <NumericChart featureName={featureName} featureData={featureData} />;
        }
        if (featureData?.type === "categorical") {
            return <CategoricalChart featureName={featureName} featureData={featureData} />;
        }
        // fallback for old backend responses
        if (featureData && typeof featureData === "object" && "min" in featureData && "max" in featureData && "mean" in featureData) {
            return <NumericChart featureName={featureName} featureData={{
                type: "numeric",
                min: featureData.min,
                max: featureData.max,
                mean: featureData.mean,
                distribution: [
                    { index: 0, value: featureData.min },
                    { index: 1, value: featureData.mean },
                    { index: 2, value: featureData.max },
                ],
            }} />;
        }
        return <CategoricalChart featureName={featureName} featureData={{ type: "categorical", values: featureData }} />;
    };

    return (
        <div>
            {showIntro && (
                <p className="section-copy" style={{ marginBottom: "12px" }}>
                    Expand a feature to inspect its distribution.
                </p>
            )}
            {Object.entries(obj).map(([featureName, featureData]) => (
                <details
                    key={featureName}
                    className="feature-detail"
                >
                    <summary>{featureName}</summary>
                    <div style={{ marginTop: "15px" }}>
                        {renderFeatureChart(featureName, featureData)}
                    </div>
                </details>
            ))}
        </div>
    );
}
