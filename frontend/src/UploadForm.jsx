import { useState } from "react";
import axios from "axios";
import { convertDatasetDocumentToResult } from "./utils";

const API_URL = "http://localhost:5002";

function UploadForm({ onResult }) {
    const [file, setFile] = useState(null);
    const [datasets, setDatasets] = useState([]);
    const [searchId, setSearchId] = useState("");
    const [datasetNameFilter, setDatasetNameFilter] = useState("");
    const [showDatasetList, setShowDatasetList] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoadingDatasets, setIsLoadingDatasets] = useState(false);

    const [form, setForm] = useState({
        dataset_name: "",
        origin: "",
        intended_use: "",
        task_type: "other",
        preprocessing_steps: "",
        target_column: "",
        deployment_context: "",
        domain: "",
        contains_personal_data: false,
        privacy_notes: "",
    });

    const isFormValid =
        file &&
        form.dataset_name &&
        form.origin &&
        form.intended_use &&
        form.task_type;

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm({ ...form, [name]: type === "checkbox" ? checked : value });
    };

    const loadDatasets = async () => {
        setIsLoadingDatasets(true);
        try {
            const response = await axios.get(`${API_URL}/datasets`);
            setDatasets(response.data);
        } catch (error) {
            console.error("Load datasets error:", error);
            alert("Could not load stored datasets.");
        } finally {
            setIsLoadingDatasets(false);
        }
    };

    const loadDatasetById = async (datasetId) => {
        try {
            const response = await axios.get(`${API_URL}/datasets/${datasetId}`);
            onResult(convertDatasetDocumentToResult(response.data));
        } catch (error) {
            console.error("Load dataset error:", error);
            alert(error.response?.data?.detail || "Could not retrieve dataset.");
        }
    };

    const searchDatasetById = async () => {
        if (!searchId.trim()) {
            alert("Please enter a dataset ID.");
            return;
        }
        await loadDatasetById(searchId.trim());
    };

    const filteredDatasets = datasets
        .filter((dataset) =>
            (dataset.metadata?.dataset_name || "")
                .toLowerCase()
                .includes(datasetNameFilter.toLowerCase())
        )
        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!file) {
            alert("Please choose a CSV file first.");
            return;
        }

        const formData = new FormData();
        formData.append("file", file);
        Object.entries(form).forEach(([key, value]) => {
            formData.append(key, value);
        });

        setIsSubmitting(true);
        try {
            const response = await axios.post(`${API_URL}/datasets/upload`, formData);
            onResult(convertDatasetDocumentToResult(response.data.dataset));
            await loadDatasets();
        } catch (error) {
            console.error("Upload error:", error);
            alert(error.response?.data?.detail || "Upload failed. Please check backend and input data.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div>
            <form onSubmit={handleSubmit} className="card">
                <div className="assessment-header">
                    <div>
                        <p className="eyebrow">New Assessment</p>
                        <h3>Upload Dataset</h3>
                        <p className="section-copy">
                            Required fields define the purpose of the dataset. Optional fields improve suitability and privacy review.
                        </p>
                    </div>
                </div>

                <div className="form-field full-width" style={{ marginBottom: "16px" }}>
                    <label className="field-label">CSV file *</label>
                    <input
                        type="file"
                        accept=".csv"
                        onChange={(e) => setFile(e.target.files[0])}
                    />
                </div>

                <h3>Required Information</h3>

                <div className="form-grid">
                    <label className="form-field">
                        <span className="field-label">Dataset name *</span>
                        <input name="dataset_name" value={form.dataset_name} onChange={handleChange} />
                    </label>

                    <label className="form-field">
                        <span className="field-label">Origin *</span>
                        <input name="origin" value={form.origin} onChange={handleChange} />
                    </label>

                    <label className="form-field full-width">
                        <span className="field-label">Intended use *</span>
                        <input name="intended_use" value={form.intended_use} onChange={handleChange} />
                        <span className="field-help">Example: training a classifier for loan-risk screening in a banking workflow.</span>
                    </label>

                    <label className="form-field">
                        <span className="field-label">Task type *</span>
                        <select name="task_type" value={form.task_type} onChange={handleChange}>
                            <option value="other">Other</option>
                            <option value="classification">Classification</option>
                            <option value="regression">Regression</option>
                            <option value="clustering">Clustering</option>
                        </select>
                    </label>
                </div>

                <h3 className="form-section-heading">Optional Information</h3>

                <div className="form-grid">
                    <label className="form-field">
                        <span className="field-label">Target column name</span>
                        <input name="target_column" value={form.target_column} onChange={handleChange} />
                    </label>

                    <label className="form-field">
                        <span className="field-label">Deployment context</span>
                        <input name="deployment_context" value={form.deployment_context} onChange={handleChange} />
                    </label>

                    <label className="form-field">
                        <span className="field-label">Domain</span>
                        <input name="domain" value={form.domain} onChange={handleChange} />
                    </label>

                    <label className="form-field">
                        <span className="field-label">Preprocessing steps</span>
                        <input name="preprocessing_steps" value={form.preprocessing_steps} onChange={handleChange} />
                    </label>

                    <label className="form-field full-width">
                        <span className="field-label">
                            <input
                                type="checkbox"
                                name="contains_personal_data"
                                checked={form.contains_personal_data}
                                onChange={handleChange}
                                style={{ marginRight: "8px" }}
                            />
                            Dataset contains personal data
                        </span>
                    </label>

                    <label className="form-field full-width">
                        <span className="field-label">Privacy notes</span>
                        <textarea
                            name="privacy_notes"
                            value={form.privacy_notes}
                            onChange={handleChange}
                            rows="3"
                        />
                    </label>
                </div>

                <button type="submit" disabled={!isFormValid || isSubmitting} style={{ marginTop: "18px" }}>
                    {isSubmitting ? "Analysing..." : "Upload & Analyse Dataset"}
                </button>
            </form>

            <div className="card">
                <h3>Stored Datasets</h3>

                <div className="search-row">
                    <input
                        placeholder="Search dataset by ID"
                        value={searchId}
                        onChange={(e) => setSearchId(e.target.value)}
                    />
                    <button type="button" onClick={searchDatasetById}>Search by ID</button>
                </div>

                <button
                    type="button"
                    onClick={async () => {
                        if (!showDatasetList && datasets.length === 0) {
                            await loadDatasets();
                        }
                        setShowDatasetList(!showDatasetList);
                    }}
                    disabled={isLoadingDatasets}
                >
                    {isLoadingDatasets ? "Loading..." : showDatasetList ? "Hide Stored Datasets" : "Load Stored Datasets"}
                </button>

                {showDatasetList && (
                    <div style={{ marginTop: "12px" }}>
                        <input
                            placeholder="Filter by dataset name"
                            value={datasetNameFilter}
                            onChange={(e) => setDatasetNameFilter(e.target.value)}
                            style={{ width: "100%", marginBottom: "10px" }}
                        />

                        {filteredDatasets.length > 0 ? (
                            <ul className="stored-dataset-list">
                                {filteredDatasets.map((dataset) => (
                                    <li key={dataset.dataset_id}>
                                        <button
                                            type="button"
                                            onClick={() => loadDatasetById(dataset.dataset_id)}
                                        >
                                            {dataset.metadata?.dataset_name || "Unnamed Dataset"}
                                        </button>
                                        <span style={{ marginLeft: "8px" }}>
                                            {dataset.metadata?.task_type || "unknown"} - {dataset.dataset_id}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p>No matching datasets found.</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default UploadForm;
