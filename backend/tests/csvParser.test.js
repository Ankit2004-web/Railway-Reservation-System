const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { parseCsv } = require('../../database/import/csvParser');

describe('csvParser', () => {
    it('parses comment-prefixed header rows', () => {
        const csv = `# code,name,city
NDLS,New Delhi,Delhi
BCT,Mumbai CSMT,Mumbai`;
        const rows = parseCsv(csv);
        assert.equal(rows.length, 2);
        assert.equal(rows[0].code, 'NDLS');
        assert.equal(rows[0].name, 'New Delhi');
    });

    it('skips inline comment data lines', () => {
        const csv = `# code,name
NDLS,New Delhi
# comment line
BCT,Mumbai`;
        const rows = parseCsv(csv);
        assert.equal(rows.length, 2);
    });
});
