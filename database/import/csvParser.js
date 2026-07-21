const fs = require('fs');
const path = require('path');

function parseCsv(content) {
    const lines = content.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
    if (!lines.length) return [];

    let headerLine = lines[0];
    if (headerLine.startsWith('#')) {
        headerLine = headerLine.replace(/^#\s*/, '');
    }

    const headers = splitCsvLine(headerLine).map((h) => h.trim());
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith('#')) continue;

        const values = splitCsvLine(line);
        const row = {};
        headers.forEach((h, idx) => {
            row[h] = (values[idx] ?? '').trim();
        });
        rows.push(row);
    }
    return rows;
}

function splitCsvLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            inQuotes = !inQuotes;
        } else if (ch === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += ch;
        }
    }
    result.push(current);
    return result.map((v) => v.replace(/^"|"$/g, '').trim());
}

function readCsvFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    return parseCsv(content);
}

function fileHashSimple(content) {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
        hash = ((hash << 5) - hash) + content.charCodeAt(i);
        hash |= 0;
    }
    return `fnv-${Math.abs(hash)}`;
}

module.exports = { parseCsv, readCsvFile, fileHashSimple };
