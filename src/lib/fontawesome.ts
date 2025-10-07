import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faBoltLightning,
  faFilePdf,
  faArrowRight,
  faCloudArrowUp,
  faTrash,
  faDownload,
} from "@fortawesome/free-solid-svg-icons";

type FontAwesomePrefix = "fas" | "fal";

type IconLookupMap = {
  [Prefix in FontAwesomePrefix]: Record<string, IconDefinition>;
};

export const byPrefixAndName: IconLookupMap = {
  fas: {
    "bolt-lightning": faBoltLightning,
    "file-pdf": faFilePdf,
    download: faDownload,
  },
  fal: {
    "arrow-right": faArrowRight,
    "cloud-arrow-up": faCloudArrowUp,
    trash: faTrash,
  },
};
