import fs from "fs";
import { profilesToConfig } from "./utils";
import { normalProfile } from "./profiles/normal";
import { programmingProfile } from "./profiles/programming";
import { readingProfile } from "./profiles/reading";
import { triviaProfile } from "./profiles/trivia";

const profiles = [normalProfile, programmingProfile, readingProfile, triviaProfile];

fs.writeFileSync("karabiner.json", profilesToConfig(profiles));
