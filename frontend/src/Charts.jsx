import {
    BarChart, Bar, LineChart, Line,
    XAxis, YAxis, CartesianGrid, Tooltip,
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
