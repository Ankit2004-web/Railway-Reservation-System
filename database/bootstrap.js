const path = require('path');

const backendModules = path.join(__dirname, '../backend/node_modules');

const requireFromBackend = (packageName) => require(path.join(backendModules, packageName));

requireFromBackend('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

module.exports = {
    backendModules,
    requireFromBackend
};
