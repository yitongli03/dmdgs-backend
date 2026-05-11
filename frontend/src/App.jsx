import { useState } from "react";
import UploadForm from "./UploadForm";
import DatasetInfoPage from "./pages/DatasetInfoPage";
import QualityPage from "./pages/QualityPage";
import SuitabilityPage from "./pages/SuitabilityPage";
import BiasPage from "./pages/BiasPage";
import PrivacyPage from "./pages/PrivacyPage";
import SummaryPage from "./pages/SummaryPage";

const STEPS = [
    { id: "info", label: "Dataset Info" },
    { id: "quality", label: "Data Quality" },
    { id: "suitability", label: "Suitability" },
    { id: "bias", label: "Bias Awareness" },
    { id: "privacy", label: "Privacy" },
    { id: "summary", label: "Summary" },
];

function StepIndicator({ currentPage }) {
    const currentIndex = STEPS.findIndex((s) => s.id === currentPage);
    if (currentIndex === -1) return null;

    return (
        <div className="step-indicator" aria-label="Assessment progress">
            {STEPS.map((step, i) => (
                <span key={step.id} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span
                        className={`step-chip ${i === currentIndex ? "is-active" : ""} ${i < currentIndex ? "is-complete" : ""}`}
                    >
                        {i + 1}. {step.label}
                    </span>
                    {i < STEPS.length - 1 && (
                        <span className="step-separator">/</span>
                    )}
                </span>
            ))}
        </div>
    );
}

function App() {
    const [result, setResult] = useState(null);
    const [currentPage, setCurrentPage] = useState("home");

    const goTo = (page) => {
        setCurrentPage(page);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleResult = (data) => {
        setResult(data);
        goTo("info");
    };

    const goHome = () => {
        setResult(null);
        goTo("home");
    };

    const pageProps = { result, goTo, goHome };

    return (
        <div className="app-shell">
            <header className="app-header">
                <h1>DMDGS Dataset Governance Tool</h1>
                <p className="app-subtitle">
                    Supports dataset governance under EU AI Act Article 10 by turning assessment criteria developed in the thesis into a structured review workflow.
                    The evaluation perspectives cover data quality, contextual suitability, bias awareness, and privacy considerations, with orientation from relevant ISO concepts.
                </p>
            </header>

            {currentPage !== "home" && result && (
                <p className="dataset-context">
                    <strong>{result.metadata?.dataset_name || result.dataset_id}</strong>
                </p>
            )}

            <StepIndicator currentPage={currentPage} />

            {currentPage === "home" && (
                <>
                    <p className="section-copy">
                        Upload a CSV and describe its intended use. The tool applies the derived evaluation methods and produces a transparent governance report for human review.
                    </p>
                    <UploadForm onResult={handleResult} />
                </>
            )}
            {currentPage === "info" && (
                <DatasetInfoPage {...pageProps} onContinue={() => goTo("quality")} onBack={goHome} />
            )}
            {currentPage === "quality" && (
                <QualityPage {...pageProps} onContinue={() => goTo("suitability")} onBack={() => goTo("info")} />
            )}
            {currentPage === "suitability" && (
                <SuitabilityPage {...pageProps} onContinue={() => goTo("bias")} onBack={() => goTo("quality")} />
            )}
            {currentPage === "bias" && (
                <BiasPage {...pageProps} onContinue={() => goTo("privacy")} onBack={() => goTo("suitability")} />
            )}
            {currentPage === "privacy" && (
                <PrivacyPage {...pageProps} onContinue={() => goTo("summary")} onBack={() => goTo("bias")} />
            )}
            {currentPage === "summary" && (
                <SummaryPage {...pageProps} onBack={() => goTo("privacy")} />
            )}
        </div>
    );
}

export default App;
