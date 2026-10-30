import type { Report } from "@/lib/types";

import published from "./samples.json";

/** Real reports published with the site. Written by eval/publish.ts. */
export const SAMPLES = published as unknown as Report[];
