// suggestionTermsIndex.ts
// รวม suggestion terms ทั้งหมดไว้ในที่เดียว เพื่อ preload และ optimize การเข้าถึง

import { SMART_CAB_SUGGESTION_TERMS } from './smartCabSuggestionTerms';
import { LEFT_ORIGINAL_SUGGESTION_TERMS } from './leftOriginalSuggestionTerms';
import { MOVE_STEERING_SUGGESTION_TERMS } from './moveSteeringSuggestionTerms';
import { LAO_CENTER_SUGGESTION_TERMS } from './laoCenterSuggestionTerms';
import { CHAMP_SUGGESTION_TERMS } from './champSuggestionTerms';
import { ROCCO_SUGGESTION_TERMS } from './roccoSuggestionTerms';
import { VXR_SUGGESTION_TERMS } from './vxrSuggestionTerms';
import { TEIY_SUGGESTION_TERMS } from './teiySuggestionTerms';
import { LEGENDER_SUGGESTION_TERMS } from './legenderSuggestionTerms';
import { KAPUK_SUGGESTION_TERMS } from './kapukSuggestionTerms';
import { AUTO_SUGGESTION_TERMS } from './autoSuggestionTerms';
import { PHOVIN_SUGGESTION_TERMS } from './phovinSuggestionTerms';
import { KATHEIY_SUGGESTION_TERMS } from './katheiySuggestionTerms';
import { ADVENTURE_SUGGESTION_TERMS } from './adventureSuggestionTerms';
import { FULL_OPTION_SUGGESTION_TERMS } from './fullOptionSuggestionTerms';
import { TAENG_SOM_SUGGESTION_TERMS } from './taengSomSuggestionTerms';

export const ALL_SUGGESTION_TERMS: string[] = [
  ...SMART_CAB_SUGGESTION_TERMS,
  ...LEFT_ORIGINAL_SUGGESTION_TERMS,
  ...MOVE_STEERING_SUGGESTION_TERMS,
  ...LAO_CENTER_SUGGESTION_TERMS,
  ...CHAMP_SUGGESTION_TERMS,
  ...ROCCO_SUGGESTION_TERMS,
  ...VXR_SUGGESTION_TERMS,
  ...TEIY_SUGGESTION_TERMS,
  ...LEGENDER_SUGGESTION_TERMS,
  ...KAPUK_SUGGESTION_TERMS,
  ...AUTO_SUGGESTION_TERMS,
  ...PHOVIN_SUGGESTION_TERMS,
  ...KATHEIY_SUGGESTION_TERMS,
  ...ADVENTURE_SUGGESTION_TERMS,
  ...FULL_OPTION_SUGGESTION_TERMS,
  ...TAENG_SOM_SUGGESTION_TERMS,
];

export const ALL_SUGGESTION_TERMS_SET = new Set(ALL_SUGGESTION_TERMS);
