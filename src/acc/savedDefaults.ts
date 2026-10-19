import gtaaAccMetadata from "@/acc/defaults/GTAA.acc-metadata.json";
import { rememberAccMetadataDocument } from "@/acc/attributeCache";

/** The Resolve ACC download for folder GTAA, kept so the next load does not call APS again. */
const GTAA_SAVED_AT = "2026-10-18T15:59:46.000Z";

export function installSavedAccMetadataDefaults(): number {
  return rememberAccMetadataDocument(gtaaAccMetadata, "GTAA", GTAA_SAVED_AT);
}
