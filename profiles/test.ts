import { KarabinerRules, Profile } from "../types";
import { doubleTap, open, createHyperSubLayers, switchProfile } from "../utils";

const rules: KarabinerRules[] = [
  doubleTap("t", open("https://youtube.com")),
  ...createHyperSubLayers({
    m: switchProfile("Normal Mode"),
  }),
];

export const testProfile: Profile = {
  name: "Test",
  complex_modifications: { rules },
};
