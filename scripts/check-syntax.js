const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function checkFile(filePath, isModule = false) {
    if (isModule) {
        const content = fs.readFileSync(filePath);
        execFileSync(process.execPath, ['--input-type=module', '--check'], {
            input: content,
            stdio: ['pipe', 'inherit', 'inherit']
        });
    } else {
        execFileSync(process.execPath, ['--check', filePath], {
            stdio: 'inherit'
        });
    }
}

function getFiles(dir, filter = /\.js$/) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
        .filter(f => filter.test(f))
        .map(f => path.join(dir, f));
}

let count = 0;

// public/js/*.js (ES modules)
for (const file of getFiles('public/js')) {
    checkFile(file, true);
    count++;
}

// public/sw.js (Service Worker script)
if (fs.existsSync('public/sw.js')) {
    checkFile('public/sw.js', false);
    count++;
}

// src/*.js, src/*/*.js, tests/*.js, tests/browser/*.js, scripts/*.js
const cjsDirs = ['src', 'src/middleware', 'src/routes', 'src/sockets', 'tests', 'tests/browser', 'scripts'];
for (const dir of cjsDirs) {
    for (const file of getFiles(dir)) {
        checkFile(file, false);
        count++;
    }
}

console.log(`✓ Syntax check passed for ${count} JavaScript files.`);
