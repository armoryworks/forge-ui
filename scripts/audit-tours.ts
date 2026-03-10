import * as fs from 'fs';
import * as path from 'path';

const featuresDir = path.join(__dirname, '..', 'src', 'app', 'features');
const features = fs.readdirSync(featuresDir).filter(f =>
  fs.statSync(path.join(featuresDir, f)).isDirectory()
);

const results: { feature: string; hasTour: boolean }[] = [];

for (const feature of features) {
  const featureDir = path.join(featuresDir, feature);
  const files = getAllFiles(featureDir);
  const hasTour = files.some(file => {
    const content = fs.readFileSync(file, 'utf-8');
    return content.includes('TourService') || content.includes('HelpTourService') || content.includes('helpTourId');
  });
  results.push({ feature, hasTour });
}

console.log('\n=== Tour Coverage Audit ===\n');
const withTour = results.filter(r => r.hasTour);
const withoutTour = results.filter(r => !r.hasTour);

console.log(`Features WITH tours (${withTour.length}):`);
withTour.forEach(r => console.log(`  \u2713 ${r.feature}`));

console.log(`\nFeatures WITHOUT tours (${withoutTour.length}):`);
withoutTour.forEach(r => console.log(`  \u2717 ${r.feature}`));

console.log(`\nCoverage: ${withTour.length}/${results.length} (${Math.round(withTour.length / results.length * 100)}%)\n`);

function getAllFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllFiles(fullPath));
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}
