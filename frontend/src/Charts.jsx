import {
    BarChart, Bar, LineChart, Line,
    XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Cell,
} from "recharts";
import { formatNumber } from "./utils";

const COLORS = [
    "#2563eb", "#0f766e", "#b45309", "#7c3aed",
    "#be123c", "#0891b2", "#4d7c0f", "#9333ea",
    "#475569", "#ca8a04",
];

export function CategoricalChart({ featureName, featureData }) {
    const values = featureData?.values || {};

    if (Object.keys(values).length === 0) {
        return (
            <div style={{ marginBottom: "30px" }}>
                <h5>{featureName}</h5>
                <p>Not available</p>
            </div>
        );
    }

    const chartData = Object.entries(values).map(([name, value]) => ({
        name,
        value: Number(value),
    }));

    return (
        <div style={{ marginBottom: "30px" }}>
            <h5>{featureName}</h5>
            <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                        dataKey="name"
                        interval={0}
                        angle={-20}
                        textAnchor="end"
                        height={74}
                        tick={{ fontSize: 11, fill: "#64748b" }}
                    />
                    <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                    <Tooltip />
                    <Bar dataKey="value">
                        {chartData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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

export function FeatureDistributions({ obj }) {
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
            <p className="section-copy" style={{ marginBottom: "12px" }}>Expand a feature to inspect its distribution.</p>
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
