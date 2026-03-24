import fs from "fs";
import { profilesToConfig } from "./utils";
import { normalProfile } from "./profiles/normal";
import { programmingProfile } from "./profiles/programming";
import { readingProfile } from "./profiles/reading";

const profiles = [normalProfile, programmingProfile, readingProfile];

fs.writeFileSync("karabiner.json", profilesToConfig(profiles));
