import { KarabinerRules, Profile } from "../types";
import { doubleTap, open } from "../utils";

const rules: KarabinerRules[] = [
  doubleTap("t", open("https://youtube.com")),
];

export const testProfile: Profile = {
  name: "Test",
  complex_modifications: { rules },
};
