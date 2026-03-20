import fs from "fs";
import { profilesToConfig } from "./utils";
import { normalProfile } from "./profiles/normal";
import { programmingProfile } from "./profiles/programming";

const profiles = [normalProfile, programmingProfile];

fs.writeFileSync("karabiner.json", profilesToConfig(profiles));
