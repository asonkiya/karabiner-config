import fs from "fs";
import { profilesToConfig } from "./utils";
import { normalProfile } from "./profiles/normal";

// One unified profile. "Modes" (Programming / Reading / Trivia) are now
// variable-based and gated inside this single profile, so switching between
// them is an instant variable flip instead of a slow profile reload.
const profiles = [normalProfile];

fs.writeFileSync("karabiner.json", profilesToConfig(profiles));
