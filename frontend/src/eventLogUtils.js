export const EVENT_LOG_FEATURES = [
    "Event-log case duration summary",
    "Event-log activity distribution",
    "Event-log top activity transitions",
    "Event-log process variants",
    "Event-log drift-oriented signals",
];

const EVENT_LOG_COLUMN_PATTERNS = {
    caseId: ["case id", "case", "ticket id", "process id"],
    activity: ["activity", "event", "action", "task"],
    timestamp: ["timestamp", "time", "complete timestamp", "date"],
};

export function normalizeColumnName(columnName) {
    return String(columnName)
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

export function detectEventLogColumns(columns = []) {
    const detected = {
        caseId: null,
        activity: null,
        timestamp: null,
    };

    columns.forEach((column) => {
        const normalized = normalizeColumnName(column);

        Object.entries(EVENT_LOG_COLUMN_PATTERNS).forEach(([role, patterns]) => {
            if (!detected[role] && patterns.includes(normalized)) {
                detected[role] = column;
            }
        });
    });

    return detected;
}

export function isTargetActivityColumn(result) {
    const taskType = normalizeColumnName(result.metadata?.task_type || "");
    const targetColumn = normalizeColumnName(result.metadata?.target_column || "");
    const columns = result.schema_info?.columns || [];
    const detected = detectEventLogColumns(columns);
    const activityColumn = normalizeColumnName(detected.activity || "");

    return taskType === "classification" && targetColumn && targetColumn === activityColumn;
}
