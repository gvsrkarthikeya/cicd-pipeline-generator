import { getFileTree, getKeyFiles } from './lib/github.js';

const testRepo = 'https://github.com/expressjs/express';

console.log('Testing file tree fetch...');
const tree = await getFileTree(testRepo, 'master');
console.log(`Found ${tree.length} files`);
console.log('Sample files:', tree.slice(0, 10));

console.log('\nTesting key files fetch...');
const keyFiles = await getKeyFiles(testRepo, 'master');
console.log('Key files found:', Object.keys(keyFiles));