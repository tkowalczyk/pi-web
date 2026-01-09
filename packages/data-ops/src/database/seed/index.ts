import { importer } from './importer';

const dataDir = `../../.data-to-import/raw`;

importer(dataDir)
  .then(() => {
    console.log('✓ Import complete');
    process.exit(0);
  })
  .catch((err) => {
    console.error('✗ Import failed:', err.message);
    process.exit(1);
  });
