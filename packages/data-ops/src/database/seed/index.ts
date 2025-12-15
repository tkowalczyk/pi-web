import { importer } from './importer';

const year = '2025';
const dataDir = `../../.data-to-import/${year}`;

importer(dataDir)
  .then(() => {
    console.log('✓ Import complete');
    process.exit(0);
  })
  .catch((err) => {
    console.error('✗ Import failed:', err.message);
    process.exit(1);
  });
