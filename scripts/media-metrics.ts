/**
 * Dump current media kit metrics as JSON (for CI/automation checks).
 *
 *   npm run media:metrics
 */
import { getMediaKitSnapshot } from '../src/lib/mediaKit';

async function main() {
  const snapshot = await getMediaKitSnapshot();
  console.log(JSON.stringify(snapshot, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
