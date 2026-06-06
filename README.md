# DMDGS Dataset Governance Tool

DMDGS is a thesis prototype for supporting dataset governance under EU AI Act Article 10. It provides a guided workflow for uploading CSV datasets or XES event logs, entering contextual metadata, and reviewing dataset-level signals across four evaluation perspectives:

- Data quality
- Suitability and contextual alignment
- Bias awareness
- Privacy considerations

The evaluation methods are developed in the thesis with orientation from relevant ISO concepts. The tool is intended as decision support for human review, not as an automated compliance decision.

## Project Structure

```text
.
├── frontend/                  # React/Vite frontend
├── src/communication/          # FastAPI backend service
│   ├── routes/                 # API routes
│   ├── services/               # Evaluation logic
│   ├── models/                 # Data models
│   └── database_connector/     # MongoDB connection
└── uploads/                    # Local uploaded files, ignored by Git
```

## Backend

The backend is implemented with FastAPI. The main dataset endpoints are:

- `POST /datasets/upload`
- `GET /datasets`
- `GET /datasets/{dataset_id}`

Uploaded CSV/XES files are stored locally in `uploads/`, while structured dataset documents and governance outputs are stored in MongoDB. XES event logs are converted into a tabular representation before the existing governance checks are applied.

### Backend Environment

Create a local `.env` file in the project root:

```text
ATLAS_URI=<your MongoDB Atlas connection string>
DB_NAME=dmdgs_db
```

Do not commit `.env` files. They are ignored by Git.

### Run Backend Locally

From the project root:

```bash
cd src
python3 -m uvicorn communication.run_backend:app --host 0.0.0.0 --port 5002 --reload
```

## Frontend

The frontend is implemented with React and Vite. It communicates with the backend at:

```text
http://localhost:5002
```

### Run Frontend Locally

```bash
cd frontend
npm install
npm run dev
```

Then open:

```text
http://127.0.0.1:5173/
```

## Prototype Scope

This prototype currently supports CSV datasets with header rows and XES event logs that can be represented as tabular event data. XES import is treated as an input-conversion step; the governance evaluation itself still uses the same tabular dataset document structure. The prototype does not implement user authentication, dataset ownership, access control, or dataset versioning. Stored datasets are kept in a shared MongoDB collection and are intended for controlled/local testing environments.

Privacy detection is heuristic and based on user input plus column-name patterns. Bias analysis is dataset-level only and does not compute model fairness metrics.

## Git Notes

The repository ignores:

- `.env` and local environment files
- uploaded datasets in `uploads/`
- frontend dependencies and build output
- Python cache files
- local OS/editor files
